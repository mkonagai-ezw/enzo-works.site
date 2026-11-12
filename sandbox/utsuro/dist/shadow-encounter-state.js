export class ShadowEncounterState{
 constructor(){this.reset();}
 reset(){this.phase='hidden';this.time=0;this.contactTime=0;this.approachDarkness=0;}
 start(){if(this.phase!=='hidden')return false;this.phase='rush';this.time=0;return true;}
 contact(){if(this.phase!=='rush')return false;this.phase='contact';this.contactTime=0;return true;}
 // Keep the running silhouettes readable. Full black belongs to contact, not the approach.
 approach(distance){if(this.phase==='rush')this.approachDarkness=Math.max(this.approachDarkness,.8*Math.min(1,Math.max(0,(1.6-distance)/.88)));}
 tick(dt){if(this.phase==='hidden'||this.phase==='gameover')return;this.time+=dt;if(this.phase==='contact'){this.contactTime+=dt;if(this.contactTime>=.85)this.phase='gameover';}}
 get locked(){return ['contact','gameover'].includes(this.phase);}
 get darkness(){return this.locked?1:this.approachDarkness;}
}
export function sweptDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z);}
