/* Sync compact header controls on standalone pages. Main Studio and Portfolio Sim manage their own theme. */
(function(){
'use strict';
const user=document.getElementById('studioUserSelect');
if(user){
 const ids=['doen','dori','dona','dion'];
 try{
  const saved=localStorage.getItem('4ds:active-user:v1');
  user.value=ids.includes(saved)?saved:'dori';
 }catch(e){user.value='dori'}
 user.addEventListener('change',()=>{
  if(!ids.includes(user.value))return;
  try{localStorage.setItem('4ds:active-user:v1',user.value)}catch(e){return}
  window.location.reload();
 });
}
const button=document.getElementById('studioTheme');
if(button){
 let current='dark';
 try{current=localStorage.getItem('4ds:theme:v1')==='light'?'light':'dark'}catch(e){}
 function apply(){
  document.documentElement.setAttribute('data-theme',current);
  button.textContent=current==='dark'?'☀':'☾';
  button.setAttribute('aria-label',current==='dark'?'Switch to light mode':'Switch to dark mode');
  button.title=button.getAttribute('aria-label');
 }
 apply();
 button.addEventListener('click',()=>{
  current=current==='dark'?'light':'dark';
  try{localStorage.setItem('4ds:theme:v1',current)}catch(e){}
  apply();
 });
}
})();