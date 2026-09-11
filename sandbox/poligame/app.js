'use strict';
const G=window.Game,app=document.getElementById('app'),KEY='poligame-save-v1';
let state=null,party=0,district=0,target=0,business=false,storageWarning='',draftName='';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Math.round(x).toLocaleString('ja-JP');
const term=()=>['term','term2','term3'].includes(state?.chapter);
const leadership=()=>state?.chapter==='leadership';
const government=()=>state?.chapter==='government';
const maximum=()=>term()?16:12;
const period=(t,chapter)=>chapter==='term'?'第1期 · '+t+' / 16ターン':chapter==='term2'?'第2期 · '+t+' / 16ターン':chapter==='term3'?'第3期 · '+t+' / 16ターン':chapter==='leadership'?'党首選':chapter==='government'?'終章 · '+t+'期':t>12?'当選後':t+'か月目';
try{
 const raw=localStorage.getItem(KEY);
 if(raw){state=G.restore(raw);if(!state)storageWarning='セーブの内容に問題があり、読み込めませんでした。新しく始められます。';}
}catch{storageWarning='セーブを読み込めませんでした。このまま新しく遊べます。';}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(state));storageWarning='';}
 catch{storageWarning='このブラウザでは保存できません。画面を閉じると進行が失われます。';}
}
function perform(op,id){
 if(op==='start'){state=G.create(party,district,draftName||'新人候補');return true;}
 if(!state)return false;
 if(op==='choice')return G.choose(state,id);
 if(op==='action')return G.action(state,id,target,business);
 if(op==='weekend')return G.weekend(state,id);
 if(op==='continue')return G.continueResult(state);
 if(op==='rescue')return G.continueResult(state,true);
 if(op==='beginTerm')return G.Legislature.begin(state);
 if(op==='beginSecondTerm')return G.Legislature.beginSecond(state);
 if(op==='beginThirdTerm')return G.Legislature.beginThird(state);
 if(op==='beginLeadership')return G.Legislature.beginLeadership(state);
 if(op==='beginGovernment')return G.Legislature.beginGovernment(state);
 return false;
}
function refresh(){pendingAction=null;save();render();const center=document.getElementById('game-content');center?.focus({preventScroll:true});}
const effectKeys=[['energy','体力','♥'],['fame','知名度','★'],['speech','弁舌','●'],['policy','政策力','◆'],['network','人脈','✦'],['money','活動資金','💰','万円'],['clean','クリーン度','✨'],['influence','党内影響力','🏛️']];
function effectSnapshot(){if(state)G.outcomes.delete(state);return state?Object.fromEntries(effectKeys.map(([key])=>[key,state[key]]).concat([['likes',state.likes.slice()]])):null;}
function prepareEffects(before){
 if(!before||typeof setTimeout==='undefined')return null;
 const items=[],changed=new Set();
 for(const [key,label,icon,unit] of effectKeys){const delta=state[key]-before[key];if(delta){items.push({key,label,icon,unit,delta});changed.add(key);}}
 state.likes.forEach((value,i)=>{const delta=value-before.likes[i];if(delta){items.push({key:'likes.'+i,label:G.groups[i][0],icon:'👥',delta});changed.add('likes.'+i);}});
 const results=G.outcomes.get(state)||[];
 return items.length||results.length?{before,items,changed,results,progress:0}:null;
}
function applyEffects(){
 let step=0;const tick=()=>{step++;effectAnimation.progress=Math.min(1,step/12);render();if(step<12)setTimeout(tick,50);else setTimeout(()=>{effectAnimation=null;render();document.getElementById('game-content')?.focus({preventScroll:true});},260);};tick();
}
function startEffects(before){
 effectAnimation=prepareEffects(before);
 if(!effectAnimation){refresh();return;}
 pendingAction=null;save();render();setTimeout(applyEffects,1650);
}
function transitionAfter(op,id,before){
 pendingAction=null;save();
 if(typeof Image==='undefined'){refresh();return;}
 effectAnimation=prepareEffects(before);transition={kind:op,id,chapter:state.chapter};render();
 const asset=window.GameScenes.resolve(state),minimum=new Promise(done=>setTimeout(done,op==='start'?3000:effectAnimation?1650:720));
 const preload=!asset.src?Promise.resolve():new Promise(done=>{const image=new Image(),timeout=setTimeout(done,1800);image.onload=image.onerror=()=>{clearTimeout(timeout);done();};image.src=asset.src;});
 Promise.all([minimum,preload]).then(()=>{transition=null;if(effectAnimation)applyEffects();else refresh();});
}
function transitionChapter(){
 pendingAction=null;effectAnimation=null;save();
 if(typeof setTimeout==='undefined'){refresh();return;}
 transition={kind:'chapter',chapter:state.chapter};render();
 const asset=window.GameScenes.resolve(state),minimum=new Promise(done=>setTimeout(done,3000));
 const preload=!asset.src?Promise.resolve():new Promise(done=>{const image=new Image(),timeout=setTimeout(done,3600);image.onload=image.onerror=()=>{clearTimeout(timeout);done();};image.src=asset.src;});
 Promise.all([minimum,preload]).then(()=>{transition=null;refresh();});
}
app.addEventListener('input',e=>{if(e.target.id==='candidate')draftName=e.target.value;});
app.addEventListener('change',e=>{
 if(e.target.id==='district')district=Number(e.target.value);
 if(e.target.id==='target'){target=Number(e.target.value);render();}
 if(e.target.id==='business')business=e.target.value==='1';
});
app.addEventListener('click',e=>{
 const button=e.target.closest('[data-do]');if(!button||button.disabled)return;
 const op=button.dataset.do,id=button.dataset.id;
 if(transition||effectAnimation)return;
 if(op==='party'){party=Number(id);render();return;}
 if(op==='actionGroup'&&actionGroups.some(g=>g.id===id)){actionGroup=id;pendingAction=null;render();return;}
 if(op==='inspector'&&['support','debt','records'].includes(id)){inspector=id;render();return;}
 if(op==='pickAction'&&state?.stage==='main'&&['visit','org','question'].includes(id)&&G.allowed(state,id)){pendingAction=id;if(id==='org'&&(G.groups[target][5]<3||state.memory[target]))target=G.groups.findIndex((g,i)=>g[5]>=3&&!state.memory[i]);if(target<0)target=0;render();return;}
 if(op==='cancelAction'){pendingAction=null;render();return;}
 if(op==='target'&&Number.isInteger(Number(id))&&Number(id)>=0&&Number(id)<12){target=Number(id);render();return;}
 if(op==='reset'){
  if(!confirm('現在の進行を消して、最初から始めますか？'))return;
  try{localStorage.removeItem(KEY);storageWarning='';}catch{storageWarning='保存データを削除できませんでした。再読み込みすると以前の進行が戻る場合があります。';}
  state=null;render();return;
 }
 const before=effectSnapshot();
 if(perform(op,id)){
  if(['beginTerm','beginSecondTerm','beginThirdTerm','beginLeadership','beginGovernment'].includes(op))transitionChapter();
  else if(['start','action','weekend'].includes(op))transitionAfter(op,id,before);
  else startEffects(before);
 }
});
render();
if(document.modelContext?.registerTool){
 const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});
 const snapshot=()=>({started:!!state,chapter:state?.chapter||'prologue',turn:state?.turn,stage:state?.stage,event:state?.stage==='event'?G.event(state):null,votes:state?G.votes(state):null});
 for(const tool of [
  {name:'read_campaign',description:'進行中の選挙と現在の選択肢を確認する。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>snapshot()},
  {name:'choose_campaign_action',description:'進行中のゲームでイベント、主行動、週末の選択を1回実行する。',inputSchema:{type:'object',properties:{id:{type:'string'},target:{type:'integer',minimum:0,maximum:11}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{
   if(!state||!input||typeof input.id!=='string'||Object.keys(input).some(k=>!['id','target'].includes(k))||(input.target!==undefined&&(!Number.isInteger(input.target)||input.target<0||input.target>11)))throw new Error('有効な進行と選択肢が必要です');
   const ok=state.stage==='event'?G.choose(state,input.id):state.stage==='main'?G.action(state,input.id,input.target??target,business):state.stage==='weekend'?G.weekend(state,input.id):false;
   if(!ok)throw new Error('現在は選べない行動です');refresh();return snapshot();
  }}
 ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}}
}
