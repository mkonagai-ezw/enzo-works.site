import * as THREE from 'three';
import {createBillboardBatch} from './billboard-batch.js';
import {createEmbers} from './monk-fire-embers.js';
import {createIgnition} from './monk-fire-ignition.js';

// Approved B: Unity Labs CC0 Flame03, repacked as a 16 x 8 atlas.
export function flameBatch(texture,items){
 const plane=new THREE.PlaneGeometry(1,1),geo=new THREE.InstancedBufferGeometry();geo.index=plane.index;
 geo.setAttribute('position',plane.attributes.position);geo.setAttribute('uv',plane.attributes.uv);geo.instanceCount=items.length;
 for(const [name,size,get] of [['anchor',3,p=>p.at],['scale',2,p=>p.size],['phase',1,p=>[p.phase]],['rate',1,p=>[p.rate]],['gain',1,p=>[p.gain]],['birth',1,p=>[p.birth??-100]],['angle',1,p=>[p.angle??0]]])geo.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(get)),size));
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:true,uniforms:{atlas:{value:texture},clock:{value:0},strength:{value:1},grid:{value:new THREE.Vector2(16,8)},fps:{value:16},atlasSize:{value:new THREE.Vector2(texture.image.width,texture.image.height)}},vertexShader:`
 attribute vec3 anchor;attribute vec2 scale;attribute float phase,rate,gain,birth,angle;uniform float clock;
 varying vec2 vUv;varying float vPhase,vRate,vGain,vAge;
 void main(){vec4 p=modelViewMatrix*vec4(anchor,1.);vec2 q=vec2(position.x*scale.x,(position.y+.5)*scale.y);p.xy+=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*q;gl_Position=projectionMatrix*p;vUv=uv;vPhase=phase;vRate=rate;vGain=gain;vAge=clock-birth;}`,
 fragmentShader:`
 uniform sampler2D atlas;uniform float clock,strength,fps;uniform vec2 atlasSize,grid;
 varying vec2 vUv;varying float vPhase,vRate,vGain,vAge;
 vec3 frame(float f){vec2 tile=vec2(mod(f,grid.x),grid.y-1.-floor(f/grid.x));vec2 margin=.5/atlasSize;vec2 p=(tile+vUv)/grid;p=clamp(p,tile/grid+margin,(tile+1.)/grid-margin);return texture2D(atlas,p).rgb;}
 vec3 interpolated(float f){float count=grid.x*grid.y;return mix(frame(floor(f)),frame(mod(floor(f)+1.,count)),fract(f));}
 void main(){if(vAge<0.)discard;float count=grid.x*grid.y;float t=mod(clock*fps*vRate+vPhase,count-8.);vec3 color=interpolated(t+8.);if(t>count-16.)color=mix(color,interpolated(t-(count-16.)),smoothstep(count-16.,count-8.,t));
 float edge=smoothstep(0.,.06,vUv.x)*smoothstep(0.,.06,1.-vUv.x)*smoothstep(0.,.20,vUv.y)*smoothstep(0.,.04,1.-vUv.y);
 gl_FragColor=vec4(color*vGain*strength*1.25,edge*.8*smoothstep(0.,.85,vAge));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;return mesh;
}
export async function createMonkFire(scene,base,mobile=false){
 const loader=new THREE.TextureLoader();const [b,smokeMap]=await Promise.all([loader.loadAsync('assets/fire/flame03-hq.webp'),loader.loadAsync('assets/fire/smoke_01.png')]);
 for(const map of [b]){map.colorSpace=THREE.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;}
 const group=new THREE.Group();group.name='Monk ritual fire';group.position.copy(base);group.rotation.y=Math.PI/2;group.visible=false;scene.add(group);
 const layers=[
  {at:[-.22,-.06,-.10],size:[1.05,2.45],phase:0,rate:.91,gain:.9},
  {at:[.25,-.04,-.06],size:[.96,2.25],phase:26,rate:1.09,gain:.8},
  {at:[0,.34,-.19],size:[1.1,2.5],phase:43,rate:.87,gain:.8},
  {at:[-.29,.48,.09],size:[.66,1.8],phase:17,rate:1.16,gain:.58},
  {at:[.29,.6,.08],size:[.64,1.65],phase:38,rate:.97,gain:.62},
  {at:[-.14,-.025,.43],size:[.64,1.65],phase:51,rate:1.04,gain:.52},
  {at:[.18,-.015,.42],size:[.61,1.6],phase:12,rate:.94,gain:.5},
  {at:[.02,.64,.39],size:[.5,1.3],phase:32,rate:1.12,gain:.35},
 ];
 const flames=flameBatch(b,layers);group.add(flames);
 const smoke=createBillboardBatch(smokeMap,7,{alphaOnly:true});group.add(smoke.mesh);
 smoke.sprites.forEach(s=>s.material.color.set('#181a1c'));
 const embers=createEmbers(),ignition=await createIgnition(base.y);group.add(embers.mesh,ignition.mesh);
 const light=new THREE.PointLight('#ff9c43',0,5,2);light.position.set(.12,.68,.5).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2).add(base);light.visible=false;scene.add(light);
 let time=0;
 function reset(){time=0;group.visible=false;light.visible=false;light.intensity=0;ignition.mesh.visible=true;}
 return {group,light,reset,update(state,dt){
  if(!state.fireActive){if(time||group.visible)reset();return;}
  const strength=1.6,speed=1.4,emberDensity=1.6,burst=true;
  group.visible=true;light.visible=true;time+=dt*speed;
  const onset=THREE.MathUtils.smoothstep(time,burst?.08:0,burst?.62:2.2),gain=onset*strength;
  flames.material.uniforms.clock.value=time;flames.material.uniforms.strength.value=gain;flames.material.uniforms.fps.value=24;
  for(let i=0;i<smoke.sprites.length;i++){const s=smoke.sprites[i],t=(time*.16+i*.143)%1;s.position.set(Math.sin(i*2.4+time*.3)*(.1+t*.23),1.1+t*1.45,-.08+Math.cos(i*2.4)*.13);s.scale.set(.44+t*.55,.6+t*.75,1);s.material.rotation=i*.8+time*.04;s.material.opacity=Math.sin(t*Math.PI)*.23*gain;}
  smoke.sync();embers.update(time,strength,emberDensity,burst);ignition.update(time,strength,burst);
  const pulse=burst?THREE.MathUtils.smoothstep(time,0,.065)*(1.-THREE.MathUtils.smoothstep(time,.14,.85))*9:0;
  light.intensity=gain*(2.1+Math.sin(time*13.1)*.14+Math.sin(time*23.4)*.09)+pulse*strength;
 },diagnostics(){return {visible:group.visible,seconds:+(time/1.4).toFixed(2),time:+time.toFixed(2),strength:1.6,speed:1.4,emberDensity:1.6,flames:layers.length,emberSlots:embers.count,ignitionVisible:group.visible&&ignition.mesh.visible,batches:group.visible?(ignition.mesh.visible?4:3):0};}};
}
