import * as THREE from './vendor/three.module.js';
// AudioBuffer playback shares the context unlocked by the Start tap, including iOS.
export function createStoryAudio(context,phonePosition){
 const tracks={},errors=[],effects=new Set();let revealPlays=0,startPlays=0;
 for(const [name,file,volume] of [['rain','rain.mp3',.44],['kagome','kagome.wav',.085],['phone','phone.wav',.72]]){
  const gain=context.createGain();gain.gain.value=0;
  if(name==='phone'){
   const p=context.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=3;p.maxDistance=50;p.rolloffFactor=.65;
   p.positionX.value=phonePosition.x;p.positionY.value=phonePosition.y;p.positionZ.value=phonePosition.z;gain.connect(p);p.connect(context.destination);
  }else gain.connect(context.destination);
  const t={gain,volume,buffer:null,source:null,offset:0,started:0};tracks[name]=t;
  fetch('assets/audio/'+file).then(r=>{if(!r.ok)throw new Error(file+' '+r.status);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>t.buffer=b).catch(e=>errors.push(e.message));
 }
 const movementGain=context.createGain(),movementPanner=context.createPanner();
 movementGain.gain.value=0;movementPanner.panningModel='HRTF';movementPanner.distanceModel='inverse';movementPanner.refDistance=3;movementPanner.rolloffFactor=.65;movementPanner.maxDistance=50;
 movementGain.connect(movementPanner);movementPanner.connect(context.destination);
 tracks.movement={gain:movementGain,volume:.65,buffer:null,source:null,offset:0,started:0};
 const stop=t=>{if(t.source){t.offset=(t.offset+context.currentTime-t.started)%t.buffer.duration;t.source.stop();t.source.disconnect();t.source=null;}};
 const stopEffects=()=>{for(const source of effects){try{source.stop();}catch{}}effects.clear();};
 const effect=(buffer,volume,position,impact=false)=>{
  if(context.state!=='running')return false;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume;let low;if(impact){low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=700;source.connect(low);low.connect(gain);gain.gain.setTargetAtTime(0,context.currentTime,.4);}else source.connect(gain);
  let panner;
  if(position){panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=1.5;panner.rolloffFactor=1.1;panner.maxDistance=25;panner.positionX.value=position.x;panner.positionY.value=position.y+.08;panner.positionZ.value=position.z;gain.connect(panner);panner.connect(context.destination);}else gain.connect(context.destination);
  source.onended=()=>{effects.delete(source);source.disconnect();gain.disconnect();low?.disconnect();panner?.disconnect();};effects.add(source);source.start();if(impact)source.stop(context.currentTime+2.4);return true;
 };
 const direction=new THREE.Vector3();
 return {
  playStart(buffer){if(buffer&&effect(buffer,.92,null,true))startPlays++;},
  playReveal(buffer){if(buffer&&effect(buffer,.92,null,true))revealPlays++;},
  setMovementBuffer(buffer){tracks.movement.buffer=buffer;},
  reset(){stopEffects();revealPlays=0;for(const t of Object.values(tracks)){stop(t);t.offset=0;t.gain.gain.cancelScheduledValues(context.currentTime);t.gain.gain.value=0;}},
  update(state,active,sound,camera,dollPosition){
   const ended=state.phase==='lost'||state.phase==='clear';if(!active||!sound||ended)stopEffects();
   if(dollPosition){movementPanner.positionX.value=dollPosition.x;movementPanner.positionY.value=dollPosition.y+.4;movementPanner.positionZ.value=dollPosition.z;}
   const wanted={rain:state.rain&&!ended,kagome:state.chasing||state.phase==='sighting',phone:state.phase==='phone',movement:state.chasing&&state.moving&&!state.frozen&&!ended&&!!dollPosition};
   for(const [name,t] of Object.entries(tracks)){
    const run=wanted[name]&&active&&sound&&context.state==='running';
    if(run&&t.buffer&&!t.source){t.source=context.createBufferSource();t.source.buffer=t.buffer;t.source.loop=true;t.source.connect(t.gain);t.started=context.currentTime;t.source.start(0,t.offset);}
    if(!run){stop(t);if(name==='movement')t.offset=0;}t.gain.gain.setTargetAtTime(run?t.volume:0,context.currentTime,name==='movement'?.015:.12);
   }
   const l=context.listener;camera.getWorldDirection(direction);
   if(l.positionX){l.positionX.value=camera.position.x;l.positionY.value=camera.position.y;l.positionZ.value=camera.position.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
   else {l.setPosition(camera.position.x,camera.position.y,camera.position.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  },
  diagnostics(){return {errors:[...new Set(errors)],startPlays,revealPlays,activeEffects:effects.size,tracks:Object.fromEntries(Object.entries(tracks).map(([k,t])=>[k,{playing:!!t.source,time:+((t.offset+(t.source?context.currentTime-t.started:0))%(t.buffer?.duration||1)).toFixed(2),ready:!!t.buffer,volume:t.gain.gain.value}]))};}
 };
}
