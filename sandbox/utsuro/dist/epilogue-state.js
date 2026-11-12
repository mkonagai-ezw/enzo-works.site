import {ENDING_TEXT} from './ending-state.js?v=story-wording-1';
export const ENDING_LINES=ENDING_TEXT.flatMap(p=>p.split('\n'));
export const EPILOGUE_PACING=Object.freeze({charactersPerSecond:9,hold:4,lastHold:6,lineFade:1.2,gap:.6});
export class EpilogueState{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.index=0;this.typedTime=0;this.hold=0;this.lineStage='typing';this.transition=0;this.fade=0;this.creditTime=0;this.duration=180;}
 start(){if(this.phase==='idle')this.phase='narrative';}
 get line(){return ENDING_LINES[this.index];}
 get characterCount(){return Math.min(Array.from(this.line).length,Math.floor(this.typedTime*EPILOGUE_PACING.charactersPerSecond));}
 get text(){return Array.from(this.line).slice(0,this.characterCount).join('');}
 get lineComplete(){return this.characterCount===Array.from(this.line).length;}
 get lastLine(){return this.index===ENDING_LINES.length-1;}
 // Input cannot skip the automatic narration or its final hold.
 advance(){return false;}
 get lineOpacity(){return this.lineStage==='gap'?0:this.lineStage==='out'?Math.max(0,1-this.transition/EPILOGUE_PACING.lineFade):Math.min(1,this.typedTime/.8);}
 tick(dt,active){
  if(!active)return;dt=Math.max(0,Math.min(dt,.25));
  if(this.phase==='narrative'){
   if(this.lineStage==='typing'){this.typedTime+=dt;if(this.lineComplete)this.lineStage='hold';}
   else if(this.lineStage==='hold'){
    this.hold+=dt;const duration=this.lastLine?EPILOGUE_PACING.lastHold:Math.max(EPILOGUE_PACING.hold,Array.from(this.line).length*.11);
    if(this.hold>=duration){if(this.lastLine)this.phase='fade';else{this.lineStage='out';this.transition=0;}}
   }else if(this.lineStage==='out'){this.transition+=dt;if(this.transition>=EPILOGUE_PACING.lineFade){this.lineStage='gap';this.transition=0;}}
   else if(this.lineStage==='gap'){this.transition+=dt;if(this.transition>=EPILOGUE_PACING.gap){this.index++;this.typedTime=0;this.hold=0;this.transition=0;this.lineStage='typing';}}
  }else if(this.phase==='fade'){this.fade=Math.min(1,this.fade+dt/3);if(this.fade>=1)this.phase='credits';}
  else if(this.phase==='credits'){this.creditTime=Math.min(this.duration,this.creditTime+dt);if(this.creditTime>=this.duration)this.phase='complete';}
 }
 get creditProgress(){return Math.min(1,this.creditTime/this.duration);}
}
