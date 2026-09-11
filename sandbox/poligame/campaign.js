(function(root){
 'use strict';
 const G=root.Game,{clamp}=G,{log,debt,random}=G.mechanics;
 const ids=['fundraising','sponsor_request','influencer','influencer_direction','consultant'];
 const base={event:G.event,choose:G.choose,action:G.action,weekend:G.weekend,continueResult:G.continueResult};
 const chapter=s=>s.chapter||'prologue';
 const fresh=s=>({chapter:chapter(s),seen:[],deferredTurn:0,party:null,sponsorDebt:null,sponsorResolved:false,consultant:0,influencer:0,influencerMode:'safe'});
 const current=s=>s.campaignPlan?.chapter===chapter(s)?s.campaignPlan:null;
 const ensure=s=>current(s)||(s.campaignPlan=fresh(s));
 const isTerm=s=>chapter(s)==='term'||chapter(s)==='term2';
 const isTerm2=s=>chapter(s)==='term2';
 const choice=(id,title,hint,disabled=false)=>({id,title,hint,disabled});
 const mark=(p,id)=>{if(!p.seen.includes(id))p.seen.push(id);};
 function schedule(s){
  if(s.stage!=='main'||['term3','leadership','government'].includes(chapter(s)))return;
  const p=ensure(s),t=s.turn,term=isTerm(s);let id=null;
  if(p.party==='large'&&!p.sponsorResolved&&t>=(term?12:9))id='sponsor_request';
  else if(!isTerm2(s)&&!p.seen.includes('fundraising')&&t>=(term?7:4)&&t<=(term?10:8)&&p.deferredTurn!==t)id='fundraising';
  else if(!isTerm2(s)&&!p.seen.includes('influencer')&&s.fame>=30&&t>=(term?11:7)&&t<=(term?13:9))id='influencer';
  else if(!p.seen.includes('consultant')&&G.campaign(s))id='consultant';
  if(id){s.stage='event';s.event=id;}
 }
 function event(s){
  const p=current(s)||fresh(s),c=choice;
  switch(s.event){
   case 'fundraising':return {speaker:'後援会長のオオクボ',title:'政治資金パーティを開きませんか？',body:'開催した場合だけ資金と人脈が増え、体力と今回の主行動を使います。ここで見送っても資金・体力は減りません。大規模開催では、後日、支援した業界団体から公約を求められます。'+(s.mandate?'今回は党務のため開催できません。':s.party===1&&s.nomination!=='無所属'?'都市改革党の規則では個人参加型のみ開催できます。':'人脈は「地域交流」や「後援会づくり」で育ちます。'),choices:[
    c('small','小規模パーティを開催する','開催後：資金＋150万円・人脈＋3／体力−15・今回の主行動を消費（必要：人脈20・体力15）',s.network<20||s.energy<15||s.mandate),
    c('large','大規模パーティを開催する',(s.memory[11]?'業界との関係が破綻／':'')+'開催後：資金＋350万円・人脈＋5／体力−25・今回の主行動を消費／後日、業界団体から要求あり（必要：人脈35・体力25）',s.network<35||s.energy<25||s.mandate||s.memory[11]||(s.party===1&&s.nomination!=='無所属')),
    c('later','今回は開かず、次回また検討する',(isTerm(s)?'今は何も変化しない（資金±0・体力±0）／第10ターンまで再提案':'今は何も変化しない（資金±0・体力±0）／8か月目まで再提案'),s.turn===(isTerm(s)?10:8)),
    c('skip','今回は開かず、選挙中は見送る','今は何も変化しない（資金±0・体力±0）／通常活動を選べる')
   ]};
   case 'sponsor_request':return {speaker:'パーティを支えた業界団体',title:'大規模パーティの支援者から公約の要求',body:'大規模パーティ開催時に、資金350万円はすでに受け取っています。今回はその支援への対応です。公約を受け入れるか、受け取った資金の一部を返すか、返金せず関係を断つか選びます。',choices:[
    c('pledge','公約を受け入れる（返金なし）','資金は変化なし／業界好感度＋4／都市無党派−10／約束を履行済みにする'),
    c('refund','受け取った支援から150万円を返す','大規模開催で得た350万円のうち150万円を返金／資金−150万円・業界好感度−2／約束を解消',s.money<150),
    c('withdraw','返金せず、支援関係を断つ','資金は変化なし／業界好感度−15／業界の組織票が対抗馬へ移る／再契約不可')
   ]};
   case 'influencer':return {speaker:'動画クリエイターのアオイ',title:'あなたの政策、動画で届けませんか？',body:'若い世代へ届くコラボの提案です。継続契約では発信方針も選びます。休養を含む主行動1回ごとに配信し、3回で契約終了。',choices:[
    c('single','単発コラボを依頼する','150万円／知名度＋5／若者好感度＋3',s.money<150),
    c('ongoing','3回の継続契約を結ぶ','300万円／毎回知名度＋3／次に発信方針を選択',s.money<300),
    c('skip','今回は見送る','資金を温存する')
   ]};
   case 'influencer_direction':return {speaker:'動画クリエイターのアオイ',title:'どんな発信で、注目を集めますか？',body:'政策紹介なら確実に知名度を育てられます。挑発的な発信は今すぐ注目されますが、全3回の配信で毎回25%の確率で炎上します。',choices:[
    c('safe','政策をわかりやすく紹介する','毎回知名度＋3／炎上判定なし'),
    c('provocative','対抗馬を挑発して注目を集める','今すぐ知名度＋4・クリーン度−5／毎回25%で若者−6・都市無党派−8'),
    c('cancel','発信を取りやめる','今後の配信なし／契約費は戻らない')
   ]};
   case 'consultant':return {speaker:'選挙コンサルのミズノ',title:'最後の選挙戦、陣営を強化しましょう。',body:'150万円で主行動3回を強化。街頭演説・SNS・広告の知名度上昇量が50%増え、主行動の消費体力は25%減少します。休養も1回として数えます。今回の選挙限りの契約です。',choices:[
    c('hire','選挙対策パックを契約する','150万円／主行動3回／知名度効果＋50%・消費体力−25%',s.money<150),
    c('skip','自分たちで戦う','資金を温存する')
   ]};
  }
  return base.event(s);
 }
 const costs={outreach:10,donors:12,practice:8,speech:15,visit:12,org:10,network:10,study:8,media:15,sns:8,hq:8,rest:0,ad:5,question:12,committee:8,local:10,faction:8,abroad:8,study_group:8,stump:5};
 function energyCost(s,id){const normal=costs[id]*(G.campaign(s)?2:1);return Math.ceil(normal*(current(s)?.consultant>0?.75:1));}
 function fameGain(s,id){const normal=id==='speech'?3*[1,1.5,.7][s.district]:id==='ad'?6:id==='sns'?2:0;return normal*(current(s)?.consultant>0?1.5:1);}
 // Called by both engines before exhaustion, turn advancement and the final vote.
 function afterAction(s,id){
  const p=ensure(s);
  if(p.consultant>0){const bonus=fameGain(s,id)/3;s.fame=clamp(s.fame+bonus);p.consultant--;log(s,'コンサル契約：あと'+p.consultant+'回');}
  if(p.influencer>0){
   s.fame=clamp(s.fame+3);p.influencer--;log(s,'コラボ動画を配信：知名度＋3／あと'+p.influencer+'回');
   if(p.influencerMode==='provocative'&&random(s)<.25){s.likes[2]=clamp(s.likes[2]-6,-50,100);s.likes[7]=clamp(s.likes[7]-8,-50,100);log(s,'挑発的な動画が炎上。若者−6・都市無党派−8。');}
  }
 }
 function consumeParty(s,large){
  const p=ensure(s),cost=large?25:15;p.party=large?'large':'small';
  s.money+=large?350:150;s.network=clamp(s.network+(large?5:3));s.energy-=cost;
  if(large){debt(s,11,3);p.sponsorDebt=s.debts.at(-1).id;s.debts.at(-1).name='パーティ支援業界団体';}
  log(s,(large?'大規模':'小規模')+'パーティを開催。主行動を消費、差引資金＋'+(large?350:150)+'万円。');
  afterAction(s,'fundraising');
  const exhausted=s.energy===0;if(exhausted){s.energy=35;s.fame=clamp(s.fame-3);log(s,'体力が尽き、休養した。');}
  if(isTerm(s))G.Legislature.finishTurn(s);else if(exhausted)G.finishTurn(s);else s.stage='weekend';
 }
 function choose(s,id){
  if(!ids.includes(s.event)){const ok=base.choose(s,id);if(ok)schedule(s);return ok;}
  if(s.stage!=='event')return false;
  const ev=event(s),opt=ev.choices.find(c=>c.id===id);if(!opt||opt.disabled)return false;
  const type=s.event,p=ensure(s);log(s,ev.title+' → '+opt.title);s.event=null;s.stage='main';
  if(type==='fundraising'){
   if(id==='later')p.deferredTurn=s.turn;
   else{mark(p,type);if(id==='small'||id==='large')consumeParty(s,id==='large');}
  }
  if(type==='sponsor_request'){
   const d=s.debts[p.sponsorDebt];p.sponsorResolved=true;mark(p,type);
   if(id==='pledge'){s.likes[11]=clamp(s.likes[11]+4,-50,100);s.likes[7]=clamp(s.likes[7]-10,-50,100);d.status='履行済み';}
   if(id==='refund'){s.money-=150;s.likes[11]=clamp(s.likes[11]-2,-50,100);d.status='履行済み';}
   if(id==='withdraw'){s.likes[11]=clamp(s.likes[11]-15,-50,100);s.memory[11]=true;s.rivalOrg??=Array(12).fill(0);s.rivalOrg[11]+=s.org[11];s.org[11]=0;d.status='踏み倒し';}
   s.history.push({turn:s.turn,chapter:chapter(s),kind:'支援者の要求',text:opt.title,publicity:3});
  }
  if(type==='influencer'){
   mark(p,type);
   if(id==='single'){s.money-=150;s.fame=clamp(s.fame+5);s.likes[2]=clamp(s.likes[2]+3,-50,100);}
   if(id==='ongoing'){s.money-=300;p.influencer=3;s.stage='event';s.event='influencer_direction';}
  }
  if(type==='influencer_direction'){
   mark(p,type);p.influencerMode=id==='provocative'?'provocative':'safe';
   if(id==='provocative'){s.fame=clamp(s.fame+4);s.clean=clamp(s.clean-5);}
   if(id==='cancel')p.influencer=0;
  }
  if(type==='consultant'){mark(p,type);if(id==='hire'){s.money-=150;p.consultant=3;}}
  schedule(s);return true;
 }
 function validate(s){
  const p=s.campaignPlan;if(p===undefined)return !ids.includes(s.event);
  if(!p||!['term','prologue','term2','term3','leadership','government'].includes(p.chapter)||!Array.isArray(p.seen)||p.seen.length>5||new Set(p.seen).size!==p.seen.length||!p.seen.every(x=>ids.includes(x)))return false;
  if(!Number.isInteger(p.deferredTurn)||p.deferredTurn<0||p.deferredTurn>16||![null,'small','large'].includes(p.party)||typeof p.sponsorResolved!=='boolean')return false;
  if(![p.consultant,p.influencer].every(x=>Number.isInteger(x)&&x>=0&&x<=3)||!['safe','provocative'].includes(p.influencerMode))return false;
  if(p.sponsorDebt!==null&&(!Number.isInteger(p.sponsorDebt)||s.debts[p.sponsorDebt]?.group!==11))return false;
  if(p.party==='large'&&p.sponsorDebt===null)return false;
  if(p.consultant>0&&!p.seen.includes('consultant')||p.influencer>0&&!p.seen.includes('influencer'))return false;
  if(ids.includes(s.event)&&s.stage==='event'){
   if(p.chapter!==chapter(s))return false;
   if(s.event==='sponsor_request'&&(p.party!=='large'||p.sponsorResolved||s.debts[p.sponsorDebt]?.status!=='未回収'))return false;
   if(s.event==='influencer_direction'&&(p.influencer!==3||p.seen.includes('influencer_direction')))return false;
   if(!['sponsor_request','influencer_direction'].includes(s.event)&&p.seen.includes(s.event))return false;
  }
  return true;
 }
 G.Campaign={ids,current,event,schedule,energyCost,fameGain,afterAction,validate};
 G.event=event;G.choose=choose;
 for(const method of ['action','weekend','continueResult'])G[method]=function(s,...args){const ok=base[method](s,...args);if(ok)schedule(s);return ok;};
})(typeof window!=='undefined'?window:globalThis);
