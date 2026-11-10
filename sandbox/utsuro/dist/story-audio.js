import * as THREE from './vendor/three.module.js';
// AudioBuffer playback shares the context unlocked by the Start tap, including iOS.
export function createStoryAudio(context,phonePosition){
 const tracks={},errors=[];
 for(const [name,file,volume] of [['rain','rain.mp3',.44],['kagome','kagome.wav',.085],['phone','phone.wav',.72]]){
  const gain=context.createGain();gain.gain.value=0;
  if(name==='phone'){
   const p=context.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=3;p.maxDistance=50;p.rolloffFactor=.65;
   p.positionX.value=phonePosition.x;p.positionY.value=phonePosition.y;p.positionZ.value=phonePosition.z;gain.connect(p);p.connect(context.destination);
  }else gain.connect(context.destination);
  const t={gain,volume,buffer:null,source:null,offset:0,started:0};tracks[name]=t;
  fetch('assets/audio/'+file).then(r=>{if(!r.ok)throw new Error(file+' '+r.status);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>t.buffer=b).catch(e=>errors.push(e.message));
 }
 const stop=t=>{if(t.source){t.offset=(t.offset+context.currentTime-t.started)%t.buffer.duration;t.source.stop();t.source.disconnect();t.source=null;}};
 const direction=new THREE.Vector3();
 return {
  reset(){for(const t of Object.values(tracks)){stop(t);t.offset=0;t.gain.gain.cancelScheduledValues(context.currentTime);t.gain.gain.value=0;}},
  update(state,active,sound,camera){
   const ended=state.phase==='lost'||state.phase==='clear',wanted={rain:state.rain&&!ended,kagome:state.chasing||state.phase==='sighting',phone:state.phase==='phone'};
   for(const [name,t] of Object.entries(tracks)){
    const run=wanted[name]&&active&&sound&&context.state==='running';
    if(run&&t.buffer&&!t.source){t.source=context.createBufferSource();t.source.buffer=t.buffer;t.source.loop=true;t.source.connect(t.gain);t.started=context.currentTime;t.source.start(0,t.offset);}
    if(!run)stop(t);t.gain.gain.setTargetAtTime(run?t.volume:0,context.currentTime,.12);
   }
   const l=context.listener;camera.getWorldDirection(direction);
   if(l.positionX){l.positionX.value=camera.position.x;l.positionY.value=camera.position.y;l.positionZ.value=camera.position.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
   else {l.setPosition(camera.position.x,camera.position.y,camera.position.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  },
  diagnostics(){return {errors:[...new Set(errors)],tracks:Object.fromEntries(Object.entries(tracks).map(([k,t])=>[k,{playing:!!t.source,time:+((t.offset+(t.source?context.currentTime-t.started:0))%(t.buffer?.duration||1)).toFixed(2),ready:!!t.buffer,volume:t.gain.gain.value}]))};}
 };
}
