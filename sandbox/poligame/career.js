(function(root){
 'use strict';
 const G=root.Game,chapters=['prologue','term','term2','term3','leadership','government'];
 const chapter=s=>s.chapter||'prologue';
 const copy=x=>JSON.parse(JSON.stringify(x));
 const roles=['新人候補','国会議員','政務官','副大臣','党三役','大臣','党首','内閣総理大臣'];
 function role(s){return chapter(s)==='government'?7:s.leaderResult?.won?6:s.cabinet==='minister'?5:s.cabinet==='exec'?4:s.viceMinister?3:s.role==='政務官'?2:s.elected?1:0;}
 function fresh(s,partial=false){return {version:1,partial,initialLikes:G.parties[s.party].likes.map(x=>G.clamp(x+G.parties[s.party].mod[s.district],-50,100)),actions:{},choices:[],checks:[],funding:[],elections:[],highestRole:role(s)};}
 function observe(s,c){
  c.highestRole=Math.max(c.highestRole,role(s));
  const ch=chapter(s),r=s.result;
  if(!r)return;
  const resolved=ch==='prologue'?(s.elected||s.stage==='end'):['term','term2','term3'].includes(ch)?(s.reelected||s.stage==='end'):ch==='government'&&s.stage==='end'&&s.govResult?.seats!=null;
  if(!resolved)return;
  const won=ch==='prologue'?!!s.elected:ch==='government'?!!s.govResult.ownWon:!!s.reelected;
  const entry={chapter:ch,won,rescue:won&&!r.won,player:r.player,rival:r.rival,share:r.share};
  const i=c.elections.findIndex(e=>e.chapter===ch);if(i<0)c.elections.push(entry);else c.elections[i]=entry;
 }
 function legacy(s){
  const c=fresh(s,true);
  // Old saves have no complete action ledger: use only choices still visible in logs.
  for(const l of [...s.logs].reverse()){
   const pos=l.text.indexOf(' → ');if(pos<0)continue;
   const title=l.text.slice(0,pos),label=l.text.slice(pos+3);
   let event='legacy',id='legacy';
   if(title==='「選挙には、お金がいるでしょう」'){event='donation';id=label==='きっぱり断る'?'reject':label==='支援を受ける'?'accept':'legacy';}
   if(title==='政治資金パーティを開きませんか？'){event='fundraising';id=label.includes('大規模')?'large':label.includes('小規模')?'small':'skip';}
   if(title==='大規模パーティの支援者から公約の要求'){event='sponsor_request';id=label.includes('万円を返す')?'refund':label.includes('返金せず')?'withdraw':'pledge';}
   c.choices.push({chapter:l.chapter||chapter(s),turn:l.turn,event,id,title,label});
  }
  observe(s,c);return c;
 }
 const active=new WeakMap();
 function wrap(owner,key,kind){
  const base=owner[key];if(!base)return;
  owner[key]=function(s,...args){
   if(!s||active.has(s))return base(s,...args);
   const c=s.career||legacy(s),ch=chapter(s),turn=s.turn,previous={...s};
   const option=kind==='choice'?G.event(s)?.choices.find(x=>x.id===args[0]):null;
   const entry=option?{chapter:ch,turn,event:s.event,id:args[0],title:G.event(s).title,label:option.title}:null;
   active.set(s,c);let ok;
   try{ok=base(s,...args);}finally{active.delete(s);}
   if(!ok)return ok;
   s.career=c;
   if(kind==='continue'&&ch==='prologue'&&chapter(s)!==ch)previous.elected=s.elected;
   if(chapter(s)!==ch)observe(previous,c);
   if(kind==='action'||kind==='weekend'){const id=(kind==='weekend'?'weekend:':'')+args[0];c.actions[id]=(c.actions[id]||0)+1;}
   if(entry)c.choices.push(entry);
   let source=null,amount=0;
   if(kind==='action'&&args[0]==='org'){source=G.groups[args[1]??0][0]+(args[2]&&args[1]===11?'（新興）':'')+'への団体訪問';amount=G.funds(previous,G.groups[args[1]??0][5]*50*(args[2]&&args[1]===11?2:1));}
   if(entry?.event==='donation'&&entry.id==='accept'){source='業界からの献金';amount=G.funds(previous,500);}
   if(entry?.event==='fundraising'&&['small','large'].includes(entry.id)){source=entry.id==='large'?'大規模政治資金パーティ':'小規模政治資金パーティ';amount=G.funds(previous,entry.id==='large'?350:150);}
   if(entry?.event==='sponsor_request'&&entry.id==='refund'){source='パーティ支援者への返金';amount=-(previous.campaignPlan?.refundDue??150);}
   if(entry?.event==='reform'&&entry.id==='return'){source='党規則による献金返金';amount=-(previous.donationRefund||250);}
   if(entry?.event==='kickback'&&entry.id==='take'){source='派閥からの戻し金';amount=G.funds(previous,200);}
   if(source)c.funding.push({chapter:ch,turn,source,amount});
   if(c.funding.length>256)c.funding.shift();
   // A full playthrough is under 512 decisions; retain all ordinary play records.
   if(c.choices.length>512)c.choices=c.choices.slice(-512);
   observe(s,c);return ok;
  };
 }
 const create=G.create;G.create=function(...args){const s=create(...args);s.career=fresh(s);return s;};
 for(const [name,kind] of [['action','action'],['choose','choice'],['weekend','weekend'],['continueResult','continue']])wrap(G,name,kind);
 for(const name of ['begin','beginSecond','beginThird','beginLeadership','beginGovernment'])wrap(G.Legislature,name,'chapter');
 function recordCheck(s,o){const c=s.career||active.get(s);if(c){c.checks.push({chapter:chapter(s),turn:s.turn,key:o.key,success:o.success,title:o.title});if(c.checks.length>256)c.checks.shift();}}
 function isFinal(s){
  if(s.stage!=='end')return false;
  switch(chapter(s)){
   case 'prologue':return !s.elected;
   case 'term':case 'term2':return !s.reelected;
   case 'term3':return !s.reelected||!!s.leadershipSkip||!!s.term3Failed;
   case 'leadership':return !s.leaderResult?.ending?.toGovernment;
   case 'government':return true;
  }
 }
 const styles=[
  ['local','地元に根を張る庶民派','地域の声をつなぐ対話役',['outreach','visit','local','network','weekend:festival'],'地域との交流を重ね、身近な声を政治へ届けようとしました。'],
  ['voice','世論に訴える発信者','言葉を磨いた演説家',['speech','media','sns','ad','stump','presser','practice','weekend:station'],'演説や発信に力を注ぎ、自分の考えを広く伝えようとしました。'],
  ['policy','政策で道を開く実務家','学びを重ねる政策通',['study','committee','question','abroad','policy','weekend:book'],'政策を学び、課題への具体的な答えを探し続けました。'],
  ['org','組織を束ねる調整役','人をつなぐ世話役',['org','faction','hq','study_group','staff'],'団体や党内の仲間との関係を築き、組織の力で活動を支えました。'],
  ['independent','信念を貫く一匹狼','自分の道を選ぶ挑戦者',[],'支援者や党の要求に対して、自分で道を選ぶ決断を重ねました。'],
  ['strategy','政局を渡り歩く戦略家','機会をつかむ交渉役',['faction_care','tighten','publicity','diplomacy'],'党内調整や政治の駆け引きに取り組み、次の機会を探りました。']
 ];
 const important=['donation','fundraising','sponsor_request','issue','term_review','boss_demand','reform','kickback','alliance','platform','leader_ground','cabinet_offer','gov_cabinet','collect','term_collect','term2_collect','term3_collect'];
 function summary(s){
  const c=s.career?copy(s.career):legacy(s);observe(s,c);
  const has=(event,id)=>c.choices.some(x=>x.event===event&&x.id===id);
  const count=(event,id)=>c.choices.filter(x=>x.event===event&&x.id===id).length;
  const action=id=>c.actions[id]||0;
  const ranked=styles.map(style=>({style,score:style[3].reduce((n,id)=>n+action(id),0)}));
  ranked[4].score=4*c.choices.filter(x=>(x.event==='boss_demand'&&x.id==='defy')||(x.event==='reform'&&x.id==='leave')||(['collect','term_collect','term2_collect','term3_collect'].includes(x.event)&&x.id==='break')).length;
  ranked[5].score+=4*c.choices.filter(x=>['leader_ground','alliance','boss_demand'].includes(x.event)&&!['none','obey'].includes(x.id)).length;
  ranked.sort((a,b)=>b.score-a.score);
  const total=ranked.reduce((n,x)=>n+x.score,0),top=ranked[0],distinct=top.score>=3&&top.score/Math.max(1,total)>=.3;
  const short=chapter(s)==='prologue';
  const title=distinct?top.style[short?2:1]:total>=3?'幅広く動いた現実派':short?'可能性を秘めた新人候補':'歩みを重ねた政治家';
  const stats=[['speech','弁舌'],['policy','政策力'],['network','人脈'],['fame','知名度']].sort((a,b)=>s[b[0]]-s[a[0]]);
  const trait=s[stats[0][0]]>=55?stats[0][1]+'を武器にした挑戦':short?'最初の選挙で探った、自分の道':'選択を重ねて歩んだ政治の道';
  const votes=G.votes(s),layers=G.groups.map((g,i)=>({name:g[0],value:s.likes[i],delta:s.likes[i]-c.initialLikes[i],votes:Math.round(votes.rows[i].player),i}));
  const supporters=layers.filter(x=>x.value>0).sort((a,b)=>b.value-a.value||b.votes-a.votes).slice(0,2);
  const lost=layers.filter(x=>x.delta<=-5).sort((a,b)=>a.delta-b.delta).slice(0,2);
  const paragraphs=[distinct?top.style[4]:total>=3?'一つの活動に偏らず、複数の方法で支持を広げようとしました。':c.partial?'活動回数の記録が十分に残っていないため、確認できる選択と到達点からその歩みを振り返ります。':'残された活動記録はまだ少なく、政治家としての道を探り始めたところでした。'];
  if(supporters.length)paragraphs.push(supporters.map(x=>x.name).join('と')+'が支持の基盤となりました。'+(supporters.some(x=>x.delta>=10)?'活動を通じて、新たな支持も伸ばしました。':supporters.some(x=>c.initialLikes[x.i]>0)?'党から引き継いだ地盤も、その歩みを支えました。':''));
  else paragraphs.push('幅広い支持を固めるには、まだ時間が必要でした。');
  const visits=Math.max(action('org'),s.visits.reduce((a,b)=>a+b,0));
  if(has('donation','reject'))paragraphs.push(visits?'業界からの献金の申し出を断る一方、団体訪問では資金支援を受けました。':has('fundraising','large')?'献金の申し出は断りましたが、大規模パーティでは業界の支援を受けました。':'業界からの献金の申し出を断る選択をしました。');
  else if(has('donation','accept'))paragraphs.push('業界からの献金を受け、支援者との約束を背負って活動しました。');
  else if(visits)paragraphs.push('団体訪問を通じて資金や組織の支援を受け、活動を支えました。');
  else if(action('donors'))paragraphs.push('個人サポーターを募り、小さな支援を活動資金に変えてきました。');
  if(has('sponsor_request','refund'))paragraphs.push('スポンサーの要求には支援金の一部を返し、約束を解消する道を選びました。');
  else if(s.debts.some(d=>d.status==='踏み倒し'))paragraphs.push('支援者の要求を断ち切る決断は、組織との関係にも代償を残しました。');
  else if(s.debts.some(d=>d.status==='履行済み')&&!has('sponsor_request','withdraw'))paragraphs.push('支援者との約束には、履行や解消という形で区切りをつけました。');
  else if(has('term_review','admit'))paragraphs.push('公約との違いを認め、自分の言葉で説明する道を選びました。');
  const seen=new Set(),highlights=[];
  for(const x of [...c.choices].reverse().sort((a,b)=>(important.includes(b.event)?1:0)-(important.includes(a.event)?1:0))){
   if(seen.has(x.event)||['start','rival','campaign','after','legacy'].includes(x.event))continue;
   highlights.push(x);seen.add(x.event);if(highlights.length===3)break;
  }
  if(highlights.length<3)for(const h of [...s.history].reverse()){
   if(!['公約','役職','政策','矛盾','支援者の要求','謝罪済み','造反'].includes(h.kind)||highlights.some(x=>x.label===h.text))continue;
   highlights.push({chapter:h.chapter||'prologue',turn:h.turn,title:h.kind,label:h.text});if(highlights.length===3)break;
  }
  const minimum={prologue:0,term:1,term2:2,term3:3,leadership:4,government:4}[chapter(s)];
  const currentWin=chapter(s)==='prologue'?!!s.elected:['term','term2','term3'].includes(chapter(s))?!!s.reelected:chapter(s)==='government'&&s.govResult?.seats!=null?!!s.govResult.ownWon:false;
  const wins=Math.max(c.elections.filter(e=>e.won).length,minimum+Number(currentWin));
  const ending=s.govResult?.ending?.label||s.leaderResult?.ending?.label||(s.leadershipSkip?'党首選を見送る':s.result&&!s.result.won?'選挙で落選':'今回の挑戦を終える');
  let hint='次は活動の配分を変え、別の支持基盤を育てる道もあります。';
  if(s.govResult?.toppled)hint='党内の不満が政権の幕引きにつながりました。次は派閥への配慮や内閣改造を早めに検討できます。';
  else if(s.leadershipSkip)hint='次は人脈40・政策力50・党内影響力60を育てると、長老を説得して党首選へ進む道が開けます。';
  else if(chapter(s)==='leadership'&&!s.leaderResult?.won)hint='党首選は議員・党員・都道府県の票で決まります。次は弱かった票の基盤に合わせて、派閥との関係や全国への発信を育てられます。';
  else if(s.govResult?.scandalFall)hint='不祥事による支持率低下が退陣につながりました。次はクリーン度と不祥事への対応を重視できます。';
  else if(s.fame<45)hint='知名度には伸ばす余地がありました。次は演説や発信で、支持を投票につなげる機会を増やせます。';
  else if(s.money<G.funds(s,50))hint='活動資金が少なくなっていました。個人サポーター募集や人脈育成で、選べる活動を増やせます。';
  else if(lost.length)hint=lost[0].name+'の好感度が開始時より下がりました。次はその層への活動や、政策の負担にも目を向けられます。';
  return {title,trait,paragraphs:paragraphs.slice(0,4),supporters,lost,highlights,ending,wins,role:roles[Math.max(c.highestRole,role(s))],hint,partial:c.partial,elections:c.elections,checks:c.checks,funding:c.funding,actions:Object.entries(c.actions).sort((a,b)=>b[1]-a[1]),short};
 }
 function validate(s){
  if(s.career===undefined)return true;
  const c=s.career,num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max,str=(v,n=300)=>typeof v==='string'&&v.length<=n;
  const arr=(v,n,test)=>Array.isArray(v)&&v.length<=n&&v.every(test),position=x=>x&&chapters.includes(x.chapter)&&Number.isInteger(x.turn)&&num(x.turn,1,16);
  return !!c&&c.version===1&&typeof c.partial==='boolean'&&arr(c.initialLikes,12,v=>num(v,-50,100))&&c.initialLikes.length===12&&Number.isInteger(c.highestRole)&&num(c.highestRole,0,7)&&c.actions&&typeof c.actions==='object'&&!Array.isArray(c.actions)&&Object.entries(c.actions).length<=64&&Object.entries(c.actions).every(([k,v])=>/^(weekend:)?[a-z_]+$/.test(k)&&k.length<50&&Number.isInteger(v)&&num(v,0,10000))&&arr(c.choices,512,x=>position(x)&&str(x.event,60)&&str(x.id,60)&&str(x.title)&&str(x.label))&&arr(c.checks,256,x=>position(x)&&str(x.key,60)&&str(x.title)&&typeof x.success==='boolean')&&arr(c.funding,256,x=>position(x)&&str(x.source)&&num(x.amount,-100000000,100000000))&&arr(c.elections,6,x=>x&&chapters.includes(x.chapter)&&typeof x.won==='boolean'&&typeof x.rescue==='boolean'&&num(x.player,0,100000)&&num(x.rival,0,100000)&&num(x.share,0,1));
 }
 G.Career={summary,isFinal,validate,recordCheck};
})(typeof window!=='undefined'?window:globalThis);
