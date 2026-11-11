import test from 'node:test';
import assert from 'node:assert/strict';
import {SpatialBoxes,cacheShadow,AdaptiveResolution} from '../sandbox/utsuro/dist/performance-runtime.js';
import {shareGLTFImages} from '../sandbox/utsuro/dist/shared-textures.js';

test('spatial broad phase never misses an overlapping box, including negative cells and large bounds',()=>{
 const boxes=Array.from({length:1600},(_,i)=>{const x=i%40-20,z=Math.floor(i/40)-20;return {min:{x:x-.3,y:-1,z:z-.2},max:{x:x+.4,y:2,z:z+.5}};});
 boxes.push({min:{x:-1000,y:-1,z:-1000},max:{x:1000,y:2,z:1000}});
 const grid=new SpatialBoxes(boxes,2);
 for(let i=0;i<250;i++){const x=-20+(i*17%400)/10,z=-20+(i*31%400)/10,w=(i%7)/2;const candidates=grid.query(x,x+w,z,z+w);for(const b of boxes)if(b.max.x>=x&&b.min.x<=x+w&&b.max.z>=z&&b.min.z<=z+w)assert(candidates.has(b));}
 assert(grid.query(0,1,0,1).size<boxes.length/10);
});
test('shadow maps refresh on caster/light changes and initial upload, not on unchanged frames',()=>{
 const light={castShadow:true,shadow:{map:{},needsUpdate:false}},cache=cacheShadow(light);
 assert(cache.sync('closed'));light.shadow.needsUpdate=false;assert(!cache.sync('closed'));assert(!light.shadow.needsUpdate);
 assert(cache.sync('open'));cache.invalidate();assert(cache.sync('open'));light.shadow.map=null;assert(cache.sync('open'));
 light.castShadow=false;assert(!cache.sync('different'));
});
test('adaptive resolution ignores a single stall and only changes after sustained load',()=>{
 const q=new AdaptiveResolution(1.6,1);q.sample(.4);assert.equal(q.value,1.6);
 for(let i=0;i<70;i++)q.sample(.04);assert.equal(q.value,1.6);
 for(let i=0;i<90;i++)q.sample(.04);assert.equal(q.value,1.45);
 for(let i=0;i<2000;i++)q.sample(.04);assert.equal(q.value,1);
 for(let i=0;i<2000;i++)q.sample(.016);assert(q.value>1&&q.value<=1.6);
 const value=q.value;for(let i=0;i<1000;i++)q.sample(.08,false);assert.equal(q.value,value);
});
test('identical embedded images decode once across parsers, with independent texture wrappers',async()=>{
 let plugin,decodes=0;const shared=shareGLTFImages({register:fn=>plugin=fn});
 const source={},makeTexture=()=>({source,sampler:'default',clone(){return {...this};}});
 const makeParser=()=>({json:{images:[{bufferView:0,mimeType:'image/png'}]},getDependency:async()=>new Uint8Array([4,5,6]).buffer,loadImageSource:async()=>{decodes++;return makeTexture();}});
 const a=makeParser(),b=makeParser();plugin(a);plugin(b);
 const [first,second]=await Promise.all([a.loadImageSource(0,{}),b.loadImageSource(0,{})]);
 assert.equal(decodes,1);assert.notEqual(first,second);assert.equal(first.source,second.source);first.sampler='different';assert.equal(second.sampler,'default');assert.deepEqual(shared.diagnostics(),{unique:1,reused:1});
});
