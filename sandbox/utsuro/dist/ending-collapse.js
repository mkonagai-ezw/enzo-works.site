import * as THREE from 'three';
import {createBillboardBatch} from './billboard-batch.js';
import {ENDING_TIMING} from './ending-state.js?v=family-collapse-1';

// Seeded, absolute-time animation: no physics spikes, no accumulated drift on pause.
export async function createEndingCollapse(scene,mobile){
 const map=await new THREE.TextureLoader().loadAsync('assets/fire/smoke_01.png');
 const root=new THREE.Group();root.name='Ceiling smoke ash and falling charred timber';root.visible=false;scene.add(root);
 const smoke=createBillboardBatch(map,mobile?22:38,{alphaOnly:true});root.add(smoke.mesh);smoke.mesh.renderOrder=12;
 const dust=createBillboardBatch(map,mobile?8:14,{alphaOnly:true});root.add(dust.mesh);dust.mesh.renderOrder=14;
 const count=mobile?140:320,positions=new Float32Array(count*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const ashMaterial=new THREE.PointsMaterial({color:'#a69c88',size:.009,transparent:true,opacity:0,depthWrite:false});const ash=new THREE.Points(geo,ashMaterial);ash.frustumCulled=false;root.add(ash);
 let wood;scene.traverse(o=>{if(!wood&&o.isMesh&&o.material?.name==='Corridor - old timber')wood=o.material;});
 const timberMaterial=wood?wood.clone():new THREE.MeshStandardMaterial();timberMaterial.color.set('#33251c');timberMaterial.roughness=1;timberMaterial.metalness=0;
 timberMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 #ifdef USE_MAP
 float lines=sin(vMapUv.x*270.+sin(vMapUv.y*35.)*3.);float charred=smoothstep(-.2,.7,lines);diffuseColor.rgb*=mix(.16,.65,charred);
 #endif`);};timberMaterial.customProgramCacheKey=()=> 'charred-ending-timber-1';const beams=[];
 for(let i=0;i<(mobile?9:15);i++){
  const large=i<5,length=large?2.8+i*.2:.18+(i%3)*.17,geometry=new THREE.BoxGeometry(length,large?.25:.16,large?.3:.22,1,3,3),v=geometry.attributes.position;
  for(let n=0;n<v.count;n++){const x=v.getX(n),y=v.getY(n),z=v.getZ(n);if(Math.abs(x)>length*.49)v.setX(n,x+Math.sin(y*93+z*57+i)*.085);}v.needsUpdate=true;geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,timberMaterial);
  mesh.position.set(0,4,-8);mesh.visible=false;root.add(mesh);
  beams.push({mesh,delay:i*.21,x:large?Math.sin(i*2)*.35:Math.sin(i*9)*1.5,z:large?-8.1-i*.28:-6.7-(i%5)*.55,angle:(i%2?1:-1)*(.2+(i%3)*.19)});
 }
 let last={};
 return {root,reset(){root.visible=false;for(const b of beams)b.mesh.visible=false;},update(state){
  root.visible=state.fireActive;if(!root.visible)return;
  const t=state.fireSeconds,build=state.spread,ceiling=state.ceiling,fall=Math.max(0,state.time-ENDING_TIMING.collapse);
  smoke.sprites.forEach((s,i)=>{const cycle=(t*.10+i*.618)%1,near=i%3===0;
   s.position.set(Math.sin(i*4.7+t*.16)*(near?1.2:1.65),2.0+cycle*.95,-2.4-(i%11)*.83);
   s.scale.set(1.3+cycle*1.8,1+cycle*.95,1);s.material.rotation=i*1.7+t*.025;
   s.material.color.setRGB(.085+build*.035,.065+build*.02,.052);
   s.material.opacity=Math.sin(cycle*Math.PI)*(.04+.23*build+.19*ceiling);
  });smoke.sync();
  for(let i=0;i<count;i++){const speed=.26+(i%7)*.047,age=(t*speed+i*.618)%3;positions[i*3]=Math.sin(i*7.3)*1.8+Math.sin(t*.6+i)*.1;positions[i*3+1]=3-age;positions[i*3+2]=-1.8-(i%41)*.26;}
  geo.attributes.position.needsUpdate=true;ashMaterial.opacity=.75*ceiling;
  let falling=0;
  for(const b of beams){const age=fall-b.delay;b.mesh.visible=state.time>=ENDING_TIMING.collapse&&age>=0;if(!b.mesh.visible)continue;falling++;
   const descent=Math.min(age,1.1);b.mesh.position.set(b.x,Math.max(.18,3.65-2.6*descent*descent),b.z);b.mesh.rotation.set(age*.32,b.angle*.5,b.angle+Math.min(age,1.2)*b.angle*.7);
  }
  dust.sprites.forEach((s,i)=>{const age=Math.max(0,fall-.65-i*.055);s.position.set(Math.sin(i*3.7)*1.35,.35+Math.min(age,2)*.65,-8.1-(i%4)*.38);s.scale.set(1+Math.min(age,2)*1.6,1+Math.min(age,2)*1.1,1);s.material.color.set('#100e0c');s.material.rotation=i*.7;s.material.opacity=Math.min(.7,age*.6);});dust.sync();
  last={smoke:smoke.sprites.length,ash:ceiling>0?count:0,fallingTimbers:falling,ceiling:+ceiling.toFixed(2)};
 },diagnostics(){return {visible:root.visible,...last};}};
}
