import test from 'node:test';
import assert from 'node:assert/strict';
import {EpilogueState,ENDING_LINES} from '../sandbox/utsuro/dist/epilogue-state.js';

test('all ending sentences type and hold automatically, then reach credits without input',()=>{
 const s=new EpilogueState(),seen=[];s.start();
 for(let frame=0;frame<1600&&s.phase!=='credits';frame++){
  if(!seen.includes(s.index))seen.push(s.index);
  const index=s.index;s.advance();assert.equal(s.index,index,'input cannot skip narration');
  s.tick(.1,true);
 }
 assert.deepEqual(seen,ENDING_LINES.map((_,i)=>i));assert.equal(s.phase,'credits');assert(s.hold>=6);
 s.duration=1;for(let i=0;i<11;i++)s.tick(.1,true);assert.equal(s.phase,'complete');
 s.reset();assert.equal(s.phase,'idle');assert.equal(s.index,0);assert.equal(s.text,'');assert.equal(s.lineOpacity,0);
});

test('automatic narrative pauses during typing, hold, transition, and credits',()=>{
 const s=new EpilogueState();s.start();const stages=new Set();
 for(let i=0;i<1600&&s.phase!=='credits';i++){
  stages.add(s.lineStage);const before=JSON.stringify(s);s.tick(30,false);assert.equal(JSON.stringify(s),before);s.tick(.1,true);
 }
 assert.deepEqual([...stages].sort(),['gap','hold','out','typing']);
 const before=s.creditTime;s.tick(.25,false);assert.equal(s.creditTime,before);
});
