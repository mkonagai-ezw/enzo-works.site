export async function createShadowAudio(context){
 const response=await fetch('assets/audio/'+encodeURIComponent('部屋に駆け込んでくる.mp3'));if(!response.ok)throw Error('影の足音を読み込めません');const buffer=await context.decodeAudioData(await response.arrayBuffer());
 const mix=context.createGain();mix.gain.value=0;mix.connect(context.destination);
 const offsets=[0,.18],rates=[.98,1.035];let voices=[],lastPhase='hidden',lastGain=0;
 function stop(){for(const v of voices){v.source.stop();v.source.disconnect();v.gain.disconnect();v.pan.disconnect();}voices=[];}
 function start(time){voices=offsets.map((delay,i)=>{const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();source.buffer=buffer;source.loop=true;source.playbackRate.value=rates[i];gain.gain.value=i?.47:.53;pan.pan.value=i?.24:-.24;source.connect(gain);gain.connect(pan);pan.connect(mix);const elapsed=Math.max(0,time-delay),wait=Math.max(0,delay-time);source.start(context.currentTime+wait,(elapsed*rates[i])%buffer.duration);return {source,gain,pan};});}
 return {reset(){stop();mix.gain.cancelScheduledValues(context.currentTime);mix.gain.value=0;lastGain=0;lastPhase='hidden';},
  update(state,active,sound){const run=active&&sound&&state.phase==='rush'&&context.state==='running';if(run&&!voices.length)start(state.time);if(!run&&voices.length)stop();const target=run?Math.min(.65,.20+state.time*.12):0;if(target!==lastGain){mix.gain.setTargetAtTime(target,context.currentTime,.035);lastGain=target;}lastPhase=state.phase;},
  diagnostics(){return {running:voices.length>0,voices:voices.length,phase:lastPhase,offsets,rates,duration:buffer.duration,file:'部屋に駆け込んでくる.mp3'};}};
}
