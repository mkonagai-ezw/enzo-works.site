// Native dialogs keep focus, Escape and touch scrolling within the open panel.
export function createTitleScreen(){
 const intro=document.querySelector('#intro');
 const settings=document.querySelector('#settings');
 const credits=document.querySelector('#credits');
 const orientation=document.querySelector('#orientationGuide');
 const guide=document.querySelector('#firstControls');
 let guideShown=false,guideTimer;
 const dialogs=[settings,credits,orientation];
 function open(dialog){dialog.showModal();}
 document.querySelector('#settingsToggle').onclick=()=>open(settings);
 document.querySelector('#creditsToggle').onclick=()=>open(credits);
 document.querySelector('#closeSettings').onclick=()=>settings.close();
 document.querySelector('#closeCredits').onclick=()=>credits.close();
 document.querySelector('#closeOrientation').onclick=()=>orientation.close();
 // Recommend once on entry. Rotation dismisses it; returning to portrait does not interrupt play.
 const portrait=matchMedia('(orientation: portrait)');
 const compactTouch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0||innerWidth<900;
 if(compactTouch&&portrait.matches)open(orientation);
 window.addEventListener('resize',()=>{if(orientation.open&&!portrait.matches)orientation.close();});
 for(const dialog of dialogs){
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 }
 document.addEventListener('keydown',e=>{
  if(!dialogs.some(dialog=>dialog.open))return;
  // Preserve native slider keys, focus traversal and dialog cancellation.
  e.stopImmediatePropagation();
 },true);
 return {
  enter(touch){
   for(const dialog of dialogs)if(dialog.open)dialog.close();
   intro.inert=true;
   if(intro.contains(document.activeElement))document.activeElement.blur();
   if(!guideShown){
    guideShown=true;
    guide.textContent=touch?'左のスティックで移動 ／ 画面をドラッグして見回す\n「灯」で懐中電灯 ／ 「調べる」で調べる':'W A S D・矢印で移動 ／ マウスで見回す\nF：懐中電灯　 E：調べる　 Esc：メニュー';
    guide.hidden=false;clearTimeout(guideTimer);
    guideTimer=setTimeout(()=>{guide.hidden=true;},6500);
   }
  },
  pause(){intro.inert=false;guide.hidden=true;clearTimeout(guideTimer);document.querySelector('#start').focus({preventScroll:true});},
  reset(){for(const dialog of dialogs)if(dialog.open)dialog.close();guideShown=false;guide.hidden=true;clearTimeout(guideTimer);}
 };
}
