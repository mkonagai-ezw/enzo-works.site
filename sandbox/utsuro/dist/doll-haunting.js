import * as THREE from './vendor/three.module.js';
import {MeshBVH,acceleratedRaycast} from './vendor/three-mesh-bvh.module.js';

// Looking away is distinct from walking behind a wall. Each move needs a new sighting.
export class HauntingState {
  constructor(){this.activated=false;this.phase='dormant';this.moves=0;this.seenTime=0;this.awayTime=0;this.retry=0;}
  update(dt,{active,observed,outside},relocate){
    if(!active){this.seenTime=0;this.awayTime=0;this.retry=0;return false;}
    this.retry=Math.max(0,this.retry-dt);
    if(this.phase!=='armed'){
      this.seenTime=observed?this.seenTime+dt:0;
      if(this.seenTime>=.24){this.activated=true;this.phase='armed';this.awayTime=0;}
      return false;
    }
    this.awayTime=outside?this.awayTime+dt:0;
    if(this.awayTime<.16||this.retry>0)return false;
    this.retry=.3;
    if(!relocate())return false;
    this.moves++;this.phase='waiting-for-sighting';this.seenTime=0;this.awayTime=0;
    return true;
  }
}

export function facingRotation(base,eye,originalForward){
  return Math.atan2(eye.x-base.x,eye.z-base.z)-Math.atan2(originalForward.x,originalForward.z);
}

// Export batching joins distant boards into one mesh. Split its disconnected pieces
// for collision so the empty space between boards is still a usable destination.
export function propBoxes(mesh){
  const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const parent=[],points=[],ids=[],weld=new Map();
  const find=id=>{while(parent[id]!==id){parent[id]=parent[parent[id]];id=parent[id];}return id;};
  for(let i=0;i<position.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(position,i),key=p.toArray().map(v=>Math.round(v*10000)).join(',');
    let id=weld.get(key);if(id===undefined){id=points.length;weld.set(key,id);points.push(p);parent.push(id);}ids.push(id);
  }
  for(let i=0;i<(index?.count||position.count);i+=3){const a=ids[index?index.getX(i):i],b=ids[index?index.getX(i+1):i+1],c=ids[index?index.getX(i+2):i+2];parent[find(b)]=find(a);parent[find(c)]=find(a);}
  const boxes=new Map();
  points.forEach((p,i)=>{const id=find(i);if(!boxes.has(id))boxes.set(id,new THREE.Box3());boxes.get(id).expandByPoint(p);});
  return [...boxes.values()].map(b=>{b.applyMatrix4(mesh.matrixWorld);b.name=mesh.name;return b;});
}

