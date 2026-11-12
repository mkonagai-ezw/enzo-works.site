import * as THREE from 'three';
import {createNewspaper} from './newspaper.js?v=layout-2';
import {createCupboardHaunting} from './cupboard-haunting.js';

export const NOTE_TEXT='オワッタ\nスベテシッパイ\nスベテウシナッタ\nスベテスベテスベテスベテダ';
export const NOTE_POSITION=[6.45,0,-4.75];
export const CLUE_VIEWS={
 newspaper:{eye:[2.62,2.29,-1.55],target:[2.62,.70,-2.65]},
 note:{eye:[6.45,1.62,-3.65],target:[6.45,.04,-4.75]},
 ropes:{eye:[7,1.62,-4.4],target:[8.4,1.25,-6.2]},
 chains:{eye:[-2.25,2.29,2.9],target:[-3.25,.72,3.5]},
 cabinet:{eye:[-1.32,2.29,-3.28],target:[-1.5,1.65,-4.43]},
 fallen:{eye:[-1.32,2.29,-2.85],target:[-1.4,1.05,-4.1]},
 portrait:{eye:[.65,2.29,-4.3],target:[.65,1.83,-5.78]},
 shoes:{eye:[7.4,1.62,3.3],target:[9.05,.18,2.35]}
};
export async function createForeshadowing({loader,scene,navigation,surfaceHeight,onCupboardClose}){
 const [a,b,c,noteAsset,artAsset]=await Promise.all(['clues-initial.glb','clues-reveal.glb','clue-child-shoe.glb','despair-note-v2.glb','scattered-art-supplies.glb'].map(f=>loader.loadAsync('assets/'+f)));
 const newspaper=await createNewspaper(surfaceHeight);b.scene.add(newspaper.paper);
 const note=noteAsset.scene,art=artAsset.scene;note.name='Mysterious note near well';note.position.fromArray(NOTE_POSITION);note.position.y=surfaceHeight(NOTE_POSITION[0],NOTE_POSITION[2])+.012;art.name='Scattered drawing supplies';b.scene.add(note,art);
 const initial=a.scene,reveal=b.scene;initial.name='Initial story clues';reveal.name='Chant story clues';reveal.visible=false;scene.add(initial,reveal);
 for(const root of [initial,reveal])root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.shadowSide=THREE.FrontSide;}});
 reveal.traverse(o=>{for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){
  if(m.name.startsWith('Dusty drawing paper')){m.color.setRGB(.52,.49,.43);m.roughness=.97;}
  if(m.name==='Frantic graphite on old paper'){m.color.setRGB(.78,.75,.68);}
  if(m.name==='Clue worn black lacquer'){m.color.setRGB(.16,.13,.095);m.roughness=.78;m.normalScale.set(.65,.65);m.needsUpdate=true;}
  if(m.name==='Clue dull worn gold'){m.roughness=.72;m.normalScale.set(.23,.23);}
 }});
 navigation.colliders.push({name:'Old memorial cupboard',min:[-2.03,.672,-4.95],max:[-.60,2.33,-4.38]});
 const cupboard=await createCupboardHaunting({initial,scene,onClose:onCupboardClose});
 const shoes=new THREE.Group();shoes.name='Discarded child shoes';reveal.add(shoes);
 let seed=992;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const placements=[];
 // Three irregular pockets, plus stray shoes toward the edge of the undergrowth.
 for(let i=0;i<24;i++){
  const cluster=i%3,x=8.35+cluster*.64+(rand()-.5)*.85,z=1.65+cluster*.38+(rand()-.5)*1.12;
  const s=.67+rand()*.43,tilt=i%7===0?1.2:(rand()-.5)*.19;
  placements.push({x,z,s,yaw:rand()*Math.PI*2,tilt,color:new THREE.Color().setRGB(.65+rand()*.22,.59+rand()*.20,.49+rand()*.22)});
 }
 c.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(c.scene),dummy=new THREE.Object3D();
 c.scene.traverse(o=>{
  if(!o.isMesh)return;const geometry=o.geometry.clone();
  // Meshopt normalized integer attributes must be decoded before baking transforms.
  for(const name of ['position','normal']){const at=geometry.getAttribute(name);if(at?.normalized){const f=new Float32Array(at.count*3);for(let i=0;i<at.count;i++){f[i*3]=at.getX(i);f[i*3+1]=at.getY(i);f[i*3+2]=at.getZ(i);}geometry.setAttribute(name,new THREE.BufferAttribute(f,3));}}
  geometry.applyMatrix4(o.matrixWorld);const material=o.material.clone();material.roughness=.97;material.metalness=0;material.shadowSide=THREE.FrontSide;
  const batch=new THREE.InstancedMesh(geometry,material,placements.length);batch.castShadow=true;batch.receiveShadow=false;
  placements.forEach((p,i)=>{dummy.position.set(0,0,0);dummy.rotation.set(0,p.yaw,p.tilt);dummy.scale.setScalar(p.s);dummy.updateMatrix();const low=bounds.clone().applyMatrix4(dummy.matrix).min.y;dummy.position.set(p.x,surfaceHeight(p.x,p.z)+.006-low,p.z);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);batch.setColorAt(i,p.color);});batch.computeBoundingSphere();shoes.add(batch);
 });
 const clues=[
  {id:'newspaper',label:'古い新聞記事',point:newspaper.paper.position.clone().add(new THREE.Vector3(0,.025,0)),title:newspaper.article.title,text:newspaper.text,image:newspaper.image,reading:true},
  {id:'note',label:'謎のメモ書き',point:note.position.clone().add(new THREE.Vector3(0,.014,0)),text:NOTE_TEXT},
  {id:'chains',label:'錆びた鎖',point:new THREE.Vector3(-3.25,.72,3.5),text:'小さな輪のついた鎖。\n畳には、何度も擦ったような跡がある。',always:true},
  {id:'tablets',label:'収納の中',point:new THREE.Vector3(-.98,1.6,-4.39),text:'奥まで、びっしりと位牌が並んでいる。\n名前の部分は擦れて、読み取れない。'},
  {id:'portrait',label:'古い写真',point:new THREE.Vector3(.65,1.83,-5.795),text:'見知らぬ男の写真。\nこの部屋を、見張っているように見える。'},
  {id:'shoes',label:'藪の中の靴',point:new THREE.Vector3(9.05,.18,2.35),text:'どれも、小さな靴だ。\n対になる片方が見つからない。'}
 ];
 let revealed=false;
 return {initial,reveal,clues,note,art,cupboard,
  show(){revealed=true;reveal.visible=true;cupboard.show();},reset(){revealed=false;reveal.visible=false;cupboard.reset();},
  target(camera,clearLine){const direction=camera.getWorldDirection(new THREE.Vector3());for(const c of clues){if(!c.always&&!revealed)continue;if(c.id==='tablets'&&!cupboard.state.open)continue;const delta=c.point.clone().sub(camera.position);if(delta.length()<2.6&&delta.normalize().dot(direction)>.9&&clearLine(camera.position,c.point))return 'clue:'+c.id;}return null;},
  get(id){return clues.find(c=>'clue:'+c.id===id);},
  diagnostics(){return {ropes:2,chainLinks:84,cabinetVisible:initial.visible,cupboard:cupboard.diagnostics(),delayedVisible:revealed,shoes:revealed?placements.length:0,tablets:revealed?30:0,portrait:revealed,note:revealed,artSupplies:revealed,notePosition:note.position.toArray()};}
 };
}
