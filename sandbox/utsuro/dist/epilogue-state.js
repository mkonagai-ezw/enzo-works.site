import {ENDING_TEXT} from './ending-state.js';
export const ENDING_LINES=ENDING_TEXT.flatMap(p=>p.split('\n'));
export class EpilogueState{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.index=0;this.typedTime=0;this.hold=0;this.fade=0;this.creditTime=0;this.duration=180;}
 start(){if(this.phase==='idle')this.phase='narrative';}
 get line(){return ENDING_LINES[this.index];}
 get characterCount(){return Math.min(Array.from(this.line).length,Math.floor(this.typedTime*16));}
 get text(){return Array.from(this.line).slice(0,this.characterCount).join('');}
 get lineComplete(){return this.characterCount===Array.from(this.line).length;}
 get lastLine(){return this.index===ENDING_LINES.length-1;}
 advance(){
  if(this.phase!=='narrative')return false;
  if(!this.lineComplete){this.typedTime=Array.from(this.line).length/16;return true;}
  if(this.lastLine)return false;
  this.index++;this.typedTime=0;this.hold=0;return true;
 }
 tick(dt,active){
  if(!active)return;dt=Math.max(0,Math.min(dt,.25));
  if(this.phase==='narrative'){
   if(this.lastLine&&this.lineComplete){this.hold+=dt;if(this.hold>=4)this.phase='fade';}
   else this.typedTime+=dt;
  }else if(this.phase==='fade'){this.fade=Math.min(1,this.fade+dt/3);if(this.fade>=1)this.phase='credits';}
  else if(this.phase==='credits'){this.creditTime=Math.min(this.duration,this.creditTime+dt);if(this.creditTime>=this.duration)this.phase='complete';}
 }
 get creditProgress(){return Math.min(1,this.creditTime/this.duration);}
}
