import * as THREE from './vendor/three.module.js';
import {shadowArmRoom} from './shadow-arms-layout.js';

// Follow the imported mat surface instead of floating a rectangle above the room.
// Cloth borders, vertical edges and the tatami in other rooms remain untouched.
export function scorchGeometry(house){
 const positions=[],uvs=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
 const bounds=shadowArmRoom.bounds,[cx,,cz]=shadowArmRoom.center;
 house.updateWorldMatrix(true,true,true);
 house.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const groups=geometry.groups.length?geometry.groups:[{start:0,count:index?index.count:position.count,materialIndex:0}];
  for(const group of groups){
   if(!/damp.?tatami/i.test(materials[group.materialIndex]?.name||''))continue;
   for(let i=group.start;i<group.start+group.count;i+=3){
    for(const [vertex,offset] of [[a,0],[b,1],[c,2]])vertex.fromBufferAttribute(position,index?index.getX(i+offset):i+offset).applyMatrix4(mesh.matrixWorld);
    normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
    if(normal.y<.98||[a,b,c].some(p=>p.x<bounds.minX-.001||p.x>bounds.maxX+.001||p.z<bounds.minZ-.001||p.z>bounds.maxZ+.001||Math.abs(p.y-.670)>.01))continue;
    for(const p of [a,b,c]){positions.push(p.x,p.y+.0015,p.z);uvs.push((p.x-cx)/3.45+.5,.5-(p.z-cz)/3.3);}
   }
  }
 });
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}

export async function createTatamiScorch({house,scene,mobile=false,anisotropy=4}){
 const texture=await new THREE.TextureLoader().loadAsync('assets/scorched-tatami/'+(mobile?'burn-mobile.webp':'burn.webp'));
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
 const material=new THREE.MeshStandardMaterial({name:'Cooled carbonized tatami',map:texture,color:'#a6a19a',roughness:1,metalness:0,bumpMap:texture,bumpScale:.009,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const group=new THREE.Group();group.name='Pre-ritual tatami fire scar';
 const mesh=new THREE.Mesh(scorchGeometry(house),material);mesh.receiveShadow=true;mesh.renderOrder=3;group.add(mesh);scene.add(group);
 return {group,update:(story,stage)=>{group.visible=stage==='house'&&!story.rain;},diagnostics:()=>({visible:group.visible,triangles:mesh.geometry.attributes.position.count/3})};
}
