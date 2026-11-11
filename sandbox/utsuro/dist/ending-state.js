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
export class EndingState{
 constructor(){this.reset();}
 reset(){this.phase='explore';this.time=0;this.startYaw=0;this.startPitch=0;this.startPosition=[0,1.64,-10];}
 begin(position,yaw,pitch){if(this.phase!=='explore')return false;this.phase='farewell';this.time=0;this.startPosition=[...position];this.startYaw=yaw;this.startPitch=pitch;return true;}
 tick(dt,active){if(!active||this.phase==='explore')return;this.time+=Math.max(0,Math.min(dt,.25));if(this.time>=21)this.phase='epilogue';}
 get locked(){return this.phase!=='explore';}
 get door(){const t=this.time;if(!this.locked)return 0;return .16*smooth(t/1.5)+.84*smooth((t-13.8)/2);}
 get turn(){return smooth((this.time-1.5)/2.3)*(1-smooth((this.time-11.3)/2.5));}
 get dissolve(){return smooth((this.time-5.8)/5.5);}
 get walk(){return smooth((this.time-15.8)/4.7);}
 get white(){if(!this.locked)return 0;return this.time<21?smooth((this.time-19)/1.5):1-smooth((this.time-21)/1.5);}
 get epilogueTime(){return Math.max(0,this.time-21);}
 get familyVisible(){return this.locked&&this.time>=1.5&&this.time<11.3;}
}
