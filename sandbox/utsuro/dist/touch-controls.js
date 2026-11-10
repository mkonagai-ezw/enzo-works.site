export function stickVector(dx,dy,radius=45){
 const length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;
 const x=dx*scale/radius,z=-dy*scale/radius;
 return length<radius*.12?{x:0,z:0}:{x,z};
}
export function createTouchStick(pad,knob,enabled){
 const axes={x:0,z:0};let pointer=null,center={x:0,y:0};
 const reset=()=>{pointer=null;axes.x=0;axes.z=0;knob.style.transform='translate(-50%,-50%)';};
 const move=e=>{if(e.pointerId!==pointer)return;e.preventDefault();Object.assign(axes,stickVector(e.clientX-center.x,e.clientY-center.y));knob.style.transform=`translate(calc(-50% + ${axes.x*40}px),calc(-50% - ${axes.z*40}px))`;};
 pad.addEventListener('pointerdown',e=>{if(!enabled()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;const r=pad.getBoundingClientRect();center={x:r.left+r.width/2,y:r.top+r.height/2};pad.setPointerCapture(pointer);move(e);});
 pad.addEventListener('pointermove',move);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{if(e.pointerId===pointer)reset();});
 return {axes,reset};
}
