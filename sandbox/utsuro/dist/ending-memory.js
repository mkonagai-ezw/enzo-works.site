// Predecoded once, driven by the cinematic clock (including pause and QA seeks).
export async function createEndingMemory(){
 const image=new Image();image.alt='縁側で笑う夫婦と、人形を抱いた娘';image.src='assets/ending/family-memory-v1.webp';await image.decode();
 const overlay=document.createElement('div');overlay.id='endingMemory';overlay.hidden=true;
 const frame=document.createElement('div');frame.className='hintPicture';
 const tears=document.createElement('canvas');tears.width=768;tears.height=512;tears.className='hintTears';
 const grain=document.createElement('canvas');grain.width=192;grain.height=128;grain.className='hintNoise';
 frame.append(image,tears);overlay.append(frame,grain);document.body.append(overlay);
 const ctx=tears.getContext('2d'),noise=grain.getContext('2d'),pixels=noise.createImageData(192,128),reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=-1;
 return {reset(){overlay.hidden=true;last=-1;},update(state){
  overlay.hidden=!state.memoryVisible;if(overlay.hidden)return;
  const t=state.memoryTime,step=Math.floor(t*(reduced.matches?4:12));if(step===last)return;last=step;
  const burst=!reduced.matches&&(t<.65||t>5.45||(t>2.5&&t<2.75));
  frame.style.opacity=String(Math.min(1,t/.18,(6-t)/.35));overlay.style.setProperty('--noise-strength',burst?'.32':'.10');
  for(let i=0;i<pixels.data.length;i+=4){const v=Math.random()*220;pixels.data.set([v,v,v,255],i);}noise.putImageData(pixels,0,0);ctx.clearRect(0,0,768,512);
  frame.style.transform=burst?`translateX(${Math.sin(step*7)*5}px)`:'';
  if(reduced.matches)return;
  for(let n=0;n<(burst?16:2);n++){const y=Math.random()*490,h=3+Math.random()*(burst?18:3),x=(Math.random()-.5)*(burst?95:12);ctx.drawImage(image,0,y/512*image.height,image.width,h/512*image.height,x,y,768,h);ctx.fillStyle=n%2?'#79999966':'#995e7766';ctx.fillRect(x,y,768,1);}
 }};
}
