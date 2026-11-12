import * as THREE from './vendor/three.module.js';

// Cut the terrain itself (including collision/raycast geometry), not a black decal.
// Subtract a convex 48-sided opening while interpolating the existing UVs/normals.
export function cutWellOpening(mesh,cx,cz,radius=.64){
 mesh.updateWorldMatrix(true,false,true);
 const source=mesh.geometry,attributes=Object.entries(source.attributes),values=Object.fromEntries(attributes.map(([name,a])=>[name,Array.from({length:a.count*a.itemSize},(_,i)=>a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize))]));
 const p=source.attributes.position,world=Array.from({length:p.count},(_,i)=>new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(mesh.matrixWorld));
 const indices=[],groups=[],segments=48,apothem=radius*Math.cos(Math.PI/segments);
 function crossing(a,b,t){const id=world.length;world.push(world[a].clone().lerp(world[b],t));for(const [name,attr] of attributes)for(let k=0;k<attr.itemSize;k++)values[name].push(values[name][a*attr.itemSize+k]*(1-t)+values[name][b*attr.itemSize+k]*t);return id;}
 function emit(poly){for(let i=1;i+1<poly.length;i++)indices.push(poly[0],poly[i],poly[i+1]);}
 const index=source.index,count=index?index.count:p.count;
 for(const group of source.groups.length?source.groups:[{start:0,count,materialIndex:0}]){
  const start=indices.length;
  for(let i=group.start;i<group.start+group.count;i+=3){
   let poly=[0,1,2].map(k=>index?index.getX(i+k):i+k);const points=poly.map(id=>world[id]);
   if(Math.max(...points.map(v=>v.x))<cx-radius||Math.min(...points.map(v=>v.x))>cx+radius||Math.max(...points.map(v=>v.z))<cz-radius||Math.min(...points.map(v=>v.z))>cz+radius){emit(poly);continue;}
   for(let side=0;side<segments&&poly.length;side++){
    const angle=(side+.5)*Math.PI*2/segments,nx=Math.cos(angle),nz=Math.sin(angle),inside=[],outside=[];
    for(let j=0;j<poly.length;j++){
     const a=poly[j],b=poly[(j+1)%poly.length],da=(world[a].x-cx)*nx+(world[a].z-cz)*nz-apothem,db=(world[b].x-cx)*nx+(world[b].z-cz)*nz-apothem;
     if(da<=0)inside.push(a);if(da>=0)outside.push(a);
     if((da<0&&db>0)||(da>0&&db<0)){const id=crossing(a,b,da/(da-db));inside.push(id);outside.push(id);}
    }
    emit(outside);poly=inside;
   }
  }
  groups.push({start,count:indices.length-start,materialIndex:group.materialIndex});
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,a] of attributes)geometry.setAttribute(name,new THREE.Float32BufferAttribute(values[name],a.itemSize));
 geometry.setIndex(indices);for(const g of groups)geometry.addGroup(g.start,g.count,g.materialIndex);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 return geometry;
}

export function createWellShaft({garden,well,scene,position}){
 const [cx,base,cz]=position,earth=garden.getObjectByName('Garden_earth');
 if(!earth)throw Error('井戸の開口を作る地面が見つかりません');
 cutWellOpening(earth,cx,cz);
 const cap=well.getObjectByName('Dark well bottom');if(cap)cap.visible=false;
 let stone;well.traverse(o=>{if(!stone&&o.isMesh&&/^Well[ _]moss[ _]stone/.test(o.name))stone=Array.isArray(o.material)?o.material[0]:o.material;});
 if(!stone)throw Error('井戸の内壁の材質が見つかりません');
 const group=new THREE.Group();group.name='Open well shaft';group.position.set(cx,base,cz);
 const top=.12,bottom=-3.8,geometry=new THREE.CylinderGeometry(.575,.54,top-bottom,48,16,true);
 geometry.translate(0,(top+bottom)/2,0);
 const colors=[],uv=geometry.attributes.uv;
 for(let i=0;i<geometry.attributes.position.count;i++){
  const y=geometry.attributes.position.getY(i),shade=THREE.MathUtils.lerp(.012,.65,Math.pow(Math.max(0,(y-bottom)/(top-bottom)),2.5));
  colors.push(shade,shade,shade);uv.setXY(i,uv.getX(i)*3.6,uv.getY(i)*3.92);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const material=stone.clone();material.side=THREE.BackSide;material.shadowSide=THREE.BackSide;material.vertexColors=true;material.roughness=1;
 const wall=new THREE.Mesh(geometry,material);wall.name='Deep well inner wall';wall.receiveShadow=true;wall.castShadow=true;group.add(wall);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(.575,48),new THREE.MeshBasicMaterial({color:0x000000}));floor.rotation.x=-Math.PI/2;floor.position.y=bottom;floor.name='Unlit deep well bottom';group.add(floor);
 // Continue the two existing clue ropes below their old ground-level endpoints.
 const ropeMaterial=new THREE.MeshStandardMaterial({color:0x252015,roughness:1});
 for(const x of [8.12,8.65]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,2.9,6),ropeMaterial);rope.position.set(x-cx,.09-2.9/2,0);rope.castShadow=true;rope.receiveShadow=true;group.add(rope);}
 scene.add(group);return group;
}
