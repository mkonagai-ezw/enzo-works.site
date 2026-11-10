import * as THREE from './vendor/three.module.js';
export function createRain(scene){
  const count=7500,positions=new Float32Array(count*6),seeds=new Float32Array(count*2),ends=new Float32Array(count*2);
  for(let i=0;i<count;i++){const x=Math.random()*38-17,z=Math.random()*40-18,y=Math.random()*13;for(let j=0;j<2;j++){positions.set([x,y,z],i*6+j*3);seeds[i*2+j]=Math.random();ends[i*2+j]=j;}seeds[i*2+1]=seeds[i*2];}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('end',new THREE.BufferAttribute(ends,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},strength:{value:0},eye:{value:new THREE.Vector3()},direction:{value:new THREE.Vector3()},lamp:{value:0}},
    vertexShader:`attribute float seed;attribute float end;uniform float time;varying vec3 world;varying float tip;void main(){vec3 p=position;p.y=mod(p.y-time*(6.+seed*3.),13.);p.x+=sin(time*.4+seed)*.3;p.y+=end*.32;p.x+=end*.025;world=p;tip=end;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float strength;uniform vec3 eye;uniform vec3 direction;uniform float lamp;varying vec3 world;varying float tip;void main(){if(world.y<0.02)discard;if(world.x>-4.8&&world.x<4.9&&world.z>-6.65&&world.z<5.65&&world.y<5.5)discard;vec3 d=world-eye;float dist=length(d);float beam=smoothstep(.88,.98,dot(normalize(d),direction))*lamp*exp(-dist*.16);float a=strength*(.13+beam*.48)*exp(-dist*.045)*mix(.4,1.,tip);gl_FragColor=vec4(vec3(.62,.72,.76)+beam*.2,a);}`});
  const mesh=new THREE.LineSegments(geometry,material);mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  let intensity=0,time=0;
  return {reset(){intensity=0;time=0;mesh.visible=false;material.uniforms.strength.value=0;},update(dt,enabled,camera,flashOn){intensity=THREE.MathUtils.damp(intensity,enabled?1:0,1.5,dt);if(enabled)time+=dt;mesh.visible=intensity>.005;material.uniforms.time.value=time;material.uniforms.strength.value=intensity;material.uniforms.eye.value.copy(camera.position);camera.getWorldDirection(material.uniforms.direction.value);material.uniforms.lamp.value=flashOn?1:0;}};
}
