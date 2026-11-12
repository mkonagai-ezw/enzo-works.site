import {CorridorHintState,CORRIDOR_MEMORIES,HINT_IMAGES,HINT_DURATION} from './corridor-memory-state.js';
export {CorridorHintState,HINT_IMAGES} from './corridor-memory-state.js';
export function createCorridorHints({onComplete,onError}){
 const state=new CorridorHintState(),cache=new Map(),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');let generation=0,currentImage=null;
 const overlay=document.createElement('section');overlay.id='corridorHint';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','人形が見せた絵');
 const frame=document.createElement('div');frame.className='hintPicture';
 const grain=document.createElement('canvas');grain.width=384;grain.height=256;grain.className='hintNoise';grain.setAttribute('aria-hidden','true');
 const ctx=grain.getContext('2d'),pixels=ctx.createImageData(384,256);let noiseTime=0;
 const tears=document.createElement('canvas');tears.width=768;tears.height=512;tears.className='hintTears';tears.setAttribute('aria-hidden','true');const tearCtx=tears.getContext('2d');
 const skip=document.createElement('button');skip.className='hintSkip';skip.type='button';skip.textContent='先へ　›';skip.hidden=true;skip.onclick=()=>state.skip();
 overlay.append(frame,grain,skip);document.body.append(overlay);
 function preload(path){
  if(!path)return Promise.resolve(null);if(cache.has(path))return cache.get(path);
  const promise=new Promise((resolve,reject)=>{
   const img=new Image();img.alt='古い紙に描かれた子供の絵';img.draggable=false;
   const timer=setTimeout(()=>reject(new Error('Hint image load timeout')),15000);
   img.onload=async()=>{try{await img.decode();resolve(img);}catch(e){reject(e);}finally{clearTimeout(timer);}};
   img.onerror=()=>{clearTimeout(timer);reject(new Error('Hint image load failed'));};img.src=path;
  });cache.set(path,promise);promise.catch(()=>cache.delete(path));return promise;
 }
 function hide(){skip.hidden=true;overlay.hidden=true;document.body.classList.remove('viewing-hint');frame.replaceChildren();currentImage=null;noiseTime=0;frame.style.transform='';tearCtx.clearRect(0,0,768,512);}
 async function showImage(token){
  noiseTime=.1;frame.style.opacity='0';skip.hidden=true;overlay.style.setProperty('--noise-strength','.32');overlay.hidden=false;overlay.dataset.phase='loading';document.body.classList.add('viewing-hint');
  try{const img=await preload(state.path);if(token!==generation)return false;currentImage=img;frame.replaceChildren(img,tears);state.ready();skip.hidden=!state.canSkip;overlay.dataset.phase='showing';return true;}
  catch(e){if(token===generation){state.reset();hide();onError(e);}return false;}
 }
 return {state,
  prepare(floor){for(const f of [floor,floor+1])for(const id of CORRIDOR_MEMORIES[f-1]||[])preload(HINT_IMAGES[id]).catch(()=>{});},
  begin(floor,steps){if(!state.begin(floor,steps))return Promise.resolve(false);return showImage(++generation);},
  skip(){return state.skip();},
  reset(clearSeen=false){generation++;state.reset(clearSeen);hide();},
  update(dt,active){
   state.tick(dt,active);
   if(state.phase==='complete'){if(state.advance())showImage(++generation);else{hide();onComplete();}return;}
   if(!state.locked)return;
   const t=state.time;if(state.phase==='showing')overlay.dataset.phase=t<.25?'entering':t>HINT_DURATION-.45?'leaving':'visible';frame.style.opacity=String(Math.min(1,t/.2,(HINT_DURATION-t)/.45));
   if(!active)return;noiseTime+=dt;if(noiseTime<(reducedMotion.matches?.3:.083))return;noiseTime=0;
   // Strong tearing at the boundaries, with short interruptions between readable intervals.
   const burst=!reducedMotion.matches&&(t<.75||t>HINT_DURATION-.65||(t>1.65&&t<1.88)||(t>3.25&&t<3.5));
   overlay.dataset.glitch=burst?'strong':'settled';
   for(let i=0;i<pixels.data.length;i+=4){const v=Math.random()*210;pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v;pixels.data[i+3]=255;}
   ctx.putImageData(pixels,0,0);overlay.style.setProperty('--noise-strength',String(reducedMotion.matches?.12:burst?.32:.13));
   tearCtx.clearRect(0,0,768,512);frame.style.transform=reducedMotion.matches?'':`translate(${burst?(Math.random()-.5)*6:0}px,${burst?(Math.random()-.5)*2:0}px)`;
   if(!currentImage||reducedMotion.matches)return;
   const w=currentImage.naturalWidth,h=currentImage.naturalHeight;
   for(let n=0;n<(burst?15:3);n++){
    const y=Math.floor(Math.random()*492),height=burst?4+Math.floor(Math.random()*16):2+Math.floor(Math.random()*4),shift=(Math.random()-.5)*(burst?100:16);
    tearCtx.drawImage(currentImage,0,y/512*h,w,height/512*h,shift,y,768,height);
    // Thin coloured tracking edges and dark dropouts; never a full-screen flash.
    tearCtx.fillStyle=n%2?'rgba(93,151,150,.32)':'rgba(158,79,92,.32)';tearCtx.fillRect(shift,y,768,1);
    if(burst&&n%4===0){tearCtx.fillStyle='rgba(0,0,0,.6)';tearCtx.fillRect(0,y+height,768,2);}
   }
  },
  diagnostics(){return {phase:state.phase,floor:state.floor,time:+state.time.toFixed(2),image:state.path,memory:state.steps[state.index],seen:[...state.seen],canSkip:state.canSkip};}
 };
}
