import * as THREE from './vendor/three.module.js';
export function createStoryAudio(context,phonePosition,monkPosition){
 const tracks={},errors=[],effects=new Set();let startPlays=0,revealPlays=0;
 const ready=Promise.all([
  ['rain','rain.mp3',.44,null],['kagome','kagome.wav',.085,null],
  ['phone','phone.wav',.72,phonePosition],['chant','chant.wav',.20,monkPosition]
 ].map(async([name,file,volume,position])=>{
  const gain=context.createGain();gain.gain.value=0;let panner=null;
  if(position){panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=name==='chant'?1.6:3;panner.rolloffFactor=name==='chant'?1.35:.65;panner.maxDistance=50;panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;gain.connect(panner);panner.connect(context.destination);}else gain.connect(context.destination);
  const t={gain,panner,position,volume,buffer:null,source:null,offset:0,started:0};tracks[name]=t;
  try{const r=await fetch('assets/audio/'+file);if(!r.ok)throw Error(file+' '+r.status);t.buffer=await context.decodeAudioData(await r.arrayBuffer());}catch(e){errors.push(e.message);console.error('音源を読み込めません',file,e);}
 }));
 function stop(t){if(t.source){t.offset=(t.offset+context.currentTime-t.started)%t.buffer.duration;t.source.stop();t.source.disconnect();t.source=null;}}
 function stopEffects(){for(const source of effects){try{source.stop();}catch{}}effects.clear();}
 function impact(buffer){
  if(!buffer||context.state!=='running')return false;
  const source=context.createBufferSource(),gain=context.createGain(),low=context.createBiquadFilter();source.buffer=buffer;low.type='lowpass';low.frequency.value=700;gain.gain.value=.92;source.connect(low);low.connect(gain);gain.connect(context.destination);gain.gain.setTargetAtTime(0,context.currentTime,.4);effects.add(source);source.onended=()=>{effects.delete(source);source.disconnect();low.disconnect();gain.disconnect();};source.start();source.stop(context.currentTime+2.4);return true;
 }
 const direction=new THREE.Vector3();
 return {ready,
  playStart(buffer){if(impact(buffer))startPlays++;},playReveal(buffer){if(impact(buffer))revealPlays++;},
  reset(){stopEffects();revealPlays=0;for(const t of Object.values(tracks)){stop(t);t.offset=0;t.gain.gain.cancelScheduledValues(context.currentTime);t.gain.gain.value=0;}},
  update(state,active,sound,camera){
   if(!active||!sound)stopEffects();
   const wanted={rain:state.rain,kagome:state.kagome,chant:state.chanting,phone:state.phoneRinging};
   for(const [name,t] of Object.entries(tracks)){
    const run=!!wanted[name]&&active&&sound&&context.state==='running';
    if(run&&t.buffer&&!t.source){t.source=context.createBufferSource();t.source.buffer=t.buffer;t.source.loop=true;t.source.connect(t.gain);t.started=context.currentTime;t.source.start(0,t.offset);}
    const level=name==='chant'?state.chantLevel:name==='phone'?state.phoneLevel:1;
    if(!run)stop(t);t.targetGain=run?t.volume*level:0;t.gain.gain.setTargetAtTime(t.targetGain,context.currentTime,name==='chant'?.8:.08);
   }
   camera.getWorldDirection(direction);const l=context.listener;
   if(l.positionX){l.positionX.value=camera.position.x;l.positionY.value=camera.position.y;l.positionZ.value=camera.position.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
   else{l.setPosition(camera.position.x,camera.position.y,camera.position.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  },
  diagnostics(){return {errors:[...errors],startPlays,revealPlays,tracks:Object.fromEntries(Object.entries(tracks).map(([name,t])=>[name,{playing:!!t.source,targetGain:t.targetGain||0,maxGain:t.volume,ready:!!t.buffer,time:+((t.offset+(t.source?context.currentTime-t.started:0))%(t.buffer?.duration||1)).toFixed(2),position:t.position?.toArray()||null,refDistance:t.panner?.refDistance,rolloffFactor:t.panner?.rolloffFactor}]))};}
 };
}
