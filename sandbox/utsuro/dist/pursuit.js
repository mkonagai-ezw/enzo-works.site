import * as THREE from './vendor/three.module.js';

export const RUN_SPEED=2.65, DOLL_SPEED=3.12, SURVIVE_SECONDS=60;
export const SIGHTING_SECONDS=1, START_GRACE_SECONDS=3;
export class SightingGate {
  constructor(){this.seen=0;this.confirmed=false;this.grace=START_GRACE_SECONDS;}
  update(dt,active,observed){
    if(!active){if(!this.confirmed)this.seen=0;return false;}
    if(!this.confirmed){this.seen=observed?this.seen+dt:0;if(this.seen>=SIGHTING_SECONDS)this.confirmed=true;return false;}
    this.grace=Math.max(0,this.grace-dt);return this.grace<=.000001;
  }
}
export class EscapeState {
  constructor(){this.phase='explore';this.seconds=0;this.frozen=false;this.rain=false;}
  unlock(moves){if(this.phase==='explore'&&moves>0)this.phase='jizo-ready';}
  examine(){if(this.phase!=='jizo-ready')return false;this.phase='warning';this.rain=true;return true;}
  dismiss(){if(this.phase!=='warning')return false;this.phase='reveal';return true;}
  reveal(){if(this.phase!=='reveal')return false;this.phase='sighting';return true;}
  beginChase(){if(this.phase!=='sighting')return false;this.phase='chase';return true;}
  get chasing(){return this.phase==='chase'||this.phase==='phone';}
  tick(dt,active,caught=false){
    if(!active||!this.chasing)return;
    this.seconds+=dt;
    if(caught){this.phase='lost';this.frozen=false;return;}
    if(this.seconds>=SURVIVE_SECONDS)this.phase='phone';
  }
  answer(){if(this.phase!=='phone')return false;this.phase='clear';return true;}
}

