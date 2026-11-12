import * as THREE from 'three';

// Bake only the two silhouettes, then blur their alpha. The room and doll stay sharp.
export function createSoftFarewellShadow(renderer,shell,height){
 const width=1.2,frameHeight=2.16,centerY=1.02;
 const renderScene=new THREE.Scene(),position=shell.position.clone();shell.removeFromParent();shell.position.set(0,0,0);renderScene.add(shell);
 const camera=new THREE.OrthographicCamera(-width/2,width/2,frameHeight/2,-frameHeight/2,.1,10);camera.position.set(0,centerY,-4);camera.lookAt(0,centerY,0);
 const targets=Array.from({length:3},()=>new THREE.WebGLRenderTarget(256,512,{depthBuffer:false}));

 const quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{source:{value:targets[0].texture},stepUV:{value:new THREE.Vector2()}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source;uniform vec2 stepUV;varying vec2 vUv;void main(){float a=texture2D(source,vUv).a*.227027; a+=(texture2D(source,vUv+stepUV*1.384615).a+texture2D(source,vUv-stepUV*1.384615).a)*.316216; a+=(texture2D(source,vUv+stepUV*3.230769).a+texture2D(source,vUv-stepUV*3.230769).a)*.070270;gl_FragColor=vec4(0.,0.,0.,a);}',toneMapped:false});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quadScene.add(quad);
 function refresh(){
  const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),xr=renderer.xr.enabled;
  try{renderer.xr.enabled=false;renderScene.updateMatrixWorld(true);material.uniforms.source.value=targets[0].texture;
   renderer.setClearColor(0x000000,0);renderer.setRenderTarget(targets[0]);renderer.clear();renderer.render(renderScene,camera);
   material.uniforms.stepUV.value.set(5/256,0);renderer.setRenderTarget(targets[1]);renderer.clear();renderer.render(quadScene,quadCamera);
   material.uniforms.source.value=targets[1].texture;material.uniforms.stepUV.value.set(0,5/512);renderer.setRenderTarget(targets[2]);renderer.clear();renderer.render(quadScene,quadCamera);
  }finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);renderer.xr.enabled=xr;}
 }
 refresh();
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,frameHeight),new THREE.MeshBasicMaterial({map:targets[2].texture,transparent:true,opacity:.94,depthWrite:false,fog:false,side:THREE.DoubleSide,toneMapped:false}));mesh.position.copy(position);mesh.position.y=centerY;mesh.rotation.y=Math.PI;mesh.name='Soft farewell silhouette';mesh.userData.shadowRenderTarget=targets[2];mesh.userData.refresh=refresh;mesh.userData.shell=shell;return mesh;
}
