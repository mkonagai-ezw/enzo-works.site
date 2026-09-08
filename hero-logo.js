import * as THREE from './vendor/three.module.min.js';

const hero=document.querySelector('.hero');
const art=hero.querySelector('.hero-art');
const host=art.querySelector('.hero-model');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try {
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    renderer.setClearColor(0,0);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.domElement.setAttribute('aria-hidden','true');
    host.append(renderer.domElement);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.1,80);
    const outline=[[0,300],[284,28],[754,28],[678,119],[342,119],[275,184],[577,196],[490,296],[169,296],[160,308],[257,417],[414,417],[543,298],[624,298],[633,415],[761,298],[849,298],[626,535],[540,535],[540,442],[528,431],[415,535],[205,535]];
    const shape=new THREE.Shape();
    outline.forEach(([x,y],i)=>shape[i?'lineTo':'moveTo']((x-425)/150,(282-y)/150));
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.65,bevelEnabled:true,bevelThickness:.075,bevelSize:.065,bevelSegments:5,steps:1});
    geometry.center();
    const face=new THREE.MeshPhysicalMaterial({color:0x27444b,metalness:1,roughness:.22,clearcoat:1,clearcoatRoughness:.14});
    const edge=new THREE.MeshPhysicalMaterial({color:0x879fa2,metalness:1,roughness:.17,clearcoat:1});
    const logo=new THREE.Mesh(geometry,[face,edge]);
    scene.add(logo);
    scene.add(new THREE.HemisphereLight(0xdcf8ff,0x3d555a,2));
    const light=new THREE.DirectionalLight(0xffffff,3); light.position.set(-3,5,5);scene.add(light);
    // Large reflection panels produce moving highlights over the bevels.
    const studio=new THREE.Scene();studio.background=new THREE.Color(0x334d55);
    for(const [x,y,z,w,h,c] of [[-4,3,4,3,8,0xffffff],[5,1,2,2,7,0xb6f0ed],[0,5,-4,8,3,0xffffff],[0,-4,2,10,3,0x172c32]]) {
        const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));
        panel.position.set(x,y,z);panel.lookAt(0,0,0);studio.add(panel);
    }
    const pmrem=new THREE.PMREMGenerator(renderer);
    const environment=pmrem.fromScene(studio,.03);scene.environment=environment.texture;pmrem.dispose();
    studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    let floatPaused=reduced.matches, visible=true, lost=false, raf=0,last=0,time=0,drag=null;
    let vx=0,vy=0;
    const reset=()=>{logo.rotation.set(.12,-.38,-.10);vx=vy=0;};
    reset();
    const allowed=()=>visible&&!document.hidden&&!lost&&!hero.classList.contains('intro-playing')&&!hero.classList.contains('intro-transition');
    const draw=()=>renderer.render(scene,camera);
    const tick=now=>{
        raf=0;if(!allowed())return;
        const dt=last?Math.min((now-last)/1000,.04):0;last=now;
        if(!floatPaused){
            time+=dt;logo.position.y=Math.sin(time*.85)*.12;
            if(!drag){
                logo.rotation.y+=vx*dt;logo.rotation.x+=vy*dt;
                vx*=Math.exp(-4*dt);vy*=Math.exp(-4*dt);
            }
        }
        draw();
        if(!floatPaused)raf=requestAnimationFrame(tick);
    };
    const sync=()=>{
        cancelAnimationFrame(raf);raf=0;last=0;
        if(allowed()){draw();if(!floatPaused)raf=requestAnimationFrame(tick);}
    };
    const resize=()=>{
        const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
        renderer.setSize(width,height);
        camera.aspect=width/height;
        // Fit the entire bounding sphere, even when the mark rotates vertically.
        const halfFov=Math.atan(Math.tan(34*Math.PI/360)*Math.min(1,camera.aspect));
        camera.position.set(0,0,3.5/Math.sin(halfFov));
        camera.updateProjectionMatrix();sync();
    };
    function release(e){
        if(!drag||e.pointerId!==drag.id)return;
        if(performance.now()-drag.at>100)vx=vy=0;
        if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
        drag=null;
    }
    host.addEventListener('pointerdown',e=>{
        if(drag||!allowed()||(e.pointerType==='mouse'&&e.button!==0))return;
        drag={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};
        vx=vy=0;host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});
    });
    host.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId)return;
        const now=performance.now(),dt=Math.max((now-drag.at)/1000,.016);
        const dx=(e.clientX-drag.x)*.009,dy=(e.clientY-drag.y)*.009;
        logo.rotation.y+=dx;logo.rotation.x+=dy;
        vx=THREE.MathUtils.clamp(dx/dt,-4,4);vy=THREE.MathUtils.clamp(dy/dt,-4,4);
        drag={id:e.pointerId,x:e.clientX,y:e.clientY,at:now};draw();
    });
    host.addEventListener('pointerup',release);
    host.addEventListener('pointercancel',e=>{release(e);vx=vy=0;});
    host.addEventListener('lostpointercapture',()=>{drag=null;});
    host.addEventListener('keydown',e=>{
        const keys={ArrowLeft:[0,-.15],ArrowRight:[0,.15],ArrowUp:[-.15,0],ArrowDown:[.15,0]};
        if(e.key==='Home'){e.preventDefault();reset();draw();}
        else if(keys[e.key]){e.preventDefault();logo.rotation.x+=keys[e.key][0];logo.rotation.y+=keys[e.key][1];vx=vy=0;draw();}
    });
    reduced.addEventListener('change',()=>{floatPaused=reduced.matches;vx=vy=0;sync();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(([e])=>{visible=e.isIntersecting;sync();}).observe(art);
    new MutationObserver(sync).observe(hero,{attributes:true,attributeFilter:['class']});
    new ResizeObserver(resize).observe(host);
    renderer.domElement.addEventListener('webglcontextlost',e=>{
        e.preventDefault();lost=true;art.classList.remove('model-ready');sync();
    });
    renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;art.classList.add('model-ready');resize();});
    art.classList.add('model-ready');resize();
} catch(error) {
    renderer?.dispose();host.replaceChildren();host.removeAttribute('tabindex');
    art.classList.remove('model-ready');
    art.querySelector('.hero-art-label').textContent='ENZO WORKS';
    console.warn('Using static logo fallback.',error);
}
