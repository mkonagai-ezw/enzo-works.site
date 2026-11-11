import * as THREE from 'three';
// One draw per texture, retaining individual sprite colors, rotation and opacity.
export function createBillboardBatch(map,count,{alphaOnly=false,additive=false}={}){
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.instanceCount=count;
 const arrays={center:new Float32Array(count*3),size:new Float32Array(count*2),turn:new Float32Array(count),tint:new Float32Array(count*3),opacity:new Float32Array(count)};
 for(const [name,values] of Object.entries(arrays))geometry.setAttribute('i'+name,new THREE.InstancedBufferAttribute(values,name==='center'||name==='tint'?3:name==='size'?2:1).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,fog:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),map:{value:map},alphaOnly:{value:alphaOnly?1:0}},vertexShader:`#include <fog_pars_vertex>
 attribute vec3 icenter,itint;attribute vec2 isize;attribute float iturn,iopacity;varying vec2 vUv;varying vec3 tint;varying float opacity;void main(){vec2 p=position.xy*isize;float c=cos(iturn),s=sin(iturn);p=mat2(c,s,-s,c)*p;vec4 center=modelViewMatrix*vec4(icenter,1.);center.xy+=p;vec4 mvPosition=center;gl_Position=projectionMatrix*center;
 #include <fog_vertex>
 vUv=uv;tint=itint;opacity=iopacity;}`,fragmentShader:`#include <fog_pars_fragment>
 uniform sampler2D map;uniform float alphaOnly;varying vec2 vUv;varying vec3 tint;varying float opacity;void main(){vec4 t=texture2D(map,vUv);gl_FragColor=vec4(tint*mix(t.rgb,vec3(1.),alphaOnly),opacity*mix(t.a,t.g,alphaOnly));
 #include <colorspace_fragment>
 #include <fog_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 const sprites=Array.from({length:count},()=>({position:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1),material:{color:new THREE.Color(),rotation:0,opacity:0}}));
 return {mesh,sprites,sync(){sprites.forEach((s,i)=>{s.position.toArray(arrays.center,i*3);arrays.size.set([s.scale.x,s.scale.y],i*2);arrays.turn[i]=s.material.rotation;arrays.opacity[i]=s.material.opacity;s.material.color.toArray(arrays.tint,i*3);});for(const name of Object.keys(arrays))geometry.attributes['i'+name].needsUpdate=true;}};
}
