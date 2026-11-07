/* Compact mobile chapter picker; uses the existing Academy select as source of truth. */
(() => {
  'use strict';
  const source = document.getElementById('mobile');
  if (!source || !source.parentElement) return;
  const host = document.createElement('div');
  host.className = 'jj-mobile-nav';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'jj-mobile-trigger';
  trigger.setAttribute('aria-label','Select study chapter');
  trigger.setAttribute('aria-controls','jj-mobile-chapter-menu');
  trigger.setAttribute('aria-expanded','false');
  const label = document.createElement('span');
  label.className = 'jj-mobile-label';
  const caret = document.createElement('span');
  caret.className = 'jj-mobile-arrow';
  caret.textContent = '▾';
  caret.setAttribute('aria-hidden', 'true');
  trigger.append(label, caret);
  const menu = document.createElement('div');
  menu.id = 'jj-mobile-chapter-menu';
  menu.className = 'jj-mobile-menu';
  menu.hidden = true;
  menu.setAttribute('aria-label','Study chapters');
  host.append(trigger,menu);
  source.parentElement.insertBefore(host,source);

  const syncLabel = () => {
    const current = source.options[source.selectedIndex];
    label.textContent = current ? current.textContent.trim() : 'Chapters';
    trigger.title = current ? current.textContent.trim() : 'Browse chapters';
  };
  function close(restoreFocus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded','false');
    if (restoreFocus) trigger.focus();
  }
  function navButton(option, chapter=false) {
    const button = document.createElement('button');
    button.type='button';
    button.className=chapter?'jj-mobile-chapter':'';
    button.textContent=option.textContent.trim();
    button.dataset.chapter=option.value;
    if (option.value===source.value) button.setAttribute('aria-current','page');
    button.addEventListener('click',()=>{
      if (source.value!==option.value) {
        source.value=option.value;
        source.dispatchEvent(new Event('change',{bubbles:true}));
      }
      syncLabel();
      close(true);
    });
    return button;
  }
  function rebuild() {
    menu.replaceChildren();
    const items=Array.from(source.children);
    for (const item of items) {
      if (item.tagName==='OPTION') {
        menu.appendChild(navButton(item));
      } else if (item.tagName==='OPTGROUP') {
        const group = document.createElement('details');
        group.className = 'jj-mobile-group';
        group.open=Array.from(item.children).some(option=>option.value===source.value);
        const summary=document.createElement('summary');
        summary.appendChild(document.createTextNode(item.label));
        const count=document.createElement('span');
        count.textContent=String(item.children.length);
        summary.appendChild(count);
        group.appendChild(summary);
        for (const option of item.children) {
          if (option.tagName==='OPTION') group.appendChild(navButton(option,true));
        }
        menu.appendChild(group);
      }
    }
  }
  function open() {
    rebuild();
    menu.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    const current=menu.querySelector('[aria-current="page"]');
    if(current)current.scrollIntoView({block:'nearest'});
  }
  trigger.addEventListener('click',()=>{menu.hidden?open():close()});
  document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close(true)}});
  window.addEventListener('resize',()=>{if(window.innerWidth>750)close()});
  source.addEventListener('change',syncLabel);
  // Keep the displayed selected chapter correct when navigation happens by
  // dashboard cards, linked chapters, or the desktop navigation.
  if (typeof pick==='function') {
    const underlyingPick=pick;
    pick=function(...args) {
      const outcome=underlyingPick.apply(this,args);
      syncLabel();
      close();
      return outcome;
    };
  }
  syncLabel();
})();
