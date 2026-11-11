import * as THREE from 'three';

// A quiet standing pose from the bind skeleton, independent of combat animations.
export function createFarewellPose(model,index=0){
 const a=new THREE.Vector3(),b=new THREE.Vector3(),parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),delta=new THREE.Quaternion();
 function aim(name,childName,direction){
  const bone=model.getObjectByName(name),child=model.getObjectByName(childName);if(!bone||!child)throw Error('Farewell skeleton: '+name);
  model.updateMatrixWorld(true);bone.getWorldPosition(a);child.getWorldPosition(b);b.sub(a).normalize();delta.setFromUnitVectors(b,new THREE.Vector3(...direction).normalize());
  bone.getWorldQuaternion(worldQ);bone.parent.getWorldQuaternion(parentQ);bone.quaternion.copy(parentQ.invert().multiply(delta).multiply(worldQ));model.updateMatrixWorld(true);
 }
 for(const side of ['l','r']){const sign=side==='l'?1:-1;
  aim('upperarm_'+side,'lowerarm_'+side,[sign*.10,-1,.025]);
  aim('lowerarm_'+side,'hand_'+side,[-sign*.025,-1,.075]);
  aim('hand_'+side,'middle_01_'+side,[sign*.015,-1,.04]);
 }
 const spine=model.getObjectByName('spine_03'),head=model.getObjectByName('Head');
 const spineBase=spine.quaternion.clone(),headBase=head.quaternion.clone(),q=new THREE.Quaternion(),x=new THREE.Vector3(1,0,0);
 return time=>{spine.quaternion.copy(spineBase).multiply(q.setFromAxisAngle(x,Math.sin(time*.9+index*.8)*.003));head.quaternion.copy(headBase).multiply(q.setFromAxisAngle(x,.018+Math.sin(time*.6+index)*.002));};
}
