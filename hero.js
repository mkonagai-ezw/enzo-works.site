// One-shot film -> white exposure flash -> accessible, static brand layout.
import('./hero-logo.js').catch(error=>console.warn('3D logo unavailable',error));
const hero=document.querySelector('.hero');
const video=hero.querySelector('video');
const intro=hero.querySelector('.hero-intro');
const flash=hero.querySelector('.hero-flash');
const skip=hero.querySelector('.hero-skip');
const replay=hero.querySelector('.hero-replay');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state='final', frame=0, timer=0, flashAnimation=null, visible=true;
function cancelWatch(){ cancelAnimationFrame(frame); clearTimeout(timer); }
function finish(){
    cancelWatch(); video.pause();
    state='final';
    hero.classList.remove('intro-playing','intro-transition');
    hero.classList.add('hero-revealing');
    document.body.classList.remove('hero-intro-active');
    intro.inert=true;
    if(document.activeElement===skip) replay.focus({preventScroll:true});
}
function transition(animate=true){
    if(state!=='playing')return;
    state='transition'; cancelWatch();
    hero.classList.add('intro-transition');
    if(!animate||reduced.matches){finish();return;}
    // One soft exposure pulse: fully white before replacing the frozen end frame.
    flashAnimation=flash.animate([{opacity:0},{opacity:1}],{duration:220,fill:'forwards',easing:'ease-in'});
    flashAnimation.finished.then(()=>{
        finish();
        flashAnimation=flash.animate([{opacity:1},{opacity:0}],{duration:650,fill:'forwards',easing:'ease-out'});
        return flashAnimation.finished;
    }).then(()=>{flashAnimation?.cancel();flashAnimation=null;}).catch(()=>{});
}
function watch(){
    if(state!=='playing')return;
    if(Number.isFinite(video.duration)&&video.currentTime>=video.duration-.65){transition();return;}
    frame=requestAnimationFrame(watch);
}
async function start(){
    if(state==='playing'||state==='transition')return;
    flashAnimation?.cancel(); flashAnimation=null;
    hero.classList.remove('hero-revealing'); video.currentTime=0; video.muted=true;
    state='playing'; intro.inert=false;
    hero.classList.add('intro-playing'); document.body.classList.add('hero-intro-active');
    if(document.activeElement===replay)skip.focus({preventScroll:true});
    timer=setTimeout(()=>{if(state==='playing')transition(false);},20000);
    try { await video.play(); if(state==='playing'){cancelAnimationFrame(frame);watch();}else video.pause(); }
    catch { if(state==='playing')transition(false); }
}
skip.addEventListener('click',()=>transition(false));
replay.addEventListener('click',start);
video.addEventListener('ended',()=>transition());
video.addEventListener('error',()=>transition(false));
video.addEventListener('timeupdate',()=>{if(state==='playing'&&video.duration-video.currentTime<=.65)transition();});
function syncVisibility(){
    if(state!=='playing')return;
    if(document.hidden||!visible){video.pause();cancelAnimationFrame(frame);}
    else video.play().then(()=>{cancelAnimationFrame(frame);watch();}).catch(()=>transition(false));
}
document.addEventListener('visibilitychange',syncVisibility);
new IntersectionObserver(([e])=>{visible=e.isIntersecting;syncVisibility();}).observe(hero);
reduced.addEventListener('change',()=>{if(reduced.matches)transition(false);});
intro.inert=true;
replay.hidden=false;
if(!reduced.matches&&!location.hash)start();
