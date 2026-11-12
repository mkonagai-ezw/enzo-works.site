export const CUPBOARD_PEEK=.085,CUPBOARD_OPEN=.64;
export class CupboardState {
 constructor(){this.reset();}
 reset(){this.mode='peeking';this.offset=CUPBOARD_PEEK;this.consumed=false;this.revealed=false;this.elapsed=0;this.slams=0;}
 get faceVisible(){return !this.revealed&&(this.mode==='peeking'||this.mode==='slamming');}
 get moving(){return ['slamming','opening','closing'].includes(this.mode);}
 get open(){return this.mode==='open';}
 move(mode,target,duration){this.mode=mode;this.from=this.offset;this.to=target;this.duration=duration;this.elapsed=0;}
 slam(){if(this.mode!=='peeking')return false;this.consumed=true;this.slams++;this.move('slamming',0,.13);return true;}
 interact(){
  if(this.moving)return null;
  if(this.mode==='peeking'){this.slam();return 'slam';}
  if(this.mode==='closed'){this.move('opening',CUPBOARD_OPEN,.48);return 'open';}
  if(this.mode==='open'){this.move('closing',0,.32);return 'close';}
  return null;
 }
 reveal(){this.revealed=true;this.consumed=true;if(['peeking','slamming'].includes(this.mode)){this.mode='closed';this.offset=0;}}
 update(dt,{active,lit=false}){
  if(!active)return false;
  const slammed=lit&&this.slam();
  if(this.moving){this.elapsed+=Math.max(0,dt);const t=Math.min(1,this.elapsed/this.duration),ease=this.mode==='slamming'?1-(1-t)**3:t*t*(3-2*t);this.offset=this.from+(this.to-this.from)*ease;if(t===1){this.offset=this.to;this.mode=this.to===0?'closed':'open';}}
  return slammed;
 }
}
