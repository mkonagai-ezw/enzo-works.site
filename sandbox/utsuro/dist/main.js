import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {createDust} from './dust.js';
import {createDollHaunting} from './doll-haunting.js?v=jizo-transform-1';
import {createPursuit,RUN_SPEED} from './pursuit.js?v=jizo-transform-1';
import {createRain} from './rain.js';
import {createStoryAudio} from './story-audio.js?v=jizo-transform-1';
import {createTouchStick} from './touch-controls.js';
const $=s=>document.querySelector(s),canvas=$('#world');
const mobileMode=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0||innerWidth<900;
const touchUI=()=>mobileMode||innerWidth<900;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobileMode,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,mobileMode?1:1.6));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();scene.background=new THREE.Color('#080e15');scene.fog=new THREE.FogExp2('#080e15',.043);
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.07,140);camera.rotation.order='YXZ';
const hemi=new THREE.HemisphereLight('#91a7ba','#20261f',.18);scene.add(hemi);
const moon=new THREE.DirectionalLight('#91a5be',.28);moon.position.set(12,22,4);moon.castShadow=!mobileMode;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});moon.shadow.bias=-.0002;moon.shadow.normalBias=.035;moon.shadow.radius=3;scene.add(moon);
const fill=new THREE.PointLight('#72858f',.25,8,2);fill.position.set(1,2,-1);scene.add(fill);
const flash=new THREE.SpotLight('#edeee0',25,16,.48,.65,1.7);flash.castShadow=true;flash.shadow.mapSize.set(mobileMode?1024:2048,mobileMode?1024:2048);flash.shadow.camera.near=.08;flash.shadow.camera.far=16;flash.shadow.bias=-.0004;flash.shadow.normalBias=.012;scene.add(flash,flash.target);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);let loaded=0;let total=18;
async function model(file){const g=await loader.loadAsync('assets/'+(mobileMode?'mobile/':'')+file);loaded++;$('#loading i').style.width=Math.round(loaded/total*100)+'%';return g.scene;}
let house,navigation,layout,door,doorProgress=0,doorOpen=false,playing=false,firstStart=true,inspectionUntil=0;
let pursuit,storyAudio,phone,jizo,higanbana,endShown=false;
const jizoPoint=new THREE.Vector3(3,.60,-7.8),phonePoint=new THREE.Vector3(1.7,1.15,-.83);
function controlsLocked(){return ['warning','lost','clear'].includes(pursuit?.state.phase);}
let haunting,rustleData,rustleReady,rustleSource,rustleGain,rustlePlays=0,rustleDuration=0;
const keys=new Set();let previousFrame=performance.now();let yaw=0,pitch=0,drag=false,lookPointer=null,lastX=0,lastY=0,flashOn=true,audioContext,startImpactBuffer,soundGain,footTime=0;
const PLAYER_START={position:[7.5,1.62,8],yaw:.65,pitch:0};
const position=new THREE.Vector3(...PLAYER_START.position),target=new THREE.Vector3();
function returnToGarden(){position.fromArray(PLAYER_START.position);yaw=PLAYER_START.yaw;pitch=PLAYER_START.pitch;inspectionUntil=0;camera.position.copy(position);camera.rotation.set(pitch,yaw,0);}
const v3=new THREE.Vector3(),dummy=new THREE.Object3D();let bambooBatches=[];
function makeClouds(){
 const geometry=new THREE.SphereGeometry(95,48,24);
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 v;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(v);vec2 p=d.xz/(max(d.y,.15)+.7)*3.+vec2(time*.001,0);float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+1.2;a*=.52;}vec3 c=mix(vec3(.025,.039,.049),vec3(.10,.13,.15),smoothstep(.2,.85,n));c=mix(vec3(.055,.085,.103),c,smoothstep(-.1,.35,d.y));gl_FragColor=vec4(c*.38,1.);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=-10;scene.add(mesh);return material;
}
const clouds=makeClouds();
const dust=createDust(scene),rain=createRain(scene);
const touchStick=createTouchStick($('#movePad'),$('#stickKnob'),()=>playing&&!controlsLocked());
function instances(root,placements,kind){
 if(mobileMode)placements=placements.filter((p,i)=>{const far=Math.hypot(p.position[0],p.position[2])>13;return kind==='shrub'?i%3===0:kind==='fern'?i%2===0:(far&&['bambooNatural','leaves','bamboo'].includes(kind)?i%2===0:true);});
 if(!placements.length)return;
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.isMesh)return;
  const geo=o.geometry.clone();
  // Expand normalized integers before baking transforms; integer attributes clip translated values.
  for(const name of ['position','normal']){const a=geo.getAttribute(name);if(a?.normalized){const values=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){values[i*3]=a.getX(i);values[i*3+1]=a.getY(i);values[i*3+2]=a.getZ(i);}geo.setAttribute(name,new THREE.BufferAttribute(values,3));}}
  geo.applyMatrix4(o.matrixWorld);
  const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
  const materials=Array.isArray(material)?material:[material];
  for(const m of materials){m.side=THREE.DoubleSide;if(kind==='fern'){m.alphaTest=.45;m.transparent=false;}if(kind==='bamboo'){m.color.multiplyScalar(.38);m.roughness=1;m.metalness=0;}if(kind==='bambooNatural'){m.color.multiplyScalar(.68);m.roughness=.95;m.metalness=0;m.transparent=false;if(m.alphaTest>0)m.alphaTest=.4;}if(['treeNear','treeFar','shrub'].includes(kind)){m.color.multiplyScalar(.82);m.roughness=Math.max(m.roughness,.85);m.metalness=0;m.transparent=false;if(m.alphaMap||m.alphaTest>0)m.alphaTest=.4;}}
  const cells=new Map();for(const p of placements){const key=Math.floor(p.position[0]/8)+','+Math.floor(p.position[2]/8);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
  for(const group of cells.values()){
   const batch=new THREE.InstancedMesh(geo,material,group.length);batch.castShadow=!mobileMode&&kind==='treeNear';batch.receiveShadow=true;
   group.forEach((p,i)=>{dummy.position.fromArray(p.position);dummy.rotation.set(0,p.rotation,0);dummy.scale.fromArray(p.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();scene.add(batch);if(kind==='bamboo')bambooBatches.push(batch);
  }
 });
}
function environmentLight(){
 const lantern=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:'#a39b77',roughness:1,emissive:'#b4843d',emissiveIntensity:.45});
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.12,.13,.35,12),mat);body.position.y=.25;lantern.add(body);
 const dark=new THREE.MeshStandardMaterial({color:'#171c18',roughness:.8});
 for(let i=0;i<8;i++){let r=i*Math.PI/4;const bar=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.4,5),dark);bar.position.set(Math.cos(r)*.125,.25,Math.sin(r)*.125);lantern.add(bar);}
 lantern.position.set(4.1,.64,.85);scene.add(lantern);let lamp=new THREE.PointLight('#e0ae67',1.3,5,2);lamp.position.set(4.1,1.02,.85);scene.add(lamp);
}
async function init(){
 try{
  const data=await Promise.all([model('house.glb'),model('garden.glb'),model('bamboo.glb'),model('bamboo_far.glb'),model('fern.glb'),model('door.glb'),fetch('assets/navigation.json').then(r=>r.json()),fetch('assets/layout.json').then(r=>r.json())]);
  [house,,,,,door,navigation,layout]=data;
  // Cast architectural shadows from the visible faces; back-face casting creates triangular self-shadows on thin imported walls.
  house.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.shadowSide=THREE.FrontSide;for(const t of [m.map,m.normalMap,m.roughnessMap])if(t)t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}}});scene.add(house);
  data[1].traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=o.name!=='Garden_earth';}});scene.add(data[1]);
  door.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.shadowSide=THREE.FrontSide;}});scene.add(door);
  instances(data[2],layout.bambooNear,'bamboo');instances(data[3],layout.bambooFar,'bamboo');instances(data[4],layout.ferns,'fern');
  environmentLight();
  phone=await model('phone.glb');phone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(phone);
  jizo=await model('jizo.glb');jizo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(jizo);
  const [flower,flowerLayout]=await Promise.all([model('higanbana.glb'),fetch('assets/higanbana-layout.json').then(r=>r.json())]);
  higanbana=new THREE.Group();higanbana.name='Jizo unlock flowers';higanbana.visible=false;
  for(const p of flowerLayout.placements){const stem=flower.clone(true);stem.position.fromArray(p.position);stem.rotation.y=p.rotation;stem.scale.setScalar(p.scale);stem.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.side=THREE.DoubleSide;}});higanbana.add(stem);}scene.add(higanbana);
  const jizoBounds=new THREE.Box3().setFromObject(jizo);navigation.colliders.push({name:'Jizo',min:jizoBounds.min.toArray(),max:jizoBounds.max.toArray()});
  const doll=await model('doll.glb');doll.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.shadowSide=THREE.BackSide;if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}}});scene.add(doll);
  const leaves=await model('leaves.glb');instances(leaves,[...layout.bambooNear,...layout.bambooFar],'leaves');
  const [weather,well]=await Promise.all([model('weather.glb'),model('well.glb')]);
  weather.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.depthWrite=false;m.alphaTest=.01;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;m.side=THREE.DoubleSide;}}});scene.add(weather);
  well.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(well);
  const forest=await fetch('assets/forest.json').then(r=>r.json());total=11+forest.assets.length;
  await Promise.all(forest.assets.map(async a=>{
   const root=await model(a.file);
   if(a.kind==='tree'){
    const near=a.placements.filter(p=>p.shadow),far=a.placements.filter(p=>!p.shadow);
    if(near.length)instances(root,near,'treeNear');if(far.length)instances(root,far,'treeFar');
   }else instances(root,a.placements,a.kind);
  }));
  const soundResponse=await fetch('assets/audio/'+encodeURIComponent('バサ.mp3'));
  if(!soundResponse.ok)throw new Error('人形の効果音を読み込めません');rustleData=await soundResponse.arrayBuffer();
  haunting=createDollHaunting({scene,camera,doll,navigation,surfaceHeight,obstacles:[house,data[1],phone,well,jizo],door,onFirstMove:playRustle});
  pursuit=createPursuit({camera,haunting,navigation,height:surfaceHeight,doorBox:()=>{const b=new THREE.Box3().setFromObject(door);return {min:b.min.toArray(),max:b.max.toArray()};},onReveal:()=>{setJizoPresent(false);if($('#sound').checked)storyAudio?.playReveal(startImpactBuffer);},onFootstep:p=>{if(playing&&!document.hidden&&$('#sound').checked)storyAudio?.playFootstep(p);}});
  $('#start').disabled=false;$('#startText').textContent='探索を始める';$('#loading').hidden=true;
  // An observable diagnostics panel supports repeatable local QA without game UI clutter.
  const info=document.createElement('output');info.id='diagnostics';info.hidden=true;document.body.append(info);
  renderer.compile(scene,camera);
 }catch(e){console.error(e);$('#startText').textContent='読み込みに失敗しました';$('#error').hidden=false;$('#error').textContent='風景を読み込めませんでした。起動用ファイルから開き直してください。 '+e.message;}
}
function start(){
 if(!house||controlsLocked())return;
 playing=true;document.body.classList.add('playing');$('#reticle').hidden=false;$('#touch').hidden=!touchUI();
 if(firstStart){returnToGarden();firstStart=false;}$('#hint').textContent='F 懐中電灯　／　E 調べる';
 if(!touchUI()){try{let p=canvas.requestPointerLock();p?.catch(()=>{});}catch{}}
 startAudio();
}
function pause(){playing=false;keys.clear();touchStick.reset();drag=false;lookPointer=null;document.body.classList.remove('playing');$('#reticle').hidden=true;$('#touch').hidden=true;$('#prompt').hidden=true;$('#startText').textContent='探索に戻る';if(document.pointerLockElement)document.exitPointerLock();if(soundGain)soundGain.gain.setTargetAtTime($('#sound').checked?.015:0,audioContext.currentTime,.3);if(rustleSource){rustleSource.stop();rustleSource=null;}}
function startAudio(){
 const firstAudioStart=!audioContext;
 if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();soundGain=audioContext.createGain();soundGain.gain.value=$('#sound').checked?.08:0;soundGain.connect(audioContext.destination);const b=audioContext.createBuffer(1,audioContext.sampleRate*5,audioContext.sampleRate),a=b.getChannelData(0);let previous=0;for(let i=0;i<a.length;i++){previous=(previous+(Math.random()*2-1)*.025)/1.025;a[i]=previous*4;}startImpactBuffer=b;const src=audioContext.createBufferSource();src.buffer=b;src.loop=true;const low=audioContext.createBiquadFilter();low.type='lowpass';low.frequency.value=700;src.connect(low);low.connect(soundGain);src.start();}
 audioContext.resume().then(()=>{if(firstAudioStart&&playing&&$('#sound').checked)storyAudio?.playStart(startImpactBuffer);});soundGain.gain.setTargetAtTime($('#sound').checked?.08:0,audioContext.currentTime,.4);
 if(!storyAudio)storyAudio=createStoryAudio(audioContext,phonePoint);
 if(!rustleReady)rustleReady=audioContext.decodeAudioData(rustleData.slice(0)).then(buffer=>{rustleDuration=buffer.duration;return buffer;});
}
async function playRustle(){
 if(!audioContext||!$('#sound').checked)return;
 try{const buffer=await rustleReady;if(!playing||!$('#sound').checked||audioContext.state!=='running')return;
  rustleSource=audioContext.createBufferSource();rustleSource.buffer=buffer;rustleGain=audioContext.createGain();rustleGain.gain.value=.65;rustleSource.connect(rustleGain);rustleGain.connect(audioContext.destination);
  const source=rustleSource;source.onended=()=>{source.disconnect();if(rustleSource===source)rustleSource=null;};source.start();rustlePlays++;
 }catch(error){console.error('人形の効果音を再生できません',error);}
}
function footstep(){if(!audioContext||!$('#sound').checked)return;const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='triangle';osc.frequency.setValueAtTime(90+Math.random()*40,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(32,audioContext.currentTime+.12);gain.gain.setValueAtTime(.027,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.14);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.15);}
function aimedAt(point,range){
 const d=point.clone().sub(camera.position);return d.length()<range&&d.normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.82&&haunting.clearLine(camera.position,point);
}
function interactionTarget(){
 if(controlsLocked())return null;
 if(pursuit?.state.phase==='phone'&&aimedAt(phonePoint.clone().addScaledVector(camera.position.clone().sub(phonePoint).normalize(),.22),2.15))return 'phone';
 // The stone itself is the ray endpoint, so test just in front of its surface.
 if(pursuit?.state.phase==='jizo-ready'){
   const p=jizoPoint.clone().addScaledVector(camera.position.clone().sub(jizoPoint).normalize(),.24);
   if(aimedAt(p,2.3))return 'jizo';
 }

 const w=layout?.well?.position;
 if(w){const dx=w[0]-position.x,dz=w[2]-position.z,d=Math.hypot(dx,dz);if(d<2.7&&(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/(d||1)>.5)return 'well';}
 if(position.distanceTo(new THREE.Vector3(3.34,1.6,-.6))<2.5)return 'door';
 return null;
}
function showStory(title,detail,button,ending=false){
 keys.clear();touchStick.reset();drag=false;lookPointer=null;$('#storyTitle').textContent=title;$('#storyDetail').textContent=detail;$('#storyAction').textContent=button;$('#story').dataset.ending=ending?'true':'false';$('#story').hidden=false;$('#reticle').hidden=true;$('#prompt').hidden=true;$('#touch').hidden=true;
 if(document.pointerLockElement)document.exitPointerLock();$('#storyAction').focus();
}
function setJizoPresent(present){jizo.visible=present;const collider=navigation.colliders.find(b=>b.name==='Jizo');if(collider)collider.disabled=!present;}
function closeWarning(){
 if(!pursuit.dismiss())return;flashOn=true;camera.lookAt(haunting.actor.position.clone().add(new THREE.Vector3(0,.5,0)));yaw=camera.rotation.y;pitch=camera.rotation.x;camera.updateMatrixWorld(true);$('#story').hidden=true;keys.clear();$('#reticle').hidden=false;$('#touch').hidden=!touchUI();$('#hint').textContent='光の中心に、とらえろ。';
 if(!touchUI()){try{canvas.requestPointerLock()?.catch(()=>{});}catch{}}
}
function restartGame(){
 if(!pursuit||!['lost','clear'].includes(pursuit.state.phase))return;
 keys.clear();touchStick.reset();drag=false;lookPointer=null;pursuit.reset();storyAudio?.reset();rain.reset();
 higanbana.visible=false;setJizoPresent(true);
 if(rustleSource){try{rustleSource.stop();}catch{}rustleSource=null;}
 rustlePlays=0;endShown=false;doorOpen=false;doorProgress=0;door.position.z=0;door.updateMatrixWorld(true);
 flashOn=true;footTime=0;inspectionUntil=0;firstStart=false;returnToGarden();previousFrame=performance.now();
 $('#story').hidden=true;$('#presenceHint').hidden=true;$('#inspection').hidden=true;$('#credits').hidden=true;
 document.body.classList.remove('pursued');$('#reticle').classList.remove('holding');start();
}
function activateStoryAction(){if(pursuit?.state.phase==='warning')closeWarning();else restartGame();}
function interact(){if(!playing||controlsLocked())return;const t=interactionTarget();
 if(t==='jizo'&&pursuit.examine()){showStory('にげろ','', '閉じる');return;}
 if(t==='phone'&&pursuit.state.answer())return;
if(t==='well'){inspectionUntil=performance.now()+6500;$('#inspection').textContent='古い板で塞がれている。\n隙間から、冷たい空気が流れてくる。';}else if(t==='door'){doorOpen=!doorOpen;footstep();}}
function terrainHeight(x,z){const y=-z,r=Math.hypot(x*.9,y),gate=x>4.5&&x<9.2&&y<-5?0:1;return Math.max(0,Math.min(4.3,(r-10)*.32))*(.82+.18*Math.sin(x*.46)*Math.cos(y*.39))*gate-.015;}
function surfaceHeight(x,z){let h=Math.max(0,terrainHeight(x,z));for(const f of navigation?.floors||[]){if(x>=f.min[0]-.05&&x<=f.max[0]+.05&&z>=f.min[2]-.05&&z<=f.max[2]+.05)h=Math.max(h,f.max[1]);}for(const f of layout?.steps||[]){if(Math.abs(x-f.x)<f.w/2&&Math.abs(z-f.z)<f.d/2)h=Math.max(h,f.h);}return h;}
function blocked(x,z,y){
 if(x<-13||x>14||z<-14||z>16)return true;
 const r=.18;
 for(const b of navigation.colliders){if(b.disabled)continue;if(b.max[1]<y-1.05||b.min[1]>y+.1)continue;if(x+r>b.min[0]&&x-r<b.max[0]&&z+r>b.min[2]&&z-r<b.max[2])return true;}
 if(!doorOpen&&Math.abs(x-3.34)<r+.035&&z>-.97-r&&z<-.07+r)return true;
 return false;
}
$('#start').onclick=start;
$('#storyAction').onclick=activateStoryAction;
$('#menu').onclick=()=>{if(!controlsLocked())playing?pause():start();};$('#creditsToggle').onclick=()=>$('#credits').hidden=false;$('#closeCredits').onclick=()=>$('#credits').hidden=true;
$('#brightness').oninput=e=>renderer.toneMappingExposure=Number(e.target.value);$('#sound').onchange=()=>{if(soundGain)soundGain.gain.setTargetAtTime($('#sound').checked?.08:0,audioContext.currentTime,.2);else if(playing&&$('#sound').checked)startAudio();if(rustleGain)rustleGain.gain.setTargetAtTime($('#sound').checked?.65:0,audioContext.currentTime,.02);};
$('#touchLight').onclick=()=>{if(!controlsLocked())flashOn=!flashOn;};$('#touchAction').onclick=interact;
document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;if(controlsLocked()){if(['KeyE','Enter','Space'].includes(e.code)){e.preventDefault();activateStoryAction();}return;}keys.add(e.code);if(e.code==='KeyF')flashOn=!flashOn;if(e.code==='KeyE')interact();if(e.code==='Escape')pause();if(e.code==='KeyR'&&!pursuit?.state.rain)returnToGarden();});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(playing&&!controlsLocked())pause()});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!drag&&!controlsLocked())pause()});
canvas.addEventListener('pointerdown',e=>{if(!playing||controlsLocked())return;if(lookPointer!==null)return;drag=true;lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(e.pointerId===lookPointer){drag=false;lookPointer=null;}});
document.addEventListener('pointermove',e=>{if(!playing||controlsLocked())return;let dx=0,dy=0;if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY;}else if(drag&&e.pointerId===lookPointer){dx=e.clientX-lastX;dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;}const sensitivity=touchUI()?Math.PI/Math.max(320,innerWidth):.0021;yaw-=dx*sensitivity;pitch=Math.max(-1.25,Math.min(1.25,pitch-dy*sensitivity));});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let elapsed=0,frameTimes=[],diagnosticAt=0;
function animate(){requestAnimationFrame(animate);let now=performance.now();let frameDt=(now-previousFrame)/1000,dt=Math.min(frameDt,.05);previousFrame=now;elapsed+=dt;clouds.uniforms.time.value=elapsed;
 if(playing&&navigation&&!controlsLocked()){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  forward+=touchStick.axes.z;right+=touchStick.axes.x;let speed=(pursuit?.state.rain?RUN_SPEED:1.65)*dt/Math.max(1,Math.hypot(forward,right)),dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
  if(!blocked(position.x+dx,position.z,position.y))position.x+=dx;if(!blocked(position.x,position.z+dz,position.y))position.z+=dz;
  const h=surfaceHeight(position.x,position.z)+1.62;position.y=THREE.MathUtils.damp(position.y,h,12,dt);
  camera.position.copy(position);camera.rotation.set(pitch,yaw,0);
  if(forward||right){camera.position.y+=Math.sin(elapsed*9)*.009;footTime+=dt;if(footTime>.62){footstep();footTime=0;}}
  const near=interactionTarget();$('#prompt').hidden=!near;$('#prompt').textContent=near==='jizo'?'E　お地蔵さんを調べる':near==='phone'?'E　電話に出る':near==='well'?'E　井戸を調べる':doorOpen?'E　障子を閉める':'E　障子を開ける';
  const inHouse=position.x>-4.5&&position.x<4.6&&position.z>-6.4&&position.z<5.6&&surfaceHeight(position.x,position.z)>.4;
  $('#place').textContent=inHouse?(position.x>3.3?'縁側':'家の中'):position.z<-3&&position.x>5?'奥庭':'庭';
 }else if(firstStart){camera.position.set(9.2+Math.sin(elapsed*.05)*.15,2.8,9.8);camera.lookAt(-1.4,1.5,1.5);}
 if(door){doorProgress=THREE.MathUtils.damp(doorProgress,doorOpen?1:0,4,dt);door.position.z=-doorProgress*.88;}
 haunting?.update(dt,playing&&!document.hidden&&!pursuit?.state.rain);
 pursuit?.update(dt,playing&&!document.hidden&&!controlsLocked(),yaw,flashOn);
 if(pursuit){
   const state=pursuit.state;
   higanbana.visible=haunting.diagnostics().moves>0;
   if(['lost','clear'].includes(state.phase)&&!endShown){endShown=true;showStory(state.phase==='clear'?'生還':'つかまった',state.phase==='clear'?'受話器の向こうで、誰かが息をした。':'もう、振り向かなくていい。','もう一度',true);}
   $('#status').textContent=state.phase==='phone'?'家の中で、電話が鳴っている':state.chasing?'光の中心で、人形を止めろ':state.phase==='jizo-ready'?'家の裏手に、石のお地蔵さんがある':state.phase==='sighting'?'今のうちに離れろ — '+Math.ceil(pursuit.diagnostics().sighting.grace)+'秒':'庭・縁側・和室';
   if(state.phase==='sighting')$('#hint').textContent='今のうちに離れろ。光の中心で人形を止められる。';
   if(state.chasing)$('#hint').textContent=state.phase==='phone'?'E 電話に出る　／　F 懐中電灯':'光の中心で止める　／　F 懐中電灯';
   storyAudio?.update(state,playing&&!document.hidden,$('#sound').checked,camera);
   document.body.classList.toggle('pursued',state.chasing);
   $('#reticle').classList.toggle('holding',state.frozen&&state.chasing);
 }
 rain.update(dt,!!pursuit?.state.rain,camera,flashOn&&playing);

 $('#inspection').hidden=!playing||performance.now()>inspectionUntil;
 camera.getWorldDirection(v3);flash.position.copy(camera.position).addScaledVector(v3,.2);flash.position.y-=.16;flash.target.position.copy(camera.position).addScaledVector(v3,10);flash.visible=playing&&flashOn;
 dust.update(elapsed,flash.position,v3,flash.visible,renderer.getPixelRatio());
 renderer.render(scene,camera);
 frameTimes.push(frameDt);if(frameTimes.length>120)frameTimes.shift();
 if(elapsed-diagnosticAt>1&&$('#diagnostics')){diagnosticAt=elapsed;$('#diagnostics').textContent=JSON.stringify({loaded:!!house,playing,mobileMode,touchVisible:!$('#touch').hidden,position:position.toArray().map(x=>+x.toFixed(3)),yaw,pitch,flash:flashOn,door:doorOpen,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(frameTimes.length/frameTimes.reduce((a,b)=>a+b,0)),colliders:navigation.colliders.length,doll:haunting?.diagnostics(),jizoVisible:!!jizo?.visible,flowers:{visible:!!higanbana?.visible,count:higanbana?.children.length||0},pursuit:pursuit?.diagnostics(),storyAudio:storyAudio?.diagnostics(),rustle:{plays:rustlePlays,duration:rustleDuration,state:audioContext?.state}});}
}
$('#fullscreen').hidden=!document.documentElement.requestFullscreen;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
document.body.classList.toggle('touch-mode',touchUI());
window.addEventListener('resize',()=>{document.body.classList.toggle('touch-mode',touchUI());$('#touch').hidden=!playing||controlsLocked()||!touchUI();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing&&!controlsLocked())pause();});
init();animate();
