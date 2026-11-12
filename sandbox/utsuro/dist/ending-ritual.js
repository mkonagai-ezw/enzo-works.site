import * as THREE from 'three';
import {flameBatch} from './monk-fire.js?v=family-collapse-1';
import {createIgnition} from './monk-fire-ignition.js';
import {ENDING_TIMING} from './ending-state.js?v=family-collapse-1';
import {createEndingCollapse} from './ending-collapse.js';
import {createEmbers} from './monk-fire-embers.js';

export async function createEndingRitual(scene,loader,mobile){
 const [asset,map]=await Promise.all([loader.loadAsync('assets/monk-praying.glb'),new THREE.TextureLoader().loadAsync('assets/fire/flame03-hq.webp')]);
 const monks=new THREE.Group();monks.name='Twelve praying monks';monks.visible=false;scene.add(monks);asset.scene.updateMatrixWorld(true);
 const placements=[];for(const z of [-2.2,-3.7,-5.2,-6.7,-8.2,-9.7])for(const side of [-1,1])placements.push(new THREE.Vector3(side*1.39,0,z));
 const dummy=new THREE.Object3D(),matrix=new THREE.Matrix4(),center=new THREE.Vector3(0,0,-5.2);
 asset.scene.traverse(o=>{if(!o.isMesh)return;const m=o.material.clone();m.shadowSide=THREE.FrontSide;if(/face seal/i.test(m.name))Object.assign(m,{transparent:false,alphaTest:.35,depthWrite:true});
  const batch=new THREE.InstancedMesh(o.geometry,m,placements.length);batch.castShadow=false;batch.receiveShadow=false;
  placements.forEach((p,i)=>{dummy.position.copy(p);dummy.lookAt(center);dummy.updateMatrix();matrix.multiplyMatrices(dummy.matrix,o.matrixWorld);batch.setMatrixAt(i,matrix);});batch.computeBoundingSphere();monks.add(batch);
 });
 map.colorSpace=THREE.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;
 const fire=new THREE.Group();fire.name='Farewell burning corridor';fire.visible=false;scene.add(fire);
 const halo=new THREE.Mesh(new THREE.PlaneGeometry(2.9,2.9),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{power:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float power;void main(){vec2 p=(vUv-.5)*2.;float a=pow(max(0.,1.-dot(p,p)),2.)*power;gl_FragColor=vec4(.85,.22,.035,a);}'}));halo.position.set(0,1.25,-4.7);halo.renderOrder=4;fire.add(halo);
 const familyLayers=[],frontLayers=[];
 for(const [x,z,height] of [[-.34,-5.1,2.2],[.34,-5.1,1.95],[0,-5.6,1.15]]){
  familyLayers.push({at:[x-.14,.45,z+.25],size:[1.05,height],phase:familyLayers.length*13,rate:1,gain:.65,birth:0});
  familyLayers.push({at:[x+.17,.2,z+.16],size:[.85,height],phase:familyLayers.length*17,rate:1.13,gain:.55,birth:.13});
  frontLayers.push({at:[x,0,z-.18],size:[.55,.58],phase:familyLayers.length*9,rate:.9,gain:.5,birth:.25});
 }
 const familyFire=flameBatch(map,familyLayers);familyFire.renderOrder=5;fire.add(familyFire);
 const frontFire=flameBatch(map,frontLayers);frontFire.renderOrder=8;fire.add(frontFire);
 const hallLayers=[];for(let i=0;i<(mobile?8:12);i++)for(const side of [-1,1]){
  const z=-1.2-i*(mobile?1.5:1.02),birth=(ENDING_TIMING.spread-ENDING_TIMING.ignite+Math.abs(z+5.1)*.45)*1.4;
  hallLayers.push({at:[side*1.72,.02,z],size:[1.15,2.45+(i%3)*.23],phase:i*19+side*12,rate:.85+(i%4)*.1,gain:.8,birth});
  if(!mobile)hallLayers.push({at:[side*1.78,.55,z+.2],size:[.82,2.35],phase:i*23+side*7,rate:1.1,gain:.3,birth:birth+2});
 }
 const hallFire=flameBatch(map,hallLayers);hallFire.renderOrder=5;fire.add(hallFire);
 const ceilingLayers=[];
 for(let i=0;i<(mobile?10:18);i++){const side=i%2?1:-1,z=-2.5-Math.floor(i/2)*1.05;
 ceilingLayers.push({at:[side*1.88,2.55,z],size:[.8+(i%3)*.15,1.25+(i%4)*.19],angle:-side*(Math.PI/2+.42),phase:i*19,rate:.62+(i%5)*.13,gain:.58,birth:(ENDING_TIMING.ceiling-ENDING_TIMING.ignite+Math.abs(z+5)*.3)*1.4});}
 const ceilingFire=flameBatch(map,ceilingLayers);ceilingFire.renderOrder=9;
 // Ceiling tongues need a tapered, warm base; the upright atlas's white foot would read as a rectangular card here.
 ceilingFire.material.fragmentShader=ceilingFire.material.fragmentShader.replace('gl_FragColor=vec4(color*vGain*strength*1.25,edge*.8*smoothstep(0.,.85,vAge));',`float width=.12+.4*sin(clamp(vUv.y+.1,0.,1.)*3.14159);float plume=(1.-smoothstep(width*.65,width,abs(vUv.x-.5)))*smoothstep(0.,.38,vUv.y);gl_FragColor=vec4(min(color,vec3(1.,.36,.055))*vGain*strength,edge*plume*.8*smoothstep(0.,.85,vAge));`);
 fire.add(ceilingFire);
 const collapse=await createEndingCollapse(scene,mobile);
 const ignition=await createIgnition(0);ignition.mesh.position.set(0,0,-5.25);ignition.mesh.scale.set(1.6,1,1);ignition.mesh.renderOrder=10;fire.add(ignition.mesh);
 const embers=[];for(const x of [-.34,.34]){const e=createEmbers();e.mesh.position.set(x,0,-5.1);fire.add(e.mesh);embers.push(e);}
 const lights=[-5.2,-2,-9,-12].map(z=>{const l=new THREE.PointLight('#ff8e35',0,6.5,2);l.position.set(0,1.2,z);scene.add(l);return l;});
 function reset(){collapse.reset();monks.visible=false;fire.visible=false;for(const l of lights)l.intensity=0;}
 return {monks,fire,collapseRoot:collapse.root,reset,
  update(state){
   collapse.update(state);monks.visible=state.monksVisible;fire.visible=state.fireActive;if(!fire.visible){for(const l of lights)l.intensity=0;return;}
   const t=state.fireSeconds*1.4,joining=state.time>=ENDING_TIMING.join&&state.time<ENDING_TIMING.spread,strength=joining?.95:1.4;
   frontFire.material.uniforms.clock.value=t;frontFire.material.uniforms.strength.value=strength;frontFire.material.uniforms.fps.value=24;
   halo.material.uniforms.power.value=.7*THREE.MathUtils.smoothstep(t,0,.7);
   familyFire.material.uniforms.clock.value=t;familyFire.material.uniforms.strength.value=strength;familyFire.material.uniforms.fps.value=24;
   ceilingFire.material.uniforms.clock.value=t;ceilingFire.material.uniforms.strength.value=1.25+state.ceiling*.35;ceilingFire.material.uniforms.fps.value=24;
   hallFire.material.uniforms.clock.value=t;hallFire.material.uniforms.strength.value=1.6;hallFire.material.uniforms.fps.value=24;
   ignition.update(t,1.6,true);for(const e of embers)e.update(t,1.3,mobile?1:1.6,true);
   lights.forEach((l,i)=>{const grow=i?THREE.MathUtils.smoothstep(state.time,ENDING_TIMING.spread+i,ENDING_TIMING.spread+4+i):THREE.MathUtils.smoothstep(t,0,.3);l.intensity=grow*(i?9:7)*(1+Math.sin(t*9+i)*.07);});
  },diagnostics(){return {collapse:collapse.diagnostics(),ceilingLayers:ceilingLayers.length,monks:monks.visible?placements.length:0,monkDraws:monks.children.length,fire:fire.visible,flameLayers:familyLayers.length+frontLayers.length+hallLayers.length,ignition:fire.visible&&ignition.mesh.visible};}
 };
}