// A small navigation grid over the actual floor heights. Edges are swept against
// the wall/column boxes; diagonal corners and elevated floor ledges cannot be cut.
export class ChaseNavigation {
  constructor(navigation,height,doorBox){
    this.height=height;this.doorBox=doorBox;this.dynamicDoor=doorBox?.();this.cell=.22;this.minX=-12.5;this.minZ=-13.5;this.cols=119;this.rows=132;
    this.boxes=navigation.colliders.filter(b=>b.name!=='Ichimatsu doll');
    this.buckets=new Map();
    for(const b of this.boxes)for(let x=Math.floor(b.min[0]-.2);x<=Math.floor(b.max[0]+.2);x++)for(let z=Math.floor(b.min[2]-.2);z<=Math.floor(b.max[2]+.2);z++){
      const key=x+','+z;if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(b);
    }
    this.points=[];this.open=new Uint8Array(this.cols*this.rows);
    for(let z=0;z<this.rows;z++)for(let x=0;x<this.cols;x++){
      const px=this.minX+x*this.cell,pz=this.minZ+z*this.cell,p=new THREE.Vector3(px,height(px,pz),pz);
      const i=this.points.length;this.points.push(p);this.open[i]=!this.blocked(p,false);
    }
  }
  blocked(p,door=true){
    const r=.18;if(p.x<this.minX||p.z<this.minZ||p.x>13.45||p.z>15.3)return true;
    const boxes=this.buckets.get(Math.floor(p.x)+','+Math.floor(p.z))||[];
    const collides=b=>b&&b.max[1]>p.y+.24&&b.min[1]<p.y+.72&&p.x+r>b.min[0]&&p.x-r<b.max[0]&&p.z+r>b.min[2]&&p.z-r<b.max[2];
    return boxes.some(collides)||(door&&collides(this.dynamicDoor));
  }
  segment(a,b){
    const n=Math.max(1,Math.ceil(a.distanceTo(b)/.08));let last=a.y;
    for(let i=1;i<=n;i++){const t=i/n,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t),y=this.height(x,z);
      if(Math.abs(y-last)>.30||this.blocked({x,y,z}))return false;last=y;
    }return true;
  }
  nearest(p,connected=false){
    const x=Math.round((p.x-this.minX)/this.cell),z=Math.round((p.z-this.minZ)/this.cell);let best=-1,dist=Infinity;
    for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){
      const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=this.cols||zz>=this.rows)continue;
      const id=zz*this.cols+xx,q=this.points[id],d=Math.hypot(q.x-p.x,q.z-p.z);
      if(this.open[id]&&d<dist&&!this.blocked(q)&&(!connected||this.segment(new THREE.Vector3(p.x,this.height(p.x,p.z),p.z),q))){best=id;dist=d;}
    }return best;
  }
  path(from,to){
    this.dynamicDoor=this.doorBox?.();
    const start=this.nearest(from,true),end=this.nearest(to,true);if(start<0||end<0)return [];
    const count=this.points.length,cost=new Float32Array(count).fill(Infinity),previous=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=[];
    const heuristic=id=>this.points[id].distanceTo(this.points[end]);
    const push=(id,score)=>{let i=heap.length;heap.push({id,score});while(i){const parent=(i-1)>>1;if(heap[parent].score<=score)break;heap[i]=heap[parent];i=parent;}heap[i]={id,score};};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].score<heap[j].score)j++;if(heap[j].score>=last.score)break;heap[i]=heap[j];i=j;}heap[i]=last;}return top.id;};
    cost[start]=0;push(start,heuristic(start));
    while(heap.length){
      const id=pop();if(closed[id])continue;closed[id]=1;
      if(id===end){const result=[];for(let i=end;i!==-1;i=previous[i])result.push(this.points[i].clone());result.reverse();if(this.segment(from,result[0]))result.unshift(from.clone());else return [];return result;}
      const x=id%this.cols,z=Math.floor(id/this.cols);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=this.cols||zz>=this.rows)continue;const next=zz*this.cols+xx;
        if(closed[next]||!this.open[next]||Math.abs(this.points[next].y-this.points[id].y)>.30)continue;
        const g=cost[id]+this.points[id].distanceTo(this.points[next]);if(g>=cost[next]||!this.segment(this.points[id],this.points[next]))continue;
        cost[next]=g;previous[next]=id;push(next,g+heuristic(next));
      }
    }return [];
  }
}

export function beamHits(camera,base,enabled,clearLine){
  if(!enabled)return false;const direction=camera.getWorldDirection(new THREE.Vector3());
  for(const h of [.25,.4,.56,.66]){
    const p=base.clone();p.y+=h;const offset=p.clone().sub(camera.position),d=offset.length();
    if(d>14||d<.1)continue;
    if(offset.normalize().dot(direction)>Math.cos(.055+.085/d)&&clearLine(camera.position,p))return true;
  }return false;
}

