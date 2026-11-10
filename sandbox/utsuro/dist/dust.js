import * as THREE from 'three';

// World-space motes: the house depth buffer hides dust behind walls and furniture.
export function createDust(scene) {
 const count=1800,positions=new Float32Array(count*3),seeds=new Float32Array(count);
 let state=91823;
 const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<count;i++){
  const nearTable=i<650;
  positions[i*3]=(nearTable?-.1:-4.0)+random()*(nearTable?3.3:8.2);
  positions[i*3+1]=.88+random()*2.65;
  positions[i*3+2]=(nearTable?-3.1:-5.7)+random()*(nearTable?3.5:10.8);
  seeds[i]=random();
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
 const uniforms={time:{value:0},beamPosition:{value:new THREE.Vector3()},beamDirection:{value:new THREE.Vector3()},beamOn:{value:0},pixelRatio:{value:1}};
 const material=new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
  vertexShader:`
   attribute float seed;
   uniform float time,pixelRatio,beamOn;
   uniform vec3 beamPosition,beamDirection;
   varying float glow;
   void main(){
    float phase=seed*62.83185;
    vec3 p=position;
    p.x+=.085*sin(time*.13+phase)+.025*sin(time*.29+phase*3.);
    p.y+=.12*sin(time*.095+phase*1.7);
    p.z+=.075*cos(time*.11+phase*2.1);
    vec3 delta=p-beamPosition;
    float distanceToBeam=length(delta);
    float cone=smoothstep(.89,.965,dot(normalize(delta),beamDirection));
    float beam=cone*exp(-distanceToBeam*.28)*beamOn;
    vec4 viewPosition=modelViewMatrix*vec4(p,1.);
    float proximity=smoothstep(.35,.85,-viewPosition.z);
    float variation=.58+.42*sin(phase+time*.3)*sin(phase+time*.3);
    glow=(.008+beam*.65)*proximity*variation;
    gl_PointSize=clamp((1.5+seed*2.)*pixelRatio*2.5/max(.8,-viewPosition.z),.8,5.*pixelRatio);
    gl_Position=projectionMatrix*viewPosition;
   }`,
  fragmentShader:`
   varying float glow;
   void main(){
    float radius=length(gl_PointCoord-.5)*2.;
    float soft=exp(-radius*radius*4.)*(1.-smoothstep(.75,1.,radius));
    float alpha=soft*glow;
    if(alpha<.002)discard;
    gl_FragColor=vec4(.78,.77,.66,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const points=new THREE.Points(geometry,material);points.name='Indoor drifting dust';points.frustumCulled=false;points.renderOrder=2;scene.add(points);
 return {count,update(time,flashPosition,flashDirection,on,pixelRatio){
  uniforms.time.value=time;uniforms.beamPosition.value.copy(flashPosition);uniforms.beamDirection.value.copy(flashDirection);uniforms.beamOn.value=on?1:0;uniforms.pixelRatio.value=pixelRatio;
 }};
}
