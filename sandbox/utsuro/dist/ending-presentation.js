import {setText,setOpacity} from './performance-runtime.js';
import {EpilogueState} from './epilogue-state.js';
import {CREDIT_SECTIONS} from './ending-credits.js';
export function createEndingPresentation({photo,onRestart,onExit,soundEnabled}){
 const state=new EpilogueState();let generation=0,pending=false,blocked=false,wantsAudio=false,creditsHeight=0,viewportHeight=0;
 const overlay=document.createElement('section');overlay.id='ending';overlay.hidden=true;overlay.setAttribute('aria-label','とある家 エンディング');
 const morning=document.createElement('div');morning.className='endingMorning';morning.append(photo);
 const narrative=document.createElement('div');narrative.className='endingNarrative';
 const line=document.createElement('p');line.id='endingLine';
 const advance=document.createElement('button');advance.id='endingNext';advance.type='button';advance.textContent='全文を表示';narrative.append(line,advance);morning.append(narrative);overlay.append(morning);
 const rollWindow=document.createElement('div');rollWindow.className='creditWindow';rollWindow.hidden=true;
 const roll=document.createElement('div');roll.className='creditRoll';
 CREDIT_SECTIONS.forEach(([title,lines],i)=>{const section=document.createElement('section');section.className='creditBlock'+(!lines.length?' creditHeading':'');const h=document.createElement(i===0?'h1':'h2');h.textContent=title;section.append(h);for(const text of lines){const p=document.createElement('p');p.textContent=text;section.append(p);}roll.append(section);});rollWindow.append(roll);overlay.append(rollWindow);
 const final=document.createElement('div');final.className='creditsComplete';final.hidden=true;final.innerHTML='<h1>とある家</h1><p>ENZO WORKS</p>';overlay.append(final);
 const actions=document.createElement('div');actions.className='creditActions';actions.hidden=true;
 const musicButton=document.createElement('button');musicButton.type='button';musicButton.textContent='楽曲を再生';musicButton.hidden=true;
 const exit=document.createElement('button');exit.type='button';exit.textContent='終わる';exit.onclick=()=>onExit();
 const restart=document.createElement('button');restart.type='button';restart.textContent='はじめから';restart.onclick=()=>onRestart();actions.append(musicButton,exit,restart);overlay.append(actions);document.body.append(overlay);
 const music=new Audio('assets/audio/bourei-v01.mp3');music.preload='auto';music.volume=0;
 function duration(){if(Number.isFinite(music.duration)&&music.duration>30)state.duration=music.duration;}
 music.addEventListener('loadedmetadata',duration);
 function attempt(){
  if(pending||!wantsAudio||blocked)return;pending=true;const token=generation;
  music.play().then(()=>{if(token!==generation||!wantsAudio)music.pause();if(token===generation){pending=false;blocked=false;musicButton.hidden=true;}}).catch(()=>{if(token===generation){pending=false;blocked=true;musicButton.hidden=false;}});
 }
 // Prime the supplied song from the same user gesture that opens the door or advances text.
 function unlockAudio(){
  if(pending||state.phase==='credits'||state.phase==='complete')return;
  const token=generation;music.volume=0;pending=true;
  music.play().then(()=>{if(token===generation){pending=false;blocked=false;}if(!wantsAudio){music.pause();music.currentTime=0;}}).catch(()=>{if(token===generation){pending=false;}});
 }
 function next(){unlockAudio();state.advance();render();}
 advance.onclick=next;
 morning.onclick=e=>{if(e.target===advance)return;next();};
 musicButton.onclick=()=>{blocked=false;wantsAudio=true;attempt();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){wantsAudio=false;music.pause();}});
 function measure(){creditsHeight=roll.scrollHeight;viewportHeight=rollWindow.clientHeight;}
 window.addEventListener('resize',measure);
 function render(){
  overlay.hidden=state.phase==='idle';overlay.dataset.phase=state.phase;
  const credits=['credits','complete'].includes(state.phase);
  document.body.classList.toggle('ending-epilogue',state.phase!=='idle');
  morning.hidden=credits;setOpacity(morning,1-state.fade);
  setText(line,state.text);
  advance.hidden=state.phase!=='narrative'||(state.lastLine&&state.lineComplete);
  setText(advance,state.lineComplete?'次へ　›':'全文を表示');
  rollWindow.hidden=state.phase!=='credits';actions.hidden=!credits;final.hidden=state.phase!=='complete';
  if(state.phase==='credits'){if(!creditsHeight||!viewportHeight)measure();roll.style.transform=`translateY(${viewportHeight-(viewportHeight+creditsHeight)*state.creditProgress}px)`;}
 }
 return {state,unlockAudio,advance:next,
  seekCredits(progress){if(state.phase!=='credits')return;state.creditTime=Math.max(0,Math.min(1,progress))*state.duration;if(music.readyState)music.currentTime=state.creditTime;render();},
  reset(){generation++;pending=false;blocked=false;wantsAudio=false;music.pause();music.currentTime=0;music.volume=0;musicButton.hidden=true;state.reset();render();},
  update(dt,active,visible){
   if(visible&&state.phase==='idle'){state.start();duration();}
   state.tick(dt,active&&visible);render();
   wantsAudio=active&&visible&&state.phase==='credits'&&soundEnabled();
   if(wantsAudio){music.volume=.72*Math.min(1,state.creditTime/3,Math.max(0,(state.duration-state.creditTime)/5));if(music.paused)attempt();}
   else{music.pause();}
   if(wantsAudio&&!music.paused&&!music.seeking&&music.currentTime>0){state.creditTime=Math.min(state.duration,music.currentTime);}
  },
  diagnostics(){return {phase:state.phase,line:state.index+1,characters:state.characterCount,lineComplete:state.lineComplete,creditTime:+state.creditTime.toFixed(2),duration:state.duration,musicPlaying:!music.paused,musicTime:+music.currentTime.toFixed(2),musicBlocked:blocked};}
 };
}
