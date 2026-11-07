/* JJ Academy: remember reader zoom without resizing navigation controls. */
(() => {
  'use strict';
  const heading = document.querySelector('header .head');
  if (!heading || document.getElementById('jj-reader-size')) return;
  const key = 'jj-academy-reading-scale-v1';
  const MIN = 80, MAX = 160, STEP = 10;
  let percent = 100;
  try {
    const saved = Number(localStorage.getItem(key));
    if (Number.isFinite(saved) && saved >= MIN && saved <= MAX && saved % STEP === 0) percent = saved;
  } catch (_) {}
  const control = document.createElement('div');
  control.id = 'jj-reader-size';
  control.className = 'jj-reader-size';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'jj-reader-trigger';
  trigger.textContent = 'Aa';
  trigger.title = 'Change reading text size';
  trigger.setAttribute('aria-label', 'Reading text size');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'jj-reader-popup');
  const popup = document.createElement('div');
  popup.className = 'jj-reader-popup';
  popup.id = 'jj-reader-popup';
  popup.hidden = true;
  const title = document.createElement('div');
  title.className = 'jj-reader-heading';
  const name = document.createElement('span');
  name.textContent = 'Reading size';
  const value = document.createElement('span');
  value.className = 'jj-reader-percent';
  value.setAttribute('role','status');
  value.setAttribute('aria-live','polite');
  title.append(name,value);
  const row = document.createElement('div');
  row.className = 'jj-reader-steps';
  function button(label, tooltip, change) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.title = tooltip;
    el.setAttribute('aria-label', tooltip);
    el.addEventListener('click', change);
    return el;
  }
  const minus = button('A−','Decrease reading size',()=>apply(percent - STEP));
  const plus = button('A+','Increase reading size',()=>apply(percent + STEP));
  const reset = button('Reset to 100%','Reset reading size to normal',()=>apply(100));
  reset.className = 'jj-reader-reset';
  row.append(minus,plus);
  const hint = document.createElement('small');
  hint.textContent = 'Applies to chapters and reading content. Saved on this device.';
  popup.append(title,row,reset,hint);
  control.append(trigger,popup);
  // Put next to the theme toggle, visible on mobile and desktop.
  const theme = heading.querySelector('#theme');
  if (theme) heading.insertBefore(control,theme);
  else heading.appendChild(control);
  function apply(next) {
    percent = Math.max(MIN,Math.min(MAX,next));
    document.documentElement.style.setProperty('--jj-reading-scale',String(percent/100));
    value.textContent = percent + '%';
    minus.disabled = percent <= MIN;
    plus.disabled = percent >= MAX;
    reset.disabled = percent === 100;
    trigger.title = 'Reading size: '+ percent + '%';
    try { localStorage.setItem(key,String(percent)); } catch (_) {}
  }
  function close() {
    popup.hidden=true;
    trigger.setAttribute('aria-expanded','false');
  }
  trigger.addEventListener('click',()=>{
    popup.hidden=!popup.hidden;
    trigger.setAttribute('aria-expanded',String(!popup.hidden));
  });
  document.addEventListener('pointerdown',e=>{if(!control.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden){close();trigger.focus()}});
  apply(percent);
})();
