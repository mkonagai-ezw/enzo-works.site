import * as THREE from 'three';
import {EndingState,ENDING_TIMING} from './ending-state.js?v=family-collapse-1';
import {createEndingRitual} from './ending-ritual.js?v=family-collapse-1';
import {createEndingRitualAudio,loadEndingCollapseAudio} from './ending-ritual-audio.js?v=auto-epilogue-1';
import {createFarewellHandhold} from './farewell-handhold.js';
import {createEndingPresentation} from './ending-presentation.js?v=story-wording-1';
import {createFarewellPose} from './farewell-pose.js';
import {createSoftFarewellShadow} from './soft-farewell-shadow.js?v=handhold-1';
import {createEndingMemory} from './ending-memory.js';
import {cacheShadow} from './performance-runtime.js';

export async function createEndingStage({loader,dollSource,mobile,renderer,audioContext,ritualBuffers,soundEnabled=()=>true}){
 const [gltf,collapseBuffer,...people]=await Promise.all([loader.loadAsync('assets/ending/ending-stage.glb?v=candles-1'),loadEndingCollapseAudio(audioContext),...['male','female'].map(n=>loader.loadAsync('assets/couple/shadow-'+n+'.glb'))]);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x050403);scene.fog=new THREE.FogExp2(0x080604,.022);
 scene.add(new THREE.HemisphereLight(0x92959f,0x3b2819,.09));scene.add(gltf.scene);
 const left=gltf.scene.getObjectByName('ExitDoorLeft'),right=gltf.scene.getObjectByName('ExitDoorRight');
 if(!left||!right)throw Error('玄関の引き戸を読み込めません');
 const leftX=left.position.x,rightX=right.position.x;
 gltf.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.shadowSide=THREE.FrontSide;if(/Glass/.test(o.name)){o.material=new THREE.MeshStandardMaterial({color:'#e4e9d9',emissive:'#fff5d7',emissiveIntensity:1.7,roughness:.4});o.castShadow=false;}});
 const outside=new THREE.Mesh(new THREE.PlaneGeometry(11,7),new THREE.MeshBasicMaterial({color:'#fff9e6',toneMapped:false}));outside.position.set(0,2,-13.8);scene.add(outside);
 const sun=new THREE.SpotLight('#fff0cd',5,26,.54,.7,1.2);sun.position.set(0,3,-13.1);sun.target.position.set(0,.4,-4);sun.castShadow=true;sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
 for(const side of [-1,1]){const l=new THREE.SpotLight('#fceac7',15,8,.65,.8,1.1);l.position.set(side*2.7,2.1,-10.4);l.target.position.set(-side*.3,.05,-9);l.castShadow=false;scene.add(l,l.target);}
 // Match the branch block's model spacing, amber light, flame size and flicker.
 const candleGeometry=new THREE.SphereGeometry(1,8,6),candleMaterial=new THREE.MeshBasicMaterial({color:0xffd49a,toneMapped:false}),candles=[];
 for(const z of [-2.6,-6.8,-11])for(const side of [-1,1]){const flame=new THREE.Mesh(candleGeometry,candleMaterial);flame.position.set(side*1.64,1.332,z);flame.scale.set(.01,.032,.01);const light=new THREE.PointLight(0xffab58,5.2,9,2);light.position.set(side*1.64,1.36,z);scene.add(flame,light);candles.push({flame,light,phase:candles.length*1.73});}
 let candleTime=0;
 // Soft transparent shafts suggest suspended dust without full-screen postprocessing.
 const shafts=new THREE.Group();scene.add(shafts);
 const shaftMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:.035}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;void main(){float edge=pow(max(0.,sin(vUv.x*3.14159)),2.);float a=edge*sin(vUv.y*3.14159)*strength;gl_FragColor=vec4(1.,.88,.65,a);}',toneMapped:false});
 for(let i=0;i<5;i++){const beam=new THREE.Mesh(new THREE.PlaneGeometry(.28+i*.18,9.5),shaftMaterial);beam.position.set((i-2)*.27,1.15,-8);beam.rotation.x=Math.PI/2+.16;beam.rotation.z=(i-2)*.03;shafts.add(beam);}
 const family=new THREE.Group();family.name='Family farewell';scene.add(family);family.visible=false;
 const dissolveUniform={value:0},softParents=[],handPoses=[];let lastHandFrame=-1;
 function fadeMaterial(material){const m=material.clone();m.transparent=true;m.depthWrite=false;m.onBeforeCompile=s=>{s.uniforms.uDissolve=dissolveUniform;s.vertexShader='varying vec3 vDissolve;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDissolve=position;');s.fragmentShader='uniform float uDissolve;varying vec3 vDissolve;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\nfloat grain=fract(sin(dot(floor(vDissolve*130.),vec3(12.9898,78.233,45.164)))*43758.5453);if(grain<uDissolve)discard;diffuseColor.a*=1.-uDissolve;');};m.customProgramCacheKey=()=> 'farewell-dissolve-v1';return m;}
 function actor(model,height,x,z,shadow){model.updateMatrixWorld(true);let b=new THREE.Box3().setFromObject(model),c=b.getCenter(new THREE.Vector3()),s=height/(b.max.y-b.min.y);const shell=new THREE.Group();model.scale.multiplyScalar(s);model.position.sub(new THREE.Vector3(c.x,b.min.y,c.z)).multiplyScalar(s);shell.add(model);shell.position.set(x,0,z);shell.rotation.y=Math.PI;model.traverse(o=>{if(o.isMesh){o.material=shadow?fadeMaterial(new THREE.MeshBasicMaterial({color:'#010102',fog:false})):Array.isArray(o.material)?o.material.map(fadeMaterial):fadeMaterial(o.material);o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;}});family.add(shell);return shell;}
 people.forEach((g,i)=>{const pose=createFarewellPose(g.scene,i);pose(0);const shell=actor(g.scene,i?1.61:1.88,i?.34:-.34,-5.1,true);const silhouette=createSoftFarewellShadow(renderer,shell,i?1.61:1.88);silhouette.rotation.z=i?.025:-.025;family.add(silhouette);silhouette.renderOrder=6;softParents.push(silhouette);handPoses.push(createFarewellHandhold(g.scene,i));});
 const farewellDoll=actor(dollSource.clone(true),.83,0,-5.6,false);farewellDoll.traverse(o=>{if(o.isMesh)o.renderOrder=7;});
 const count=mobile?150:330,points=new Float32Array(count*3),seeds=Float32Array.from({length:count},(_,i)=>((i*16807+12345)%65521)/65521);
 const particleMat=new THREE.PointsMaterial({color:'#dacba4',size:.025,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(points,3));const particles=new THREE.Points(geo,particleMat);scene.add(particles);particles.frustumCulled=false;
 const smoke=await new THREE.TextureLoader().loadAsync('assets/fire/smoke_01.png');
 const mistPositions=new Float32Array((mobile?90:180)*3),mistGeo=new THREE.BufferGeometry();mistGeo.setAttribute('position',new THREE.BufferAttribute(mistPositions,3));const mistMat=new THREE.PointsMaterial({color:'#030404',alphaMap:smoke,size:.32,transparent:true,depthWrite:false,opacity:.35,fog:false});const mist=new THREE.Points(mistGeo,mistMat);scene.add(mist);mist.frustumCulled=false;
 const ritual=await createEndingRitual(scene,loader,mobile),ritualAudio=createEndingRitualAudio(audioContext,{...ritualBuffers,collapse:collapseBuffer});
 const photo=new Image();photo.alt='晴天の朝、竹藪に囲まれた古い家';photo.src='assets/ending/morning-house-v1.webp';photo.className='endingPhoto';await photo.decode();
 const state=new EndingState(),sunCache=cacheShadow(sun);let onRestart=()=>{},onExit=()=>{};
 const presentation=createEndingPresentation({photo,onRestart:()=>onRestart(),onExit:()=>onExit(),soundEnabled});
 const memory=await createEndingMemory();
 const black=document.createElement('div');black.id='endingBlack';black.setAttribute('aria-hidden','true');document.body.append(black);
 function reset(){memory.reset();presentation.reset();state.reset();ritual.reset();ritualAudio.reset();lastHandFrame=-1;family.visible=false;mist.visible=false;dissolveUniform.value=0;left.position.x=leftX;right.position.x=rightX;black.style.opacity=0;particleMat.opacity=0;document.body.classList.remove('ending-cinematic','ending-epilogue');}
 const point=new THREE.Vector3(0,1.1,-12.4),direction=new THREE.Vector3();
 // Prepare the choir and fire programs before the player can open the door.
 const warmCamera=new THREE.PerspectiveCamera(64,1,.07,60);warmCamera.position.set(0,1.64,-10);warmCamera.lookAt(0,1,-5);
 ritual.monks.visible=true;ritual.fire.visible=true;ritual.collapseRoot.visible=true;ritual.collapseRoot.traverse(o=>{if(o.isMesh)o.visible=true;});family.visible=true;
 if(renderer.compileAsync)await renderer.compileAsync(scene,warmCamera);else renderer.compile(scene,warmCamera);
 reset();
 return {scene,state,presentation,pauseAudio(){ritualAudio.pause();},spawn:[0,1.64,-1.5],reset,setRestart(fn){onRestart=fn;},setExit(fn){onExit=fn;},get shadowRevision(){return left.position.x+','+right.position.x;},
  canStand(x,z){return Math.abs(x)<1.85&&z<-.3&&z>-11.75&&candles.every(c=>Math.hypot(x-c.light.position.x,z-c.light.position.z)>.27);},
  target(camera){direction.copy(point).sub(camera.position);return !state.locked&&direction.length()<2.9&&direction.normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.82?'exit':null;},
  begin(position,yaw,pitch){const ok=state.begin(position.toArray(),yaw,pitch);if(ok){document.body.classList.add('ending-cinematic');presentation.unlockAudio();}return ok;},
  update(dt,active,camera,position){state.tick(dt,active);memory.update(state);ritual.update(state);ritualAudio.update(state,active,soundEnabled(),camera);if(state.phase==='epilogue'){black.style.opacity=state.black;presentation.update(dt,active&&state.epilogueTime>=1.8,true);document.body.dataset.endingShot=presentation.state.phase;return;}const t=state.time;document.body.dataset.endingShot=state.black>0?'blackout':state.collapse>0?'collapse':state.ceiling>0?'ceiling-fire':state.spread>0?'hall-fire':state.handJoin>0?'handhold':state.memoryVisible?'memory':state.fireActive?'family-fire':t>=ENDING_TIMING.reveal?'family':'entrance';left.position.x=leftX-state.door*1.27;right.position.x=rightX+state.door*1.27;sunCache.sync(left.position.x+','+right.position.x);sun.intensity=5+state.door*35;shaftMaterial.uniforms.strength.value=.025+state.door*.045;family.visible=state.familyVisible;dissolveUniform.value=state.dissolve;
   const handFrame=Math.round(state.handJoin*(mobile?48:64));if(state.familyVisible&&handFrame!==lastHandFrame){handPoses.forEach((pose,i)=>{pose(state.handJoin);softParents[i].userData.refresh();});lastHandFrame=handFrame;}
   softParents.forEach((parent,i)=>{parent.material.opacity=.94*(1-state.dissolve);parent.rotation.z=(i?.025:-.025)+Math.sin(t*.7+i)*.0015;}); if(active)candleTime+=dt; for(const c of candles){c.light.intensity=5.2*(1+.055*Math.sin(candleTime*7.3+c.phase)+.025*Math.sin(candleTime*17+c.phase));c.flame.scale.y=.032*(1+.1*Math.sin(candleTime*9+c.phase));c.flame.rotation.z=.1*Math.sin(candleTime*4.8+c.phase);}
   if(state.locked){const turn=state.turn,forward=state.startYaw+Math.atan2(Math.sin(-state.startYaw),Math.cos(-state.startYaw));const facing=forward+Math.PI*turn;const settle=THREE.MathUtils.smoothstep(t,0,1.5);camera.rotation.set(THREE.MathUtils.lerp(state.startPitch,-.11*turn,settle),THREE.MathUtils.lerp(state.startYaw,facing,settle),0);position.fromArray(state.startPosition);position.x=THREE.MathUtils.lerp(position.x,0,state.walk);position.z=THREE.MathUtils.lerp(position.z,-13.4,state.walk);camera.position.copy(position);if(state.collapse>0){const shake=Math.sin(t*21)*.009*state.collapse;camera.rotation.z=shake;camera.position.y+=Math.sin(t*29)*.012*state.collapse;}}
   for(let i=0;i<count;i++){const s=seeds[i],which=i%3,x=which===0?-.34:which===1?0:.34,h=which===1?.83:which===0?1.88:1.61;points[i*3]=x+Math.sin(i*2.4+t*.6)*(.12+state.dissolve*.5);points[i*3+1]=(s*h+state.dissolve*.9)%2.4;points[i*3+2]=(which===1?-5.6:-5.1)+Math.cos(i*1.3)*.16-state.dissolve*.45;}
   geo.attributes.position.needsUpdate=true;particleMat.opacity=state.familyVisible?Math.sin(state.dissolve*Math.PI)*.55:0;black.style.opacity=state.black;
   mist.visible=state.familyVisible;mistMat.opacity=.35*(1-state.dissolve);for(let i=0;i<mistPositions.length/3;i++){const s=seeds[i%count],side=i%2?1:-1;mistPositions[i*3]=side*.34+Math.sin(i*2.4+t*.35)*(.16+state.dissolve*.35);mistPositions[i*3+1]=(s*(side===1?1.6:1.87)+t*.015)%(side===1?1.6:1.87);mistPositions[i*3+2]=-5.1+Math.cos(i*1.3)*.16;}mistGeo.attributes.position.needsUpdate=true;
   presentation.update(dt,active,state.phase==='epilogue');
  },diagnostics(){return {phase:state.phase,time:+state.time.toFixed(2),door:state.door,turn:state.turn,dissolve:state.dissolve,familyVisible:state.familyVisible,handJoin:state.handJoin,hands:softParents.map((p,i)=>{const v=new THREE.Vector3();p.userData.shell.getObjectByName('hand_'+(i?'l':'r')).getWorldPosition(v);v.x+=p.position.x;v.z+=p.position.z;return v.toArray();}),ritual:ritual.diagnostics(),audio:ritualAudio.diagnostics(),black:state.black,memory:state.memoryVisible,collapse:state.collapse,epilogue:presentation.diagnostics(),finished:presentation.state.phase==='complete'};}
 };
}
