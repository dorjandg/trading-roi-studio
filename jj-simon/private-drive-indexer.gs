/**
 * JJ Academy private Drive transcript indexer — Apps Script source template.
 * Not deployed by committing this file. Runs under the owner's Google account.
 * Never publish the index sheet or expose transcript text through a public GET.
 *
 * Setup: create a private standalone Apps Script, paste this file, set
 * Script Properties:
 *   JJ_SOURCE_FOLDER_IDS = comma-separated owner-approved folder IDs
 *   JJ_INDEX_SHEET_ID = private Google Sheet ID
 * Run jjIndexDriveTranscripts() manually or add an hourly time trigger.
 * Supported: Google Docs and plain text/VTT/SRT Drive files.
 */
function jjIndexDriveTranscripts(){
  const p=PropertiesService.getScriptProperties();
  const ids=(p.getProperty('JJ_SOURCE_FOLDER_IDS')||'').split(',').map(x=>x.trim()).filter(Boolean);
  const sheetId=p.getProperty('JJ_INDEX_SHEET_ID');
  if(!ids.length||!sheetId)throw Error('Configure private source folder IDs and private index Sheet ID.');
  const book=SpreadsheetApp.openById(sheetId);
  let tab=book.getSheetByName('TranscriptIndex');
  if(!tab)tab=book.insertSheet('TranscriptIndex');
  if(tab.getLastRow()===0)tab.appendRow(['record_id','drive_file_id','file_title','modified_at','chunk_number','text','source_url','indexed_at']);
  const old=tab.getLastRow()>1?tab.getRange(2,1,tab.getLastRow()-1,4).getValues():[];
  const indexed=new Map();
  old.forEach(row=>indexed.set(String(row[1]),String(row[3])));
  let files=0,chunks=0,skipped=0;
  const startedAt=new Date().toISOString();
  for(const folderId of ids){
    const folder=DriveApp.getFolderById(folderId);
    const iterator=folder.getFiles();
    while(iterator.hasNext()){
      const file=iterator.next();
      const id=file.getId(),mime=file.getMimeType(),modified=file.getLastUpdated().toISOString();
      if(indexed.get(id)===modified){skipped++;continue}
      let raw='';
      if(mime==='application/vnd.google-apps.document')raw=DocumentApp.openById(id).getBody().getText();
      else if(mime==='text/plain'||/\.(txt|vtt|srt)$/i.test(file.getName()))raw=file.getBlob().getDataAsString('UTF-8');
      else {skipped++;continue}
      raw=raw.replace(/<[^>]*>/g,' ').replace(/\r/g,'').trim();
      if(!raw){skipped++;continue}
      // Remove stale chunks only for this file, leaving other indexed files intact.
      for(let row=tab.getLastRow();row>=2;row--)if(String(tab.getRange(row,2).getValue())===id)tab.deleteRow(row);
      const rows=[];
      for(let offset=0,n=0;offset<raw.length;offset+=1600,n++){
        const text=raw.slice(offset,offset+1900);
        if(text.trim().length<30)continue;
        rows.push([id+':'+n,id,file.getName(),modified,n,text,file.getUrl(),new Date().toISOString()]);
      }
      if(rows.length){
        tab.getRange(tab.getLastRow()+1,1,rows.length,8).setValues(rows);
        chunks+=rows.length;
      }
      files++;
    }
  }
  // Metadata only: no transcript text in status sheet.
  let status=book.getSheetByName('IndexStatus');
  if(!status)status=book.insertSheet('IndexStatus');
  status.clearContents();
  const records=Math.max(0,tab.getLastRow()-1);
  const allIds=records?tab.getRange(2,2,records,1).getValues().map(r=>String(r[0])):[];
  const metadata=[
    ['Metric','Value'],
    ['Last started (UTC)',startedAt],
    ['Last completed (UTC)',new Date().toISOString()],
    ['Files updated',files],
    ['Chunks written',chunks],
    ['Files skipped',skipped],
    ['Indexed files',new Set(allIds).size],
    ['Indexed excerpts',records],
    ['Folder count',ids.length],
    ['Visibility','Private Google Sheet; no public transcript API']
  ];
  status.getRange(1,1,metadata.length,2).setValues(metadata);
  console.log(JSON.stringify({filesUpdated:files,chunksWritten:chunks,skipped,indexedFiles:new Set(allIds).size,indexedExcerpts:records}));
  return {filesUpdated:files,chunksWritten:chunks,skipped,indexedFiles:new Set(allIds).size,indexedExcerpts:records};
}

/**
 * Optional owner-installed hourly trigger. Run once after reviewing folder IDs.
 * Does not deploy a public web endpoint or share any private Sheet.
 */
function jjInstallHourlyIndexTrigger(){
  const name='jjIndexDriveTranscripts';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(name).timeBased().everyHours(1).create();
  return 'Installed one hourly private index trigger';
}