export function createDollHaunting({scene,camera,doll,navigation,surfaceHeight,obstacles,door,onFirstMove}){
  const state=new HauntingState(),origin=new THREE.Vector3(1.86,.728,-3.62);
  const originalForward=new THREE.Vector3(Math.cos(-1.12),0,-Math.sin(-1.12));
  const pivot=new THREE.Group();pivot.name='Ichimatsu haunting pivot';
  scene.remove(doll);pivot.add(doll);doll.position.sub(origin);pivot.position.copy(origin);scene.add(pivot);
  pivot.updateMatrixWorld(true);
  const localBounds=new THREE.Box3().setFromObject(pivot).translate(origin.clone().negate());
  const currentBounds=localBounds.clone().translate(origin);
  const collider={name:'Ichimatsu doll',min:currentBounds.min.toArray(),max:currentBounds.max.toArray()};
  const fixedBoxes=navigation.colliders.map(b=>new THREE.Box3(new THREE.Vector3().fromArray(b.min),new THREE.Vector3().fromArray(b.max)));
  navigation.colliders.push(collider);
  const plantBoxes=[],extraBoxes=[],proxies=[],doorProxies=[];
  const raycaster=new THREE.Raycaster(),ray=new THREE.Ray(),hit=new THREE.Vector3();
  raycaster.firstHitOnly=true;
  const doubleSide=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  function makeProxy(o){
    // Keep the render index unchanged; only collision proxies use accelerated rays.
    if(!o.geometry.boundsTree)o.geometry.boundsTree=new MeshBVH(o.geometry,{indirect:true});
    const proxy=new THREE.Mesh(o.geometry,doubleSide);proxy.raycast=acceleratedRaycast;proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(o.matrixWorld);return proxy;
  }
  for(const root of obstacles){
    root.updateMatrixWorld(true);
    root.traverse(o=>{
      if(!o.isMesh)return;
      const proxy=makeProxy(o);proxy.userData.obstacleRoot=root;proxies.push(proxy);
      // House furniture has individual navigation boxes. Other props use their mesh bounds.
      if(root!==obstacles[0]&&o.name!=='Garden_earth')extraBoxes.push(...propBoxes(o));
    });
  }
  scene.traverse(o=>{
    if(!o.isInstancedMesh)return;
    o.geometry.computeBoundingBox();const m=new THREE.Matrix4(),world=new THREE.Matrix4();
    for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);world.multiplyMatrices(o.matrixWorld,m);plantBoxes.push(o.geometry.boundingBox.clone().applyMatrix4(world));}
  });
  door.traverse(o=>{if(o.isMesh)doorProxies.push({source:o,proxy:makeProxy(o)});});
  const doorBox=new THREE.Box3();
  function syncDoor(){door.updateMatrixWorld(true);doorBox.setFromObject(door);for(const p of doorProxies)p.proxy.matrixWorld.copy(p.source.matrixWorld);}
  const allProxies=[...proxies,...doorProxies.map(p=>p.proxy)];
  const frustum=new THREE.Frustum(),viewMatrix=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  const expanded=new THREE.Box3(),testBox=new THREE.Box3(),bodyBox=new THREE.Box3();
  const eye=new THREE.Vector3(),direction=new THREE.Vector3(),point=new THREE.Vector3();
  let visibilityClock=0,visible=false,lastPlacement=null,searches=0,lastSearchMs=0,rejections={};
  function reject(reason){rejections[reason]=(rejections[reason]||0)+1;return false;}
  function inView(box){return frustum.intersectsBox(expanded.copy(box).expandByScalar(.10));}
  function clearRay(to){
    direction.subVectors(to,eye);const distance=direction.length();direction.divideScalar(distance);ray.set(eye,direction);
    for(const b of [...fixedBoxes,doorBox,...plantBoxes])if(ray.intersectBox(b,hit)&&hit.distanceTo(eye)<distance-.025)return false;
    raycaster.set(eye,direction);raycaster.near=.015;raycaster.far=distance-.025;
    return raycaster.intersectObjects(allProxies.filter(p=>p.userData.obstacleRoot?.visible!==false),false).length===0;
  }
  function clearBody(base,rotation,requireAll){
    const right=new THREE.Vector3(Math.cos(rotation+Math.atan2(originalForward.x,originalForward.z)),0,-Math.sin(rotation+Math.atan2(originalForward.x,originalForward.z)));
    // Face, chest and both sides must be unobstructed at a new placement.
    const samples=[[0,.65],[0,.42],[-.17,.34],[.17,.34],[0,.12]];
    let count=0;
    for(const [offset,h] of samples){point.copy(base).addScaledVector(right,offset);point.y+=h;
      if(!requireAll&&!frustum.containsPoint(point))continue;
      if(clearRay(point)){if(!requireAll)return true;count++;}else if(requireAll)return false;
    }
    return requireAll&&count===samples.length;
  }
  function boundsAt(base,rotation){matrix.makeRotationY(rotation);matrix.setPosition(base);return testBox.copy(localBounds).applyMatrix4(matrix);}
  function fits(base,box){
    bodyBox.copy(box).expandByScalar(.025);bodyBox.min.y=base.y+.035;
    const obstacle=[...fixedBoxes,doorBox,...extraBoxes,...plantBoxes].find(b=>bodyBox.intersectsBox(b));
    if(obstacle)return reject(obstacle.name||'collision');
    // Four feet/hem samples may not straddle a step, float, or sink into a prop.
    const r=.22;
    for(const [dx,dz] of [[0,0],[-r,-r],[-r,r],[r,-r],[r,r]]){
      if(Math.abs(surfaceHeight(base.x+dx,base.z+dz)-base.y)>.035)return reject('uneven-floor');
      point.set(base.x+dx,base.y+.10,base.z+dz);raycaster.set(point,new THREE.Vector3(0,-1,0));raycaster.near=0;raycaster.far=.18;
      const hits=raycaster.intersectObjects(proxies,false);
      if(!hits.length||Math.abs(hits[0].point.y-base.y)>.035)return reject('no-floor-contact');
    }
    return true;
  }
  function relocate(){
    const started=performance.now();searches++;rejections={};
    const candidates=[];
    // Sample a small ring around the player. A failed search leaves the doll in place.
    const offset=(state.moves*.381966)%1;
    for(const radius of [1.65,2.1,2.7,3.4,4.2])for(let i=0;i<28;i++){
      const a=(i/28+offset)*Math.PI*2,x=eye.x+Math.sin(a)*radius,z=eye.z+Math.cos(a)*radius;
      if(x<-12.5||x>13.5||z<-13.5||z>15.5)continue;
      const base=new THREE.Vector3(x,surfaceHeight(x,z),z);
      if(base.distanceTo(pivot.position)<1.05)continue;
      const rotation=facingRotation(base,eye,originalForward),box=boundsAt(base,rotation).clone();
      if(inView(box))continue;
      candidates.push({base,rotation,box,score:Math.abs(radius-2.1)+Math.random()*.7});
    }
    candidates.sort((a,b)=>a.score-b.score);
    for(const c of candidates){
      if(!fits(c.base,c.box))continue;
      if(!clearBody(c.base,c.rotation,true)){reject('occluded');continue;}
      const from=pivot.position.toArray();pivot.position.copy(c.base);pivot.rotation.y=c.rotation;pivot.updateMatrixWorld(true);
      currentBounds.copy(c.box);collider.min=currentBounds.min.toArray();collider.max=currentBounds.max.toArray();
      lastPlacement={from,to:c.base.toArray(),rotation:c.rotation,offscreen:true,unobstructed:true,facingDot:originalForward.clone().applyAxisAngle(new THREE.Vector3(0,1,0),c.rotation).dot(eye.clone().sub(c.base).setY(0).normalize())};
      visible=false;visibilityClock=0;lastSearchMs=performance.now()-started;return true;
    }
    lastSearchMs=performance.now()-started;return false;
  }
  return {
    actor:pivot,
    reset(){
      Object.assign(state,new HauntingState());pivot.visible=true;pivot.position.copy(origin);pivot.rotation.set(0,0,0);pivot.updateMatrixWorld(true);
      currentBounds.copy(localBounds).translate(origin);collider.min=currentBounds.min.toArray();collider.max=currentBounds.max.toArray();
      visibilityClock=0;visible=false;lastPlacement=null;searches=0;lastSearchMs=0;rejections={};
    },
    setPresent(value){pivot.visible=value;if(!value){collider.min=[10000,10000,10000];collider.max=[10000,10000,10000];}},
    setPose(base,eyePosition,lean=0){
      pivot.position.copy(base);pivot.rotation.set(0,facingRotation(base,eyePosition,originalForward),lean);
      pivot.updateMatrixWorld(true);currentBounds.copy(boundsAt(base,pivot.rotation.y));
      collider.min=currentBounds.min.toArray();collider.max=currentBounds.max.toArray();
    },
    clearLine(from,to){
      syncDoor();direction.subVectors(to,from);const distance=direction.length();
      if(distance<.03)return true;
      direction.divideScalar(distance);raycaster.set(from,direction);raycaster.near=.02;raycaster.far=distance-.03;
      return raycaster.intersectObjects(allProxies.filter(p=>p.userData.obstacleRoot?.visible!==false),false).length===0;
    },
    update(dt,active){
      if(!active){state.update(dt,{active:false},relocate);visible=false;visibilityClock=0;return;}
      camera.updateMatrixWorld(true);eye.copy(camera.position);syncDoor();
      frustum.setFromProjectionMatrix(viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      const outside=!inView(currentBounds);visibilityClock-=dt;
      if(outside)visible=false;
      else if(visibilityClock<=0){visible=eye.distanceTo(pivot.position)<10&&clearBody(pivot.position,pivot.rotation.y,false);visibilityClock=.12;}
      if(state.update(dt,{active:true,observed:visible&&!outside,outside},relocate)&&state.moves===1)onFirstMove();
    },
    diagnostics(){return {activated:state.activated,phase:state.phase,moves:state.moves,visible,position:pivot.position.toArray(),rotation:pivot.rotation.y,lastPlacement,searches,lastSearchMs:+lastSearchMs.toFixed(1),rejections};}
  };
}
