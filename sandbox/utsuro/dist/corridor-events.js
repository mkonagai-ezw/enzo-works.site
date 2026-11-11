import * as THREE from 'three';

import {CORRIDOR_COUNT,corridorMessage} from './corridor-choices.js';
export class CorridorDollState{
 constructor(){this.reset();}
 reset(){this.phase='hidden';this.seenTime=0;}
 appear(){this.phase='waiting';this.seenTime=0;}
 inspect(){if(this.phase!=='waiting')return false;this.phase='reading';return true;}
 finishHint(){if(this.phase==='reading')this.phase='seen';}
 retryHint(){if(this.phase==='reading')this.phase='waiting';}
 update(dt,{active,visible,outside}){
  if(!active||this.phase==='hidden'||this.phase==='gone')return;
  if(this.phase==='seen'&&outside)this.phase='gone';
 }
 get present(){return ['waiting','reading','seen'].includes(this.phase);}
}
export async function createCorridorEvents({loader,scene,dollSource,architecture}){
 const group=new THREE.Group();group.name='Corridor pointing monks';scene.add(group);
 const assets=await Promise.all(['left','right'].map(s=>loader.loadAsync('assets/monk-pointing-'+s+'.glb')));
 const monks=assets.map((asset,i)=>{const root=asset.scene;root.position.set(i?1.05:-1.05,0,-23.5);root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;}});group.add(root);return {id:i?'right':'left',root,point:new THREE.Vector3(root.position.x,1.48,root.position.z+.1)};});
 const doll=new THREE.Group();doll.name='Corridor hint doll';const model=dollSource.clone(true);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
 model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));doll.add(model);doll.rotation.y=-.45;doll.position.set(0,0,-9);doll.visible=false;scene.add(doll);
 const state=new CorridorDollState(),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),box=new THREE.Box3(),point=new THREE.Vector3(),direction=new THREE.Vector3(),ray=new THREE.Raycaster();let outcome=null,floor=1;
 function lineClear(camera,target){direction.copy(target).sub(camera.position);const distance=direction.length();ray.set(camera.position,direction.normalize());ray.far=Math.max(0,distance-.1);return ray.intersectObject(architecture,true).length===0;}
 return {group,doll,state,monks,
  reset(block=1){floor=Math.max(1,Math.min(CORRIDOR_COUNT,block));state.appear();doll.visible=true;group.visible=true;outcome=null;doll.updateMatrixWorld(true);box.setFromObject(doll);},
  inspect(){return state.inspect();},
  finishHint(){state.finishHint();},
  retryHint(){state.retryHint();},
  accept(correct){if(outcome!==null||typeof correct!=='boolean')return false;outcome=correct?'success':'failure';if(!correct){state.reset();doll.visible=false;group.visible=false;}return true;},
  canStand(x,z){return (!state.present||Math.hypot(x-doll.position.x,z-doll.position.z)>.3)&&(!group.visible||monks.every(m=>Math.hypot(x-m.root.position.x,z-m.root.position.z)>.48));},
  target(camera){if(!group.visible||outcome==='failure')return null;const forward=camera.getWorldDirection(new THREE.Vector3());if(state.phase==='waiting'){point.copy(doll.position);point.y+=.48;direction.copy(point).sub(camera.position);if(direction.length()<2.8&&direction.normalize().dot(forward)>.88&&lineClear(camera,point))return 'hint-doll';}for(const m of monks){direction.copy(m.point).sub(camera.position);if(direction.length()<2.5&&direction.normalize().dot(forward)>.85&&lineClear(camera,m.point))return 'corridor:'+m.id;}return null;},
  message(id){return corridorMessage(floor,id.replace('corridor:',''));},
  update(dt,camera,active){if(!active||state.phase!=='seen')return;camera.updateMatrixWorld(true);matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);state.update(dt,{active,outside:!frustum.intersectsBox(box)});doll.visible=state.present;},
  get floor(){return floor;},get outcome(){return outcome;},
  diagnostics(){return {outcome,floor,dollPhase:state.phase,dollVisible:doll.visible,monksVisible:group.visible,monks:monks.map(m=>({id:m.id,position:m.root.position.toArray()}))};}
 };
}
