import test from 'node:test';
import assert from 'node:assert/strict';
import {createShadowAudio} from '../sandbox/utsuro/dist/shadow-audio.js';
import {Vector3} from '../sandbox/utsuro/dist/vendor/three.module.js';

test('the passing footsteps reuse the decoded sound, stay behind the listener, and stop on pause or reading',async t=>{
 const oldFetch=globalThis.fetch;let downloads=0;globalThis.fetch=async()=>{downloads++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};};t.after(()=>globalThis.fetch=oldFetch);
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.end=v;},setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}}),node=()=>({connect(){},disconnect(){}}),sources=[],panners=[];
 const context={state:'running',currentTime:0,destination:{},listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,param()])),decodeAudioData:async()=>({duration:5}),
  createGain:()=>({...node(),gain:param()}),createPanner:()=>{const p={...node(),positionX:param(),positionY:param(),positionZ:param()};panners.push(p);return p;},
  createBufferSource:()=>{const s={...node(),playbackRate:param(),start(){},stop(){this.stops=(this.stops||0)+1;}};sources.push(s);return s;}};
 const audio=await createShadowAudio(context),camera={position:new Vector3(0,1.64,-15),getWorldDirection:v=>v.set(0,0,-1)},state={phase:'hidden'};
 assert(audio.playPass(camera));assert(panners[0].positionZ.value>camera.position.z);assert(sources[0].playbackRate.value>1);assert.equal(downloads,1);
 audio.update(state,false,true,camera);assert(!audio.diagnostics().passPlaying);assert.equal(sources[0].stops,2);
 audio.playPass(camera);audio.update(state,true,true,camera,true);assert(!audio.diagnostics().passPlaying);
 audio.playPass(camera);audio.update(state,true,false,camera);assert(!audio.diagnostics().passPlaying);
 audio.reset();assert.equal(audio.diagnostics().passPlays,0);assert.equal(downloads,1);
});
