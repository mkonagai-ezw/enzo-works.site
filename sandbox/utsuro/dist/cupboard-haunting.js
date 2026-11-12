import * as THREE from './vendor/three.module.js';
import {CupboardState} from './cupboard-state.js';

// The source GLB batches the fixed cupboard and old door by material.
// Remove only the old front panel/handle triangles; preserve the shelves and chains.
export function removeTrianglesInBox(mesh,box){
 const geo=mesh.geometry,index=geo.index,position=geo.attributes.position,kept=[],p=new THREE.Vector3();let removed=0;
 for(let i=0;i<(index?.count||position.count);i+=3){let inside=true;const ids=[];
  for(let k=0;k<3;k++){const id=index?index.getX(i+k):i+k;ids.push(id);p.fromBufferAttribute(position,id).applyMatrix4(mesh.matrixWorld);inside&&=box.containsPoint(p);}
  if(inside)removed++;else kept.push(...ids);
 }
 if(removed){mesh.geometry=geo.clone();mesh.geometry.setIndex(kept);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
 return removed;
}
export async function createCupboardHaunting({initial,scene,onClose=()=>{}}){
 initial.updateMatrixWorld(true);let wood,removed=0;
 initial.traverse(o=>{if(!o.isMesh)return;
  if(o.material?.name==='Clue aged cabinet wood'){wood=o.material;removed+=removeTrianglesInBox(o,new THREE.Box3(new THREE.Vector3(-2.1,.68,-4.434),new THREE.Vector3(-.5,2.34,-4.37)));}
  if(o.material?.name==='Clue rusted iron')removed+=removeTrianglesInBox(o,new THREE.Box3(new THREE.Vector3(-1.05,1.42,-4.40),new THREE.Vector3(-1.01,1.57,-4.37)));
 });
 if(!wood||!removed)throw Error('収納の引き戸を分離できませんでした');
 const state=new CupboardState(),group=new THREE.Group();group.name='Sliding haunted cupboard';scene.add(group);
 const timber=wood.clone(),iron=new THREE.MeshStandardMaterial({color:'#211b15',roughness:.94,metalness:.18});
 function box(size,material){const g=new THREE.BoxGeometry(...size),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){const axis=Math.abs(n.getX(i))>.5?0:Math.abs(n.getY(i))>.5?1:2;uv.setXY(i,(axis===0?p.getZ(i):p.getX(i))*2.4,p.getY(i)*2.4);}uv.needsUpdate=true;
  const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 }
 function panel(x,z){const root=new THREE.Group();root.position.set(x,1.497,z);group.add(root);
  const slab=box([.68,1.51,.028],timber);root.add(slab);
  const handle=box([.024,.13,.004],iron);handle.position.set(.23,.01,.016);root.add(handle);return root;
 }
 panel(-1.65,-4.425);const moving=panel(-.99,-4.39);
 for(const y of [.732,2.262]){const rail=box([1.31,.028,.055],timber);rail.position.set(-1.32,y,-4.398);group.add(rail);}
 const texture=await new THREE.TextureLoader().loadAsync('assets/peeking-child/doll-face-v2.png');texture.colorSpace=THREE.SRGBColorSpace;
 const height=.56,width=height*texture.image.width/texture.image.height,left=-.76-width/2,right=-.682,faceGeometry=new THREE.PlaneGeometry(right-left,height);
 // Keep the original image scale, trimming only the quad at the cupboard's side.
 const faceUV=faceGeometry.attributes.uv;for(let i=0;i<faceUV.count;i++)faceUV.setX(i,faceUV.getX(i)*(right-left)/width);
 const face=new THREE.Mesh(faceGeometry,new THREE.MeshStandardMaterial({map:texture,alphaTest:.4,roughness:1,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.11}));
 face.name='Face behind the cupboard gap';face.position.set((left+right)/2,1.98,-4.455);group.add(face);
 const point=new THREE.Vector3(-1.32,1.6,-4.35),closePosition=point.clone(),raycaster=new THREE.Raycaster(),direction=new THREE.Vector3(),delta=new THREE.Vector3();
 const samples=[new THREE.Vector3(-.705,2.06,-4.453),new THREE.Vector3(-.71,2.01,-4.453),new THREE.Vector3(-.715,1.94,-4.453)];
 const blockers=[];initial.traverse(o=>{if(o.isMesh)blockers.push(o);});group.traverse(o=>{if(o.isMesh&&o!==face)blockers.push(o);});
 const interactables=[];group.traverse(o=>{if(o.isMesh)interactables.push(o);});
 function sync(){moving.position.x=-.99-state.offset;face.visible=state.faceVisible;group.updateMatrixWorld(true);}
 function illuminated(camera,flash,clearLine){
  if(!flash.visible||flash.intensity<=0||camera.position.z<-4.4)return false;
  direction.subVectors(flash.target.position,flash.position).normalize();
  for(const sample of samples){delta.subVectors(sample,flash.position);const distance=delta.length();if(distance>4.5||distance>flash.distance||distance<.05)continue;
   delta.divideScalar(distance);if(delta.dot(direction)<Math.cos(flash.angle*.88))continue;
   if(!clearLine(flash.position,sample)||!clearLine(camera.position,sample))continue;
   raycaster.set(flash.position,delta);raycaster.near=.01;raycaster.far=distance-.003;
   if(!raycaster.intersectObjects(blockers,false).length)return true;
  }return false;
 }
 sync();
 return {group,state,point,
  target(camera,clearLine){if(state.moving||camera.position.z<-4.3||camera.position.distanceToSquared(point)>12)return false;raycaster.set(camera.position,camera.getWorldDirection(direction));raycaster.near=.02;raycaster.far=2.6;const hit=raycaster.intersectObjects(interactables.filter(o=>o.visible),false)[0];return !!hit&&clearLine(camera.position,hit.point);},
  interact(){const action=state.interact();if(action==='slam'||action==='close')onClose(closePosition);sync();return action;},
  show(){state.reveal();sync();},reset(){state.reset();sync();},
  update(dt,{active,beforeJizo,camera,flash,clearLine}){if(!beforeJizo&&!state.revealed)state.reveal();const lit=active&&state.mode==='peeking'&&beforeJizo&&illuminated(camera,flash,clearLine);if(state.update(dt,{active,lit}))onClose(closePosition);sync();},
  get shadowKey(){return state.offset+','+face.visible;},
  diagnostics(){return {mode:state.mode,offset:+state.offset.toFixed(3),faceVisible:face.visible,consumed:state.consumed,slams:state.slams,revealed:state.revealed,removedTriangles:removed};}
 };
}
