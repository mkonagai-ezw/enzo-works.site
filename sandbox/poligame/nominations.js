(function(root){
 'use strict';
 const G=root.Game,{clamp}=G,{log}=G.mechanics;
 const profiles=[
  {id:'morita',name:'森田 修司',age:60,job:'党一筋のベテラン',type:'loyal',group:'core',quality:58,desc:'党の理念を訴え、従来の支持者を確実に動かす。異論には厳しい。'},
  {id:'tachibana',name:'橘 千尋',age:39,job:'地域の生活相談ネットワーク代表',type:'bridge',group:'weak',quality:62,desc:'党と距離がある住民の相談を担ってきた。政策の違いを残したまま協力を求める。'},
  {id:'sekiguchi',name:'関口 大地',age:47,job:'地方議会の無所属議員',type:'local',group:6,quality:66,desc:'地域の物流と交通に実績。地元の利益に反する党方針には従わない。'},
  {id:'kuroda',name:'黒田 健一',age:54,job:'業界推薦の経営者',type:'sponsor',group:11,quality:54,desc:'組織と資金を持ち込む。推薦団体は政策協定と公認枠を期待している。'},
  {id:'aiba',name:'相葉 理恵',age:45,job:'社会保障の政策研究者',type:'expert',group:1,quality:86,desc:'世代間の負担を調整する実務家。選挙の知名度は低く、育成費が必要。'},
  {id:'sora',name:'青木 ソラ',age:29,job:'政治動画の配信者',type:'star',group:2,quality:42,desc:'発信力は抜群。過去の刺激的な動画への説明と政策の勉強が課題。'},
  {id:'matsuda',name:'松田 和江',age:62,job:'地方支部を支えた党職員',type:'loyal',group:'core',quality:64,desc:'長年の党員が信頼する実務派。公認を従来の支持層へ戻すよう求める。'},
  {id:'endo',name:'遠藤 悠',age:36,job:'非正規雇用を支える弁護士',type:'bridge',group:3,quality:72,desc:'働く人の立場で立候補。党方針への白紙委任はせず、制度改正を求める。'},
  {id:'nishino',name:'西野 真紀',age:41,job:'救急看護師・市民団体代表',type:'local',group:7,quality:74,desc:'党派を越えた医療支援の実績を持つ。中央からの一方的な指示を嫌う。'}
 ];
 const rounds=[['morita','tachibana','sekiguchi'],['kuroda','aiba','sora'],['matsuda','endo','nishino']];
 const labels={cohesion:'党内結束',breadth:'支持の広がり',quality:'候補者の質',integrity:'党の清潔度',local:'地方組織の信頼'};
 const ids=['party_nominate','party_bridge','party_sponsor','party_scandal','party_local','party_pressure','party_rebel','party_reunion'];
 const problems=['若者向け予算を削って高齢者へ回してほしい','独身者への支援を削って子育て給付へ集中してほしい','政策経験より配信人気で候補を選んでほしい','財源の議論を後回しにして一律給付を約束してほしい','労働者保護を弱めて企業負担を減らしてほしい','組合推薦者へ公認枠を固定してほしい','都市向け予算を地方の公共事業へ回してほしい','党の理念を棚上げして世論調査だけで政策を決めてほしい','異論を持つ候補の公認を取り消してほしい','過去発言が路線と異なる候補を排除してほしい','推薦候補の比例上位と政策協定を保証してほしい','献金する団体へ公認枠と政策上の優遇を保証してほしい'];
 const profile=id=>profiles.find(c=>c.id===id);
 const active=s=>s.chapter==='party';
 const layer=i=>G.groups[i][0];
 const cost=(s,n)=>G.funds(s,n);
 function initial(s){
  const baseLikes=s.likes.map((x,i)=>clamp(G.parties[s.party].likes[i]+x*.25,-50,100));
  const core=baseLikes.indexOf(Math.max(...baseLikes)),opposed=G.groups[core][7];
  const weak=(opposed.length?opposed:[...Array(12).keys()]).reduce((a,b)=>baseLikes[a]<=baseLikes[b]?a:b);
  return {version:1,core,weak,baseLikes,reach:Array(12).fill(0),pressure:Array(12).fill(0),cohesion:50,breadth:0,quality:50,integrity:s.clean,local:50,slate:[],seen:[],complete:false,opposition:!s.ruling,result:null,resume:null,subject:null,campaignBoost:0};
 }
 function begin(s){
  if(s.chapter!=='leadership'||s.stage!=='end'||!s.leaderResult?.won||s.partyOps)return false;
  s.partyOps=initial(s);s.chapter='party';s.turn=1;s.stage='event';s.event='party_nominate';s.finalScore=null;
  log(s,'党首として公認を決める。3回の公認会議と6回の党活動で、次の総選挙の顔ぶれを整える。');return true;
 }
 const target=(s,c)=>c.group==='core'?s.partyOps.core:c.group==='weak'?s.partyOps.weak:c.group;
 function ally(s,group){return (G.People?.entries(s)||[]).find(r=>r.trust>=45&&G.People.profiles.find(p=>p.id===r.id)?.group===group);}
 function add(s,key,n){const p=s.partyOps;p[key]=clamp(p[key]+n,0,100);}
 function reach(s,group,n){const p=s.partyOps;p.reach[group]=clamp(p.reach[group]+n,-40,40);}
 function pressure(s,group,n){const p=s.partyOps;p.pressure[group]=clamp(p.pressure[group]+n,0,12);}
 const support=(s,i)=>clamp(s.partyOps.baseLikes[i]+s.partyOps.reach[i],-50,100);
 function plan(s,c){
  const group=target(s,c),friend=ally(s,group),bridge=c.type==='bridge'&&group!==s.partyOps.core;
  const effect={loyal:{cohesion:12,quality:2,reach:10,pressure:2},bridge:{cohesion:bridge?(friend?-3:-8):3,breadth:bridge?12:3,quality:3,reach:14,pressure:bridge?0:2},local:{cohesion:-4,breadth:8,local:12,quality:4,reach:10,pressure:1},sponsor:{cohesion:5,quality:1,integrity:-12,reach:12,pressure:3,money:100},expert:{cohesion:-2,breadth:8,quality:14,reach:8,pressure:0,money:-50},star:{cohesion:-6,breadth:6,quality:-4,reach:14,pressure:2}}[c.type];
  if(c.type==='sponsor'&&s.party===1){effect.money=0;effect.integrity=-4;effect.reach=8;effect.pressure=1;effect.cohesion=0;}
  const shown=Object.entries(labels).flatMap(([k,label])=>effect[k]?[label+(effect[k]>0?'＋':'')+effect[k]]:[]);
  shown.unshift('党支持：'+layer(group)+'＋'+effect.reach);
  if(bridge)shown.push(layer(s.partyOps.core)+'の党支持−4／最大勢力の圧力−1');
  if(c.type==='loyal')shown.push('都市無党派の党支持−2（同じ層なら相殺）');
  if(effect.pressure)shown.push('この層の支配圧力＋'+effect.pressure);
  if(effect.money)shown.push('資金'+(effect.money>0?'＋':'−')+cost(s,Math.abs(effect.money))+'万円');
  if(c.type==='sponsor'&&s.party===1)shown.push('党規則により団体資金は受け取らず、個人候補として公認');
  if(friend&&bridge)shown.push(G.People.profiles.find(p=>p.id===friend.id).name+'の紹介で党内反発を軽減');
  return {group,bridge,effect,hint:shown.join(' ／ ')};
 }
 function nominate(s,c){
  const p=s.partyOps,{group,bridge,effect}=plan(s,c);
  for(const k of Object.keys(labels))if(effect[k])add(s,k,effect[k]);
  reach(s,group,effect.reach);pressure(s,group,effect.pressure);
  if(bridge){reach(s,p.core,-4);pressure(s,p.core,-1);}
  if(c.type==='loyal')reach(s,7,-2);
  if(effect.money)s.money+=cost(s,effect.money);
  p.slate.push({id:c.id,group,status:'公認',relationship:bridge?'政策の違いを残して協力':'公認時の約束を共有',elected:null});
  s.history.push({chapter:s.chapter,turn:s.turn,kind:'公認',text:c.name+'を公認（'+layer(group)+'向け）',publicity:3});
 }
 const choice=(id,title,hint,disabled=false)=>({id,title,hint,disabled});
 function subject(s){return s.partyOps?.slate.find(x=>x.id===s.partyOps.subject)||null;}
 function event(s){
  const p=s.partyOps;if(!p||s.stage!=='event'||!ids.includes(s.event))return null;
  if(s.event==='party_nominate'){
   const n=(s.turn-1)/2;if(!Number.isInteger(n)||!rounds[n]||p.slate.length!==n)return null;
   return {speaker:'党公認委員会',title:['最初の公認。どんな党をつくる？','比例上位の一枠を、誰に託す？','地方支部から届いた、最後の公認案'][n],body:'公認会議 '+(n+1)+'/3。候補の得意分野と党の方針を比べて選びます。党支持は全国議席に反映されます。あなた個人の支持とは別です。',choices:rounds[n].map(id=>{const c=profile(id),v=plan(s,c);return {...choice(id,c.name+'（'+c.job+'）',v.hint,v.effect.money<0&&s.money<cost(s,-v.effect.money)),candidate:id,description:c.desc,group:v.group};})};
  }
  const r=subject(s),c=r?profile(r.id):null,name=c?.name||'公認候補';
  const ch=(id,title,hint,energy=0,money=0,locked=false)=>choice(id,title,hint+(energy?' ／ 体力−'+energy:'')+(money?' ／ 資金−'+cost(s,money)+'万円':''),locked||s.energy<energy||s.money<cost(s,money));
  if(s.event==='party_bridge')return {speaker:name,title:'「党の色が変わった」と、古参が反発',body:name+'は違う立場の住民も代表したいと訴えています。従来の党員は、公認を認めても党の方針は守らせるべきだと求めています。',choices:[ch('dialogue','双方の譲れない条件を話し合う','人脈判定：成功なら結束＋8・広がり＋3／失敗なら結束−4',6),choice('force','候補に党方針への全面同意を求める','結束＋10／広がり−8／候補の層の党支持−8'),choice('defend','政策の違いを認め、公認を守る','結束−5／広がり＋5／候補の層の党支持＋4')]};
  if(s.event==='party_sponsor')return {speaker:name+'の推薦団体',title:s.party===1?'団体資金を受け取らなくても、要求は来る':'「支援した分は、公約と公認枠で」',body:s.party===1?'党規則に従い、黒田は団体資金を伴わない個人候補として公認しました。しかし元の推薦団体は政策協定と優先枠を求めています。資金の受領や優先枠との取引はできません。':'黒田の支援団体が、規制緩和と次の公認枠の確約を求めてきました。受け入れると組織は動きますが、党の判断が縛られます。',choices:[...(s.party===1?[]:[choice('accept','政策協定と優先枠を約束する','業界の党支持＋8・結束＋5／党清潔度−10・業界の支配圧力＋2／借り1件'),ch('refund','資金を返して、推薦条件を解消する','党清潔度＋8／業界の党支持−6・支配圧力−2',0,100)]),choice('refuse','追加要求を断り、公開の場で説明する','党清潔度＋3／業界の党支持−10・結束−4／支配圧力−1')]};
  if(s.event==='party_scandal')return {speaker:'選挙担当の記者',title:name+'の過去の発言が拡散',body:'公認候補の発言が、ある住民を切り捨てるものだと批判されています。党首として公認の責任が問われます。',choices:[ch('explain','本人と事実確認し、撤回と説明を行う','弁舌判定：成功なら党清潔度＋4／失敗なら党清潔度−6・都市の党支持−6',4),choice('withdraw','公認を取り消す','党清潔度＋8／候補の層の党支持−8・結束−5／候補を失う'),choice('shield','選挙のため公認候補を擁護する','結束＋6／党清潔度−12・都市の党支持−8・候補の層の圧力＋2')]};
  if(s.event==='party_local')return {speaker:'地方支部の公認会議',title:'中央の指示か、地元の判断か',body:name+'の選挙運動に、本部が統一方針を求めています。地元支部は、その地域の困りごとを優先したいと反発しています。',choices:[choice('central','本部の統一方針を優先する','結束＋8／地方信頼−10・候補の層の党支持−4'),choice('local','地元支部へ裁量を渡す','結束−4／地方信頼＋10・候補の層の党支持＋5'),ch('mediate','地域ごとの公約を調整する','人脈50が必要／結束＋4・地方信頼＋5',6,0,s.network<50)]};
  if(s.event==='party_pressure'){
   const i=pressureGroup(s);
   return {speaker:layer(i)+'に近い党内グループ',title:'「これからの公認も、私たちのために」',body:layer(i)+'向けの公認と譲歩が重なり、党への要求が強まりました。「'+problems[i]+'」。高い支持そのものではなく、公認を通じた依存が原因です。',choices:[choice('yield','勝つために要求を受け入れる','対象層の党支持＋10・結束＋8／対立層の党支持−8・広がり−10・党清潔度−5・圧力＋2'),choice('limit','公認の基準を公開し、優先枠を拒む','対象層の党支持−8・結束−8／広がり＋5・党清潔度＋5・圧力−3'),ch('negotiate','他の層を含めた合意をつくる','政策力判定：成功なら圧力−3・結束＋3・広がり＋5／失敗なら結束−6・対象層の党支持−4',6)]};
  }
  if(s.event==='party_rebel')return {speaker:name,title:'「党には協力する。でも、この法案には反対だ」',body:name+'が、公認時に掲げた地元の公約と党の法案が矛盾すると訴えています。'+(r.elected?'当選した仲間との合意が問われます。':'まだ総選挙前の候補ですが、党の方針への異議を公にしています。'),choices:[choice('whip',r.elected?'党議拘束をかけて従わせる':'党方針への同意を公認の条件にする','結束＋8／地方信頼−8・候補の層の党支持−6・派閥不満＋1'),ch('persuade','候補の公約を踏まえて説得する','人脈判定：成功なら結束＋6・地方信頼＋3／失敗なら結束−5・派閥不満＋2',6),choice('amend','負担を減らす修正を受け入れる','広がり＋5・地方信頼＋5／結束−4・派閥不満＋1'),choice('leave','離党を認める','党清潔度＋2／結束−8・獲得議席見込み−4／候補が離党')]};
  if(s.event==='party_reunion')return {speaker:name,title:'公認候補が、地域の声を持ち帰った',body:name+'は、選挙の応援を一度きりにせず、住民と党が話せる場を続けたいと提案します。',choices:[ch('listen','住民との対話を続ける','広がり＋6・地方信頼＋5・候補の層の党支持＋4／人脈＋2',6),choice('loyal','党への忠誠を先に確かめる','結束＋6／広がり−4'),choice('delegate','政策チームへつなぐ','政策力50が必要／候補者の質＋6・党清潔度＋2',0,0,s.policy<50)]};
  return null;
 }
 function next(s){
  s.event=null;s.stage='main';s.partyOps.subject=null;
 }
 function pressureGroup(s){return s.partyOps.pressure.map((v,i)=>({v,i})).filter(x=>x.v>=4&&support(s,x.i)>=55).sort((a,b)=>b.v-a.v||a.i-b.i)[0]?.i??s.partyOps.core;}
 function duePressure(s){return s.partyOps.pressure.some((x,i)=>x>=4&&support(s,i)>=55);}
 function prepare(s){
  const p=s.partyOps;
  if(s.turn%2){s.event='party_nominate';s.stage='event';return;}
  const r=p.slate.at(-1),c=profile(r.id);p.subject=r.id;
  const kind=s.turn===6&&duePressure(s)&&!p.seen.includes('party_pressure')?'party_pressure':({bridge:'party_bridge',sponsor:'party_sponsor',star:'party_scandal',local:'party_local',expert:'party_reunion',loyal:'party_local'})[c.type];
  s.event=kind==='party_bridge'&&r.group===p.core?'party_reunion':kind;s.stage='event';
 }
 function choose(s,id){
  const ev=event(s),opt=ev?.choices.find(x=>x.id===id);if(!opt||opt.disabled)return false;
  const p=s.partyOps,type=s.event,r=subject(s);log(s,ev.title+' → '+opt.title);
  if(type==='party_nominate'){nominate(s,profile(id));next(s);return true;}
  const group=r?.group??p.core;
  if(type==='party_bridge'){
   if(id==='dialogue'){s.energy-=6;if(G.check(s,'party_dialogue')){add(s,'cohesion',8);add(s,'breadth',3);}else add(s,'cohesion',-4);}
   if(id==='force'){add(s,'cohesion',10);add(s,'breadth',-8);reach(s,group,-8);r.relationship='党方針への全面同意を要求';}
   if(id==='defend'){add(s,'cohesion',-5);add(s,'breadth',5);reach(s,group,4);r.relationship='政策の違いを党首が守った';}
  }
  if(type==='party_sponsor'){
   if(id==='accept'){reach(s,11,8);add(s,'cohesion',5);add(s,'integrity',-10);pressure(s,11,2);G.mechanics.debt(s,11,2);s.debts.at(-1).name='黒田の推薦団体（公認枠の約束）';}
   if(id==='refund'){s.money-=cost(s,100);add(s,'integrity',8);reach(s,11,-6);pressure(s,11,-2);}
   if(id==='refuse'){add(s,'integrity',3);reach(s,11,-10);add(s,'cohesion',-4);pressure(s,11,-1);}
  }
  if(type==='party_scandal'){
   if(id==='explain'){s.energy-=4;if(G.check(s,'party_explain'))add(s,'integrity',4);else{add(s,'integrity',-6);reach(s,7,-6);}}
   if(id==='withdraw'){add(s,'integrity',8);reach(s,group,-8);add(s,'cohesion',-5);r.status='公認取消';}
   if(id==='shield'){add(s,'cohesion',6);add(s,'integrity',-12);reach(s,7,-8);pressure(s,group,2);}
  }
  if(type==='party_local'){
   if(id==='central'){add(s,'cohesion',8);add(s,'local',-10);reach(s,group,-4);}
   if(id==='local'){add(s,'cohesion',-4);add(s,'local',10);reach(s,group,5);}
   if(id==='mediate'){s.energy-=6;add(s,'cohesion',4);add(s,'local',5);}
  }
  if(type==='party_pressure'){
   const i=pressureGroup(s);
   if(id==='yield'){reach(s,i,10);add(s,'cohesion',8);add(s,'breadth',-10);add(s,'integrity',-5);pressure(s,i,2);for(const j of G.groups[i][7])reach(s,j,-8);}
   if(id==='limit'){reach(s,i,-8);add(s,'cohesion',-8);add(s,'breadth',5);add(s,'integrity',5);pressure(s,i,-3);}
   if(id==='negotiate'){s.energy-=6;if(G.check(s,'party_negotiate')){pressure(s,i,-3);add(s,'cohesion',3);add(s,'breadth',5);}else{add(s,'cohesion',-6);reach(s,i,-4);}}
  }
  if(type==='party_rebel'){
   if(id==='whip'){add(s,'cohesion',8);add(s,'local',-8);reach(s,group,-6);s.factionAnger+=1;}
   if(id==='persuade'){s.energy-=6;if(G.check(s,'party_dialogue')){add(s,'cohesion',6);add(s,'local',3);}else{add(s,'cohesion',-5);s.factionAnger+=2;}}
   if(id==='amend'){add(s,'breadth',5);add(s,'local',5);add(s,'cohesion',-4);s.factionAnger+=1;}
   if(id==='leave'){add(s,'integrity',2);add(s,'cohesion',-8);r.status='離党';}
  }
  if(type==='party_reunion'){
   if(id==='listen'){s.energy-=6;add(s,'breadth',6);add(s,'local',5);reach(s,group,4);s.network=clamp(s.network+2);}
   if(id==='loyal'){add(s,'cohesion',6);add(s,'breadth',-4);}
   if(id==='delegate'){add(s,'quality',6);add(s,'integrity',2);}
  }
  const marker=(active(s)?'':'gov:')+type;if(!p.seen.includes(marker))p.seen.push(marker);
  s.history.push({chapter:s.chapter,turn:s.turn,kind:'党運営',text:ev.title+'：'+opt.title,publicity:3});
  p.resume=null;next(s);return true;
 }
 const actions=[
  ['party_tour','候補と全国を回る','体力−12／党全体の選挙力＋2・候補の層の党支持＋3・知名度＋1'],
  ['party_talk','党内の対話を重ねる','体力−8／党内結束＋7・人脈＋2'],
  ['party_train','候補の政策研修','資金を使い候補者の質＋10・政策力＋2／体力−6'],
  ['party_donors','個人サポーターを募る','体力−10／小口の活動資金・人脈＋1'],
  ['party_rest','休養して態勢を整える','体力＋30／この期の党活動は行わない']
 ];
 function allowed(s,id){return active(s)&&s.stage==='main'&&actions.some(x=>x[0]===id)&&s.energy>=({party_tour:12,party_talk:8,party_train:6,party_donors:10,party_rest:0}[id])&&(id!=='party_train'||s.money>=cost(s,50));}
 function action(s,id){
  if(!allowed(s,id))return false;const p=s.partyOps;
  if(id==='party_tour'){s.energy-=12;p.campaignBoost+=2;for(const r of p.slate.filter(r=>r.status==='公認'))reach(s,r.group,3);s.fame=clamp(s.fame+1);}
  if(id==='party_talk'){s.energy-=8;add(s,'cohesion',7);s.network=clamp(s.network+2);}
  if(id==='party_train'){s.energy-=6;s.money-=cost(s,50);add(s,'quality',10);s.policy=clamp(s.policy+2);}
  if(id==='party_donors'){s.energy-=10;s.money+=cost(s,60+Math.floor((s.network+s.fame)/5));s.network=clamp(s.network+1);}
  if(id==='party_rest')s.energy=clamp(s.energy+30);
  log(s,actions.find(x=>x[0]===id)[1]);
  G.settleBudget(s);
  if(s.turn<6){s.turn++;prepare(s);return true;}
  p.complete=true;s.stage='end';s.event=null;
  if(p.opposition){
   const own=G.votes(s),party=G.Legislature.partySeats(s),coalition=['coalition','joint'].includes(s.alliance)&&party.seats>=150;
   p.result={ownWon:own.player>own.rival,seats:party.seats,majority:party.majority,coalition,won:own.player>own.rival&&(party.majority||coalition),nomination:party.nomination};
   s.result={...own,won:p.result.ownWon,party};s.ruling=p.result.won;
   for(const r of p.slate)r.elected=r.status==='公認'&&party.seats>=Math.round(220-profile(r.id).quality*.6);
   if(!p.result.won)s.finalScore=Math.round(80+s.clean+party.seats/5);
   log(s,'党首として臨んだ総選挙：'+party.seats+'議席。'+(p.result.won?'政権交代を実現した。':'政権獲得には届かなかった。'));
  }
  return true;
 }
 function seatEffect(s){
  const p=s.partyOps;if(!p)return {bonus:0,quality:0,breadth:0,cohesion:0,local:0,capture:0,integrity:0,vacancy:0};
  const out={quality:Math.round((p.quality-50)*.2),breadth:Math.round(p.breadth*.2),cohesion:Math.round((p.cohesion-50)*.15),local:Math.round((p.local-50)*.1),capture:-p.pressure.reduce((a,n)=>a+Math.max(0,n-3)*2,0),integrity:-Math.round(Math.max(0,50-p.integrity)*.2),vacancy:-p.slate.filter(r=>r.status!=='公認').length*4};
  for(const key of Object.keys(out))out[key]=out[key]||0;
  out.bonus=clamp(Object.values(out).reduce((a,b)=>a+b,0),-35,30);return out;
 }
 function govInterrupt(s){
  const p=s.partyOps;if(!p?.complete||s.chapter!=='government'||s.stage!=='main'||s.govPhase!=='run')return;
  const pick=p.slate.find(r=>r.status==='公認'&&['bridge','local'].includes(profile(r.id).type));
  let id=null,r=null;
  if(s.turn>=2&&duePressure(s)&&!p.seen.includes('gov:party_pressure'))id='party_pressure';
  else if(s.turn>=3&&pick&&!p.seen.includes('gov:party_rebel')){id='party_rebel';r=pick;}
  else if(s.turn>=5&&p.integrity<55&&!p.seen.includes('gov:party_scandal')){id='party_scandal';r=p.slate.find(r=>r.status==='公認');}
  else if(s.turn>=6&&pick&&!p.seen.includes('gov:party_reunion')){id='party_reunion';r=pick;}
  if(id&&(r||id==='party_pressure')){s.event=id;s.stage='event';p.subject=r?.id||null;p.resume='main';}
 }
 function summary(s){
  const p=s.partyOps;if(!p)return '';
  const names=p.slate.map(r=>profile(r.id).name).join('、');
  return names+'を公認しました。'+(Math.max(...p.pressure)>=4?'特定の支持層へ公認と譲歩を重ね、党の判断への圧力を残しました。':p.breadth>=25?'異なる立場を迎え、支持の広がりを持つ党をつくりました。':'党の既存基盤と新しい人材の配分を探りました。')+(p.cohesion<40?'一方、党内の合意には課題を残しました。':'')+(p.slate.some(r=>r.status==='離党')?'公認した候補との離別も経験しました。':'');
 }
 function validate(s){
  const p=s.partyOps;if(p===undefined)return !active(s)&&!ids.includes(s.event);
  const num=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max,group=i=>Number.isInteger(i)&&i>=0&&i<12;
  const arr=(v,n,test)=>Array.isArray(v)&&v.length===n&&v.every(test);
  if(!p||p.version!==1||!group(p.core)||!group(p.weak)||!arr(p.baseLikes,12,x=>num(x,-50,100))||!arr(p.reach,12,x=>num(x,-40,40))||!arr(p.pressure,12,x=>Number.isInteger(x)&&num(x,0,12)))return false;
  if(Object.keys(labels).some(k=>!num(p[k],0,100))||!num(p.campaignBoost,0,12))return false;
  if(typeof p.complete!=='boolean'||typeof p.opposition!=='boolean'||!Array.isArray(p.slate)||p.slate.length>3||new Set(p.slate.map(r=>r.id)).size!==p.slate.length)return false;
  if(!p.slate.every((r,i)=>r&&rounds[i].includes(r.id)&&group(r.group)&&['公認','公認取消','離党'].includes(r.status)&&typeof r.relationship==='string'&&r.relationship.length<100&&(r.elected===null||typeof r.elected==='boolean')))return false;
  if(!Array.isArray(p.seen)||p.seen.length>20||new Set(p.seen).size!==p.seen.length||!p.seen.every(x=>ids.includes(x.replace(/^gov:/,''))))return false;
  if(![null,'main'].includes(p.resume)||(p.subject!==null&&!p.slate.some(r=>r.id===p.subject)))return false;
  if(p.complete&&p.slate.length!==3)return false;
  if(p.result!==null&&(!p.complete||!p.opposition||!p.result||!['won','ownWon','majority','coalition'].every(k=>typeof p.result[k]==='boolean')||!Number.isInteger(p.result.seats)||!num(p.result.seats,0,465)))return false;
  if(active(s)){
   if(!s.leaderResult?.won||!Number.isInteger(s.turn)||!num(s.turn,1,6)||!['event','main','end'].includes(s.stage))return false;
   const expected=Math.floor((s.turn+1)/2)-(s.event==='party_nominate'?1:0);
   if(p.slate.length!==expected||p.complete!==(s.stage==='end'))return false;
   if(s.stage==='event'&&!event(s))return false;
   if(p.complete&&p.opposition&&!p.result)return false;
  }
  if(ids.includes(s.event)&&s.chapter==='government'&&(p.resume!=='main'||!p.complete||!event(s)))return false;
  if(ids.includes(s.event)&&s.event!=='party_nominate'&&s.event!=='party_pressure'&&!subject(s))return false;
  return true;
 }
 G.Nominations={profiles,rounds,ids,labels,begin,event,plan,target,seatEffect,support,validate,summary,govInterrupt,actions,allowed};
 const base={event:G.event,choose:G.choose,action:G.action,allowed:G.allowed,actionsFor:G.actionsFor};
 G.event=s=>ids.includes(s.event)?event(s):base.event(s);
 G.choose=(s,id)=>ids.includes(s.event)?choose(s,id):base.choose(s,id);
 G.actionsFor=s=>active(s)?actions:base.actionsFor(s);
 G.allowed=(s,id)=>active(s)?allowed(s,id):base.allowed(s,id);
 G.action=(s,id,...args)=>active(s)?action(s,id):base.action(s,id,...args);
 G.Legislature.beginParty=begin;
 if(typeof module!=='undefined')module.exports=G.Nominations;
})(typeof window!=='undefined'?window:globalThis);
