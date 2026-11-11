import * as THREE from 'three';
const x=new THREE.Vector3(1,0,0),y=new THREE.Vector3(0,1,0),z=new THREE.Vector3(0,0,1),q=new THREE.Quaternion();
// Hold a contorted pose, then catch up abruptly. The short blend avoids mesh discontinuities.
function catchUp(t,period,offset=0){const v=(t+offset)/period,n=Math.floor(v),f=v-n,u=Math.min(1,f/.16),ease=u*u*(3-2*u);return (n%2===0?1:-1)*(2*ease-1);}
export function shadowMotion(t,index){
 const k=index?1:-1,p=t+index*.37;
 return {twist:catchUp(p,.47)*.57,lag:catchUp(p-.13,.47)*.42,
  neck:k*.73+catchUp(p,.73,.12)*.27,head:catchUp(p-.08,.73,.12)*-.37,
  shoulder:catchUp(p,.31)*.67,elbow:catchUp(p-.1,.39)*.82,
  lean:index?.42:-.24,roll:Math.sin(p*5.1)*.13,
  speed:(index?9.1:8.3)*(.87+.30*catchUp(p,.39)),stride:1.45+.38*catchUp(p,.39),
  lift:.018*(1+Math.sin(p*15))};
}
export function applyShadowPose(bones,motion,locked=false){
 const turn=(name,axis,angle)=>bones[name]?.quaternion.multiply(q.setFromAxisAngle(axis,angle));
 turn('spine_02',z,motion.lag);turn('spine_03',y,motion.twist);turn('spine_03',x,motion.lean);
 turn('neck_01',z,motion.neck);turn('Head',y,motion.head-motion.twist*.5);
 turn('upperarm_l',z,motion.shoulder);turn('upperarm_r',x,-motion.shoulder*.9);
 turn('lowerarm_l',y,motion.elbow);turn('lowerarm_r',y,-motion.elbow*.8);
 if(locked){turn('upperarm_l',x,-.9);turn('upperarm_r',x,-.9);}
}
export function createShadowPoseDriver(mixer,bones){
 const entries=Object.values(bones).filter(Boolean).map(bone=>({bone,base:bone.quaternion.clone()}));
 return (dt,motion,locked)=>{
  // AnimationMixer skips unchanged tracks. Remove last frame's overlay before sampling.
  for(const e of entries)e.bone.quaternion.copy(e.base);
  mixer.update(dt);
  for(const e of entries)e.base.copy(e.bone.quaternion);
  applyShadowPose(bones,motion,locked);
 };
}
