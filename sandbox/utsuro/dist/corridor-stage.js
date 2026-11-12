import * as THREE from 'three';
import {corridorLightProfile} from './corridor-atmosphere.js?v=mobile-scares-1';
import {canStand} from './corridor-navigation.js';
import {cacheShadow,transformKey} from './performance-runtime.js?v=mobile-scares-1';
export async function createCorridorStage(loader,mobile){
 const [gltf,layout]=await Promise.all([loader.loadAsync('assets/corridor-block-01.glb'),fetch('assets/corridor-layout.json').then(r=>{if(!r.ok)throw Error('廊下の配置を読み込めません');return r.json();})]);
 let profile=corridorLightProfile(1);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x020202);scene.fog=new THREE.FogExp2(0x030303,profile.fog);const ambient=new THREE.HemisphereLight(0x92959f,0x3b2819,profile.ambient);scene.add(ambient);
 gltf.scene.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=!o.name.startsWith('Candlestick');}});scene.add(gltf.scene);
 const geo=new THREE.SphereGeometry(1,8,6),mat=new THREE.MeshBasicMaterial({color:0xffd49a,toneMapped:false});
 const flames=layout.lights.map(item=>{const flame=new THREE.Mesh(geo,mat);flame.position.fromArray(item.position);flame.position.y-=.028;flame.scale.set(.01,.032,.01);scene.add(flame);return {flame,phase:item.phase,position:new THREE.Vector3(...item.position)};});
 // All candle flames remain visible; mobile shades with only the four nearest lights.
 // Point-light shadows require six scene renders each. The flashlight retains room shadows.
 const lights=layout.lights.slice(0,mobile?4:layout.lights.length).map((_,i)=>{const l=new THREE.PointLight(0xffab58,profile.candlePower,profile.candleReach,2);l.castShadow=!mobile&&i<2;l.shadow.mapSize.set(1024,1024);l.shadow.bias=-.00015;l.shadow.normalBias=.025;l.shadow.camera.near=.08;l.shadow.camera.far=9;scene.add(l);return l;});
 let time=0,candlesLit=true,extinguishedThrough=-Infinity,memoryCut=1,memoryTarget=1,glimpseTime=0;
 const shadowCaches=lights.slice(0,2).map(cacheShadow);
 // Keep the renderer's light/shadow counts constant as candles go out. Changing
 // visibility recompiles lit materials during the rush, right when timing matters.
 function syncLights(camera){const nearest=flames.filter(c=>c.flame.visible).sort((a,b)=>a.position.distanceToSquared(camera.position)-b.position.distanceToSquared(camera.position));const casters=scene.children.filter(o=>o.isGroup&&o!==gltf.scene).map(o=>o.visible).join(',');for(let i=0;i<lights.length;i++){const c=nearest[i],l=lights[i];l.intensity=c?(glimpseTime>0?.25:1)*profile.candlePower*(1+.055*Math.sin(time*7.3+c.phase)+.025*Math.sin(time*17+c.phase)):0;if(c){l.position.copy(c.position);shadowCaches[i]?.sync(casters+transformKey(l));}}}
 return {scene,get lighting(){return profile;},
  setFloor(floor){memoryCut=memoryTarget=1;glimpseTime=0;candlesLit=true;extinguishedThrough=-Infinity;for(const c of flames)c.flame.visible=true;profile=corridorLightProfile(floor);ambient.intensity=profile.ambient;scene.fog.density=profile.fog;for(const light of lights)light.distance=profile.candleReach;},
  memoryRead(count){if(profile.floor===4)memoryTarget=count===1?-10:-20;if(profile.floor===3&&count===2)glimpseTime=.85;},
  architecture:gltf.scene,layout,spawn:layout.spawn,canStand:(x,z)=>canStand(layout,x,z),
  setCandlesLit(lit){candlesLit=!!lit;extinguishedThrough=lit?-Infinity:Infinity;memoryCut=memoryTarget=1;for(const c of flames)c.flame.visible=candlesLit;for(const l of lights)l.intensity=candlesLit?profile.candlePower:0;},
  updateEncounter(state,actors){if(!['rush','contact','gameover'].includes(state.phase)||state.time===0)return;extinguishedThrough=Math.max(extinguishedThrough,state.darkness===1?Infinity:Math.max(...actors.map(a=>a.shell.position.z))+.5);for(const c of flames)c.flame.visible=c.position.z>extinguishedThrough;candlesLit=flames.some(c=>c.flame.visible);},
  diagnostics(){return {lighting:profile,candlesLit,memoryCut,glimpseTime,visibleFlames:flames.filter(c=>c.flame.visible).length,lightSlots:lights.length,shadowLights:lights.filter(l=>l.castShadow).length,litLights:lights.filter(l=>l.visible&&l.intensity>0).length};},
  update(dt,camera){time+=dt;glimpseTime=Math.max(0,glimpseTime-dt);memoryCut=Math.max(memoryTarget,memoryCut-dt*7);for(const c of flames)c.flame.visible=c.position.z>extinguishedThrough&&c.position.z<=memoryCut;candlesLit=flames.some(c=>c.flame.visible);syncLights(camera);for(const c of flames){c.flame.scale.y=.032*(1+.1*Math.sin(time*9+c.phase));c.flame.rotation.z=.1*Math.sin(time*4.8+c.phase);}}
 };
}
