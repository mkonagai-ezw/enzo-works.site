import * as THREE from 'three';

// Small cooling fragments, plus a short one-shot spray at ignition. One GPU draw.
export function createEmbers(count=144){
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
 geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.instanceCount=count;
 let seed=23971;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const seeds=new Float32Array(count*4);for(let i=0;i<seeds.length;i++)seeds[i]=random();geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{time:{value:0},strength:{value:1},density:{value:1},ignition:{value:1}},vertexShader:`
 attribute vec4 seed;uniform float time,strength,density,ignition;varying vec2 vUv;varying vec3 tint;varying float opacity;
 float hash(float n){return fract(sin(n)*43758.5453);}
 vec3 path(float age,float life,float cycle,bool burst){
  float a=seed.x*6.283+hash(cycle+seed.y*91.)*1.7;
  float r=.16+seed.z*.18;float ageS=age*life;
  if(burst){float reach=(.5+seed.y*1.3)*(1.-exp(-ageS*2.));return vec3(cos(a)*(r+reach),.45+seed.z*.65+(2.+seed.y*1.7)*ageS-1.7*ageS*ageS,sin(a)*(r+reach));}
  vec3 p=vec3(cos(a)*r,.12+seed.w*1.05,sin(a)*r);
  p.y+=ageS*(.65+seed.y*.6)-.09*ageS*ageS;
  p.x+=sin(ageS*2.1+a)*.07*ageS+cos(a)*ageS*(.06+seed.x*.15);
  p.z+=cos(ageS*1.7+a)*.08*ageS+sin(a)*ageS*.11;
  return p;
 }
 void main(){
  bool burst=seed.w>.78;float life=burst?(.75+seed.y*.95):(1.35+seed.y*2.0);
  float clock=burst?max(0.,time-.04-seed.z*.14):time+seed.z*life;
  float age=burst?clock/life:fract(clock/life);float cycle=burst?0.:floor(clock/life);
  float living=burst?step(time,.04+seed.z*.14+life)*step(.04+seed.z*.14,time)*ignition*min(density,1.):step(seed.w,density*.7);
  vec3 world=path(age,life,cycle,burst),past=path(max(0.,age-.012),life,cycle,burst);
  vec4 center=modelViewMatrix*vec4(world,1.);vec4 previous=modelViewMatrix*vec4(past,1.);
  vec2 direction=normalize(center.xy-previous.xy+vec2(.00001,.00002));vec2 side=vec2(direction.y,-direction.x);
  float size=.009+pow(seed.x,3.)*.018;float streak=1.+(burst?2.4:1.0)*seed.z;
  center.xy+=side*position.x*size+direction*position.y*size*streak;
  gl_Position=projectionMatrix*center;vUv=uv;
  float fade=smoothstep(0.,.08,age)*(1.-smoothstep(.48,1.,age));
  float flutter=.66+.34*pow(sin(time*(9.+seed.y*11.)+seed.x*18.),2.);
  opacity=living*fade*flutter*strength*smoothstep(0.,.16,time)*step(0.,world.y);
  tint=mix(vec3(1.,.63,.19),vec3(.55,.025,.002),smoothstep(.1,.95,age));
 }
 `,fragmentShader:`varying vec2 vUv;varying vec3 tint;varying float opacity;
 void main(){vec2 p=(vUv-.5)*2.;float radius=dot(p,p);float halo=exp(-radius*4.7),core=1.-smoothstep(.06,.48,radius);float mask=core*.8+halo*.23;gl_FragColor=vec4(tint,mask*opacity);
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 return {mesh,count,update(time,strength,density,ignition){Object.assign(material.uniforms.time,{value:time});material.uniforms.strength.value=strength;material.uniforms.density.value=density;material.uniforms.ignition.value=ignition?1:0;}};
}
