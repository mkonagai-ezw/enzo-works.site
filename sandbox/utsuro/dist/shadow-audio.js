import * as THREE from './vendor/three.module.js';
export async function createShadowAudio(context){
 const response=await fetch('assets/audio/'+encodeURIComponent('部屋に駆け込んでくる.mp3'));if(!response.ok)throw Error('影の足音を読み込めません');const buffer=await context.decodeAudioData(await response.arrayBuffer());
 const mix=context.createGain();mix.gain.value=0;mix.connect(context.destination);
 const offsets=[0,.18],rates=[.98,1.035];let pass=null,passPlays=0;const forward=new THREE.Vector3();let voices=[],lastPhase='hidden',lastGain=0;
 function stop(){for(const v of voices){v.source.stop();v.source.disconnect();v.gain.disconnect();v.pan.disconnect();}voices=[];}
 function start(time){voices=offsets.map((delay,i)=>{const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();source.buffer=buffer;source.loop=true;source.playbackRate.value=rates[i];gain.gain.value=i?.47:.53;pan.pan.value=i?.24:-.24;source.connect(gain);gain.connect(pan);pan.connect(mix);const elapsed=Math.max(0,time-delay),wait=Math.max(0,delay-time);source.start(context.currentTime+wait,(elapsed*rates[i])%buffer.duration);return {source,gain,pan};});}
 function stopPass(){if(!pass)return;const v=pass;pass=null;v.source.onended=null;v.source.stop();v.source.disconnect();v.gain.disconnect();v.pan.disconnect();}
 function syncPass(camera){camera.getWorldDirection(forward);const l=context.listener,p=camera.position;if(l.positionX){for(const [key,value] of Object.entries({positionX:p.x,positionY:p.y,positionZ:p.z,forwardX:forward.x,forwardY:forward.y,forwardZ:forward.z,upX:0,upY:1,upZ:0}))l[key].value=value;}else{l.setPosition(p.x,p.y,p.z);l.setOrientation(forward.x,forward.y,forward.z,0,1,0);}}
 return {suspend(){stopPass();},
  playPass(camera){if(context.state!=='running')return false;stopPass();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const source=context.createBufferSource(),gain=context.createGain(),pan=context.createPanner(),now=context.currentTime;
   source.buffer=buffer;source.loop=true;source.playbackRate.value=1.45;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.17,now+.12);gain.gain.setValueAtTime(.17,now+1.3);gain.gain.linearRampToValueAtTime(0,now+2.1);
   pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=2;pan.rolloffFactor=1;
   const base=camera.position.clone().addScaledVector(forward,-2.2),side=new THREE.Vector3(forward.z,0,-forward.x);pan.positionY.value=.18;
   for(const axis of ['x','z']){const param=pan['position'+axis.toUpperCase()];param.setValueAtTime(base[axis]-side[axis]*1.4,now);param.linearRampToValueAtTime(base[axis]+side[axis]*1.4,now+2.1);}
   source.connect(gain);gain.connect(pan);pan.connect(context.destination);pass={source,gain,pan};source.onended=()=>{if(pass?.source===source)pass=null;source.disconnect();gain.disconnect();pan.disconnect();};syncPass(camera);source.start();source.stop(now+2.15);passPlays++;return true;
  },reset(){stopPass();passPlays=0;stop();mix.gain.cancelScheduledValues(context.currentTime);mix.gain.value=0;lastGain=0;lastPhase='hidden';},
  update(state,active,sound,camera,reading=false){if(pass){if(!active||!sound||reading)stopPass();else if(camera)syncPass(camera);}const run=active&&sound&&state.phase==='rush'&&context.state==='running';if(run&&!voices.length)start(state.time);if(!run&&voices.length)stop();const target=run?Math.min(.65,.20+state.time*.12):0;if(target!==lastGain){mix.gain.setTargetAtTime(target,context.currentTime,.035);lastGain=target;}lastPhase=state.phase;},
  diagnostics(){return {passPlaying:!!pass,passPlays,running:voices.length>0,voices:voices.length,phase:lastPhase,offsets,rates,duration:buffer.duration,file:'部屋に駆け込んでくる.mp3'};}};
}
