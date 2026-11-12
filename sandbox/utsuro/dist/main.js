import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.mjs';
import {createDust} from './dust.js';
import {createDollHaunting} from './doll-haunting.js?v=performance-2';
import {createForeshadowing,CLUE_VIEWS} from './foreshadowing.js?v=cupboard-peek-1';
import {HouseStoryState,CLUE_IDS} from './house-story.js?v=doll-clue-hints-1';
import {createMonkFire} from './monk-fire.js?v=mobile-scares-1';
import {createShadowCouple} from './shadow-couple.js?v=mobile-scares-1';
import {createCorridorCreakAudio} from './corridor-creak-audio.js?v=four-dark-1';
import {createShadowAudio} from './shadow-audio.js?v=memory-pass-1';
import {createShadowArms} from './shadow-arms.js?v=mobile-scares-1';
import {shadowArmRoom,createShadowArmPlacements} from './shadow-arms-layout.js';
import {createCorridorEvents} from './corridor-events.js?v=four-memories-1';
import {CORRIDOR_COUNT,evaluateCorridorExit} from './corridor-choices.js?v=four-memories-1';
import {createCorridorHints} from './corridor-hints.js?v=four-memories-1';
import {createCorridorStage} from './corridor-stage.js?v=mobile-scares-1';
import {createEndingStage} from './ending-stage.js?v=auto-epilogue-1';
import {createRain} from './rain.js';
import {createStoryAudio} from './ritual-audio.js?v=ending-buffers-1';
import {cacheShadow,transformKey,AdaptiveResolution,cinematicFrameDelta,setText,setOpacity} from './performance-runtime.js?v=mobile-scares-1';
import {shareGLTFImages} from './shared-textures.js';
import {createWellShaft} from './well-shaft.js';
import {createTatamiScorch} from './tatami-scorch.js';
import {createTouchStick} from './touch-controls.js';
import {createTitleScreen} from './title-screen.js?v=title-card-2';
const elements=new Map(),$=s=>{if(!elements.has(s)){const e=document.querySelector(s);if(e)elements.set(s,e);return e;}return elements.get(s);},canvas=$('#world');
const diagnosticMode=['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa');
const mobileMode=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0||innerWidth<900;
const touchUI=()=>mobileMode||innerWidth<900;
const titleScreen=createTitleScreen();
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobileMode,powerPreference:'high-performance'});
const resolution=new AdaptiveResolution(Math.min(devicePixelRatio,mobileMode?.85:1.6),mobileMode?.65:1);
renderer.setPixelRatio(resolution.value);renderer.setSize(innerWidth,innerHeight);
renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();scene.background=new THREE.Color('#080e15');scene.fog=new THREE.FogExp2('#080e15',.043);
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.07,140);camera.rotation.order='YXZ';
const hemi=new THREE.HemisphereLight('#91a7ba','#20261f',.28);scene.add(hemi);
const moon=new THREE.DirectionalLight('#91a5be',.36);moon.position.set(12,22,4);moon.castShadow=!mobileMode;moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});moon.shadow.bias=-.0002;moon.shadow.normalBias=.035;moon.shadow.radius=3;scene.add(moon);
const fill=new THREE.PointLight('#72858f',.4,8,2);fill.position.set(1,2,-1);scene.add(fill);
const flash=new THREE.SpotLight('#edeee0',25,16,.48,.65,1.7);flash.castShadow=true;flash.shadow.mapSize.set(mobileMode?512:2048,mobileMode?512:2048);flash.shadow.camera.near=.08;flash.shadow.camera.far=16;flash.shadow.bias=-.0004;flash.shadow.normalBias=.012;scene.add(flash,flash.target);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const imageCache=shareGLTFImages(loader),moonCache=cacheShadow(moon),flashCache=cacheShadow(flash);let loaded=0;let total=18;
async function model(file){const g=await loader.loadAsync('assets/'+(mobileMode?'mobile/':'')+file);loaded++;$('#loading i').style.width=Math.round(loaded/total*100)+'%';return g.scene;}
let house,navigation,layout,door,doorProgress=0,doorOpen=false,playing=false,firstStart=true,inspectionUntil=0;
let corridorEvents,corridorReading=false,shadowCouple,shadowAudio,shadowAudioLoading=false,monkFire,clues,storyAudio,phone,jizo,higanbana,monk,arms,corridor,wellLid,wellLidRest,armsActive=false,currentStage='house';
let corridorCreak,corridorHints,tatamiScorch,renderingWarmup=false,clueReading=false;
let ending,endingLoading=false,endingDollSource,corridorWins=0,endingQAFreeze=false;
const story=new HouseStoryState(),monkBase=new THREE.Vector3(...shadowArmRoom.center),monkPoint=monkBase.clone().add(new THREE.Vector3(0,1.15,0));
async function sharedModel(file){return (await loader.loadAsync('assets/'+file)).scene;}
const jizoOffset=new THREE.Vector3(0,0,-.7),jizoPoint=new THREE.Vector3(3,.60,-7.8).add(jizoOffset),phonePoint=new THREE.Vector3(1.7,1.15,-.83);
function controlsLocked(){return clueReading||!!corridorHints?.state.locked||endingLoading||(currentStage==='ending'&&ending?.state.locked)||corridorReading||story.viewLocked||!!shadowCouple?.state.locked;}
function movementLocked(){return clueReading||!!corridorHints?.state.locked||endingLoading||(currentStage==='ending'&&ending?.state.locked)||corridorReading||story.movementLocked||!!shadowCouple?.state.locked;}
function canToggleFlash(){return !corridorHints?.state.locked&&currentStage!=='ending'&&!['ritual','blackout','arrival'].includes(story.phase);}
let haunting,rustleData,rustleReady,rustleSource,rustleGain,rustlePlays=0,rustleDuration=0;
const keys=new Set();let previousFrame=performance.now();let yaw=0,pitch=0,drag=false,lookPointer=null,lastX=0,lastY=0,flashOn=true,audioContext,startImpactBuffer,soundGain,footTime=0;
const PLAYER_START={position:[7.5,1.62,8],yaw:.65,pitch:0};
const position=new THREE.Vector3(...PLAYER_START.position),target=new THREE.Vector3();
function returnToGarden(){position.fromArray(PLAYER_START.position);yaw=PLAYER_START.yaw;pitch=PLAYER_START.pitch;inspectionUntil=0;camera.position.copy(position);camera.rotation.set(pitch,yaw,0);}
const v3=new THREE.Vector3(),dummy=new THREE.Object3D();let bambooBatches=[],forestLods=[],forestRevision=0,lastLodTime=-1;
function makeClouds(){
 const geometry=new THREE.SphereGeometry(95,48,24);
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 v;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec3 d=normalize(v);vec2 p=d.xz/(max(d.y,.15)+.7)*3.+vec2(time*.001,0);float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+1.2;a*=.52;}vec3 c=mix(vec3(.025,.039,.049),vec3(.10,.13,.15),smoothstep(.2,.85,n));c=mix(vec3(.055,.085,.103),c,smoothstep(-.1,.35,d.y));gl_FragColor=vec4(c*.38,1.);}`});
 const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=-10;scene.add(mesh);return material;
}
const clouds=makeClouds();
const dust=createDust(scene),rain=createRain(scene);
const touchStick=createTouchStick($('#movePad'),$('#stickKnob'),()=>playing&&!movementLocked());
function instances(root,placements,kind,lodRoot=null){
 const lowMeshes=new Map();lodRoot?.updateMatrixWorld(true);lodRoot?.traverse(o=>{if(o.isMesh)lowMeshes.set(o.name,o);});
 if(mobileMode)placements=placements.filter((p,i)=>{const far=Math.hypot(p.position[0],p.position[2])>13;return kind==='shrub'?i%3===0:kind==='fern'?i%2===0:(far&&['bambooNatural','leaves','bamboo'].includes(kind)?i%2===0:true);});
 if(!placements.length)return;
 root.updateMatrixWorld(true);
 root.traverse(o=>{
  if(!o.isMesh)return;
  const geo=o.geometry.clone();
  // Expand normalized integers before baking transforms; integer attributes clip translated values.
  for(const name of ['position','normal']){const a=geo.getAttribute(name);if(a?.normalized){const values=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){values[i*3]=a.getX(i);values[i*3+1]=a.getY(i);values[i*3+2]=a.getZ(i);}geo.setAttribute(name,new THREE.BufferAttribute(values,3));}}
  geo.applyMatrix4(o.matrixWorld);
  let lowGeo=null;const low=lowMeshes.get(o.name);
  if(low){lowGeo=low.geometry.clone();for(const name of ['position','normal']){const at=lowGeo.getAttribute(name);if(at?.normalized){const values=new Float32Array(at.count*3);for(let i=0;i<at.count;i++){values[i*3]=at.getX(i);values[i*3+1]=at.getY(i);values[i*3+2]=at.getZ(i);}lowGeo.setAttribute(name,new THREE.BufferAttribute(values,3));}}lowGeo.applyMatrix4(low.matrixWorld);}

  const material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
  const materials=Array.isArray(material)?material:[material];
  for(const m of materials){m.side=THREE.DoubleSide;if(kind==='fern'){m.alphaTest=.45;m.transparent=false;}if(kind==='bamboo'){m.color.multiplyScalar(.38);m.roughness=1;m.metalness=0;}if(kind==='bambooNatural'){m.color.multiplyScalar(.68);m.roughness=.95;m.metalness=0;m.transparent=false;if(m.alphaTest>0)m.alphaTest=.4;}if(['treeNear','treeFar','shrub'].includes(kind)){m.color.multiplyScalar(.82);m.roughness=Math.max(m.roughness,.85);m.metalness=0;m.transparent=false;if(m.alphaMap||m.alphaTest>0)m.alphaTest=.4;}}
  const cells=new Map();for(const p of placements){const key=Math.floor(p.position[0]/8)+','+Math.floor(p.position[2]/8);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
  for(const group of cells.values()){
   const batch=new THREE.InstancedMesh(geo,material,group.length);batch.castShadow=!mobileMode&&kind==='treeNear';batch.receiveShadow=true;
   group.forEach((p,i)=>{dummy.position.fromArray(p.position);dummy.rotation.set(0,p.rotation,0);dummy.scale.fromArray(p.scale);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();scene.add(batch);if(lowGeo){const coarse=new THREE.InstancedMesh(lowGeo,material,group.length);coarse.instanceMatrix=batch.instanceMatrix;coarse.castShadow=batch.castShadow;coarse.receiveShadow=true;coarse.userData.lodProxy=true;coarse.visible=false;coarse.computeBoundingSphere();scene.add(coarse);const center=new THREE.Vector3();for(const p of group)center.add(new THREE.Vector3(...p.position));center.multiplyScalar(1/group.length);forestLods.push({high:batch,low:coarse,center,coarse:false});}if(kind==='bamboo')bambooBatches.push(batch);
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
  jizo=await model('jizo.glb');jizo.position.add(jizoOffset);jizo.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(jizo);
  const [flower,flowerLayout]=await Promise.all([model('higanbana.glb'),fetch('assets/higanbana-layout.json?v=newspaper-1').then(r=>r.json())]);
  higanbana=new THREE.Group();higanbana.name='Jizo unlock flowers';higanbana.position.copy(jizoOffset);higanbana.visible=false;
  for(const p of flowerLayout.placements.slice(0,CLUE_IDS.length)){const stem=flower.clone(true);stem.position.fromArray(p.position);stem.rotation.y=p.rotation;stem.scale.setScalar(p.scale);stem.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.side=THREE.DoubleSide;}});higanbana.add(stem);}scene.add(higanbana);
  const jizoBounds=new THREE.Box3().setFromObject(jizo);navigation.colliders.push({name:'Jizo',min:jizoBounds.min.toArray(),max:jizoBounds.max.toArray()});
  const doll=await model('doll.glb');doll.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.shadowSide=THREE.BackSide;if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}}});scene.add(doll);
  const leaves=await model('leaves.glb');instances(leaves,[...layout.bambooNear,...layout.bambooFar],'leaves');
  const [weather,well]=await Promise.all([model('weather.glb'),sharedModel('well-story.glb')]);
  weather.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.transparent=true;m.depthWrite=false;m.alphaTest=.01;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;m.side=THREE.DoubleSide;}}});scene.add(weather);
  well.traverse(o=>{if(/Frayed[ _]rope[ _]over[ _]cover/i.test(o.name))o.visible=false;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(well);
  createWellShaft({garden:data[1],well,scene,position:layout.well.position});
  wellLid=well.getObjectByName('StoryWellLid');if(!wellLid)throw Error('井戸の蓋が見つかりません');wellLidRest=wellLid.quaternion.clone();
  const [monkAsset,armAsset,corridorAsset]=await Promise.all([sharedModel('monk-praying.glb'),loader.loadAsync('assets/shadow-arm.glb'),createCorridorStage(loader,mobileMode)]);
  monk=monkAsset;monk.name='Praying monk';monk.position.copy(monkBase);monk.rotation.y=Math.PI/2;monk.visible=false;monk.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=false;
   // The face paper is a cutout, not a translucent overlay on top of the fire.
   if(/face seal/i.test(o.name)||/face seal/i.test(o.material?.name)){o.material=o.material.clone();Object.assign(o.material,{transparent:false,alphaTest:.35,depthWrite:true,depthTest:true});o.renderOrder=0;}
   for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.shadowSide=THREE.FrontSide;
  }});scene.add(monk);
  navigation.colliders.push({name:'Praying monk',min:[monkBase.x-.28,monkBase.y,monkBase.z-.28],max:[monkBase.x+.28,monkBase.y+1.7,monkBase.z+.28],disabled:true});
  arms=createShadowArms({scene,gltf:armAsset,placements:createShadowArmPlacements().filter((_,i)=>!mobileMode||i%3!==2)});arms.group.visible=false;corridor=corridorAsset;
  const forest=await fetch('assets/forest.json').then(r=>r.json());total=11+forest.assets.length;
  await Promise.all(forest.assets.map(async a=>{
   const [root,lowAsset]=await Promise.all([model(a.file),loader.loadAsync('assets/lod/'+a.file)]);const low=lowAsset.scene;
   if(a.kind==='tree'){
    const near=a.placements.filter(p=>p.shadow),far=a.placements.filter(p=>!p.shadow);
    if(near.length)instances(root,near,'treeNear',low);if(far.length)instances(root,far,'treeFar',low);
   }else instances(root,a.placements,a.kind,low);
  }));
  const soundResponse=await fetch('assets/audio/'+encodeURIComponent('バサ.mp3'));
  if(!soundResponse.ok)throw new Error('人形の効果音を読み込めません');rustleData=await soundResponse.arrayBuffer();
  corridorEvents=await createCorridorEvents({loader,scene:corridor.scene,dollSource:doll,architecture:corridor.architecture});
  endingDollSource=doll;
  corridorHints=createCorridorHints({onComplete:()=>{const memory=corridorEvents.finishHint();if(memory?.fresh){corridor.memoryRead(memory.count);if(memory.count===2){if(corridorEvents.floor===2&&$('#sound').checked)shadowAudio?.playPass(camera);if(corridorEvents.floor===3){yaw=0;pitch=-.04;camera.rotation.set(pitch,yaw,0);shadowCouple.glimpse();}}}clearInput();$('#touch').hidden=!playing||!touchUI();},onError:()=>{corridorEvents.retryHint();clearInput();$('#touch').hidden=!playing||!touchUI();inspectionUntil=performance.now()+4000;$('#inspection').textContent='絵を読み込めませんでした。もう一度、人形を調べてください。';}});
  shadowCouple=await createShadowCouple({loader,scene:corridor.scene,mobile:mobileMode,canStand:corridor.canStand,onStart:()=>corridor.setCandlesLit(true),onReset:()=>corridor.setCandlesLit(true),onContact:()=>{clearInput();$('#touch').hidden=true;$('#prompt').hidden=true;},onGameOver:()=>showStory('とある家','帰る道を、間違えた。','もう一度',true)});
  monkFire=await createMonkFire(scene,monkBase,mobileMode);
  tatamiScorch=await createTatamiScorch({house,scene,mobile:mobileMode,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
  clues=await createForeshadowing({loader,scene,navigation,surfaceHeight,onCupboardClose:()=>{if(playing&&$('#sound').checked)storyAudio?.playCupboardClose();}});
  haunting=createDollHaunting({scene,camera,doll,navigation,surfaceHeight,obstacles:[house,data[1],phone,well,jizo],door,onFirstMove:playRustle});
  setupLocalStoryQA();
  // Prepare the corridor's flashlight and first shadow appearance during loading.
  renderingWarmup=true;
  corridor.scene.add(flash,flash.target);flash.visible=true;corridor.update(0,camera);
  await shadowCouple.warmup(renderer,camera);
  scene.add(flash,flash.target);
  const fireVisible=monkFire.group.visible,armVisible=arms.group.visible,monkVisible=monk.visible;
  monkFire.group.visible=true;arms.group.visible=true;monk.visible=true;
  await renderer.compileAsync(scene,camera);
  const previousTarget=renderer.getRenderTarget(),warmTarget=new THREE.WebGLRenderTarget(64,64);
  try{renderer.setRenderTarget(warmTarget);renderer.render(scene,camera);}finally{renderer.setRenderTarget(previousTarget);warmTarget.dispose();monkFire.group.visible=fireVisible;arms.group.visible=armVisible;monk.visible=monkVisible;}
  moonCache.invalidate();flashCache.invalidate();
  flash.visible=true;flash.intensity=0;renderingWarmup=false;previousFrame=performance.now();
  $('#start').disabled=false;$('#startText').textContent='はじめる';$('#loading').hidden=true;
  // An observable diagnostics panel supports repeatable local QA without game UI clutter.
  if(diagnosticMode){const info=document.createElement('output');info.id='diagnostics';info.hidden=true;document.body.append(info);}
 }catch(e){renderingWarmup=false;console.error(e);$('#startText').textContent='読み込みに失敗しました';$('#error').hidden=false;$('#error').textContent='風景を読み込めませんでした。起動用ファイルから開き直してください。 '+e.message;}
}
function start(){
 if(!house||controlsLocked())return;
 playing=true;document.body.classList.add('playing');titleScreen.enter(touchUI());$('#reticle').hidden=false;$('#touch').hidden=movementLocked()||!touchUI();
 if(firstStart){returnToGarden();firstStart=false;}$('#hint').textContent='F 懐中電灯　／　E 調べる';
 if(!touchUI()){try{let p=canvas.requestPointerLock();p?.catch(()=>{});}catch{}}
 startAudio();
}
function pause(){shadowAudio?.suspend();ending?.pauseAudio();corridorCreak?.suspend();playing=false;keys.clear();touchStick.reset();drag=false;lookPointer=null;document.body.classList.remove('playing');$('#reticle').hidden=true;$('#touch').hidden=true;$('#prompt').hidden=true;$('#startText').textContent='探索に戻る';titleScreen.pause();if(document.pointerLockElement)document.exitPointerLock();if(soundGain)soundGain.gain.setTargetAtTime($('#sound').checked?.015:0,audioContext.currentTime,.3);if(rustleSource){rustleSource.stop();rustleSource=null;}}
function startAudio(){
 const firstAudioStart=!audioContext;
 if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();soundGain=audioContext.createGain();soundGain.gain.value=$('#sound').checked?.08:0;soundGain.connect(audioContext.destination);const b=audioContext.createBuffer(1,audioContext.sampleRate*5,audioContext.sampleRate),a=b.getChannelData(0);let previous=0;for(let i=0;i<a.length;i++){previous=(previous+(Math.random()*2-1)*.025)/1.025;a[i]=previous*4;}startImpactBuffer=b;const src=audioContext.createBufferSource();src.buffer=b;src.loop=true;const low=audioContext.createBiquadFilter();low.type='lowpass';low.frequency.value=700;src.connect(low);low.connect(soundGain);src.start();}
 audioContext.resume().then(()=>{if(firstAudioStart&&playing&&$('#sound').checked)storyAudio?.playStart(startImpactBuffer);});soundGain.gain.setTargetAtTime($('#sound').checked&&currentStage==='house'?.08:0,audioContext.currentTime,.4);
 if(!shadowAudio&&!shadowAudioLoading){shadowAudioLoading=true;createShadowAudio(audioContext).then(a=>shadowAudio=a).catch(e=>{shadowAudioLoading=false;console.error(e);});}
 if(!corridorCreak)corridorCreak=createCorridorCreakAudio(audioContext,(x,z)=>corridor.canStand(x,z));
 if(!storyAudio)storyAudio=createStoryAudio(audioContext,phonePoint,monkPoint);
 if(!rustleReady)rustleReady=audioContext.decodeAudioData(rustleData.slice(0)).then(buffer=>{rustleDuration=buffer.duration;return buffer;});
}
async function playRustle(){
 if(!audioContext||!$('#sound').checked){story.noteFirstMove();return;}
 try{const buffer=await rustleReady;if(!playing||!$('#sound').checked||audioContext.state!=='running'){story.noteFirstMove();return;}
  rustleSource=audioContext.createBufferSource();rustleSource.buffer=buffer;rustleGain=audioContext.createGain();rustleGain.gain.value=.65;rustleSource.connect(rustleGain);rustleGain.connect(audioContext.destination);
  const source=rustleSource;source.onended=()=>{source.disconnect();if(rustleSource===source)rustleSource=null;};source.start();rustlePlays++;story.noteFirstMove();
 }catch(error){story.noteFirstMove();console.error('人形の効果音を再生できません',error);}
}
function footstep(){if(!audioContext||!$('#sound').checked)return;const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='triangle';osc.frequency.setValueAtTime(90+Math.random()*40,audioContext.currentTime);osc.frequency.exponentialRampToValueAtTime(32,audioContext.currentTime+.12);gain.gain.setValueAtTime(.027,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.14);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+.15);}
function aimedAt(point,range){
 const d=point.clone().sub(camera.position);return d.length()<range&&d.normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.82&&haunting.clearLine(camera.position,point);
}
function interactionTarget(){
 if(movementLocked())return null;
 if(currentStage==='ending')return ending.target(camera);
 if(currentStage==='corridor')return shadowCouple.state.phase==='hidden'?corridorEvents.target(camera):null;
 if(story.phase==='monk-ready'&&aimedAt(monkPoint,2.2))return 'monk';
 if(story.phase==='jizo-ready'){
  const p=jizoPoint.clone().addScaledVector(camera.position.clone().sub(jizoPoint).normalize(),.24);
  if(aimedAt(p,2.3))return 'jizo';
 }
 if(story.canReadHint&&haunting.actor.visible&&aimedAt(haunting.actor.position.clone().add(new THREE.Vector3(0,.5,0)),2.3))return 'clue-hint-doll';
 const clue=clues?.target(camera,(a,b)=>haunting.clearLine(a,b));if(clue)return clue;
 if(clues?.cupboard.target(camera,(a,b)=>haunting.clearLine(a,b)))return 'cupboard';
 const w=layout?.well?.position;
 if(w){const dx=w[0]-position.x,dz=w[2]-position.z,d=Math.hypot(dx,dz);if(d<2.7&&(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/(d||1)>.5)return 'well';}
 const doorDelta=new THREE.Vector3(3.34,1.6,-.6).sub(camera.position);
 if(doorDelta.length()<2.5&&doorDelta.normalize().dot(camera.getWorldDirection(new THREE.Vector3()))>.82)return 'door';
 return null;
}
function showStory(title,detail,button,ending=false){
 $('#story').dataset.kind='story';
 keys.clear();touchStick.reset();drag=false;lookPointer=null;$('#storyTitle').textContent=title;$('#storyDetail').textContent=detail;$('#storyAction').textContent=button;$('#story').dataset.ending=ending?'true':'false';$('#story').hidden=false;$('#reticle').hidden=true;$('#prompt').hidden=true;$('#touch').hidden=true;
 if(document.pointerLockElement)document.exitPointerLock();$('#storyAction').focus();
}
function setJizoPresent(present){jizo.visible=present;const collider=navigation.colliders.find(b=>b.name==='Jizo');if(collider)collider.disabled=!present;}
function clearInput(){keys.clear();touchStick.reset();drag=false;lookPointer=null;footTime=0;}
function closeWarning(){
 if(!story.dismiss())return;
 clues.show();
 setJizoPresent(false);haunting.setPose(new THREE.Vector3(jizoPoint.x,surfaceHeight(jizoPoint.x,jizoPoint.z),jizoPoint.z),camera.position);haunting.actor.visible=true;
 wellLid.quaternion.copy(wellLidRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.12));wellLid.updateMatrixWorld(true);
 if($('#sound').checked)storyAudio?.playReveal(startImpactBuffer);
 flashOn=true;camera.lookAt(haunting.actor.position.clone().add(new THREE.Vector3(0,.5,0)));yaw=camera.rotation.y;pitch=camera.rotation.x;camera.updateMatrixWorld(true);
 $('#story').hidden=true;clearInput();$('#reticle').hidden=false;$('#touch').hidden=!touchUI();$('#hint').textContent='家の中から、声がする。';
 if(!touchUI()){try{canvas.requestPointerLock()?.catch(()=>{});}catch{}}
}
function recordClue(id){
 if(!story.inspectClue(id))return;
 if(story.phase==='monk-ready'){monk.visible=true;navigation.colliders.find(b=>b.name==='Praying monk').disabled=false;$('#hint').textContent='読経が、はっきりと聞こえる。';}
}
function beginRitual(){
 if(!story.examineMonk())return;
 clearInput();flashOn=true;inspectionUntil=0;$('#prompt').hidden=true;$('#touch').hidden=true;$('#hint').textContent='足が、動かない。';
}
function enterCorridor(){
 canvas.setAttribute('aria-label','懐中電灯で進む、暗い板張りの廊下');shadowAudio?.suspend();ending?.reset();
 $('#touchLight').hidden=false;$('footer>span:first-child').textContent='曇天　／　夜';
 corridorHints.reset();corridorHints.prepare(corridorWins+1);currentStage='corridor';corridor.setFloor(corridorWins+1);corridorCreak?.reset(corridorWins+1);corridorEvents.reset(corridorWins+1);corridorReading=false;clearInput();rain.reset();arms.group.visible=false;haunting.setPresent(false);
 corridor.scene.add(flash,flash.target);flash.distance=corridor.lighting.flashReach;flash.shadow.camera.far=corridor.lighting.flashReach;flash.shadow.camera.updateProjectionMatrix();position.fromArray(corridor.spawn);yaw=0;pitch=0;camera.position.copy(position);camera.rotation.set(0,0,0);camera.updateMatrixWorld(true);flashOn=true;
 if(soundGain)soundGain.gain.setTargetAtTime(0,audioContext.currentTime,.1);
 $('#place').textContent='廊下';$('#prompt').hidden=true;$('#inspection').hidden=true;$('#hint').textContent='人形の絵を手がかりに、左右の道を選ぶ';
}
function restartGame(autoStart=true){
 titleScreen.reset();clueReading=false;
 corridorHints?.reset(true);ending?.reset();corridorWins=0;endingQAFreeze=false;
 $('#touchLight').hidden=false;$('footer>span:first-child').textContent='曇天　／　夜';canvas.setAttribute('aria-label','曇天の夜、竹藪に囲まれた日本の廃屋');
 shadowCouple.reset();shadowAudio?.reset();corridorEvents.reset();corridorReading=false;
 clearInput();corridorCreak?.reset();story.reset();clues.reset();storyAudio?.reset();haunting.reset();rain.reset();currentStage='house';scene.add(flash,flash.target);flash.distance=16;flash.shadow.camera.far=16;flash.shadow.camera.updateProjectionMatrix();
 arms.group.visible=false;armsActive=false;monkFire.reset();monk.visible=false;navigation.colliders.find(b=>b.name==='Praying monk').disabled=true;wellLid.quaternion.copy(wellLidRest);wellLid.updateMatrixWorld(true);
 higanbana.visible=false;setJizoPresent(true);if(rustleSource){try{rustleSource.stop();}catch{}rustleSource=null;}
 rustlePlays=0;doorOpen=false;doorProgress=0;door.position.z=0;door.updateMatrixWorld(true);flashOn=true;inspectionUntil=0;firstStart=false;returnToGarden();previousFrame=performance.now();
 $('#story').hidden=true;$('#blackout').style.opacity=0;$('#presenceHint').hidden=true;$('#inspection').hidden=true;$('#credits').close();if(autoStart)start();else{pause();$('#startText').textContent='はじめる';$('#place').textContent='竹藪の家';$('#hint').textContent='イヤホン推奨';}
}
function restartCorridor(){corridorWins=0;shadowCouple.reset();shadowAudio?.reset();$('#story').hidden=true;$('#blackout').style.opacity=0;story.phase='corridor';story.rain=false;enterCorridor();playing=true;$('#reticle').hidden=false;$('#touch').hidden=!touchUI();$('#hint').textContent='F 懐中電灯　／　廊下を進む';}
// One result per block; wrong exits lead into the established shadow encounter.
export function reportCorridorChoice(correct){if(currentStage!=='corridor'||story.phase!=='corridor'||corridorReading||corridorHints.state.locked||shadowCouple.state.phase!=='hidden'||corridorEvents.outcome!==null||typeof correct!=='boolean')return false;if(!correct)enterCorridor();if(!corridorEvents.accept(correct))return false;if(correct){corridorWins++;return true;}corridorWins=0;return shadowCouple.trigger(position);}
// Called on completion of the final corridor; shared with local visual QA.
export async function enterEndingStage(){
 if(endingLoading||!endingDollSource)return false;corridorHints.reset();endingLoading=true;clearInput();$('#prompt').hidden=true;$('#touch').hidden=true;$('#hint').textContent='光が、見える。';
 try{if(!ending){await storyAudio?.ready;ending=await createEndingStage({loader,dollSource:endingDollSource,mobile:mobileMode,renderer,audioContext,ritualBuffers:Object.fromEntries(['chant','fire','explosion'].map(name=>[name,storyAudio?.buffer(name)])),soundEnabled:()=>$('#sound').checked});ending.setRestart(restartGame);ending.setExit(()=>restartGame(false));}
  ending.reset();corridorCreak?.stop();endingQAFreeze=false;shadowCouple.reset();shadowAudio?.reset();storyAudio?.reset();story.phase='corridor';story.rain=false;rain.reset();haunting.setPresent(false);corridorReading=false;currentStage='ending';
  position.fromArray(ending.spawn);yaw=0;pitch=0;camera.position.copy(position);camera.rotation.set(0,0,0);camera.updateMatrixWorld(true);flashOn=false;$('#story').hidden=true;$('#blackout').style.opacity=0;$('#reticle').hidden=false;$('#inspection').hidden=true;$('#touch').hidden=!touchUI();$('#touchLight').hidden=true;$('footer>span:first-child').textContent='朝の光';canvas.setAttribute('aria-label','朝の光が差す日本家屋の玄関');$('#hint').textContent='E　玄関を開ける';$('#place').textContent='玄関';if(soundGain)soundGain.gain.setTargetAtTime(0,audioContext.currentTime,.3);return true;
 }catch(e){console.error(e);$('#hint').textContent='玄関を読み込めませんでした。もう一度お試しください。';return false;}finally{endingLoading=false;}
}
function closeCorridorMessage(){corridorReading=false;clueReading=false;$('#story').hidden=true;clearInput();$('#reticle').hidden=false;$('#touch').hidden=!touchUI();if(!touchUI()){try{canvas.requestPointerLock()?.catch(()=>{});}catch{}}}

function activateStoryAction(){if(corridorHints?.state.locked){corridorHints.skip();return;}if(currentStage==='ending'&&ending.state.phase==='epilogue')return;if(corridorReading||clueReading){closeCorridorMessage();return;}if(shadowCouple?.state.phase==='gameover'){restartCorridor();return;}if(story.phase==='warning')closeWarning();}
function interact(){
 if(!playing||movementLocked())return;const t=interactionTarget();
 if(t==='exit'){if(ending.begin(position,yaw,pitch)){clearInput();$('#touch').hidden=true;$('#prompt').hidden=true;$('#reticle').hidden=true;if(document.pointerLockElement)document.exitPointerLock();}return;}
 if(t==='hint-doll'){if(corridorEvents.inspect()){clearInput();$('#touch').hidden=true;$('#prompt').hidden=true;corridorHints.begin(corridorEvents.floor,corridorEvents.state.steps);}return;}
 if(t?.startsWith('corridor:')){const message=corridorEvents.message(t);corridorReading=true;showStory(message.title,message.text,'閉じる');$('#story').dataset.kind='corridor';return;}
 if(t==='jizo'&&story.examine()){haunting.setPresent(false);showStory('にげろ','','閉じる');return;}
 if(t==='clue-hint-doll'){const text=story.nextClueHint();if(text){inspectionUntil=performance.now()+10000;$('#inspection').textContent=text;}return;}
 if(t==='monk'){beginRitual();return;}
 if(t==='cupboard'){clues.cupboard.interact();return;}
 if(t?.startsWith('clue:')){const clue=clues.get(t);recordClue(t.slice(5));if(clue.reading){clueReading=true;inspectionUntil=0;showStory(clue.title,'','閉じる');$('#story').dataset.kind='newspaper';const image=document.createElement('img');image.src=clue.image;image.alt=clue.title+'\n'+clue.text;image.draggable=false;$('#storyDetail').append(image);$('#storyDetail').scrollTop=0;$('#storyDetail').scrollLeft=0;}else{inspectionUntil=performance.now()+6500;$('#inspection').textContent=clue.text;}return;}
 if(t==='well'){recordClue('well');inspectionUntil=performance.now()+6500;$('#inspection').textContent=story.rain?'蓋が、開いている。\n二本の縄が、暗闇の中へ続いている。':'板の隙間から、二本の縄が垂れている。\n先は暗くて見えない。';}
 else if(t==='door'){doorOpen=!doorOpen;footstep();}
}
function setupLocalStoryQA(){
 if(!['127.0.0.1','localhost'].includes(location.hostname)||new URLSearchParams(location.search).get('qa')!=='story')return;
 const panel=document.createElement('aside');panel.id='storyQA';panel.style.cssText='position:fixed;left:12px;bottom:55px;z-index:90;display:flex;gap:5px;flex-wrap:wrap;max-width:95vw;background:#18201deb;padding:7px;font-size:11px';
 const place=(p,look)=>{clearInput();position.fromArray(p);camera.position.copy(position);camera.lookAt(new THREE.Vector3(...look));yaw=camera.rotation.y;pitch=camera.rotation.x;camera.updateMatrixWorld(true);};
 const actions={
  '人形を見る':()=>place([2.8,2.291,-1.8],[1.86,1.2,-3.62]),
  '視線を外す':()=>{yaw+=2.1;camera.rotation.set(pitch,yaw,0);},
  'お地蔵さんへ':()=>place([jizoPoint.x,1.62,jizoPoint.z+1.4],jizoPoint.toArray()),
  'ヒントの人形へ':()=>{restartGame(false);story.noteFirstMove();story.examine();closeWarning();place([jizoPoint.x,1.62,jizoPoint.z+1.4],haunting.actor.position.clone().add(new THREE.Vector3(0,.5,0)).toArray());start();},
  '井戸へ':()=>place([7,1.62,-4.4],[8.4,.8,-6.2]),
  '井戸を覗く':()=>place([8.4,1.62,-5.20],[8.4,-.8,-6.2]),
  '僧の前へ':()=>place([-.93,2.292,2.39],monkPoint.toArray()),
  '収納の隙間へ':()=>{flashOn=false;place([-.73,2.29,-3.16],[-.705,2.04,-4.455]);},
  '収納の戸へ':()=>place([-1.0,2.29,-3.16],[-.98,1.6,-4.39]),
  '収納を照らす':()=>{flashOn=true;},
  '地蔵後の収納へ':()=>{restartGame(false);story.noteFirstMove();story.examine();closeWarning();place([-1.0,2.29,-3.16],[-.98,1.6,-4.39]);start();},
  '儀式の直前へ':()=>{restartGame(false);story.noteFirstMove();story.examine();closeWarning();for(const id of CLUE_IDS)recordClue(id);place([-.3,2.292,2.39],monkPoint.toArray());start();},
  '焼けた畳へ':()=>place([-.88,2.292,.98],[-2.3,.67,2.5]),
  '廊下へ':()=>{corridorWins=0;shadowCouple.reset();shadowAudio?.reset();story.phase='corridor';story.rain=false;enterCorridor();},
  '最終階層の廊下へ':()=>{corridorWins=CORRIDOR_COUNT-1;shadowCouple.reset();shadowAudio?.reset();story.phase='corridor';story.rain=false;enterCorridor();},
  '床鳴りを試聴':()=>{if(currentStage==='corridor'&&playing&&$('#sound').checked)corridorCreak?.play(camera);},
  ...Object.fromEntries([1,2,3,4].map(n=>['第'+n+'廊下へ',()=>{corridorWins=n-1;shadowCouple.reset();shadowAudio?.reset();story.phase='corridor';story.rain=false;enterCorridor();}])),
  '今の人形の前へ':()=>{if(currentStage==='corridor'){const p=corridorEvents.doll.position;place([p.x,1.64,p.z+2.1],[p.x,.48,p.z]);}},
  '廊下の中ほどへ':()=>place([0,1.64,-13],[0,1.5,-23]),
  '祈祷師の回想へ':()=>{corridorWins=0;shadowCouple.reset();shadowAudio?.reset();story.phase='corridor';story.rain=false;enterCorridor();place([0,1.64,-6.8],[0,.48,-9]);},
  '井戸の回想の廊下へ':()=>{corridorWins=2;shadowCouple.reset();shadowAudio?.reset();story.phase='corridor';story.rain=false;enterCorridor();},
  '最終玄関へ':()=>enterEndingStage(),
  '玄関の前へ':()=>{if(currentStage==='ending')place([0,1.64,-10.25],[0,1.25,-12.5]);},
  '最終演出を最初から':()=>{if(currentStage==='ending'){ending.reset();position.set(0,1.64,-10.25);yaw=0;pitch=0;ending.begin(position,yaw,pitch);endingQAFreeze=false;clearInput();}},
  '別れを静止確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=8;endingQAFreeze=true;clearInput();$('#touch').hidden=true;$('#reticle').hidden=true;$('#prompt').hidden=true;}},
  '着火を静止確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=10.25;endingQAFreeze=true;}},
  '手つなぎを静止確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=25.5;endingQAFreeze=true;}},
  '延焼を静止確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=33;endingQAFreeze=true;}},
  '家族の回想を確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=16;endingQAFreeze=true;}},
  '崩落を静止確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=38;endingQAFreeze=true;}},
  '演出を再開':()=>{endingQAFreeze=false;},
  '自動テキストを確認':()=>{if(currentStage==='ending'){ending.begin(position,yaw,pitch);ending.state.time=44;ending.state.phase='epilogue';endingQAFreeze=false;clearInput();}},
  '使用ツール欄を確認':()=>{if(currentStage==='ending')ending.presentation.seekCredits(.82);},
  'クレジット末尾を確認':()=>{if(currentStage==='ending')ending.presentation.seekCredits(1);},
  '次の廊下へ':()=>{if(currentStage==='corridor'&&corridorEvents.outcome==='success')place([-6,1.64,-33.1],[-6,1.64,-34]);},
  '左の出口へ':()=>place([-6,1.64,-33.1],[-6,1.64,-34]),
  '右の出口へ':()=>place([6,1.64,-33.1],[6,1.64,-34]),
  '誤選択を試す':()=>reportCorridorChoice(false),
  '正解を試す':()=>reportCorridorChoice(true),
  '分岐の二人へ':()=>place([0,1.64,-20.5],[0,1.1,-23.5]),
  '左の僧侶へ':()=>place([-1.05,1.64,-21.55],[-1.05,1.48,-23.4]),
  '右の僧侶へ':()=>place([1.05,1.64,-21.55],[1.05,1.48,-23.4]),
  '廊下の人形へ':()=>place([0,1.64,-6.8],[0,.48,-9]),
  '画用紙とクレヨンへ':()=>place([2.6,2.29,-1.65],[1.65,1.03,-1.65]),
  '腕を見る':()=>{camera.lookAt(new THREE.Vector3(-3.45,1.3,1.2));yaw=camera.rotation.y;pitch=camera.rotation.x;},
  ...Object.fromEntries(Object.entries(CLUE_VIEWS).map(([key,v])=>['伏線 '+key,()=>place(v.eye,v.target)])),
  '調べる':interact,'最初から':restartGame,'検証UIを隠す':()=>{panel.style.display='none';}
 };
 for(const [label,action] of Object.entries(actions)){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{if(['最初から','検証UIを隠す','最終演出を最初から','別れを静止確認','着火を静止確認','手つなぎを静止確認','延焼を静止確認','家族の回想を確認','崩落を静止確認','演出を再開','自動テキストを確認','使用ツール欄を確認','クレジット末尾を確認'].includes(label)||(label==='腕を見る'&&!controlsLocked())||!movementLocked())action();};panel.append(button);}
 document.body.append(panel);
 document.addEventListener('keydown',e=>{if(e.code==='KeyH'&&!e.repeat){panel.style.display=panel.style.display==='none'?'flex':'none';}});
}

function terrainHeight(x,z){const y=-z,r=Math.hypot(x*.9,y),gate=x>4.5&&x<9.2&&y<-5?0:1;return Math.max(0,Math.min(4.3,(r-10)*.32))*(.82+.18*Math.sin(x*.46)*Math.cos(y*.39))*gate-.015;}
function surfaceHeight(x,z){let h=Math.max(0,terrainHeight(x,z));for(const f of navigation?.floors||[]){if(x>=f.min[0]-.05&&x<=f.max[0]+.05&&z>=f.min[2]-.05&&z<=f.max[2]+.05)h=Math.max(h,f.max[1]);}for(const f of layout?.steps||[]){if(Math.abs(x-f.x)<f.w/2&&Math.abs(z-f.z)<f.d/2)h=Math.max(h,f.h);}return h;}
function blocked(x,z,y){
 if(currentStage==='ending')return !ending.canStand(x,z);
 if(currentStage==='corridor')return !corridor.canStand(x,z)||!corridorEvents.canStand(x,z);
 if(x<-13||x>14||z<-14||z>16)return true;
 const r=.18;
 for(const b of navigation.colliders){if(b.disabled)continue;if(b.max[1]<y-1.05||b.min[1]>y+.1)continue;if(x+r>b.min[0]&&x-r<b.max[0]&&z+r>b.min[2]&&z-r<b.max[2])return true;}
 if(!doorOpen&&Math.abs(x-3.34)<r+.035&&z>-.97-r&&z<-.07+r)return true;
 return false;
}
$('#start').onclick=start;
$('#storyAction').onclick=activateStoryAction;
$('#menu').onclick=()=>{if(!controlsLocked())playing?pause():start();};
$('#brightness').oninput=e=>renderer.toneMappingExposure=Number(e.target.value);$('#sound').onchange=()=>{if(soundGain)soundGain.gain.setTargetAtTime($('#sound').checked&&currentStage==='house'?.08:0,audioContext.currentTime,.2);else if(playing&&$('#sound').checked)startAudio();if(rustleGain)rustleGain.gain.setTargetAtTime($('#sound').checked?.65:0,audioContext.currentTime,.02);};
$('#touchLight').onclick=()=>{if(canToggleFlash())flashOn=!flashOn;};$('#touchAction').onclick=interact;
document.addEventListener('keydown',e=>{if(!playing)return;if(currentStage==='ending'&&e.target.closest?.('#ending button')&&['Enter','Space'].includes(e.code))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;if(controlsLocked()){if(['KeyE','Enter','Space'].includes(e.code)){e.preventDefault();activateStoryAction();}return;}keys.add(e.code);if(e.code==='KeyF'&&canToggleFlash())flashOn=!flashOn;if(e.code==='KeyE')interact();if(e.code==='Escape')pause();if(e.code==='KeyR'&&!story.rain&&currentStage==='house')returnToGarden();});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(playing&&!controlsLocked())pause()});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!drag&&!controlsLocked())pause()});
canvas.addEventListener('pointerdown',e=>{if(!playing||controlsLocked())return;if(lookPointer!==null)return;drag=true;lookPointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(e.pointerId===lookPointer){drag=false;lookPointer=null;}});
document.addEventListener('pointermove',e=>{if(!playing||controlsLocked())return;let dx=0,dy=0;if(document.pointerLockElement===canvas){dx=e.movementX;dy=e.movementY;}else if(drag&&e.pointerId===lookPointer){dx=e.clientX-lastX;dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;}const sensitivity=touchUI()?Math.PI/Math.max(320,innerWidth):.0021;yaw-=dx*sensitivity;pitch=Math.max(-1.25,Math.min(1.25,pitch-dy*sensitivity));});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let elapsed=0,frameTimes=[],diagnosticAt=0;
function animate(){requestAnimationFrame(animate);let now=performance.now();let frameDt=(now-previousFrame)/1000,dt=Math.min(frameDt,.05);previousFrame=now;if(renderingWarmup||document.hidden)return;elapsed+=dt;clouds.uniforms.time.value=elapsed;
 if(playing&&navigation&&!movementLocked()){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),right=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  forward+=touchStick.axes.z;right+=touchStick.axes.x;let speed=(currentStage==='corridor'?2.1:1.65)*dt/Math.max(1,Math.hypot(forward,right)),dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
  if(!blocked(position.x+dx,position.z,position.y))position.x+=dx;if(!blocked(position.x,position.z+dz,position.y))position.z+=dz;
  const h=currentStage!=='house'?1.64:surfaceHeight(position.x,position.z)+1.62;position.y=THREE.MathUtils.damp(position.y,h,12,dt);
  camera.position.copy(position);camera.rotation.set(pitch,yaw,0);
  if(forward||right){camera.position.y+=Math.sin(elapsed*9)*.009;footTime+=dt;if(footTime>.62){footstep();footTime=0;}}
  const near=interactionTarget();$('#prompt').hidden=!near;setText($('#prompt'),(near==='hint-doll'||near==='clue-hint-doll')?(touchUI()?'人形を調べる':'E　人形を調べる'):near==='exit'?(touchUI()?'玄関を開ける':'E　玄関を開ける'):near?.startsWith('corridor:')?'E　僧侶の顔の紙を読む':near?.startsWith('clue:')?'E　'+clues.get(near).label+'を調べる':near==='jizo'?'E　お地蔵さんを調べる':near==='monk'?'E　お坊さんを調べる':near==='well'?'E　井戸を調べる':near==='cupboard'?(clues.cupboard.state.open?'E　収納の引き戸を閉める':'E　収納の引き戸を開ける'):doorOpen?'E　障子を閉める':'E　障子を開ける');
 }else if(firstStart){camera.position.set(9.2+Math.sin(elapsed*.05)*.15,2.8,9.8);camera.lookAt(-1.4,1.5,1.5);}
 if(door&&currentStage==='house'){doorProgress=THREE.MathUtils.damp(doorProgress,doorOpen?1:0,4,dt);if(Math.abs(doorProgress-(doorOpen?1:0))<.0001)doorProgress=doorOpen?1:0;door.position.z=-doorProgress*.88;}
 const active=playing&&!document.hidden;
 if(house&&haunting&&corridor){
  haunting.update(dt,active&&currentStage==='house'&&!story.rain);
  story.unlock(haunting.moves);
  const storyDt=story.fireActive?cinematicFrameDelta(frameDt):Math.min(frameDt,.1),oldPhase=story.phase;story.tick(storyDt,active);
  if(story.stage==='corridor'&&currentStage==='house')enterCorridor();
  if(story.armsStarted&&!armsActive){armsActive=true;arms.group.visible=true;arms.setMode('Emerge');}
  if(armsActive&&active&&currentStage==='house')arms.update(storyDt);
  if(oldPhase==='arrival'&&story.phase==='corridor'){$('#touch').hidden=!touchUI();$('#hint').textContent='人形の絵を手がかりに、左右の道を選ぶ';}
  if(story.phase==='ritual'){camera.position.copy(position);camera.rotation.set(pitch,yaw,0);}
  higanbana.visible=(haunting.moves>0||story.rain)&&currentStage==='house';
  higanbana.children.forEach((stem,i)=>{stem.visible=i<story.remainingClues;});
  monkFire.update(story,active?storyDt:0,camera);
  tatamiScorch?.update(story,currentStage);

  setOpacity($('#blackout'),Math.max(story.darkness,currentStage==='corridor'?shadowCouple.state.darkness:0));
  storyAudio?.update(story,active,$('#sound').checked,camera);
  rain.update(active?dt:0,story.rain&&currentStage==='house',camera,flashOn&&playing);
  corridorHints.update(storyDt,active&&currentStage==='corridor');
  if(currentStage==='corridor'){corridorEvents.update(active?dt:0,camera,active&&!corridorReading&&!corridorHints.state.locked);shadowCouple.update(active?storyDt:0,position,camera);corridor.updateEncounter(shadowCouple.state,shadowCouple.actors);corridor.update(active?dt:0,camera);setOpacity($('#blackout'),Math.max(story.darkness,shadowCouple.state.darkness));if(shadowCouple.state.locked){camera.lookAt(shadowCouple.lookTarget());yaw=camera.rotation.y;pitch=camera.rotation.x;}}
  corridorCreak?.update(dt,{active:active&&currentStage==='corridor',eligible:currentStage==='corridor'&&!controlsLocked()&&story.phase==='corridor'&&shadowCouple.state.phase==='hidden'&&corridorEvents.state.count>0&&position.z>-20,sound:$('#sound').checked,camera,position});
  shadowAudio?.update(shadowCouple.state,active&&currentStage==='corridor',$('#sound').checked,camera,corridorReading||corridorHints.state.locked);
  if(active&&currentStage==='corridor'&&!movementLocked()&&story.phase==='corridor'&&shadowCouple.state.phase==='hidden'){
   const exit=evaluateCorridorExit(corridorEvents.floor,position);
   if(exit){
    if(corridorEvents.outcome===null)reportCorridorChoice(exit.correct);
    if(corridorEvents.outcome==='success'){if(corridorWins>=CORRIDOR_COUNT)enterEndingStage();else enterCorridor();}
   }
  }
  if(currentStage==='ending'){ending.update(Math.min(frameDt,.1),active&&!endingQAFreeze,camera,position);yaw=camera.rotation.y;pitch=camera.rotation.x;setOpacity($('#blackout'),0);}
 }

 $('#inspection').hidden=!playing||performance.now()>inspectionUntil;
 camera.getWorldDirection(v3);flash.position.copy(camera.position).addScaledVector(v3,.2);flash.position.y-=.16;flash.target.position.copy(camera.position).addScaledVector(v3,10);flash.intensity=(currentStage==='corridor'?corridor.lighting.flashPower:25)*story.flashlightPower*(currentStage==='corridor'?1-shadowCouple.state.darkness:1);flash.visible=true;if(!playing||!flashOn||story.flashlightPower<=0)flash.intensity=0;
 if(clues)clues.cupboard.update(active?Math.min(frameDt,.1):0,{active:active&&currentStage==='house'&&!controlsLocked(),beforeJizo:!story.rain,camera,flash,clearLine:(a,b)=>haunting.clearLine(a,b)});
 if(currentStage==='house')dust.update(elapsed,flash.position,v3,flash.intensity>0,renderer.getPixelRatio());
 const overlayOnly=!playing||shadowCouple?.state.phase==='gameover'||(currentStage==='ending'&&ending.state.phase==='epilogue');
 if(!overlayOnly){
  if(currentStage==='house'&&elapsed-lastLodTime>.2){lastLodTime=elapsed;for(const lod of forestLods){const distance=Math.hypot(camera.position.x-lod.center.x,camera.position.z-lod.center.z),coarse=distance>(lod.coarse?14:18);if(coarse!==lod.coarse){lod.coarse=coarse;lod.high.visible=!coarse;lod.low.visible=coarse;forestRevision++;}}}
  const casters=currentStage==='house'?[transformKey(door),transformKey(haunting?.actor),transformKey(jizo),transformKey(monk),transformKey(wellLid),clues?.reveal.visible,clues?.cupboard.shadowKey,higanbana?.visible,story.remainingClues,forestRevision].join('|'):currentStage==='corridor'?[corridorEvents.group.visible,transformKey(corridorEvents.doll)].join('|'):ending?.shadowRevision;
  if(currentStage==='house')moonCache.sync(casters);
  if(flash.intensity>0)flashCache.sync(currentStage+'|'+casters+'|'+transformKey(flash)+'|'+transformKey(flash.target));
  renderer.render(currentStage==='ending'?ending.scene:currentStage==='corridor'?corridor.scene:scene,camera);
 }
 const quality=resolution.sample(frameDt,active&&!overlayOnly&&!controlsLocked()&&(currentStage!=='corridor'||shadowCouple.state.phase==='hidden'));
 if(quality!==null){renderer.setPixelRatio(quality);renderer.setSize(innerWidth,innerHeight);}

 if(diagnosticMode){frameTimes.push(frameDt);if(frameTimes.length>120)frameTimes.shift();}
 if(diagnosticMode&&elapsed-diagnosticAt>1&&$('#diagnostics')){diagnosticAt=elapsed;$('#diagnostics').textContent=JSON.stringify({loaded:!!house,playing,mobileMode,rendering3D:!overlayOnly,renderFrames:renderer.info.render.frame,pixelRatio:renderer.getPixelRatio(),images:imageCache.diagnostics(),forestLOD:{cells:forestLods.length,coarse:forestLods.filter(l=>l.coarse).length},shadowUpdates:{moon:moonCache.updates,flash:flashCache.updates},touchVisible:!$('#touch').hidden,position:position.toArray().map(x=>+x.toFixed(3)),yaw,pitch,flash:flashOn,door:doorOpen,programs:renderer.info.programs.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps:Math.round(frameTimes.length/frameTimes.reduce((a,b)=>a+b,0)),colliders:navigation.colliders.length,doll:haunting?.diagnostics(),jizoVisible:!!jizo?.visible,jizoPosition:jizoPoint.toArray(),clueHint:story.lastHint,flowers:{visible:!!higanbana?.visible,count:higanbana?.children.filter(o=>o.visible).length||0,total:higanbana?.children.length||0},story:story.diagnostics(),clues:clues?.diagnostics(),stage:currentStage,ending:ending?.diagnostics(),corridorWins,corridorHint:corridorHints?.diagnostics(),monkVisible:!!monk?.visible,tatamiScorch:tatamiScorch?.diagnostics(),wellOpen:story.rain,fire:monkFire?.diagnostics(),shadowCouple:shadowCouple?.diagnostics(),shadowAudio:shadowAudio?.diagnostics(),candles:corridor?.diagnostics(),corridorCreak:corridorCreak?.diagnostics(),corridorEvents:corridorEvents?.diagnostics(),corridorReading,arms:armsActive?arms?.diagnostics():null,storyAudio:storyAudio?.diagnostics(),rustle:{plays:rustlePlays,duration:rustleDuration,state:audioContext?.state}});}
}
$('#fullscreen').hidden=!document.documentElement.requestFullscreen;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
document.body.classList.toggle('touch-mode',touchUI());
window.addEventListener('resize',()=>{document.body.classList.toggle('touch-mode',touchUI());$('#touch').hidden=!playing||movementLocked()||!touchUI();});
document.addEventListener('visibilitychange',()=>{
 previousFrame=performance.now();
 if(document.hidden){
  shadowAudio?.suspend();ending?.pauseAudio();
  corridorCreak?.suspend();
  if(playing&&!controlsLocked())pause();
  storyAudio?.update(story,false,$('#sound').checked,camera);
  if(shadowCouple)shadowAudio?.update(shadowCouple.state,false,$('#sound').checked);
  if(soundGain)soundGain.gain.setTargetAtTime(0,audioContext.currentTime,.05);
  if(rustleSource){rustleSource.stop();rustleSource=null;}
 }else if(soundGain)soundGain.gain.setTargetAtTime($('#sound').checked&&currentStage==='house'?(playing?.08:.015):0,audioContext.currentTime,.2);
});
init();animate();
