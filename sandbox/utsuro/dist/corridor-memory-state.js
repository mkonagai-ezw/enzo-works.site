export const HINT_IMAGES=Object.freeze(Array.from({length:8},(_,i)=>`assets/corridor-hints/hint-${String(i+1).padStart(2,'0')}-v${(i===1||i===2||i===4)?2:1}.webp`));
export const CORRIDOR_MEMORIES=Object.freeze([[0,1],[2,3],[7,4],[5,6]].map(Object.freeze));
export const HINT_DURATION=4.8;
export class CorridorHintState{
 constructor(){this.seen=new Set();this.reset();}
 reset(clearSeen=false){if(clearSeen)this.seen.clear();this.phase='idle';this.floor=1;this.steps=[];this.index=0;this.time=0;}
 begin(floor,steps=[0]){
  if(this.locked||!Number.isInteger(floor)||!CORRIDOR_MEMORIES[floor-1]||!steps.length||steps.some(s=>!Number.isInteger(s)||s<0||s>1))return false;
  this.floor=floor;this.steps=[...steps];this.index=0;this.phase='loading';this.time=0;return true;
 }
 get imageId(){return CORRIDOR_MEMORIES[this.floor-1]?.[this.steps[this.index]];}
 get path(){return HINT_IMAGES[this.imageId];}
 get canSkip(){return this.phase==='showing'&&this.seen.has(this.imageId);}
 ready(){if(this.phase==='loading')this.phase='showing';}
 skip(){if(!this.canSkip||this.time<.35)return false;this.time=HINT_DURATION;return true;}
 tick(dt,active){if(this.phase==='showing'&&active){this.time+=Math.max(0,dt);if(this.time>=HINT_DURATION)this.phase='complete';}}
 advance(){if(this.phase!=='complete')return false;this.seen.add(this.imageId);this.index++;this.time=0;this.phase=this.index<this.steps.length?'loading':'idle';return this.phase==='loading';}
 get locked(){return ['loading','showing','complete'].includes(this.phase);}
}

// Memory progress belongs to this visit; skip eligibility belongs to the playthrough.
export class CorridorDollState{
 constructor(){this.reset();}
 reset(){this.phase='hidden';this.count=0;this.steps=[];}
 appear(){this.reset();this.phase='waiting';}
 inspect(){if(!['waiting','review'].includes(this.phase))return false;this.steps=this.count<2?[this.count]:[0,1];this.phase='reading';return true;}
 finishHint(){if(this.phase!=='reading')return null;const fresh=this.count<2;if(fresh)this.count++;this.phase=this.count<2?'waiting':'review';return {fresh,count:this.count};}
 retryHint(){if(this.phase==='reading')this.phase=this.count<2?'waiting':'review';}
 get present(){return this.phase!=='hidden';}
}
