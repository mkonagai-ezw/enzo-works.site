import {CORRIDOR_COUNT} from './corridor-choices.js';

export function corridorLightProfile(floor=1){
 const level=Math.max(1,Math.min(CORRIDOR_COUNT,floor)),t=(level-1)/(CORRIDOR_COUNT-1);
 return {floor:level,ambient:.026-.017*t,candlePower:2.9-.9*t,candleReach:4.4-.7*t,fog:.036+.012*t,flashPower:30-5*t,flashReach:17-3*t};
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
