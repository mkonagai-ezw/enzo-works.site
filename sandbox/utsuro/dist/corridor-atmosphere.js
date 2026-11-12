import {CORRIDOR_COUNT} from './corridor-choices.js?v=four-memories-1';

export function corridorLightProfile(floor=1){
 const level=Math.max(1,Math.min(CORRIDOR_COUNT,floor)),t=(level-1)/(CORRIDOR_COUNT-1);
 return {floor:level,ambient:.009-.006*t,candlePower:.65-.30*t,candleReach:2.6-.4*t,fog:.045+.015*t,flashPower:27-3*t,flashReach:16-2*t};
}

// Only real walking can arm a creak. Reading, pausing and teleports discard it.
export class CorridorCreakState{
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(floor=1){this.floor=floor;this.cooldown=2.5;this.travel=0;this.still=0;this.last=null;this.plays=0;this.delay=.6+this.random()*.45;}
 update(dt,{active,eligible,position}){
  const previous=this.last;this.last={x:position.x,z:position.z};
  if(!active||!eligible){this.travel=0;this.still=0;return false;}
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(!previous)return false;
  const distance=Math.hypot(position.x-previous.x,position.z-previous.z);
  if(distance>1){this.travel=0;this.still=0;return false;}
  if(distance>.002){this.travel+=distance;this.still=0;return false;}
  this.still+=dt;
  if(this.travel<3.2||this.still<this.delay||this.cooldown>0||this.plays>=(this.floor<4?1:2))return false;
  this.travel=0;this.still=0;this.delay=.6+this.random()*.45;this.cooldown=18+this.random()*10;
  if(this.random()>.7)return false;
  this.plays++;return true;
 }
}
