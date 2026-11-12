import * as THREE from './vendor/three.module.js';
export function createStoryAudio(context,phonePosition,monkPosition){
 const tracks={},errors=[],effects=new Set();let startPlays=0,revealPlays=0,fireWasActive=false;
 const ready=Promise.all([
  ['rain','rain.mp3',.44,null],['kagome','kagome.wav',.085,null],
  ['phone','phone.wav',.72,phonePosition],['chant','chant.wav',.20,monkPosition],
  ['fire','engyclick-firewood-burning-sound-179862.mp3',.35,monkPosition],
  ['explosion','Explosion04-1(Short).mp3',.65,monkPosition,false],
  ['cupboardClose','ふすま・閉める02.mp3',.6,new THREE.Vector3(-1.32,1.6,-4.35),false]
 ].map(async([name,file,volume,position,loop=true])=>{
  const gain=context.createGain();gain.gain.value=0;let panner=null;
  if(position){panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=name==='chant'?1.6:3;panner.rolloffFactor=name==='chant'?1.35:.65;panner.maxDistance=50;panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;gain.connect(panner);panner.connect(context.destination);}else gain.connect(context.destination);
  const t={gain,panner,position,volume,loop,done:false,plays:0,buffer:null,source:null,offset:0,started:0};tracks[name]=t;
  try{const r=await fetch('assets/audio/'+encodeURIComponent(file));if(!r.ok)throw Error(file+' '+r.status);t.buffer=await context.decodeAudioData(await r.arrayBuffer());}catch(e){errors.push(e.message);console.error('音源を読み込めません',file,e);}
 }));
 function stop(t){if(t.source){const offset=t.offset+context.currentTime-t.started;t.offset=t.loop?offset%t.buffer.duration:Math.min(offset,t.buffer.duration);const source=t.source;t.source=null;source.onended=null;source.stop();source.disconnect();}}
 function stopEffects(){for(const source of effects){try{source.stop();}catch{}}effects.clear();}
 function impact(buffer){
  if(!buffer||context.state!=='running')return false;
  const source=context.createBufferSource(),gain=context.createGain(),low=context.createBiquadFilter();source.buffer=buffer;low.type='lowpass';low.frequency.value=700;gain.gain.value=.92;source.connect(low);low.connect(gain);gain.connect(context.destination);gain.gain.setTargetAtTime(0,context.currentTime,.4);effects.add(source);source.onended=()=>{effects.delete(source);source.disconnect();low.disconnect();gain.disconnect();};source.start();source.stop(context.currentTime+2.4);return true;
 }
 const direction=new THREE.Vector3();let listenerKey='';
 return {ready,buffer(name){return tracks[name]?.buffer;},
  playStart(buffer){if(impact(buffer))startPlays++;},playReveal(buffer){if(impact(buffer))revealPlays++;},
  playCupboardClose(){
   const t=tracks.cupboardClose;if(!t.buffer||context.state!=='running')return false;
   if(t.source)effects.delete(t.source);stop(t);t.offset=0;t.started=context.currentTime;t.targetGain=t.volume;t.gain.gain.cancelScheduledValues(context.currentTime);t.gain.gain.value=t.volume;
   const source=context.createBufferSource();t.source=source;source.buffer=t.buffer;source.connect(t.gain);effects.add(source);t.plays++;
   source.onended=()=>{effects.delete(source);source.disconnect();if(t.source===source){t.source=null;t.offset=0;t.targetGain=0;t.gain.gain.value=0;}};source.start();return true;
  },
  reset(){stopEffects();revealPlays=0;fireWasActive=false;for(const t of Object.values(tracks)){stop(t);t.offset=0;t.done=false;t.plays=0;t.gain.gain.cancelScheduledValues(context.currentTime);t.gain.gain.value=0;t.targetGain=0;}},
  update(state,active,sound,camera){
   if(!active||!sound)stopEffects();
   if(!!state.fireActive!==fireWasActive){for(const name of ['fire','explosion']){const t=tracks[name];stop(t);t.offset=0;t.done=false;}fireWasActive=!!state.fireActive;}
   const wanted={rain:state.rain,kagome:state.kagome,chant:state.chanting,phone:state.phoneRinging,fire:state.fireActive,explosion:state.fireActive};
   for(const [name,t] of Object.entries(tracks)){
    if(name==='cupboardClose')continue;
    if(name==='explosion'&&!t.source)t.offset=Math.max(t.offset,state.ritualSeconds||0);
    const run=!!wanted[name]&&active&&sound&&context.state==='running'&&(t.loop||(!t.done&&t.offset<(t.buffer?.duration||0)));
    if(run&&t.buffer&&!t.source){const source=context.createBufferSource();t.source=source;source.buffer=t.buffer;source.loop=t.loop;source.connect(t.gain);t.started=context.currentTime;source.onended=()=>{source.disconnect();if(t.source===source){t.source=null;if(!t.loop){t.done=true;t.offset=t.buffer.duration;}}};source.start(0,t.offset);t.plays++;}
    const level=name==='chant'?state.chantLevel:name==='phone'?state.phoneLevel:(name==='fire'||name==='explosion')?1-state.darkness:1;
    if(!run)stop(t);const target=run?t.volume*level:0;if(t.targetGain!==target){t.targetGain=target;t.gain.gain.setTargetAtTime(target,context.currentTime,name==='chant'?.8:name==='explosion'?.005:.08);}
   }
   if(!Object.values(tracks).some(t=>t.panner&&t.source))return;
   camera.getWorldDirection(direction);const key=[camera.position.x,camera.position.y,camera.position.z,direction.x,direction.y,direction.z].join(',');if(key===listenerKey)return;listenerKey=key;const l=context.listener;
   if(l.positionX){l.positionX.value=camera.position.x;l.positionY.value=camera.position.y;l.positionZ.value=camera.position.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
   else{l.setPosition(camera.position.x,camera.position.y,camera.position.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  },
  diagnostics(){return {errors:[...errors],startPlays,revealPlays,tracks:Object.fromEntries(Object.entries(tracks).map(([name,t])=>[name,{playing:!!t.source,loop:t.loop,plays:t.plays,done:t.done,targetGain:t.targetGain||0,maxGain:t.volume,ready:!!t.buffer,time:+(t.loop?(t.offset+(t.source?context.currentTime-t.started:0))%(t.buffer?.duration||1):Math.min(t.offset+(t.source?context.currentTime-t.started:0),t.buffer?.duration||0)).toFixed(2),position:t.position?.toArray()||null,refDistance:t.panner?.refDistance,rolloffFactor:t.panner?.rolloffFactor}]))};}
 };
}
