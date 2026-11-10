import * as THREE from './vendor/three.module.js';

export const RUN_SPEED=2.65, DOLL_SPEED=3.12, SURVIVE_SECONDS=60;
export const START_GRACE_SECONDS=5, FIRST_RELEASE_GRACE_SECONDS=2;
export class RevealGrace {
  constructor(){this.grace=START_GRACE_SECONDS;}
  update(dt,active){if(active)this.grace=Math.max(0,this.grace-dt);return this.grace<=.000001;}
}
export class EscapeState {
  constructor(){this.phase='explore';this.seconds=0;this.frozen=false;this.rain=false;this.moving=false;}
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
    this.boxes=navigation.colliders.filter(b=>b.name!=='Ichimatsu doll'&&b.name!=='Jizo');
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

export function createPursuit({camera,haunting,navigation,height,doorBox,onReveal=()=>{}}){
  const state=new EscapeState(),nav=new ChaseNavigation(navigation,height,doorBox),actor=haunting.actor;
  let path=[],repath=0,motion=0,visibleSpawn=null,gate=new RevealGrace(),releasePending=true,releaseGrace=0;
  const eye=new THREE.Vector3();
  return {state,nav,
    reset(){Object.assign(state,new EscapeState());path=[];repath=0;motion=0;visibleSpawn=null;gate=new RevealGrace();releasePending=true;releaseGrace=0;haunting.reset();},
    examine(){if(!state.examine())return false;haunting.setPresent(false);return true;},
    dismiss(){
      if(!state.dismiss())return false;
      onReveal();
      const base=new THREE.Vector3(3,height(3,-7.8),-7.8);
      haunting.setPose(base,camera.position);actor.visible=true;visibleSpawn=base.toArray();
      path=[];repath=0;gate=new RevealGrace();releasePending=true;releaseGrace=0;
      state.reveal();state.frozen=true;return true;
    },
    update(dt,active,yaw,flashOn){
      state.moving=false;
      state.unlock(haunting.diagnostics().moves);
      if(!active)return;
      nav.dynamicDoor=doorBox?.();
      if(state.phase==='sighting'){
        state.frozen=true;
        if(gate.update(dt,true)){state.beginChase();repath=0;}
        // The transformation is immediate; a fixed active-time grace allows escape even without aiming.
        return;
      }
      if(state.chasing){
        eye.copy(camera.position);const lit=beamHits(camera,actor.position,flashOn,haunting.clearLine);
        if(!lit&&releasePending){releasePending=false;releaseGrace=FIRST_RELEASE_GRACE_SECONDS;}
        const releaseProtected=releaseGrace>0;
        if(releaseProtected)releaseGrace=Math.max(0,releaseGrace-dt);
        state.frozen=lit||releaseProtected;repath-=dt;
        const previousPosition=actor.position.clone();
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
        const traveled=previousPosition.distanceTo(actor.position);
        state.moving=traveled>.00001;
        const caught=!state.frozen&&Math.hypot(eye.x-actor.position.x,eye.z-actor.position.z)<.59&&Math.abs(eye.y-1.62-actor.position.y)<.65&&haunting.clearLine(eye,actor.position.clone().add(new THREE.Vector3(0,.55,0)));
        state.tick(dt,true,caught);
        if(!state.chasing)state.moving=false;
      }
    },
    diagnostics(){return {phase:state.phase,seconds:+state.seconds.toFixed(2),frozen:state.frozen,moving:state.moving,rain:state.rain,position:actor.position.toArray(),pathNodes:path.length,visibleSpawn,sighting:{confirmed:true,grace:+gate.grace.toFixed(2)},releasePending,releaseGrace:+releaseGrace.toFixed(2)};}
  };
}
