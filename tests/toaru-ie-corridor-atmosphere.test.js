import test from 'node:test';
import assert from 'node:assert/strict';
import {corridorLightProfile,CorridorCreakState} from '../sandbox/utsuro/dist/corridor-atmosphere.js';
import {CORRIDOR_COUNT} from '../sandbox/utsuro/dist/corridor-choices.js';
import {createCorridorCreakAudio} from '../sandbox/utsuro/dist/corridor-creak-audio.js';
import {Vector3} from '../sandbox/utsuro/dist/vendor/three.module.js';

test('each floor darkens gradually while keeping usable flashlight reach',()=>{
 let previous=corridorLightProfile(1);assert(previous.ambient<=.01);assert(previous.candlePower<1);assert(previous.candleReach<3);
 for(let i=2;i<=CORRIDOR_COUNT;i++){
  const next=corridorLightProfile(i);for(const key of ['ambient','candlePower','candleReach','flashPower','flashReach'])assert(next[key]<previous[key]);
  assert(next.fog>previous.fog);assert(next.flashReach>=14);previous=next;
 }
 assert.deepEqual(corridorLightProfile(0),corridorLightProfile(1));
 assert.deepEqual(corridorLightProfile(999),corridorLightProfile(CORRIDOR_COUNT));
});

function walkAndStop(s){
 const position={x:0,z:0};s.update(.1,{active:true,eligible:true,position});
 for(let i=0;i<70;i++){position.z-=.06;s.update(.1,{active:true,eligible:true,position});}
 let count=0;for(let i=0;i<20;i++)count+=Number(s.update(.1,{active:true,eligible:true,position}));return count;
}
test('creaks require walking then stopping; reading and teleports cannot trigger them',()=>{
 const s=new CorridorCreakState(()=>.3);assert.equal(walkAndStop(s),1);
 assert.equal(walkAndStop(s),0,'first floors have only one event');
 s.reset(5);assert.equal(walkAndStop(s),1);
 const position={x:0,z:-4.2};
 for(let i=0;i<400;i++)assert.equal(s.update(.1,{active:true,eligible:true,position}),false,'standing still cannot repeat');
 assert.equal(walkAndStop(s),1);
 s.reset();s.cooldown=0;s.travel=4;
 s.update(.1,{active:true,eligible:false,position});
 assert.equal(s.update(2,{active:true,eligible:true,position}),false,'closing a hint cannot release a queued sound');
 s.travel=4;s.update(.1,{active:false,eligible:true,position});
 assert.equal(s.update(2,{active:true,eligible:true,position}),false,'resume cannot release a queued sound');
 assert.equal(s.update(.1,{active:true,eligible:true,position:{x:0,z:-15}}),false);
 assert.equal(s.travel,0);
});

test('real creak plays behind the camera and is stopped by menus, mute, or reading',async t=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});t.after(()=>globalThis.fetch=original);
 const parameter=()=>({value:0}),node=()=>({connect(){},disconnect(){}}),sources=[];
 const context={state:'running',destination:{},listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,parameter()])),
  createGain:()=>({...node(),gain:parameter()}),createPanner:()=>({...node(),positionX:parameter(),positionY:parameter(),positionZ:parameter()}),decodeAudioData:async()=>({duration:.986}),
  createBufferSource:()=>{const s={...node(),playbackRate:parameter(),start(){},stop(){this.stopped=true;}};sources.push(s);return s;}
 };
 const audio=createCorridorCreakAudio(context,()=>true),camera={position:new Vector3(0,1.64,-13),getWorldDirection:v=>v.set(0,0,-1)};await audio.ready;
 for(const override of [{active:false},{sound:false},{eligible:false}]){
  assert(audio.play(camera));assert(audio.diagnostics().position.z>camera.position.z);
  audio.update(.1,{active:true,eligible:true,sound:true,camera,position:camera.position,...override});assert(sources.at(-1).stopped);
 }
 audio.state.travel=4;audio.state.still=.5;audio.suspend();
 assert.equal(audio.state.travel,0);assert.equal(audio.state.still,0);assert.equal(audio.state.last,null);
 audio.reset(8);assert.equal(audio.diagnostics().plays,0);assert.equal(audio.state.floor,8);
});
