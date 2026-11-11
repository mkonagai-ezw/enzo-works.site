import * as THREE from 'three';
import {clone} from './vendor/addons/utils/SkeletonUtils.js';

// One independently skinned arm per placement. Geometry and the black material are shared.
export function createShadowArms({scene,gltf,placements,floor=.672,ceiling=3.04}){
 const group=new THREE.Group();group.name='Shadow arms';scene.add(group);
 const material=new THREE.MeshBasicMaterial({color:0x020304,side:THREE.DoubleSide,clippingPlanes:[new THREE.Plane(new THREE.Vector3(0,1,0),-floor),new THREE.Plane(new THREE.Vector3(0,-1,0),ceiling)]});
 const stainMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{amount:{value:1}},vertexShader:`varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 uvp;uniform float amount;void main(){vec2 p=uvp-.5;float a=atan(p.y,p.x),r=length(p);float edge=.34+.035*sin(a*7.)+.018*cos(a*13.);float alpha=(1.-smoothstep(.10,edge,r))*.8*amount;gl_FragColor=vec4(.002,.003,.004,alpha);}`});
 const patchGeo=new THREE.PlaneGeometry(1,1),arms=[];let elapsed=0,mode='Sway';
 const clips=new Map(gltf.animations.map(c=>[c.name,c]));
 for(const [i,p] of placements.entries()){
  const root=new THREE.Group();root.position.fromArray(p.position);root.rotation.set(0,p.yaw||0,p.ceiling?Math.PI:0);root.scale.setScalar(p.scale||1);group.add(root);
  const model=clone(gltf.scene);root.add(model);
  model.traverse(o=>{if(o.isMesh){o.material=material;o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false;}});
  const patch=new THREE.Mesh(patchGeo,stainMaterial);patch.rotation.x=-Math.PI/2;patch.scale.set(.34,.29,1);patch.position.y=(p.ceiling?p.position[1]-ceiling+.003:floor-p.position[1]+.003)/(p.scale||1);root.add(patch);
  const mixer=new THREE.AnimationMixer(model);const actions=Object.fromEntries([...clips].map(([name,clip])=>[name,mixer.clipAction(clip)]));
  const arm={root,model,mixer,actions,patch,delay:p.delay??i*.09,speed:p.speed??(.75+(i%7)*.073),phase:p.phase??(i*1.731)%8,started:false};
  arms.push(arm);
 }
 function play(arm,name,fade=false){
  const a=arm.actions[name];if(!a)return;
  if(!fade)arm.mixer.stopAllAction();
  a.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);a.setLoop(['Emerge','Retract'].includes(name)?THREE.LoopOnce:THREE.LoopRepeat,Infinity);a.clampWhenFinished=true;
  if(fade){for(const other of Object.values(arm.actions))if(other!==a&&other.isScheduled())other.fadeOut(.45);a.fadeIn(.45);}
  if(name==='Sway'||name==='Writhe')a.time=arm.phase;
  a.play();arm.mixer.update(0);
 }
 function setMode(name){mode=name;elapsed=0;for(const a of arms){a.started=false;a.emerged=false;a.root.visible=name!=='Emerge';a.patch.visible=name!=='Emerge';if(name==='Emerge')play(a,'Emerge');else play(a,name);}}
 setMode('Sway');
 return {group,setMode,
  update(dt){elapsed+=dt;for(const a of arms){
   if(mode==='Emerge'&&!a.started){if(elapsed<a.delay)continue;a.started=true;a.root.visible=true;a.patch.visible=true;play(a,'Emerge');}
   a.mixer.update(dt*a.speed);
   if(mode==='Emerge'&&!a.emerged&&a.actions.Emerge.time>=clips.get('Emerge').duration){a.emerged=true;play(a,(arms.indexOf(a)%3===0?'Writhe':'Sway'),true);}
   if(mode==='Retract'&&a.actions.Retract.time>=clips.get('Retract').duration)a.patch.visible=false;
  }},
  diagnostics(){return {count:arms.length,mode,elapsed:+elapsed.toFixed(2),visible:arms.filter(a=>a.root.visible).length,clips:[...clips.keys()],independentSkeletons:new Set(arms.map(a=>{let s;a.model.traverse(o=>{if(o.isSkinnedMesh)s=o.skeleton;});return s;})).size};},
  dispose(){for(const a of arms){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);a.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}group.removeFromParent();material.dispose();stainMaterial.dispose();patchGeo.dispose();}
 };
}
