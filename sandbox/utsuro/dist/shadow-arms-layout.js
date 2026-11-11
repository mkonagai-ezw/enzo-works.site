// The empty eight-mat room, diagonally opposite the table room.
export const shadowArmRoom={
 name:'奥の和室',center:[-2.23,.672,2.39],
 camera:[-2.08,1.8,3.18],target:[-2.88,1.65,1.73],
 bounds:{minX:-4.03,maxX:-.44,minZ:.70,maxZ:4.20},
 emergenceWaves:[0,1.2,2.8,4.5,6.4,8.5,10.8,13.2]
};
export function createShadowArmPlacements(){
 const placements=[];
 for(let i=0;i<20;i++){
  const side=i%4,k=Math.floor(i/4),u=(k+.35+(i%3)*.08)/5;
  let x,z;
  if(side===0){x=.06+u*2.9;z=-2.78+Math.sin(i*2)*.1;}
  if(side===1){x=.08+Math.sin(i)*.07;z=-2.6+u*2.7;}
  if(side===2){x=2.9+Math.sin(i)*.06;z=-2.7+u*2.6;}
  if(side===3){x=.15+u*2.7;z=.14+Math.sin(i)*.07;}
  x-=3.73;z+=3.73;
  for(const ceiling of [false,true]){
   const n=placements.length,order=(n*17)%40,wave=Math.floor(order/5);
   placements.push({position:[x+(ceiling?.11:0),ceiling?3.082:.63,z+(ceiling?-.12:0)],ceiling,
    scale:(ceiling?.48:.55)+(n%5)*.045,
    yaw:Math.atan2(shadowArmRoom.center[0]-x,shadowArmRoom.center[2]-z)+(n%3-1)*.25,
    // Spatially shuffled waves, with increasing quiet intervals and no floor/ceiling pairs.
    delay:shadowArmRoom.emergenceWaves[wave]+(order%5)*.22+(n%3)*.047,
    phase:(n*1.731)%8,speed:.65+(n%7)*.081});
  }
 }
 return placements;
}
