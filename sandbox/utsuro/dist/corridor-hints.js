export const HINT_IMAGES=Object.freeze(Array.from({length:8},(_,i)=>`assets/corridor-hints/hint-${String(i+1).padStart(2,'0')}-v${i===4?2:1}.webp`));
export class CorridorHintState{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.floor=1;this.time=0;}
 begin(floor){if(this.locked||!Number.isInteger(floor)||!HINT_IMAGES[floor-1])return false;this.floor=floor;this.phase='loading';this.time=0;return true;}
 ready(){if(this.phase==='loading')this.phase='showing';}
 tick(dt,active){if(this.phase==='showing'&&active){this.time+=Math.max(0,dt);if(this.time>=6)this.phase='complete';}}
 get locked(){return this.phase==='loading'||this.phase==='showing';}
}
export function createCorridorHints({onComplete,onError}){
 const state=new CorridorHintState(),cache=new Map();let generation=0;
 const overlay=document.createElement('section');overlay.id='corridorHint';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','人形が見せた絵');
 const frame=document.createElement('div');frame.className='hintPicture';
 const grain=document.createElement('canvas');grain.width=384;grain.height=256;grain.className='hintNoise';grain.setAttribute('aria-hidden','true');
 const ctx=grain.getContext('2d'),pixels=ctx.createImageData(384,256);let noiseTime=0;
 overlay.append(frame,grain);document.body.append(overlay);
 function preload(floor){
  const path=HINT_IMAGES[floor-1];if(!path)return Promise.resolve(null);if(cache.has(path))return cache.get(path);
  const promise=new Promise((resolve,reject)=>{
   const img=new Image();img.alt='古い紙に描かれた子供の絵';img.draggable=false;
   const timer=setTimeout(()=>reject(new Error('Hint image load timeout')),15000);
   img.onload=async()=>{try{await img.decode();resolve(img);}catch(e){reject(e);}finally{clearTimeout(timer);}};
   img.onerror=()=>{clearTimeout(timer);reject(new Error('Hint image load failed'));};img.src=path;
  });cache.set(path,promise);promise.catch(()=>cache.delete(path));return promise;
 }
 function hide(){overlay.hidden=true;document.body.classList.remove('viewing-hint');frame.replaceChildren();}
 return {state,
  prepare(floor){preload(floor).catch(()=>{});preload(floor+1).catch(()=>{});},
  async begin(floor){
   if(!state.begin(floor))return false;const token=++generation;overlay.hidden=false;overlay.dataset.phase='loading';document.body.classList.add('viewing-hint');
   try{const img=await preload(floor);if(token!==generation)return false;frame.replaceChildren(img);state.ready();overlay.dataset.phase='showing';return true;}
   catch(e){if(token===generation){state.reset();hide();onError(e);}return false;}
  },
  reset(){generation++;state.reset();hide();},
  update(dt,active){
   state.tick(dt,active);
   if(state.phase==='complete'){hide();state.phase='idle';onComplete();return;}
   if(!state.locked)return;
   const t=state.time;if(state.phase==='showing')overlay.dataset.phase=t<.25?'entering':t>5.55?'leaving':'visible';frame.style.opacity=String(Math.min(1,t/.2,(6-t)/.45));
   if(!active)return;noiseTime+=dt;if(noiseTime<.075)return;noiseTime=0;
   for(let i=0;i<pixels.data.length;i+=4){const v=Math.random()*255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=45;}
   ctx.putImageData(pixels,0,0);overlay.style.setProperty('--noise-strength',String(t<.25||t>5.55?.8:.18));
  },
  diagnostics(){return {phase:state.phase,floor:state.floor,time:+state.time.toFixed(2),image:HINT_IMAGES[state.floor-1]};}
 };
}
