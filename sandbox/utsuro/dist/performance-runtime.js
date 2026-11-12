// A broad phase only: callers still perform their exact 3D intersection checks.
export class SpatialBoxes {
 constructor(boxes=[],size=2){this.size=size;this.cells=new Map();this.large=[];for(const box of boxes)this.add(box);}
 add(box){const s=this.size,x0=Math.floor(box.min.x/s),x1=Math.floor(box.max.x/s),z0=Math.floor(box.min.z/s),z1=Math.floor(box.max.z/s);if((x1-x0+1)*(z1-z0+1)>256){this.large.push(box);return;}for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(box);}}
 query(minX,maxX,minZ,maxZ){const result=new Set(this.large),s=this.size;for(let x=Math.floor(minX/s);x<=Math.floor(maxX/s);x++)for(let z=Math.floor(minZ/s);z<=Math.floor(maxZ/s);z++)for(const box of this.cells.get(x+','+z)||[])result.add(box);return result;}
}

// Visual sequences must not consume unseen frames after a stall.
export function cinematicFrameDelta(dt){return Number.isFinite(dt)?Math.max(0,Math.min(dt,1/30)):0;}

export function cacheShadow(light){
 light.shadow.autoUpdate=false;let previous=null,updates=0;
 return {sync(key){if(!light.castShadow)return false;if(key!==previous||!light.shadow.map){light.shadow.needsUpdate=true;previous=key;updates++;return true;}return false;},invalidate(){previous=null;},get updates(){return updates;}};
}
export function transformKey(object){if(!object)return '';const p=object.position,q=object.quaternion,s=object.scale;return [object.visible,p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z].join(',');}

// Slow decisions and hysteresis prevent resolution oscillation during a scare.
export class AdaptiveResolution {
 constructor(max,min){this.max=max;this.min=Math.min(min,max);this.value=max;this.reset();}
 reset(){this.seconds=0;this.frames=0;this.slow=0;this.fast=0;}
 sample(dt,active=true){if(!active||dt<=0||dt>.15){this.reset();return null;}this.seconds+=dt;this.frames++;if(this.seconds<3)return null;const ms=this.seconds/this.frames*1000;this.seconds=0;this.frames=0;this.slow=ms>28?this.slow+1:0;this.fast=ms<18?this.fast+1:0;let next=this.value;if(this.slow>=2){next=Math.max(this.min,this.value-.15);this.slow=0;}else if(this.fast>=5){next=Math.min(this.max,this.value+.1);this.fast=0;}next=Math.round(next*100)/100;if(next===this.value)return null;this.value=next;return next;}
}
export function setText(element,text){if(element.textContent!==text)element.textContent=text;}
export function setOpacity(element,value){const text=String(value);if(element.style.opacity!==text)element.style.opacity=text;}
