import * as THREE from 'three';
import {shadowMotion,createShadowPoseDriver,shadowFrameDelta} from './shadow-motion.js?v=mobile-scares-1';
import {ShadowEncounterState,sweptDistance} from './shadow-encounter-state.js';
export async function createShadowCouple({loader,scene,mobile,canStand,onStart=()=>{},onReset=()=>{},onContact=()=>{},onGameOver=()=>{}}){
 const assets=await Promise.all(['male','female'].map(n=>loader.loadAsync('assets/couple/shadow-'+n+'.glb')));
 const smoke=await new THREE.TextureLoader().loadAsync('assets/fire/smoke_01.png');
 const state=new ShadowEncounterState(),group=new THREE.Group();group.name='The couple - smoke shadows';group.visible=false;scene.add(group);
 let seed=5287;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const anchors=['Head','neck_01','spine_03','spine_02','pelvis','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r'];
 const actors=assets.map((asset,index)=>{
  const model=asset.scene;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y,targetHeight=index?1.61:1.88;
  const shell=new THREE.Group();group.add(shell);const s=targetHeight/height;model.scale.multiply(new THREE.Vector3(s*(index?.83:.72),s,s*.82));model.position.y-=box.min.y*s;shell.add(model);
  const material=new THREE.MeshBasicMaterial({color:0x010102,fog:false});
  model.traverse(o=>{if(o.isMesh){o.material=material;o.castShadow=false;o.receiveShadow=false;o.frustumCulled=false;}});
  const mixer=new THREE.AnimationMixer(model),idle=mixer.clipAction(asset.animations.find(a=>a.name==='Idle_Loop')),run=mixer.clipAction(asset.animations.find(a=>a.name==='Sprint_Loop'));idle.play();
  const bones=Object.fromEntries(anchors.map(n=>[n,model.getObjectByName(n)])),positions=new Float32Array((mobile?112:380)*3),sizes=new Float32Array(positions.length/3),phases=new Float32Array(sizes.length);
  for(let i=0;i<sizes.length;i++){sizes[i]=.13+rnd()*.28;phases[i]=rnd();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geo.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
  const particleMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:smoke},pixelScale:{value:600},pointLimit:{value:mobile?96:180},clock:{value:0}},
   vertexShader:'attribute float aSize;attribute float aPhase;uniform float pixelScale,pointLimit;varying float vPhase;void main(){vPhase=aPhase;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*pixelScale/max(.2,-mv.z),1.,pointLimit);}',
   fragmentShader:'uniform sampler2D map;uniform float clock;varying float vPhase;void main(){vec2 uv=gl_PointCoord;float a=texture2D(map,uv).r;float pulse=.68+.22*sin(clock*2.+vPhase*30.);gl_FragColor=vec4(vec3(.012,.014,.019),a*pulse*.80);}',toneMapped:false});
  const particles=new THREE.Points(geo,particleMaterial);particles.frustumCulled=false;group.add(particles);
  return {pose:createShadowPoseDriver(mixer,bones),shell,model,mixer,idle,run,bones,positions,phases,particles,particleMaterial,index,started:false,anchorPositions:anchors.map(()=>new THREE.Vector3()),forward:new THREE.Vector3(0,0,1)};
 });
 const old=new THREE.Vector3(),target=new THREE.Vector3(),approach=new THREE.Vector3(),look=new THREE.Vector3();
 let contactActor=0,shown=false,flowTime=0,flow=new Map(),flowRoot=null;
 const key=(x,z)=>x+','+z;
 // The corridor is static: build its walkable graph during loading, not during the rush.
 const nodes=new Map();
 for(let x=-7;x<=7;x++)for(let z=-33;z<=-1;z++)if(canStand(x,z))nodes.set(key(x,z),{x,z,neighbors:[]});
 for(const node of nodes.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const neighbor=nodes.get(key(node.x+dx,node.z+dz));if(neighbor&&canStand(node.x+dx*.5,node.z+dz*.5))node.neighbors.push(neighbor);}
 // A small navigation grid keeps the shadows inside the T corridor and around its corners.
 function buildFlow(player){
  let root=null,best=Infinity;for(const node of nodes.values()){const d=(node.x-player.x)**2+(node.z-player.z)**2;if(d<best){best=d;root=node;}}
  if(!root||root===flowRoot)return;flowRoot=root;flow=new Map();const queue=[root];flow.set(key(root.x,root.z),{distance:0,x:root.x,z:root.z});
  for(let i=0;i<queue.length;i++){const node=queue[i],d=flow.get(key(node.x,node.z)).distance;for(const next of node.neighbors){const k=key(next.x,next.z);if(flow.has(k))continue;flow.set(k,{distance:d+1,x:next.x,z:next.z});queue.push(next);}}
 }
 function clear(a,b){const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.18);for(let i=1;i<=n;i++){const t=i/n;if(!canStand(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}return true;}
 function waypoint(a,player){target.copy(player);target.y=0;if(clear(a,target))return target;let best=Infinity,node=null;for(let x=Math.floor(a.x)-1;x<=Math.ceil(a.x)+1;x++)for(let z=Math.floor(a.z)-1;z<=Math.ceil(a.z)+1;z++){const f=flow.get(key(x,z));if(!f)continue;const d=f.distance+Math.hypot(a.x-x,a.z-z);if(d<best&&clear(a,{x,z})){best=d;node={x,z};}}if(node)target.set(node.x,0,node.z);else target.copy(a);return target;}
 function particles(a,t,camera){
  a.shell.updateMatrixWorld(true);anchors.forEach((n,i)=>{if(a.bones[n])a.anchorPositions[i].setFromMatrixPosition(a.bones[n].matrixWorld);});const p=a.positions;
  for(let i=0;i<a.phases.length;i++){const life=(t*(.47+(i%5)*.07)+a.phases[i])%1,anchor=a.anchorPositions[i%anchors.length],angle=i*2.399+t*(i%2?1:-1),r=.04+life*.23;
   p[i*3]=anchor.x+Math.cos(angle)*r-a.forward.x*life*.65;p[i*3+1]=anchor.y+Math.sin(angle*1.4)*r+life*.14;p[i*3+2]=anchor.z+Math.sin(angle)*r-a.forward.z*life*.65;
  }a.particles.geometry.attributes.position.needsUpdate=true;a.particleMaterial.uniforms.clock.value=t;if(camera)a.particleMaterial.uniforms.pixelScale.value=innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
 }
 return {state,group,actors,
  glimpse(){if(state.phase!=='hidden')return false;state.phase='glimpse';state.time=0;group.visible=true;actors.forEach((a,i)=>{a.shell.position.set(i?.58:-.57,0,i?-22.8:-22.2);a.shell.rotation.set(0,0,i?.06:-.04);a.run.stop();a.idle.reset().play();a.pose(0,shadowMotion(0,i),false);a.started=false;particles(a,0);});return true;},
  showcase(run=false){state.reset();onReset();state.phase='preview';group.visible=true;actors.forEach((a,i)=>{a.shell.position.set(i?.68:-.68,0,i?-6.1:-5.7);a.shell.rotation.set(0,0,0);a.run.stop();a.idle.stop();(run?a.run:a.idle).reset().play();a.run.timeScale=i?1.55:1.38;a.started=run;});},
  trigger(player,spawns=[[-.57,0,-22.3],[.58,0,-23.2]]){if(!state.start())return false;onStart();shown=false;actors.forEach((a,i)=>{a.shell.position.fromArray(spawns[i]);a.shell.rotation.set(0,0,0);a.started=true;a.idle.stop();a.run.reset().play();const motion=shadowMotion(0,i);a.run.timeScale=motion.stride;a.pose(0,motion,false);particles(a,0);});buildFlow(player);flowTime=0;group.visible=true;return true;},
  async warmup(renderer,camera){
   // Compile and upload the skinned meshes/particles offscreen before gameplay.
   const wasVisible=group.visible,renderTarget=renderer.getRenderTarget(),scratch=new THREE.WebGLRenderTarget(64,64),warmCamera=camera.clone();
   warmCamera.position.set(0,1.64,-1.1);warmCamera.lookAt(0,1,-8);warmCamera.updateMatrixWorld(true);
   try{group.visible=true;actors.forEach((a,i)=>{a.shell.position.set(i?.58:-.57,0,-8);a.idle.stop();a.run.reset().play();a.pose(0,shadowMotion(0,i),false);particles(a,0,warmCamera);});await renderer.compileAsync(scene,warmCamera);renderer.setRenderTarget(scratch);renderer.render(scene,warmCamera);}
   finally{renderer.setRenderTarget(renderTarget);scratch.dispose();group.visible=wasVisible;actors.forEach(a=>{a.run.stop();a.idle.reset().play();a.pose(0,shadowMotion(0,a.index),false);a.started=false;});}
  },
  reset(){state.reset();onReset();shown=false;group.visible=false;actors.forEach(a=>{a.run.stop();a.idle.reset().play();a.started=false;});},
  update(dt,player,camera){if(state.phase==='glimpse'){state.time+=Math.max(0,dt);if(state.time>=.85){state.reset();group.visible=false;}return;}if(state.phase==='hidden'||state.phase==='gameover')return;dt=shadowFrameDelta(dt);state.tick(dt);flowTime+=dt;if(flowTime>.35){buildFlow(player);flowTime=0;}
   actors.forEach((a,i)=>{
    const go=state.phase==='rush',motion=shadowMotion(state.time,i);
    if(go&&!a.started){a.idle.stop();a.run.reset().play();a.run.timeScale=i?1.55:1.38;a.started=true;}
    if(a.started)a.run.timeScale=motion.stride;
    a.pose(dt,motion,state.locked);a.shell.rotation.z=motion.roll;a.shell.position.y=motion.lift;
    if(go&&dt>0){old.copy(a.shell.position);approach.copy(player);const gap=Math.hypot(player.x-old.x,player.z-old.z);if(gap>1.7){const side=i?.43:-.43;approach.x+=(player.z-old.z)/gap*side;approach.z-=(player.x-old.x)/gap*side;if(!canStand(approach.x,approach.z))approach.copy(player);}const to=waypoint(old,approach),dist=Math.hypot(to.x-old.x,to.z-old.z),speed=motion.speed,step=Math.min(dist,speed*dt);if(dist>.001){a.forward.set((to.x-old.x)/dist,0,(to.z-old.z)/dist);a.shell.position.addScaledVector(a.forward,step);a.shell.rotation.y=Math.atan2(a.forward.x,a.forward.z);}
     state.approach(Math.hypot(a.shell.position.x-player.x,a.shell.position.z-player.z));
     if(sweptDistance(old,a.shell.position,player)<.72&&clear(a.shell.position,player)&&state.contact()){contactActor=i;onContact();}
    }
    particles(a,state.time,camera);
   });
   if(state.phase==='gameover'&&!shown){shown=true;group.visible=false;onGameOver();}
  },
  lookTarget(){return actors[contactActor].bones.Head.getWorldPosition(look);},
  diagnostics(){return {phase:state.phase,time:+state.time.toFixed(2),darkness:state.darkness,particleCount:actors.reduce((n,a)=>n+a.phases.length,0),actors:actors.map(a=>({position:a.shell.position.toArray(),running:a.started,animations:a.mixer.stats.actions.inUse}))};}
 };
}
