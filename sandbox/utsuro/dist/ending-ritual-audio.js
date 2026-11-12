import * as THREE from './vendor/three.module.js';
import {ENDING_TIMING} from './ending-state.js?v=family-collapse-1';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export async function loadEndingCollapseAudio(context){
 if(!context)return null;
 const response=await fetch('assets/audio/dragon-studio-falling-tree-356127.mp3');
 if(!response.ok)throw Error('崩落音を読み込めません: '+response.status);
 return context.decodeAudioData(await response.arrayBuffer());
}
export function createEndingRitualAudio(context,buffers={}){
 if(!context)return {update(){},reset(){},pause(){},diagnostics:()=>({ready:false})};
 const panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=5;panner.rolloffFactor=.55;panner.maxDistance=25;panner.positionX.value=0;panner.positionY.value=1;panner.positionZ.value=-5.2;panner.connect(context.destination);
 const tracks=Object.fromEntries([['chant',.17,true],['fire',.66,true],['explosion',.65,false],['collapse',.85,false]].map(([name,volume,loop])=>{const gain=context.createGain();gain.gain.value=0;gain.connect(name==='collapse'?context.destination:panner);return [name,{buffer:buffers[name],gain,volume,loop,source:null,plays:0,done:false,targetGain:0}];}));
 const direction=new THREE.Vector3();
 function stop(t){if(t.source){const s=t.source;t.source=null;s.onended=null;s.stop();s.disconnect();}t.targetGain=0;t.gain.gain.value=0;}
 return {
  pause(){for(const t of Object.values(tracks))stop(t);},
  reset(){for(const t of Object.values(tracks)){stop(t);t.plays=0;t.done=false;}},
  update(state,active,sound,camera){
   for(const [name,t] of Object.entries(tracks)){
    const elapsed=name==='chant'?state.time-ENDING_TIMING.chant:name==='collapse'?state.time-ENDING_TIMING.collapse:state.fireSeconds;
    const chantFade=1-smooth(state.fireSeconds/4);
    const wanted=name==='chant'?state.chanting&&chantFade>0:name==='collapse'?state.phase==='farewell'&&elapsed>=0:state.fireActive;
    const run=active&&sound&&context.state==='running'&&wanted&&t.buffer&&(t.loop||(!t.done&&elapsed<t.buffer.duration));
    if(!run){stop(t);continue;}
    if(!t.source){const s=context.createBufferSource();s.buffer=t.buffer;s.loop=t.loop;s.connect(t.gain);t.source=s;t.plays++;s.onended=()=>{s.disconnect();if(t.source===s){t.source=null;if(!t.loop)t.done=true;}};s.start(0,Math.max(0,elapsed)%t.buffer.duration);}
    const envelope=name==='chant'?Math.min(1,Math.max(0,elapsed)/.5)*chantFade:name==='fire'?.3+.7*smooth(state.fireSeconds/8):1;
    const fade=name==='collapse'?1-smooth((state.time-ENDING_TIMING.black)/(ENDING_TIMING.epilogue-ENDING_TIMING.black)):state.audioFade;
    t.targetGain=t.volume*envelope*fade;t.gain.gain.setTargetAtTime(t.targetGain,context.currentTime,name==='explosion'||name==='collapse'?.005:.08);
   }
   if(!Object.values(tracks).some(t=>t.source))return;
   camera.getWorldDirection(direction);const l=context.listener,p=camera.position;
   if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
   else{l.setPosition(p.x,p.y,p.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  },
  diagnostics(){return {ready:Object.values(tracks).every(t=>!!t.buffer),tracks:Object.fromEntries(Object.entries(tracks).map(([name,t])=>[name,{playing:!!t.source,plays:t.plays,targetGain:+t.targetGain.toFixed(3)}]))};}
 };
}
