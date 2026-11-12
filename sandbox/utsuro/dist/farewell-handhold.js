import * as THREE from './vendor/three.module.js';

// Analytic two-bone IK, applied in the silhouette bake scene's world coordinates.
export function createFarewellHandhold(model,index){
 const side=index?'l':'r',upper=model.getObjectByName('upperarm_'+side),lower=model.getObjectByName('lowerarm_'+side),hand=model.getObjectByName('hand_'+side),finger=model.getObjectByName('middle_01_'+side);
 if(!upper||!lower||!hand||!finger)throw Error('Handhold skeleton missing');
 const bones=[upper,lower,hand],rest=bones.map(b=>b.quaternion.clone());
 const target=new THREE.Vector3(index?-.34:.34,1.04,-.13),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),axis=new THREE.Vector3(),pole=new THREE.Vector3(),elbow=new THREE.Vector3();
 const delta=new THREE.Quaternion(),parent=new THREE.Quaternion(),world=new THREE.Quaternion();
 function aim(bone,child,to){
  model.updateWorldMatrix(true,true);bone.getWorldPosition(a);child.getWorldPosition(b);const wanted=c.copy(to).sub(a).normalize();b.sub(a).normalize();delta.setFromUnitVectors(b,wanted);
  bone.getWorldQuaternion(world);bone.parent.getWorldQuaternion(parent);bone.quaternion.copy(parent.invert().multiply(delta).multiply(world));model.updateWorldMatrix(true,true);
 }
 return progress=>{
  bones.forEach((bone,i)=>bone.quaternion.copy(rest[i]));model.updateWorldMatrix(true,true);
  if(progress<=0)return;
  const shoulder=upper.getWorldPosition(new THREE.Vector3()),mid=lower.getWorldPosition(new THREE.Vector3()),tip=hand.getWorldPosition(new THREE.Vector3());
  const l1=shoulder.distanceTo(mid),l2=mid.distanceTo(tip);axis.copy(target).sub(shoulder);const d=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
  pole.set(0,-1,-.15).addScaledVector(axis,-pole.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d);elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(upper,lower,elbow);aim(lower,hand,target);
  hand.getWorldPosition(a);const fingerTarget=a.clone().add(new THREE.Vector3(index?-.11:.11,-.025,0));aim(hand,finger,fingerTarget);
  bones.forEach((bone,i)=>{const posed=bone.quaternion.clone();bone.quaternion.copy(rest[i]).slerp(posed,progress);});model.updateWorldMatrix(true,true);
 };
}