export function createPursuit({camera,haunting,navigation,height,doorBox}){
  const state=new EscapeState(),nav=new ChaseNavigation(navigation,height,doorBox),actor=haunting.actor;
  let closeYaw=0,path=[],repath=0,motion=0,spawnAttempts=0,visibleSpawn=null,gate=new SightingGate();
  const eye=new THREE.Vector3(),direction=new THREE.Vector3();
  function spawn(){
    camera.updateMatrixWorld(true);camera.getWorldDirection(direction);eye.copy(camera.position);const candidates=[];
    const view=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const radius of [6.5,5.5,7.5,4.5])for(let i=0;i<80;i++){
      const a=i/80*Math.PI*2,p=new THREE.Vector3(eye.x+Math.sin(a)*radius,0,eye.z+Math.cos(a)*radius);p.y=height(p.x,p.z);
      const look=p.clone().add(new THREE.Vector3(0,.5,0)).sub(eye).normalize(),dot=look.dot(direction);
      const chest=p.clone().add(new THREE.Vector3(0,.5,0));
      if(dot<.72||!view.containsPoint(chest)||nav.blocked(p)||!haunting.clearLine(eye,chest))continue;
      candidates.push({p,score:dot*10-Math.abs(radius-6)});
    }
    candidates.sort((a,b)=>b.score-a.score);spawnAttempts++;
    for(const {p} of candidates){const route=nav.path(p,eye);if(!route.length)continue;
      haunting.setPose(p,eye);actor.visible=true;visibleSpawn=p.toArray();path=route;repath=.6;gate=new SightingGate();state.reveal();return true;}
    return false;
  }
  return {state,nav,
    reset(){Object.assign(state,new EscapeState());closeYaw=0;path=[];repath=0;motion=0;spawnAttempts=0;visibleSpawn=null;gate=new SightingGate();haunting.reset();},
    examine(){if(!state.examine())return false;haunting.setPresent(false);return true;},
    dismiss(yaw){if(!state.dismiss())return false;closeYaw=yaw;repath=0;return true;},
    update(dt,active,yaw,flashOn){
      state.unlock(haunting.diagnostics().moves);
      if(!active){if(state.phase==='sighting')gate.update(dt,false,false);return;}
      nav.dynamicDoor=doorBox?.();
      if(state.phase==='reveal'){
        repath-=dt;const turn=Math.abs(Math.atan2(Math.sin(yaw-closeYaw),Math.cos(yaw-closeYaw)));
        if(turn>.32&&repath<=0){spawn();repath=.3;}
      }
      if(state.phase==='sighting'){
        camera.updateMatrixWorld(true);
        const observed=flashOn&&beamHits(camera,actor.position,true,haunting.clearLine)&&[.12,.4,.65].every(h=>{
          const point=actor.position.clone().add(new THREE.Vector3(0,h,0)),screen=point.clone().project(camera);
          return screen.z>-1&&screen.z<1&&Math.abs(screen.x)<.8&&Math.abs(screen.y)<.8&&haunting.clearLine(camera.position,point);
        });
        state.frozen=true;
        if(gate.update(dt,true,observed)){state.beginChase();repath=0;}
        // No movement, catch or survival timer during discovery and its grace period.
        return;
      }
      if(state.chasing){
        eye.copy(camera.position);state.frozen=beamHits(camera,actor.position,flashOn,haunting.clearLine);repath-=dt;
        if(!state.frozen){
          motion+=dt;
          if(repath<=0){path=nav.path(actor.position,eye);repath=.65;}
          // Stop-start rhythm and a rigid lean keep the scanned doll unsettling.
          let distance=DOLL_SPEED*(.85+.30*Math.sin(motion*8)**2)*dt;
          while(distance>0&&path.length){const p=path[0],delta=p.clone().sub(actor.position),length=delta.length();
            if(length<.00001){path.shift();continue;}
            const next=actor.position.clone().addScaledVector(delta,Math.min(1,distance/length));next.y=height(next.x,next.z);
            if(!nav.segment(actor.position,next)){path=[];repath=0;break;}
            actor.position.copy(next);distance-=length;
          }
          haunting.setPose(actor.position,eye,Math.sin(motion*11)*.035+Math.sin(motion*2.1)*.025);
        }
        const caught=Math.hypot(eye.x-actor.position.x,eye.z-actor.position.z)<.59&&Math.abs(eye.y-1.62-actor.position.y)<.65&&haunting.clearLine(eye,actor.position.clone().add(new THREE.Vector3(0,.55,0)));
        state.tick(dt,true,caught);
      }
    },
    diagnostics(){return {phase:state.phase,seconds:+state.seconds.toFixed(2),frozen:state.frozen,rain:state.rain,position:actor.position.toArray(),pathNodes:path.length,spawnAttempts,visibleSpawn,sighting:{seen:+gate.seen.toFixed(2),confirmed:gate.confirmed,grace:+gate.grace.toFixed(2)}};}
  };
}
