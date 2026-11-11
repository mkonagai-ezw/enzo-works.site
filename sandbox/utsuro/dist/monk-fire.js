import * as THREE from 'three';
// Kenney Particle Pack (CC0): layered flame sprites, smoke and ember points.
export async function createMonkFire(scene,base,mobile=false){
 const loader=new THREE.TextureLoader(),maps=await Promise.all(['flame_01','flame_02','flame_03','smoke_01'].map(n=>loader.loadAsync('assets/fire/'+n+'.png')));
 const group=new THREE.Group();group.name='Monk ritual fire';group.position.copy(base);group.visible=false;scene.add(group);
 const flames=[],smoke=[];let seed=9401,time=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<(mobile?24:40);i++){
  const material=new THREE.SpriteMaterial({map:maps[i%3],color:0xff6d12,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const sprite=new THREE.Sprite(material);group.add(sprite);flames.push({sprite,phase:random(),angle:random()*Math.PI*2,radius:.12+random()*.27,life:.65+random()*.75,size:.24+random()*.25});
 }
 for(let i=0;i<(mobile?5:9);i++){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({alphaMap:maps[3],color:0x403b37,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));group.add(sprite);smoke.push({sprite,phase:random(),angle:random()*Math.PI*2});
 }
 const n=mobile?24:48,positions=new Float32Array(n*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const embers=new THREE.Points(geometry,new THREE.PointsMaterial({map:maps[3],size:.025,color:0xff8e32,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));group.add(embers);
 const light=new THREE.PointLight(0xff691a,0,5,2);light.position.set(0,.95,0);group.add(light);
 return {group,reset(){time=0;group.visible=false;light.intensity=0;},update(state,dt){
  group.visible=state.fireActive;if(!group.visible){time=0;light.intensity=0;return;}time+=dt;
  const strength=Math.min(1,time/1.2);
  for(const f of flames){const t=(time/f.life+f.phase)%1,a=f.angle+Math.sin(time*2+f.phase*9)*.2;
   f.sprite.position.set(Math.cos(a)*f.radius*(1-t*.35),.04+t*1.95,Math.sin(a)*f.radius*(1-t*.35));
   f.sprite.scale.set(f.size*(1-t*.5),f.size*(1.8+Math.sin(time*9+f.phase)*.25),1);
   f.sprite.material.rotation=Math.sin(time*3+f.phase*9)*.17;f.sprite.material.opacity=Math.sin(Math.PI*t)*.6*strength;
   f.sprite.material.color.setRGB(1,.16+.45*(1-t),.015+.06*(1-t));
  }
  for(const p of smoke){const t=(time*.22+p.phase)%1;p.sprite.position.set(Math.cos(p.angle)*(.12+t*.35),.8+t*1.35,Math.sin(p.angle)*.25);p.sprite.scale.setScalar(.42+t*.7);p.sprite.material.opacity=Math.sin(t*Math.PI)*.19*strength;}
  for(let i=0;i<n;i++){const t=(time*(.34+(i%7)*.025)+i/n)%1,a=i*2.4+time*.2;positions[i*3]=Math.cos(a)*(.18+t*.4);positions[i*3+1]=t*2.25;positions[i*3+2]=Math.sin(a)*(.18+t*.4);}geometry.attributes.position.needsUpdate=true;
  light.intensity=strength*(4.4+Math.sin(time*17)*.55+Math.sin(time*29)*.32);
 },diagnostics(){return {visible:group.visible,seconds:+time.toFixed(2),flames:flames.length,smoke:smoke.length};}};
}
