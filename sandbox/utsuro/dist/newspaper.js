import * as THREE from './vendor/three.module.js';
export const NEWSPAPER_POSITION=[2.62,0,-2.65];
export const NEWSPAPER_IMAGE='assets/newspaper/missing-children.webp?v=layout-2';
export async function createNewspaper(surfaceHeight){
 const [article,texture]=await Promise.all([
  fetch('assets/newspaper/article.json').then(r=>{if(!r.ok)throw Error('新聞記事を読み込めません');return r.json();}),
  new THREE.TextureLoader().loadAsync(NEWSPAPER_IMAGE)
 ]);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const geometry=new THREE.PlaneGeometry(.48,.48*1100/900,12,16),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,.004+.014*Math.pow(Math.abs(x)/.23,5)+.005*Math.sin(y*12)+.004*Math.exp(-Math.pow(x/.018,2)));}
 geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({map:texture,color:0xddd3bf,roughness:1,side:THREE.DoubleSide,alphaTest:.5});
 const paper=new THREE.Mesh(geometry,material);paper.name='Old newspaper - missing children';paper.rotation.set(-Math.PI/2,0,-.17);
 paper.position.fromArray(NEWSPAPER_POSITION);paper.position.y=surfaceHeight(paper.position.x,paper.position.z)+.012;paper.receiveShadow=true;
 return {paper,article,image:NEWSPAPER_IMAGE,text:[article.masthead+'　'+article.date,article.subtitle,...article.paragraphs].join('\n\n')};
}
