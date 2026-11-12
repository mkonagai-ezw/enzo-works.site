import * as THREE from './vendor/three.module.js';
import {CorridorCreakState} from './corridor-atmosphere.js';

export function createCorridorCreakAudio(context,canStand){
 const state=new CorridorCreakState(),forward=new THREE.Vector3();let buffer=null,voice=null,error=null,plays=0,lastPosition=null;
 const ready=fetch('assets/audio/corridor-wood-creak.mp3').then(r=>{if(!r.ok)throw Error('床鳴り音源 '+r.status);return r.arrayBuffer();}).then(data=>context.decodeAudioData(data)).then(b=>buffer=b).catch(e=>{error=e.message;console.error(e);});
 function stop(){if(!voice)return;const v=voice;voice=null;v.source.onended=null;v.source.stop();v.source.disconnect();v.gain.disconnect();v.panner.disconnect();}
 function syncListener(camera){
  camera.getWorldDirection(forward);const l=context.listener,p=camera.position;
  if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;l.forwardX.value=forward.x;l.forwardY.value=forward.y;l.forwardZ.value=forward.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  else{l.setPosition(p.x,p.y,p.z);l.setOrientation(forward.x,forward.y,forward.z,0,1,0);}
 }
 function play(camera){
  if(!buffer||context.state!=='running'||voice)return false;
  camera.getWorldDirection(forward);forward.y=0;forward.normalize();let point=null;
  for(const distance of [2.6,1.8,1.1]){const x=camera.position.x-forward.x*distance+forward.z*.3,z=camera.position.z-forward.z*distance-forward.x*.3;if(canStand(x,z)){point={x,y:.12,z};break;}}
  if(!point)return false;
  const source=context.createBufferSource(),gain=context.createGain(),panner=context.createPanner();source.buffer=buffer;source.playbackRate.value=.94;gain.gain.value=.24;
  panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=2;panner.rolloffFactor=1;panner.maxDistance=12;
  panner.positionX.value=point.x;panner.positionY.value=point.y;panner.positionZ.value=point.z;
  source.connect(gain);gain.connect(panner);panner.connect(context.destination);voice={source,gain,panner};
  source.onended=()=>{if(voice?.source===source)voice=null;source.disconnect();gain.disconnect();panner.disconnect();};
  syncListener(camera);source.start();plays++;lastPosition=point;return true;
 }
 return {ready,state,play,stop,
  suspend(){stop();state.travel=0;state.still=0;state.last=null;},
  reset(floor=1){stop();state.reset(floor);plays=0;lastPosition=null;},
  update(dt,{active,eligible,sound,camera,position}){
   const enabled=active&&sound&&!!buffer&&context.state==='running';
   if(!enabled||!eligible)stop();
   if(state.update(dt,{active:enabled,eligible,position}))play(camera);
   if(voice)syncListener(camera);
  },
  diagnostics(){return {ready:!!buffer,error,playing:!!voice,plays,position:lastPosition,floor:state.floor,cooldown:+state.cooldown.toFixed(2),walked:+state.travel.toFixed(2)};}
 };
}
