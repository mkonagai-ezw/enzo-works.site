import test from 'node:test';
import assert from 'node:assert/strict';
import {EndingState,ENDING_TIMING} from '../sandbox/utsuro/dist/ending-state.js';
import {createEndingRitualAudio} from '../sandbox/utsuro/dist/ending-ritual-audio.js';
import {Vector3} from '../sandbox/utsuro/dist/vendor/three.module.js';

test('farewell leaves room for chanting, family reveal, memory and handholding before collapse',()=>{
 const s=new EndingState(),T=ENDING_TIMING;assert(!s.chanting);assert(!s.monksVisible);assert(!s.fireActive);s.begin([0,1.64,-10],0,0);
 s.time=T.turn-.1;assert(s.chanting);assert.equal(s.turn,0);assert(!s.fireActive);assert(T.turn-T.chant>=4);
 s.time=T.reveal;assert.equal(s.turn,1);assert(s.familyVisible);assert(!s.fireActive);assert(T.ignite-T.reveal>=3);
 s.time=T.ignite+1;assert(s.fireActive);assert(!s.memoryVisible);assert.equal(s.handJoin,0);
 s.time=T.memory+2;assert(s.memoryVisible);assert.equal(s.memoryTime,2);assert.equal(s.handJoin,0);assert.equal(s.spread,0);
 s.time=T.memoryEnd;assert(!s.memoryVisible);assert.equal(s.handJoin,0);
 s.time=T.join+2;assert(s.handJoin>0&&s.handJoin<1);assert.equal(s.spread,0);assert.equal(s.dissolve,0);
 s.time=T.joined;assert.equal(s.handJoin,1);assert.equal(s.ceiling,0);
 s.time=T.ceiling+3;assert(s.spread>0);assert(s.ceiling>0);assert.equal(s.collapse,0);
 const before=s.time;s.tick(10,false);assert.equal(s.time,before);
 s.time=T.collapse+2;assert(s.collapse>0);assert(s.audioFade<1);assert.equal(s.turn,1);assert.equal(s.black,0);
 s.time=T.epilogue-.1;s.tick(.2,true);assert.equal(s.phase,'epilogue');assert(!s.fireActive);assert(!s.chanting);assert(!s.memoryVisible);assert(s.black>.95);
 s.time=T.epilogue+2;assert.equal(s.black,0);
 s.reset();assert.equal(s.handJoin,0);assert.equal(s.black,0);assert.equal(s.time,0);assert(!s.locked);
});

test('ending audio reuses buffers, pauses with the game, does not replay a late explosion, and fades out',()=>{
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;}}),node=()=>({connect(){},disconnect(){}}),sources=[];
 const ctx={state:'running',currentTime:0,destination:{},listener:Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,param()])),createPanner:()=>({...node(),positionX:param(),positionY:param(),positionZ:param()}),createGain:()=>({...node(),gain:param()}),createBufferSource:()=>{const s={...node(),start(t,offset){this.offset=offset;},stop(){this.stopped=true;}};sources.push(s);return s;}};
 const a=createEndingRitualAudio(ctx,{chant:{duration:40},fire:{duration:30},explosion:{duration:1.8},collapse:{duration:8}}),s=new EndingState(),camera={position:new Vector3(),getWorldDirection:v=>v.set(0,0,1)};
 s.begin([0,1.64,-10],0,0);s.time=.8;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.chant.plays,1);assert.equal(a.diagnostics().tracks.fire.plays,0);
 s.time=ENDING_TIMING.ignite+.1;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.explosion.plays,1);assert.equal(a.diagnostics().tracks.fire.plays,1);
 const fireAtIgnition=a.diagnostics().tracks.fire.targetGain;
 s.time=ENDING_TIMING.ignite+2;a.update(s,true,true,camera);assert(a.diagnostics().tracks.chant.targetGain<.1);assert(a.diagnostics().tracks.fire.targetGain>fireAtIgnition);
 a.pause();assert(sources.every(s=>s.stopped));s.time=ENDING_TIMING.ignite+5;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.explosion.plays,1);
 assert(!a.diagnostics().tracks.chant.playing);assert.equal(a.diagnostics().tracks.chant.targetGain,0);
 s.time=ENDING_TIMING.collapse-.1;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.collapse.plays,0);assert.equal(a.diagnostics().tracks.fire.targetGain,.66);
 s.time=ENDING_TIMING.collapse+.1;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.collapse.plays,1);assert.equal(a.diagnostics().tracks.collapse.targetGain,.85);
 s.time=ENDING_TIMING.collapse+1;a.update(s,true,true,camera);assert.equal(a.diagnostics().tracks.collapse.plays,1);
 s.time=ENDING_TIMING.epilogue-.5;a.update(s,true,true,camera);assert(a.diagnostics().tracks.collapse.targetGain<.15);
 s.time=ENDING_TIMING.epilogue;s.phase='epilogue';a.update(s,true,true,camera);assert(Object.values(a.diagnostics().tracks).every(t=>!t.playing));
 a.reset();assert(Object.values(a.diagnostics().tracks).every(t=>!t.plays));
});
