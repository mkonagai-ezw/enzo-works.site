import test from 'node:test';
import assert from 'node:assert/strict';
import {CupboardState,CUPBOARD_PEEK,CUPBOARD_OPEN} from '../sandbox/utsuro/dist/cupboard-state.js';
import * as THREE from '../sandbox/utsuro/dist/vendor/three.module.js';
import {removeTrianglesInBox} from '../sandbox/utsuro/dist/cupboard-haunting.js';

test('flashlight slam occurs once; reopening reveals an empty cupboard until the Jizo reveal',()=>{
 const s=new CupboardState();assert.equal(s.offset,CUPBOARD_PEEK);assert(s.faceVisible);
 assert.equal(s.update(.02,{active:false,lit:true}),false);assert.equal(s.mode,'peeking');
 assert.equal(s.update(.02,{active:true,lit:false}),false);
 assert.equal(s.update(.02,{active:true,lit:true}),true);assert.equal(s.mode,'slamming');assert(s.faceVisible);
 assert.equal(s.interact(),null);s.update(.15,{active:true,lit:true});assert.equal(s.mode,'closed');assert.equal(s.slams,1);assert(!s.faceVisible);
 assert.equal(s.interact(),'open');s.update(.5,{active:true,lit:true});assert(s.open);assert.equal(s.offset,CUPBOARD_OPEN);assert(!s.faceVisible);assert.equal(s.slams,1);
 assert.equal(s.interact(),'close');s.update(.4,{active:true});assert.equal(s.mode,'closed');
 s.reveal();assert(s.revealed);s.interact();s.update(.5,{active:true,lit:true});assert(s.open);assert(!s.faceVisible);
 s.reset();assert(s.faceVisible);assert.equal(s.slams,0);assert.equal(s.offset,CUPBOARD_PEEK);
});

test('Jizo reveal removes the untriggered face without playing a slam or reopening it',()=>{
 const s=new CupboardState();s.reveal();assert.equal(s.mode,'closed');assert(!s.faceVisible);assert.equal(s.slams,0);
 s.interact();s.update(.6,{active:true,lit:true});assert(s.open);assert(!s.faceVisible);
});

test('door separation respects quantized positions and preserves triangles outside the door region',()=>{
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Int16BufferAttribute([0,0,32767, 32767,0,32767, 0,32767,32767, 0,0,-32767, 32767,0,-32767, 0,32767,-32767],3,true));geometry.setIndex([0,1,2,3,4,5]);
 const mesh=new THREE.Mesh(geometry);mesh.position.set(-1,1,-5);mesh.scale.setScalar(.5);mesh.updateMatrixWorld(true);
 const count=removeTrianglesInBox(mesh,new THREE.Box3(new THREE.Vector3(-1.1,.9,-4.6),new THREE.Vector3(-.4,1.6,-4.4)));
 assert.equal(count,1);assert.deepEqual(Array.from(mesh.geometry.index.array),[3,4,5]);assert.equal(geometry.index.count,6);
});
