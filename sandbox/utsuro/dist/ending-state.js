// All timing uses active game time, so background tabs cannot skip the goodbye.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const ENDING_TEXT=[
 '私は気付いたら家の外にいた。\nいつしか夜も明け、「とある家」と呼ばれる廃墟の姿が露わになった。',
 '私が生まれた家。',
 '私が消えた家。',
 '多くの者が閉じ込められ、',
 '私だけが逃げ出した家。',
 '父と母と私は、',
 '確かにそこにいた…'
];
export const ENDING_TIMING=Object.freeze({chant:.45,turn:4.5,reveal:7,ignite:10,memory:14,memoryEnd:20,join:21,joined:25,spread:26,ceiling:30,collapse:36,black:39.5,epilogue:42});
export class EndingState{
 constructor(){this.reset();}
 reset(){this.phase='explore';this.time=0;this.startYaw=0;this.startPitch=0;this.startPosition=[0,1.64,-10];}
 begin(position,yaw,pitch){if(this.phase!=='explore')return false;this.phase='farewell';this.time=0;this.startPosition=[...position];this.startYaw=yaw;this.startPitch=pitch;return true;}
 tick(dt,active){if(!active||this.phase==='explore')return;this.time+=Math.max(0,Math.min(dt,.25));if(this.time>=ENDING_TIMING.epilogue)this.phase='epilogue';}
 get locked(){return this.phase!=='explore';}
 get door(){return this.locked?.16*smooth(this.time/1.5):0;}
 get turn(){return smooth((this.time-ENDING_TIMING.turn)/(ENDING_TIMING.reveal-ENDING_TIMING.turn));}
 get dissolve(){return smooth((this.time-ENDING_TIMING.collapse)/5);}
 get handJoin(){return smooth((this.time-ENDING_TIMING.join)/(ENDING_TIMING.joined-ENDING_TIMING.join));}
 get chanting(){return this.phase==='farewell'&&this.time>=ENDING_TIMING.chant;}
 get fireActive(){return this.phase==='farewell'&&this.time>=ENDING_TIMING.ignite;}
 get fireSeconds(){return Math.max(0,this.time-ENDING_TIMING.ignite);}
 get spread(){return smooth((this.time-ENDING_TIMING.spread)/7);}
 get ceiling(){return smooth((this.time-ENDING_TIMING.ceiling)/6);}
 get collapse(){return smooth((this.time-ENDING_TIMING.collapse)/4);}
 get memoryVisible(){return this.phase==='farewell'&&this.time>=ENDING_TIMING.memory&&this.time<ENDING_TIMING.memoryEnd;}
 get memoryTime(){return Math.max(0,this.time-ENDING_TIMING.memory);}
 get audioFade(){return 1-smooth((this.time-ENDING_TIMING.collapse)/6);}
 get walk(){return 0;}
 get black(){if(!this.locked)return 0;return this.time<ENDING_TIMING.epilogue?smooth((this.time-ENDING_TIMING.black)/1.5):1-smooth((this.time-ENDING_TIMING.epilogue)/1.8);}
 get epilogueTime(){return Math.max(0,this.time-ENDING_TIMING.epilogue);}
 get familyVisible(){return this.phase==='farewell'&&this.time>=ENDING_TIMING.turn;}
 get monksVisible(){return this.phase==='farewell'&&this.time>=ENDING_TIMING.turn;}
}
