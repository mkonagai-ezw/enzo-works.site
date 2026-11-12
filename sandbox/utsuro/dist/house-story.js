// Active-time sequencing: pausing or hiding the tab cannot skip the reveal.
export const CLUE_IDS=['well','chains','shoes','tablets','portrait','note','newspaper'];
export const CLUE_HINTS={
 well:'庭の井戸……蓋の隙間を、見て。二本の縄が……まだ、下へ続いてる……',
 chains:'机のない畳の部屋……隅に、鎖が落ちてる。何かをつなぎとめるため……逃げないように。この家から……',
 shoes:'庭の草むらに……小さな靴が、たくさん。片方だけじゃ……帰れないね……',
 tablets:'家の奥の、小さな部屋……小さな命の面影が入ってる',
 portrait:'奥の部屋の壁……額の中の人が、見てる。この人は……何を約束したんだろう……',
 note:'井戸のそば……紙が落ちてる。同じ言葉を……何度も、何度も……',
 newspaper:'家の中、古い新聞が落ちてる。帰ってこない子たちのこと……まだ、誰も知らない……'
};
export const STORY_TIMING={kagomeDelay:3,armsStart:0,fireStart:0,phoneStart:9,flickerStart:12,fadeStart:20,blackout:24,transfer:25,arrival:2};
export class HouseStoryState {
 constructor(){this.reset();}
 reset(){this.phase='explore';this.firstMoveAt=null;this.activeSeconds=0;this.ritualSeconds=0;this.arrivalSeconds=0;this.rain=false;this.inspected=new Set();this.hintCursor=0;this.lastHint=null;}
 get canReadHint(){return this.rain&&['clues','monk-ready'].includes(this.phase);}
 nextClueHint(){
  if(!this.canReadHint)return null;
  for(let n=0;n<CLUE_IDS.length;n++){
   const index=(this.hintCursor+n)%CLUE_IDS.length,id=CLUE_IDS[index];
   if(this.inspected.has(id))continue;
   this.hintCursor=(index+1)%CLUE_IDS.length;this.lastHint=id;
   return CLUE_HINTS[id];
  }
  this.lastHint='complete';return '……もう、見つけたね。あの声がする部屋へ……';
 }
 inspectClue(id){if(!CLUE_IDS.includes(id)||!['explore','jizo-ready','clues','monk-ready'].includes(this.phase)||(!this.rain&&!['well','chains'].includes(id))||this.inspected.has(id))return false;this.inspected.add(id);if(this.phase==='clues'&&this.remainingClues===0)this.phase='monk-ready';return true;}
 get remainingClues(){return CLUE_IDS.length-this.inspected.size;}
 noteFirstMove(){if(this.firstMoveAt===null)this.firstMoveAt=this.activeSeconds;this.unlock(1);}
 unlock(moves){if(this.phase==='explore'&&moves>0)this.phase='jizo-ready';}
 examine(){if(this.phase!=='jizo-ready')return false;this.phase='warning';this.rain=true;return true;}
 dismiss(){if(this.phase!=='warning')return false;this.phase=this.remainingClues===0?'monk-ready':'clues';return true;}
 examineMonk(){if(this.phase!=='monk-ready')return false;this.phase='ritual';this.ritualSeconds=0;return true;}
 get movementLocked(){return ['warning','ritual','blackout','arrival'].includes(this.phase);}
 get viewLocked(){return ['warning','blackout','arrival'].includes(this.phase);}
 get stage(){return ['arrival','corridor'].includes(this.phase)?'corridor':'house';}
 get armsStarted(){return ['ritual','blackout'].includes(this.phase)&&this.ritualSeconds>=STORY_TIMING.armsStart;}
 get kagome(){return ['explore','jizo-ready'].includes(this.phase)&&this.firstMoveAt!==null&&this.activeSeconds-this.firstMoveAt>=STORY_TIMING.kagomeDelay;}
 get chanting(){return ['clues','monk-ready'].includes(this.phase);}
 get chantLevel(){return this.phase==='monk-ready'?1:.28;}
 get fireActive(){return ['ritual','blackout'].includes(this.phase);}
 get phoneRinging(){return ['ritual','blackout'].includes(this.phase)&&this.ritualSeconds>=STORY_TIMING.phoneStart;}
 get phoneLevel(){return 1-this.darkness;}
 get darkness(){if(this.phase==='arrival')return Math.max(0,1-this.arrivalSeconds/STORY_TIMING.arrival);if(this.phase==='blackout')return 1;return this.phase==='ritual'?Math.min(1,Math.max(0,(this.ritualSeconds-STORY_TIMING.fadeStart)/(STORY_TIMING.blackout-STORY_TIMING.fadeStart))):0;}
 get flashlightPower(){
  if(this.phase==='blackout'||this.phase==='arrival')return 0;
  if(this.phase!=='ritual'||this.ritualSeconds<STORY_TIMING.flickerStart)return 1;
  const t=this.ritualSeconds,late=t>14;
  // Intermittent faults with sustained dark intervals, never full-screen white flashes.
  const cycle=t%(late?1.35:2.4);
  return cycle<(late?.44:.14)?0:cycle<(late?.70:.34)?.22:1;
 }
 tick(dt,active){
  if(!active)return;this.activeSeconds+=dt;
  if(this.phase==='ritual'||this.phase==='blackout'){
   this.ritualSeconds+=dt;
   if(this.ritualSeconds>=STORY_TIMING.blackout)this.phase='blackout';
   if(this.ritualSeconds>=STORY_TIMING.transfer){this.phase='arrival';this.rain=false;this.arrivalSeconds=0;}
  }else if(this.phase==='arrival'){
   this.arrivalSeconds+=dt;if(this.arrivalSeconds>=STORY_TIMING.arrival)this.phase='corridor';
  }
 }
 diagnostics(){return {phase:this.phase,stage:this.stage,inspected:[...this.inspected],remainingClues:this.remainingClues,kagome:this.kagome,chanting:this.chanting,chantLevel:this.chantLevel,fire:this.fireActive,phone:this.phoneRinging,phoneLevel:this.phoneLevel,firstMoveAt:this.firstMoveAt,activeSeconds:+this.activeSeconds.toFixed(2),ritualSeconds:+this.ritualSeconds.toFixed(2),darkness:this.darkness,movementLocked:this.movementLocked,viewLocked:this.viewLocked};}
}
