export function canStand(layout,x,z){
 const radius=.21;
 for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
  if(!layout.walkable.some(([xmin,xmax,zmin,zmax])=>x+dx>=xmin&&x+dx<=xmax&&z+dz>=zmin&&z+dz<=zmax))return false;
 }
 return !layout.lights.some(l=>Math.hypot(x-l.position[0],z-l.position[2])<.29);
}
