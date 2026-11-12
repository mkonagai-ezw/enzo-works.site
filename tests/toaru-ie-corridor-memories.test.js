import test from 'node:test';
import assert from 'node:assert/strict';
import {CorridorHintState,CorridorDollState,CORRIDOR_MEMORIES,HINT_IMAGES,HINT_DURATION} from '../sandbox/utsuro/dist/corridor-memory-state.js';

test('the four chapters retain eight memories, with the captors before the well and the monk last',()=>{
 assert.deepEqual(CORRIDOR_MEMORIES,[[0,1],[2,3],[7,4],[5,6]]);
 assert.equal(new Set(CORRIDOR_MEMORIES.flat()).size,HINT_IMAGES.length);
});
test('two separate doll interactions advance once each; review and failure cannot repeat story effects',()=>{
 const d=new CorridorDollState();d.appear();assert(d.inspect());assert.deepEqual(d.steps,[0]);assert(!d.inspect());
 d.retryHint();assert.equal(d.count,0);assert(d.inspect());assert.deepEqual(d.finishHint(),{fresh:true,count:1});
 assert(d.inspect());assert.deepEqual(d.steps,[1]);assert.deepEqual(d.finishHint(),{fresh:true,count:2});
 assert(d.inspect());assert.deepEqual(d.steps,[0,1]);assert.deepEqual(d.finishHint(),{fresh:false,count:2});
 assert.equal(d.phase,'review');assert(d.present);assert.equal(d.finishHint(),null);
 d.appear();assert.equal(d.count,0);assert(d.inspect());assert.deepEqual(d.steps,[0]);
});
test('replay advances both pictures; only previously completed memories can be skipped, including retries',()=>{
 const s=new CorridorHintState();assert(s.begin(3,[0]));assert.equal(s.imageId,7);s.ready();s.tick(1,true);assert(!s.skip());s.tick(10,false);assert.equal(s.time,1);
 s.tick(HINT_DURATION,true);assert(!s.advance());assert(s.seen.has(7));
 s.begin(3,[1]);s.ready();s.tick(HINT_DURATION,true);s.advance();assert(s.seen.has(4));
 s.reset();s.begin(3,[0,1]);s.ready();s.tick(.5,true);assert(s.skip());s.tick(0,true);assert(s.advance());assert.equal(s.imageId,4);assert.equal(s.phase,'loading');
 s.ready();s.tick(.5,true);assert(s.skip());s.tick(0,true);assert(!s.advance());assert(!s.locked);
 s.reset(true);assert.equal(s.seen.size,0);assert(!s.begin(5));assert(!s.begin(1,[2]));assert(!s.begin(1,[]));
});
