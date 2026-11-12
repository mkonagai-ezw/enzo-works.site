import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../sandbox/utsuro/dist/vendor/three.module.js';
import {cutWellOpening,createWellShaft} from '../sandbox/utsuro/dist/well-shaft.js';

test('well opening removes ground triangles while preserving surrounding surface and UVs',()=>{
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(6,6,3,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 ground.rotation.x=-Math.PI/2;ground.position.set(8.4,0,-6.2);
 cutWellOpening(ground,8.4,-6.2);ground.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(let ring=0;ring<=5;ring++)for(let i=0;i<24;i++){
  const r=ring*.12,a=i*Math.PI/12;ray.set(new THREE.Vector3(8.4+Math.cos(a)*r,2,-6.2+Math.sin(a)*r),down);
  assert.equal(ray.intersectObject(ground).length,0,'open throughout the mouth');
 }
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16,x=8.4+Math.cos(a)*.72,z=-6.2+Math.sin(a)*.72;ray.set(new THREE.Vector3(x,2,z),down);
  const [hit]=ray.intersectObject(ground);assert.ok(hit,'ground outside the masonry stays intact');
  assert.ok(Math.abs(hit.uv.x-((x-8.4)/6+.5))<1e-5);assert.ok(Math.abs(hit.uv.y-(-(z+6.2)/6+.5))<1e-5);
 }
});

test('well has a deep shaft instead of the old ground-level cap',()=>{
 const scene=new THREE.Scene(),garden=new THREE.Group(),well=new THREE.Group();
 const earth=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshBasicMaterial());earth.name='Garden_earth';earth.rotation.x=-Math.PI/2;earth.position.set(8.4,0,-6.2);garden.add(earth);
 const stone=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());stone.name='Well moss stone';well.add(stone);
 const cap=new THREE.Mesh(new THREE.CircleGeometry(.57),new THREE.MeshBasicMaterial());cap.name='Dark well bottom';well.add(cap);
 scene.add(garden,well);const shaft=createWellShaft({garden,well,scene,position:[8.4,0,-6.2]});scene.updateMatrixWorld(true);
 assert.equal(cap.visible,false);
 const ray=new THREE.Raycaster(new THREE.Vector3(8.4,1.62,-6.2),new THREE.Vector3(0,-1,0));
 const [hit]=ray.intersectObject(shaft,true);assert.equal(hit.object.name,'Unlit deep well bottom');assert.ok(hit.point.y<-3.7);
 assert.equal(shaft.getObjectByName('Deep well inner wall').material.side,THREE.BackSide);
});
