// Share decoded embedded images across GLBs. Texture clones keep sampler/UV/color
// space settings independent while sharing the same Three.js Source/GPU cache.
export function shareGLTFImages(loader){
 const cache=new Map();let reused=0,unique=0;
 loader.register(parser=>{
  const original=parser.loadImageSource.bind(parser),local=new Map();
  parser.loadImageSource=(index,imageLoader)=>{
   const def=parser.json.images[index];
   if(def.bufferView===undefined||!globalThis.crypto?.subtle)return original(index,imageLoader);
   if(!local.has(index))local.set(index,(async()=>{
    const bytes=await parser.getDependency('bufferView',def.bufferView),digest=await crypto.subtle.digest('SHA-256',bytes);
    const key=def.mimeType+':'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    if(!cache.has(key)){unique++;const pending=original(index,imageLoader);cache.set(key,pending);pending.catch(()=>cache.delete(key));}else reused++;
    return cache.get(key);
   })());
   return local.get(index).then(texture=>texture.clone());
  };
  return {name:'ENZO_shared_images'};
 });
 return {diagnostics:()=>({unique,reused})};
}
