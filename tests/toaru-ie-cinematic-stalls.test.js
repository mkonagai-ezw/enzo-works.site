import test from 'node:test';
import assert from 'node:assert/strict';
import {cinematicFrameDelta} from '../sandbox/utsuro/dist/performance-runtime.js';
import {HouseStoryState,CLUE_IDS} from '../sandbox/utsuro/dist/house-story.js';
import {ShadowEncounterState} from '../sandbox/utsuro/dist/shadow-encounter-state.js';

test('a stalled first ignition still presents its frames before advancing the ritual',()=>{
 const story=new HouseStoryState();story.noteFirstMove();story.examine();story.dismiss();
 for(const id of CLUE_IDS)story.inspectClue(id);assert(story.examineMonk());
 let displayedFrames=0;
 while(story.ritualSeconds*1.4<1.3){
  story.tick(cinematicFrameDelta(displayedFrames===0?2:.2),true);displayedFrames++;
  assert(!story.phoneRinging);
 }
 assert(displayedFrames>=28,'the explosion cannot disappear in a handful of slow frames');
 const paused=story.ritualSeconds;story.tick(cinematicFrameDelta(10),false);assert.equal(story.ritualSeconds,paused);
 for(let i=0;i<1000;i++)story.tick(cinematicFrameDelta(.2),true);
 assert.equal(story.phase,'corridor','bounded time still completes the transition');
});

test('stalls preserve the shadow contact hold and still reach a restartable game over',()=>{
 const state=new ShadowEncounterState();state.start();state.contact();
 state.tick(cinematicFrameDelta(4));assert.equal(state.phase,'contact');
 for(let i=0;i<24;i++)state.tick(cinematicFrameDelta(.3));assert.equal(state.phase,'contact');
 state.tick(cinematicFrameDelta(.3));assert.equal(state.phase,'gameover');
 assert.equal(state.darkness,1);state.reset();assert(state.start());assert.equal(state.darkness,0);
 for(const dt of [NaN,Infinity,-1,0])assert.equal(cinematicFrameDelta(dt),0);
 assert.equal(cinematicFrameDelta(1/60),1/60);
});
