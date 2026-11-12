import * as THREE from 'three';

// Unity Labs FireBall01 (CC0), 8 x 8. A single expanding eruption, never loops.
export async function createIgnition(floorY=0){
 const texture=await new THREE.TextureLoader().loadAsync('assets/fire/ignition-fireball.webp');texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
 const plane=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=plane.index;geometry.setAttribute('position',plane.attributes.position);geometry.setAttribute('uv',plane.attributes.uv);geometry.instanceCount=3;
 geometry.setAttribute('center',new THREE.InstancedBufferAttribute(new Float32Array([0,.42,0,-.25,.87,0,.22,1.30,0]),3));
 geometry.setAttribute('offset',new THREE.InstancedBufferAttribute(new Float32Array([0,.065,.12]),1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:true,uniforms:{map:{value:texture},time:{value:0},strength:{value:1},floorY:{value:floorY}},vertexShader:`
 attribute vec3 center;attribute float offset;uniform float time;varying vec2 vUv;varying float age,worldHeight;
 // Put the visible shell of the burst on the camera-facing side of the body.
 // Keep depth testing so room geometry still occludes it correctly.
 void main(){age=max(0.,time-offset);float expand=.12+1.8*(1.-exp(-age*13.));vec3 towardCamera=vec3(modelViewMatrix[0][2],modelViewMatrix[1][2],modelViewMatrix[2][2]);vec3 anchor=center+vec3(0,age*.28,0)+towardCamera*.65;vec2 delta=position.xy*vec2(expand,expand*1.22);vec4 p=modelViewMatrix*vec4(anchor,1.);p.xy+=delta;
 worldHeight=(modelMatrix*vec4(anchor,1.)).y+delta.x*viewMatrix[1][0]+delta.y*viewMatrix[1][1];
 gl_Position=projectionMatrix*p;vUv=uv;}
 `,fragmentShader:`
 uniform sampler2D map;uniform float strength,floorY;varying vec2 vUv;varying float age,worldHeight;
 vec3 frame(float n){vec2 tile=vec2(mod(n,8.),7.-floor(n/8.));return texture2D(map,(tile+clamp(vUv,.004,.996))/8.).rgb;}
 void main(){if(worldHeight<floorY-.005)discard;float f=min(age*48.,63.);vec3 fire=mix(frame(floor(f)),frame(min(floor(f)+1.,63.)),fract(f));float fade=smoothstep(0.,.055,age)*(1.-smoothstep(.26,1.12,age));
 // Fade the emitted light before tone mapping so hot cores do not turn into gray discs.
 gl_FragColor=vec4(fire*vec3(4.,2.5,1.2)*strength*fade,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
 return {mesh,update(time,strength,enabled){mesh.visible=enabled&&time<1.3;material.uniforms.time.value=time;material.uniforms.strength.value=strength;}};
}
