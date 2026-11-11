import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {CORRIDOR_COUNT,corridorMessage,evaluateCorridorExit} from '../sandbox/utsuro/dist/corridor-choices.js';
import {canStand} from '../sandbox/utsuro/dist/corridor-navigation.js';

const truth=['right','left','right','right','left','right','left','left'];
const position=side=>({x:side==='left'?-6:6,z:-33.1});

test('all eight drawings have distinct paired text and exactly one correct exit',async()=>{
 const manifest=JSON.parse(await fs.readFile(new URL('../sandbox/utsuro/dist/assets/corridor-hints/manifest-v2.json',import.meta.url)));
 assert.equal(CORRIDOR_COUNT,manifest.images.length);
 const messages=[];
 for(let floor=1;floor<=CORRIDOR_COUNT;floor++){
  for(const side of ['left','right']){
   const message=corridorMessage(floor,side);assert(message.text.length>0);assert(!message.text.includes('未設定'));messages.push(message.text);
   assert.deepEqual(evaluateCorridorExit(floor,position(side)),{side,correct:side===truth[floor-1]});
  }
 }
 assert.equal(new Set(messages).size,16);
 // Of all 256 full routes, only the story's complete sequence reaches eight wins.
 let completed=0;
 for(let mask=0;mask<256;mask++){
  let wins=0;
  for(let floor=1;floor<=8;floor++){
   const side=mask&(1<<(floor-1))?'right':'left';
   if(!evaluateCorridorExit(floor,position(side)).correct)break;
   wins++;
  }
  if(wins===8)completed++;
 }
 assert.equal(completed,1);
});

test('walking across the junction cannot accidentally select an answer',async()=>{
 const layout=JSON.parse(await fs.readFile(new URL('../sandbox/utsuro/dist/assets/corridor-layout.json',import.meta.url)));
 for(const sign of [-1,1]){
  for(const p of [{x:0,z:-1.1},{x:0,z:-23},{x:sign*6,z:-23},{x:sign*6,z:-32.79}]){
   assert(canStand(layout,p.x,p.z));assert.equal(evaluateCorridorExit(1,p),null);
  }
  for(const z of [-32.8,-33.1,-33.7]){
   assert(canStand(layout,sign*6,z));assert.equal(evaluateCorridorExit(1,{x:sign*6,z}).side,sign<0?'left':'right');
  }
 }
 for(const p of [{x:0,z:-33},{x:3,z:-33},{x:8.1,z:-33},{x:-8.1,z:-33},{x:6,z:-34.2},{x:NaN,z:-33},{x:6,z:-Infinity}])assert.equal(evaluateCorridorExit(1,p),null);
 for(const floor of [0,9,1.5,NaN]){
  assert.equal(evaluateCorridorExit(floor,position('left')),null);assert.equal(corridorMessage(floor,'left'),null);
 }
 assert.equal(corridorMessage(1,'forward'),null);
});
