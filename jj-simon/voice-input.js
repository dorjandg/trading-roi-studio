/* JJ Academy browser speech-to-text. Uses native Web Speech recognition
   when supported. No audio is uploaded by this website; the browser or its
   speech provider may process audio. Unanswered question sharing remains opt-in. */
(() => {
  'use strict';
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-5 0h10"></path></svg>';
  let active = null;

  function insertMic(target, mount, kind) {
    if (!target || !mount || mount.querySelector('[data-jj-mic="' + kind + '"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jj-voice-button' + (kind === 'search' ? ' jj-voice-search-button' : ' jj-voice-question-button');
    button.dataset.jjMic = kind;
    button.innerHTML = icon + (kind === 'question' ? '<span>Speak</span>' : '');
    button.setAttribute('aria-label',kind === 'question' ? 'Speak a question' : 'Search Academy by voice');
    button.setAttribute('aria-pressed','false');
    button.title = 'Speak in English; tap again to finish';
    const status = document.createElement('span');
    status.className = 'jj-voice-status ' + (kind === 'search' ? 'jj-voice-search-status' : 'jj-voice-form-status');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    if (kind === 'question') {
      // Keep the mic directly inside the question field, not hidden in the
      // action row under the question. Recreated forms get their own button.
      const wrapper = document.createElement('div');
      wrapper.className = 'jj-voice-question-wrap';
      target.before(wrapper);
      wrapper.append(target,button);
      wrapper.after(status);
    } else {
      mount.appendChild(button);
      mount.appendChild(status);
    }
    if (!Speech) {
      button.disabled = true;
      button.title = 'Browser speech recognition unavailable. Use Chrome or your keyboard microphone.';
      if (kind === 'question') status.textContent = 'Voice recognition is not available in this browser. You can use your keyboard microphone instead.';
      return;
    }
    function changeButton(listening){
      button.dataset.listening=String(listening);
      button.setAttribute('aria-pressed',String(listening));
      button.setAttribute('aria-label',listening?'Stop listening':(kind==='question'?'Speak a question':'Search Academy by voice'));
      button.title=listening?'Tap to stop listening':'Speak in English; tap again to finish';
      if(kind==='question')button.querySelector('span').textContent=listening?'Stop':'Speak';
    }
    function report(message,error=false){
      status.textContent=message;
      status.dataset.error=String(error);
    }
    button.addEventListener('click',()=>{
      if(active && active.button===button){
        report('Finishing voice input…');
        try{active.recognition.stop()}catch(_){cancelActive()}
        return;
      }
      if(active) cancelActive();
      let recognition;
      try{recognition=new Speech()}catch(_){
        report('Speech recognition could not start in this browser.',true);return;
      }
      recognition.lang='en-US';
      recognition.continuous=false;
      recognition.interimResults=true;
      recognition.maxAlternatives=1;
      const existing=target.value.trim();
      let finalTranscript='',interimTranscript='',hasError=false;
      const join=(a,b)=>[a,b].filter(Boolean).join(' ').trim();
      const session={recognition,button,target,reset:()=>changeButton(false)};
      recognition.onstart=()=>{if(active===session){changeButton(true);report('Listening… speak now.')}};
      recognition.onresult=event=>{
        if(active!==session || !target.isConnected)return;
        const finals=[],interims=[];
        for(let i=0;i<event.results.length;i++){
          const part=event.results[i][0]?.transcript?.trim()||'';
          if(!part)continue;
          if(event.results[i].isFinal)finals.push(part);else interims.push(part);
        }
        finalTranscript=finals.join(' ').trim();
        interimTranscript=interims.join(' ').trim();
        target.value=join(existing,join(finalTranscript,interimTranscript));
        target.dispatchEvent(new Event('input',{bubbles:true}));
        report(interims.length?'Recognizing…':'Speech captured.');
      };
      recognition.onerror=event=>{
        if(active!==session)return;
        hasError=true;
        const reasons={
          'not-allowed':'Microphone access denied. Allow the microphone for this website.',
          'service-not-allowed':'Browser speech service unavailable or blocked.',
          'audio-capture':'No usable microphone was detected.',
          'no-speech':'No speech detected. Tap the mic to try again.',
          'network':'Speech recognition network unavailable.',
          'language-not-supported':'English speech recognition is not supported here.',
          'aborted':'Voice input cancelled.'
        };
        report(reasons[event.error]||'Voice input failed. Try again or use your keyboard microphone.',true);
      };
      recognition.onend=()=>{
        if(active!==session)return;
        active=null;
        changeButton(false);
        if(!target.isConnected)return;
        // Preserve recognized interim words if the browser stops without
        // emitting a final segment. Never erase what the user dictated.
        const speech=finalTranscript||(!hasError?interimTranscript:'');
        if(speech)target.value=join(existing,speech);
        else if(!hasError)target.value=existing;
        target.dispatchEvent(new Event('input',{bubbles:true}));
        if(speech){
          if(kind==='question'){
            report('Question transcribed. Searching Academy…');
            const form=target.closest('form');
            if(form && form.isConnected){
              if(typeof form.requestSubmit==='function')form.requestSubmit();
              else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
            }
          }else{
            report('Voice search ready. Choose a matching topic.');
          }
        }else if(!hasError){
          report('No speech detected. Tap the microphone and try again.');
        }
      };
      active=session;
      try{recognition.start()}catch(_){
        if(active===session)active=null;
        changeButton(false);
        report('Unable to start speech recognition. Check microphone permissions.',true);
      }
    });
  }
  function cancelActive(){
    if(!active)return;
    const old=active;
    active=null;
    old.reset();
    try{old.recognition.abort()}catch(_){}
  }
  function mount(){
    const search=document.getElementById('search');
    if(search)insertMic(search,search.closest('.search-wrap'),'search');
    const form=document.querySelector('#jj-helper-app .jj-helper-form');
    if(form){
      const textarea=form.querySelector('textarea');
      if(textarea)insertMic(textarea,form,'question');
    }
    if(active && !active.target.isConnected)cancelActive();
  }
  if(typeof render==='function'){
    const priorRender=render;
    render=function(...args){
      const result=priorRender.apply(this,args);
      mount();
      return result;
    };
  }
  window.addEventListener('pagehide',cancelActive);
  mount();
})();