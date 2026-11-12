import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../sandbox/utsuro/dist/vendor/three.module.js';
import {createStoryAudio} from '../sandbox/utsuro/dist/ritual-audio.js';

function fixture(t){
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});t.after(()=>globalThis.fetch=original);
 const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}}),sources=[];
 const context={state:'running',currentTime:0,destination:{},listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(key=>[key,parameter()])),
  createGain:()=>({...node(),gain:parameter()}),createPanner:()=>({...node(),positionX:parameter(),positionY:parameter(),positionZ:parameter()}),
  decodeAudioData:async()=>({duration:3}),createBufferSource:()=>{const source={...node(),start(when,offset){this.offset=offset;},stop(){this.stopped=true;}};sources.push(source);return source;}
 };
 const state={fireActive:false,ritualSeconds:0,darkness:0},camera={position:new Vector3(),getWorldDirection:v=>v.set(0,0,-1)};
 const audio=createStoryAudio(context,new Vector3(1,1,1),new Vector3(-2.23,1.822,2.39));
 const update=(active=true,sound=true)=>audio.update(state,active,sound,camera);
 return {audio,context,state,sources,update};
}

test('ritual audio pauses without rewinding the explosion, fades, stops at the corridor and resets for replay',async t=>{
 const f=fixture(t);await f.audio.ready;f.update();assert.equal(f.sources.length,0);
 f.state.fireActive=true;f.update();let tracks=f.audio.diagnostics().tracks;
 assert.equal(tracks.explosion.plays,1);assert.equal(tracks.explosion.loop,false);assert.equal(tracks.fire.loop,true);
 f.context.currentTime=.7;f.state.ritualSeconds=.7;f.update(false);assert(f.sources.every(s=>s.stopped));
 f.context.currentTime=80;f.update();const resumed=f.sources.at(-1);assert.equal(resumed.offset,.7);
 resumed.onended();f.state.ritualSeconds=4;f.context.currentTime=84;f.update();
 tracks=f.audio.diagnostics().tracks;assert.equal(tracks.explosion.playing,false);assert.equal(tracks.explosion.plays,2);assert.equal(tracks.fire.playing,true);
 f.state.darkness=.5;f.update();assert.equal(f.audio.diagnostics().tracks.fire.targetGain,.175);
 f.state.darkness=1;f.update();assert.equal(f.audio.diagnostics().tracks.fire.targetGain,0);
 f.state.fireActive=false;f.update();assert.equal(f.audio.diagnostics().tracks.fire.playing,false);
 f.audio.reset();f.state.fireActive=true;f.state.ritualSeconds=0;f.state.darkness=0;f.update();
 assert.equal(f.audio.diagnostics().tracks.explosion.plays,1);assert.equal(f.sources.at(-1).offset,0);
});

test('unmuting after ignition does not trigger a delayed explosion, while burning can resume',async t=>{
 const f=fixture(t);await f.audio.ready;f.state.fireActive=true;f.update(true,false);
 f.state.ritualSeconds=7;f.context.currentTime=7;f.update();const tracks=f.audio.diagnostics().tracks;
 assert.equal(tracks.explosion.plays,0);assert.equal(tracks.fire.playing,true);
 f.update(false);assert.equal(f.audio.diagnostics().tracks.fire.playing,false);
});

test('cupboard closing sound only starts on an explicit event and is stopped on pause/reset',async t=>{
 const f=fixture(t);await f.audio.ready;f.update();assert.equal(f.audio.diagnostics().tracks.cupboardClose.plays,0);
 assert(f.audio.playCupboardClose());const source=f.sources.at(-1);f.update();assert(!source.stopped);assert.equal(f.audio.diagnostics().tracks.cupboardClose.plays,1);
 f.update(false);assert(source.stopped);source.onended();assert.equal(f.audio.diagnostics().tracks.cupboardClose.playing,false);
 f.audio.playCupboardClose();f.audio.reset();assert.equal(f.audio.diagnostics().tracks.cupboardClose.playing,false);assert.equal(f.audio.diagnostics().tracks.cupboardClose.plays,0);
});
