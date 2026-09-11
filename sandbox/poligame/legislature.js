(function(root){
 'use strict';
 const G=root.Game, {clamp}=G;
 const {random,log,change,debt,population}=G.mechanics;
 const base={create:G.create,event:G.event,choose:G.choose,action:G.action,allowed:G.allowed,continueResult:G.continueResult};
 const committees=[
  {name:'厚生労働',label:'年金・子育て・働く人',groups:[0,1]},
  {name:'農林水産',label:'農業と地域の産業',groups:[6,11]},
  {name:'経済産業',label:'企業と産業の政策',groups:[4,11]},
  {name:'総務',label:'地方と都市の暮らし',groups:[6,7]},
  {name:'法務',label:'家族と権利の制度',groups:[8,9]},
  {name:'外務',label:'外交と安全保障',groups:[8]}
 ];
 const bills=[
  {name:'年金支給額の引き上げ',benefit:[0],burden:[1,2],x:8,force:2},
  {name:'児童手当の拡充',body:'高齢者の医療費負担を増やし、子育て支援に回す案です。',benefit:[1],burden:[0],x:8,force:2},
  {name:'消費税率の引き上げ',body:'消費税を増やして、社会保障の財源を確保する案です。',benefit:[0],burden:[2,3,7],x:10,force:3},
  {name:'解雇規制の緩和',benefit:[4],burden:[5,3],x:8,force:2},
  {name:'農産物の関税引き下げ',benefit:[7,4],burden:[6],x:8,force:2},
  {name:'安全保障の強化',benefit:[8],burden:[9],x:10,force:3},
  {name:'選択的夫婦別姓',benefit:[9,2],burden:[8,10],x:6,force:1},
  {name:'公共事業予算の増額',benefit:[11,6],burden:[7],x:6,force:2},
  {name:'宗教法人への規制強化',benefit:[7,9],burden:[10],x:8,force:1},
  {name:'最低賃金の大幅引き上げ',benefit:[3,5],burden:[4,11],x:8,force:2},
  {name:'法人税の減税',benefit:[4,11],burden:[3,5],x:6,force:2},
  {name:'高齢者の運転免許返納の義務化',benefit:[1,7],burden:[0,6],x:6,force:1}
 ];
 const termActions=[
  ['question','国会で質問する','選んだ層の課題を取り上げる。政策力で判定。','体力 −12'],
  ['committee','委員会で活動する','担当する分野の支持を育てる。対立層は離れる。','体力 −8'],
  ['local','地元で活動する','各層の話を聞き、地盤を固める。','体力 −10'],
  ['faction','派閥の会合に出る','党内の影響力を育てる。3回ごとに長老への借り。','体力 −8'],
  ['abroad','海外を視察する','政策力で判定。成功なら政策力・知名度・無党派の支持が伸びる。','体力 −8']
 ];
 // Actions unlocked only in the second term (mid-career).
 const term2Actions=[
  ['study_group','勉強会を立ち上げる','無派閥の議員とつながり、党内で存在感を築く。','資金 −100万 / 体力 −8'],
  ['stump','応援演説に立つ','党のほかの候補を助け、党の議席に貢献する。','体力 −10']
 ];
 // §11.5 看板政策：第3期のT10と党首選で使う。
 const platforms=[
  {name:'高齢者の暮らしを守る',benefit:[0,6],burden:[2,3]},
  {name:'現役世代の負担を減らす',benefit:[1,2,3],burden:[0]},
  {name:'産業を強くする',benefit:[4,11],burden:[5,3]},
  {name:'格差をただす',benefit:[3,5],burden:[4,11]}
 ];
 // §7.5 党首選の対立候補（AI）3タイプ。layers は党員票で優位に立つ層。
 const rivals=[
  {name:'派閥の長',diet:.44,member:.18,layers:[10,11,6,8]},
  {name:'改革派スター',diet:.14,member:.44,layers:[7,2,1]},
  {name:'バランス型',diet:.30,member:.30,layers:[0,3,5]}
 ];
 // §12/§13 終章の毎ターン行動。対象を取らず、1ターン1つ。
 const govActions=[
  ['publicity','党の広報を強化する','党の活動資金で広報チームを動かす。無党派への説明を強化。','活動資金を使用'],
  ['policy','看板政策を推し進める','国会通過を狙う。恩恵層は喜び、負担層は離れる。','任期中3本まで'],
  ['diplomacy','外遊・首脳会談に臨む','弁舌で判定。成功で支持率と保守層。','弁舌判定'],
  ['presser','記者会見で国民に説明する','今期の支持率の自然減を打ち消す。','無党派＋2'],
  ['faction_care','派閥に配慮する','ポストと予算で不満を抑える。','派閥不満−3 / 無党派−3'],
  ['tighten','党内を引き締める','党内の結束を固める。','党内影響力＋3 / 派閥不満＋1'],
  ['dissolve','衆議院を解散する','いま国民の信を問う。最終選挙へ。','最終選挙']
 ];
 const eventIds=['committee_select','faction_select','bill','officers','petitions','term_campaign','term_review','term_collect'];
 const term2EventIds=['role_offer','vice_minister','faction_rank','national_debate','term2_collect'];
 const term3EventIds=['cabinet_offer','alliance','boss_demand','platform','general_election','term3_collect'];
 const leaderEventIds=['leader_start','leader_faction','leader_policy','leader_debate','leader_ground','leader_runoff'];
 const govEventIds=['gov_cabinet','gov_surprise','gov_incident','gov_resign','gov_election','gov_handout','gov_dissolve'];
 const allEventIds=eventIds.concat(term2EventIds,term3EventIds,leaderEventIds,govEventIds);
 const incidents={
  disaster:{name:'大規模災害',stat:'policy',good:'支持率＋6・地方＋5',bad:'支持率−8'},
  foreign:{name:'外交危機',stat:'speech',good:'支持率＋5・保守＋5',bad:'支持率−6・保守−5'},
  economy:{name:'景気の悪化',stat:null,good:'',bad:'支持率−5・貧困−5・経営者−5（経済政策なら軽減）'},
  scandal:{name:'閣僚スキャンダル',stat:null,good:'',bad:''},
  gaffe:{name:'与党議員の失言',stat:'speech',good:'謝罪で支持率−2',bad:'放置で支持率−5・都市無党派−8'},
  inflation:{name:'物価高'},abroad_disaster:{name:'外遊中の災害'},domino:{name:'閣僚の辞任ドミノ'}
 };
 const isTerm=s=>s.chapter==='term'||s.chapter==='term2'||s.chapter==='term3';
 const isTerm2=s=>s.chapter==='term2';
 const isTerm3=s=>s.chapter==='term3';
 const isLeader=s=>s.chapter==='leadership';
 const isGov=s=>s.chapter==='government';
 const hasParty=s=>s.nomination!=='無所属';
 const names=ids=>ids.map(i=>G.groups[i][0]).join('・');
 function record(s,text,kind,extra={}){s.history.push({turn:s.turn,chapter:s.chapter,text,kind,publicity:3,...extra});}
 function influence(s,amount){const half=amount>0&&hasParty(s)&&[0,2].includes(s.party)&&s.faction==='none';s.influence=clamp(s.influence+amount*(half?.5:1));}
 // §11.6 national seat projection: each party's coefficient per layer, summed over the 混合区 electorate.
 // opt（終章の最終選挙）：{approval} で支持率補正、{platform} で看板政策の恩恵/負担層に係数補正を加える。
 function partySeats(s,opt){
  const ruling=[0,3],a=s.governmentApproval;
  const totalShare=G.groups.reduce((sum,g)=>sum+g[1],0);
  // §11.6 プレイヤー寄与：党三役 ×0.3、大臣 ×0.2、それ以外 ×0.1。
  const roleMult=s.cabinet==='exec'?.3:s.cabinet==='minister'||s.viceMinister||(s.role&&s.role!=='none')?.2:.1;
  const allianceMult=s.alliance==='joint'?1.1:s.alliance==='broke'?.85:1;
  const approvalBias=opt&&opt.approval!=null?(opt.approval-50)/100:0;
  const plat=opt&&opt.platform!=null?platforms[opt.platform]:null;
  const raw=G.parties.map((P,pi)=>{
   const mine=hasParty(s)&&pi===s.party;
   const gov=ruling.includes(pi)?(a-50)*.4:(50-a)*.3;
   const bonus=mine?(s.nationalFame?4:0)+(s.partySupport||0):0;
   let score=0;
   for(let i=0;i<12;i++){
    const nShare=G.groups[i][1]/totalShare,turnout=G.groups[i][4];
    const contrib=mine?s.likes[i]*roleMult:0;
    let coeff=clamp((P.likes[i]+contrib+bonus+gov+20)/120,0,1);
    if(mine)coeff=clamp(coeff+approvalBias+(plat?(plat.benefit.includes(i)?.05:plat.burden.includes(i)?-.05:0):0),0,1);
    score+=nShare*turnout*coeff;
   }
   return score*(mine?allianceMult:1);
  });
  const sum=raw.reduce((x,y)=>x+y,0);
  const voteShare=sum&&hasParty(s)?raw[s.party]/sum:0;
  const seats=Math.round(Math.min(voteShare*1.3,.6)*465);
  return {voteShare,seats,total:465,majority:seats>=233};
 }
 function result(s){s.result=G.votes(s);s.result.won=s.result.player>s.result.rival;if(isTerm2(s))s.result.party=partySeats(s);s.stage='result';s.event=null;log(s,isTerm2(s)?'2期目の任期を終え、3度目の選挙が開票された。':'任期を終え、2度目の選挙が開票された。');}
 function prepare(s){
  s.postAction=false;s.pendingEvents=[];
  if(isTerm3(s)){
   if(s.turn===1)s.pendingEvents.push('cabinet_offer');
   if(s.turn===4)s.pendingEvents.push('alliance');
   if(s.turn===8)s.pendingEvents.push('boss_demand');
   if(s.turn===10)s.pendingEvents.push('platform');
   if(s.turn===12){s.result=G.votes(s);s.result.won=s.result.player>s.result.rival;s.result.party=partySeats(s);s.pendingEvents.push('general_election');}
  }else if(isTerm2(s)){
   if(s.turn===1)s.pendingEvents.push('role_offer');
   if(s.turn===8)s.pendingEvents.push('vice_minister');
   if(s.turn===10)s.pendingEvents.push('faction_rank');
   if(s.turn===12)s.pendingEvents.push('national_debate');
   if(s.turn===14)s.pendingEvents.push('term_campaign');
  }else{
   if(s.turn===1)s.pendingEvents.push('committee_select');
   if(s.turn===2)s.pendingEvents.push('faction_select');
   if(s.turn===10)s.pendingEvents.push('officers');
   if(s.turn===12)s.pendingEvents.push('petitions');
   if(s.turn===14)s.pendingEvents.push('term_campaign');
  }
  if(s.turn%2===0)s.pendingEvents.push('bill');
  // 条件イベント：固定イベントも採決もないターンの主行動前に1本だけ。
  if(s.turn>=3){const extra=s.pendingEvents.length?G.Extra?.pickGrowth(s):G.Extra?.pick(s);if(extra)s.pendingEvents.push(extra);}
  advance(s);
 }
 function advance(s){
  if(isTerm3(s)&&s.term3Failed){s.event=null;s.stage='end';return;}
  if(s.pendingEvents.length){s.event=s.pendingEvents.shift();s.stage='event';return;}
  s.event=null;
  if(!s.postAction){s.stage='main';return;}
  G.settleBudget(s);
  const target=s.turn%3===0?s.likes.indexOf(Math.max(...s.likes)):s.rival.indexOf(Math.max(...s.rival));
  s.rival[target]=clamp(s.rival[target]+2,-50,100);s.rivalFame=clamp(s.rivalFame+1);
  s.governmentApproval=clamp(s.governmentApproval+(random(s)*6-3));
  const direction=s.party===0||s.party===3?1:-1;
  s.wind=hasParty(s)?clamp(direction*(s.governmentApproval-50)/100*(s.party===4?3:1),-.9,.9):0;
  log(s,'対抗馬は'+names([target])+'を訪問。政権支持率は'+Math.round(s.governmentApproval)+'%。');
  s.mandate=!!s.nextMandate;s.nextMandate=false;
  if(s.turn===16){
   if(isTerm3(s)){s.event=null;s.stage='end';log(s,'第3期を終えた。いよいよ党首選が近づく。');return;}
   result(s);return;
  }
  s.turn++;prepare(s);
 }
 function finishTurn(s){
  s.postAction=true;s.pendingEvents=[];
  if(s.turn===6&&!isTerm2(s)){
   s.collection=s.debts.filter(d=>(d.chapter||'prologue')==='prologue'&&['未回収','一部履行'].includes(d.status)&&!s.collectedDebtIds.includes(d.id))
    .sort((a,b)=>b.weight-a.weight||a.id-b.id).slice(0,Math.max(0,2-s.collectedDebtIds.length)).map(d=>d.id);
   if(s.collection.length)s.pendingEvents.push('term_collect');
  }
  if(s.turn===6&&isTerm2(s)){
   const done=new Set([...(s.collectedDebtIds||[]),...s.collectedDebtIds2]);
   s.collection=s.debts.filter(d=>(d.chapter||'prologue')!=='term2'&&['未回収','一部履行'].includes(d.status)&&!done.has(d.id))
    .sort((a,b)=>b.weight-a.weight||a.id-b.id).slice(0,2).map(d=>d.id);
   if(s.collection.length)s.pendingEvents.push('term2_collect');
  }
  if(s.turn===6&&isTerm3(s)){
   const done=new Set([...(s.collectedDebtIds||[]),...(s.collectedDebtIds2||[]),...s.collectedDebtIds3]);
   s.collection=s.debts.filter(d=>!['term3','leadership'].includes(d.chapter||'prologue')&&['未回収','一部履行'].includes(d.status)&&!done.has(d.id))
    .sort((a,b)=>b.weight-a.weight||a.id-b.id).slice(0,2).map(d=>d.id);
   if(s.collection.length)s.pendingEvents.push('term3_collect');
  }
  if([4,11].includes(s.turn)&&random(s)<clamp((100-s.clean)*.005+s.newBusiness*.03,0,.95))s.pendingEvents.push('scandal');
  if(s.turn===15)s.pendingEvents.push('term_review');
  advance(s);
 }
 function begin(s){
  if(s.stage!=='end'||!s.elected||isTerm(s))return false;
  s.version=2;s.chapter='term';s.turn=1;s.event=null;s.result=null;
  s.committee=null;s.faction=null;s.factionVisits=0;s.governmentApproval=50;
  s.bills=[...Array(bills.length).keys()];
  for(let i=s.bills.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.bills[i],s.bills[j]]=[s.bills[j],s.bills[i]];}
  s.bills=s.bills.slice(0,8);s.ballots=[];s.reelected=false;s.lastElectionRescue=false;
  s.rivalOrg??=Array(12).fill(0);
  s.collectedDebtIds=s.debts.filter(d=>d.status!=='未回収').map(d=>d.id).slice(0,2);
  s.termDiscipline=s.usedRescue&&hasParty(s);s.nominationCancelled=!!s.nominationCancelled;
  s.mandate=false;s.nextMandate=false;
  log(s,'第1期が始まった。1ターンは3か月。16ターン後、もう一度選挙に挑む。');
  prepare(s);return true;
 }
 // §11.4 第2期：中堅議員。第1期で再選した後に進める。
 function beginSecond(s){
  if(s.stage!=='end'||s.chapter!=='term'||!s.elected||!s.reelected)return false;
  s.chapter='term2';s.turn=1;s.event=null;s.result=null;
  s.bills=[...Array(bills.length).keys()];
  for(let i=s.bills.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.bills[i],s.bills[j]]=[s.bills[j],s.bills[i]];}
  s.bills=s.bills.slice(0,8);s.ballots=[];
  s.reelected=false;s.lastElectionRescue=false;
  s.role='none';s.viceMinister=false;s.factionRank=false;s.nationalFame=false;s.partySupport=0;
  s.collectedDebtIds2=[];s.termDiscipline=false;
  s.mandate=false;s.nextMandate=false;
  s.rivalOrg??=Array(12).fill(0);
  s.rivalFame=clamp(Math.max(s.rivalFame,38));
  log(s,'第2期が始まった。中堅議員として、党の中での立ち位置が問われる。');
  prepare(s);return true;
 }
 // §11.5 第3期：党の顔・与党化。第2期で再選した後に進める。
 function beginThird(s){
  if(s.stage!=='end'||s.chapter!=='term2'||!s.elected||!s.reelected)return false;
  s.chapter='term3';s.turn=1;s.event=null;s.result=null;
  s.bills=[...Array(bills.length).keys()];
  for(let i=s.bills.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[s.bills[i],s.bills[j]]=[s.bills[j],s.bills[i]];}
  s.bills=s.bills.slice(0,8);s.ballots=[];
  s.reelected=false;s.lastElectionRescue=false;
  s.cabinet='none';s.alliance='none';s.platform=null;s.leadershipSkip=false;s.term3Failed=false;
  s.ruling=!!G.parties[s.party].ruling&&hasParty(s);
  s.collectedDebtIds3=[];s.termDiscipline=false;
  s.mandate=false;s.nextMandate=false;
  s.rivalOrg??=Array(12).fill(0);
  s.rivalFame=clamp(Math.max(s.rivalFame,42));
  log(s,'第3期が始まった。党の顔として、与党化と党首の座が視野に入る。');
  prepare(s);return true;
 }
 // §7 党首選。第3期で再選し、派閥ボスの「出るな」に従っていなければ進める。
 function beginLeadership(s){
  if(s.stage!=='end'||s.chapter!=='term3'||!s.elected||!s.reelected||s.leadershipSkip||s.term3Failed)return false;
  s.chapter='leadership';s.turn=1;s.event='leader_start';s.stage='event';
  s.postPromises=0;s.prefVotes=0;s.debatePenalty=0;s.memberBoost=0;s.rivalDietCut=0;s.betrayed=false;
  s.factionZero=!!s.factionZero;s.leaderResult=null;
  log(s,'党首選が告示された。議員票と党員票、そして決選投票の都道府県票を争う。');
  return true;
 }
 function billInfo(s){
  const id=s.bills[s.turn/2-1],b=bills[id];
  if(!b)return null;
  const likes=G.parties[s.party].likes;
  const partyYes=b.benefit.reduce((a,i)=>a+likes[i],0)>b.burden.reduce((a,i)=>a+likes[i],0);
  return {id,b,partyYes};
 }
 function contradictions(s){
  const promised=s.policyStance==='elder'?[0]:s.policyStance==='child'?[1]:s.policyStance==='third'?[0,1]:[];
  return s.ballots.filter(v=>v.position!=='absent'&&promised.some(i=>v.hurt.includes(i))).length;
 }
 function getEvent(s){
  const c=(id,title,hint,disabled=false)=>({id,title,hint,disabled});
  switch(s.event){
   case 'committee_select':return {speaker:'秘書のタナカ',title:'どの分野を、担当しますか。',body:'選んだ委員会で4年間活動します。地元の支持者に近い分野か、これから育てたい分野か。あなたの最初の専門分野を決めましょう。',choices:committees.map((v,i)=>c(String(i),v.name+'の委員会に入る',v.label))};
   case 'faction_select':
    if(!hasParty(s))return {speaker:'同期のカミヤ',title:'無所属で、議会に居場所を作る。',body:'党や派閥からの指示はありません。自分の判断で法案に投票し、地元で信頼を育てていきましょう。',choices:[c('none','自分の道を進む','党の命令を受けずに活動する')]};
    if([0,2].includes(s.party))return {speaker:'派閥の長老',title:'「仲間は、多いほうがいい」',body:'党内の3つのグループから声がかかりました。入れば力になってもらえますが、長老への借りができます。入らなければ、影響力の伸びが半分になります。',choices:[c('regional','地域重視の派閥に入る','地方の支持者が喜ぶ／長老への借り'),c('economic','産業重視の派閥に入る','経営者が喜ぶ／長老への借り'),c('social','暮らし重視の派閥に入る','労働者が喜ぶ／長老への借り'),c('none','派閥に入らず活動する','自由を守る／党内影響力が育ちにくい')]};
    return {speaker:'党の幹部',title:'「党首の近くで、働かないか」',body:'党首を支えるチームへの誘いです。近くにいれば意見は届きますが、党の方針への協力も期待されます。',choices:[c('aide','党首のチームに加わる','党内影響力が上がる／党への借り'),c('none','距離を置いて活動する','地元の判断を優先できる')]};
   case 'bill':{
    const info=billInfo(s);if(!info)return null;const {b,partyYes}=info;
    const hint=yes=>names(yes?b.benefit:b.burden)+'が喜ぶ／'+names(yes?b.burden:b.benefit)+'が怒る';
    return {speaker:'本会議 / 第'+(s.turn/2)+'回の採決',title:b.name,body:(b.body||'この法案には、恩恵を受ける人と負担を背負う人がいます。')+(hasParty(s)?' 党は「'+(partyYes?'賛成':'反対')+'しろ」と指示しています。':' あなたは自分の判断で投票できます。'),choices:hasParty(s)?[
     c('follow','党に従って'+(partyYes?'賛成':'反対')+'する',hint(partyYes)),
     c('rebel','党に逆らって'+(partyYes?'反対':'賛成')+'する',hint(!partyYes)+(s.termDiscipline?'／比例救済の約束に反し、次回公認を失う':'／党内影響力が下がる')),
     c('absent','採決を欠席する','各層が失望する／欠席が記録される')
    ]:[c('yes','法案に賛成する',hint(true)),c('no','法案に反対する',hint(false)),c('absent','採決を欠席する','各層が失望する／欠席が記録される')]};
   }
   case 'officers':return {speaker:'同期のカミヤ',title:hasParty(s)?'党の役員選びが、始まっています。':'議会の仲間から、協力のお願い。',body:hasParty(s)?'幹部が推す候補を応援してほしいと言われました。自分の意思を通すか、党内での関係を優先するか。':'会派を超えた勉強会に誘われました。地元の予定と重なっています。',choices:[c('support','協力を引き受ける','人脈か党内影響力が上がる'),c('refuse','自分の予定を優先する','自由を守る／党内では距離ができる')]};
   case 'petitions':return {speaker:'後援会長のオオクボ',title:'3つのお願い。応えられるのは、1つ。',body:'年金生活者、子育て世帯、地元の事業者が相談に来ました。今回は1つだけ重点的に対応できます。',choices:[c('0','高齢者の相談に応える','高齢者が喜ぶ／子育て世帯と業界が落胆する'),c('1','子育て世帯の相談に応える','子育て世帯が喜ぶ／高齢者と業界が落胆する'),c('11','事業者の相談に応える','業界が喜ぶ／高齢者と子育て世帯が落胆する')]};
   case 'term_campaign':return {speaker:'秘書のタナカ',title:isTerm2(s)?'中堅議員の、4年間が問われます。':'今度は、4年間の仕事が問われます。',body:s.nominationCancelled?'党はあなたの公認を取り消しました。今回の選挙では比例復活を使えません。最後の3ターンは体力消費が2倍です。':isTerm2(s)?'任期の最後の3ターンです。体力消費が2倍になり、選挙広告も使えます。党がいくつ議席を取れるかも、あなたの評価につながります。':'任期の最後の3ターンです。体力消費が2倍になり、選挙広告を使えます。過去の採決も、支持者は覚えています。',choices:[c('go','再選に向けて動く','今の支持層・体力・資金を確認する')]};
   case 'term_review':return {speaker:'記者のサトウ',title:'「選挙の公約と、採決が違いませんか」',body:'記者があなたの公約と議会での投票を照らし合わせています。説明が必要な採決は'+contradictions(s)+'件です。',choices:[c('explain','採決の理由を説明する','弁舌で判定／公約との矛盾が多いほど難しい'),c('admit','方針が変わったことを認める','約束した層が失望する／履歴に説明を残す')]};
   case 'term_collect':case 'term2_collect':{
    const d=s.debts[s.collection[0]];if(!d)return null;
    return {speaker:d.name+'からの連絡',title:'「あのときの、お願いです」',body:'支援を受けたときの約束を、今こそ果たしてほしいと言われました。協力すれば、ほかの支持者が負担を背負います。',choices:[c('fulfill','約束を果たす','相手が喜ぶ／対立層が怒る'),c('partial','一部の協力にとどめる','資金'+G.funds(s,200)+'万円／重さ1の借りが残る',s.money<G.funds(s,200)),c('break','要求を断る','相手の組織票が対抗馬へ／再契約できなくなる')]};
   }
   case 'role_offer':{
    const rel=committees[s.committee]?.groups||[];
    return {speaker:'派閥の長老',title:'「そろそろ、役職を持て」',body:'大臣の下で政策を預かる役職の打診です。引き受ければ知名度と党内での力が伸び、担当分野の支持者に近づきますが、対立する層は離れます。',choices:[
     c('accept','打診を引き受ける',(rel.length?names(rel)+'が喜ぶ／':'')+'知名度＋5・党内影響力＋5／対立層が離れる'),
     c('decline','今回は引き受けない','自由に動ける／党内評価が少し下がる（影響力−3）')
    ]};
   }
   case 'vice_minister':{
    const ready=s.influence>=40,rel=committees[s.committee]?.groups||[];
    return {speaker:'党の幹部',title:ready?'「副大臣を、任せたい」':'副大臣の打診は、今回はなかった。',body:ready?'政権の中枢に近い役職です。知名度と影響力が大きく伸びますが、担当分野で負担を背負う層が離れ、政権支持率の下振れはあなたの評価にも響きます。':'副大臣には党内影響力40が必要でした。会合や質問で力を積み、次の機会に備えましょう。',choices:ready?[
     c('accept','副大臣を引き受ける',(rel.length?names([...new Set(rel.flatMap(i=>G.groups[i][7]))].filter(i=>!rel.includes(i)))+'が離れる／':'')+'知名度＋10・党内影響力＋8／政権と一蓮托生'),
     c('decline','今回は固辞する','影響力−3／自由を保つ')
    ]:[c('go','活動に戻る','影響力40で打診が届く')]};
   }
   case 'faction_rank':{
    const inFaction=hasParty(s)&&['regional','economic','social'].includes(s.faction);
    return {speaker:'同期のカミヤ',title:inFaction?'派閥の中で、次のポストを競う。':'派閥の外から、存在感を示す。',body:inFaction?'同期のライバルと、派閥内での序列を比べられています。影響力か知名度で上回れば「次はお前だ」と見なされます。':'派閥に属さないあなたに序列争いは関係ありません。地元の信頼を固めましょう。',choices:inFaction?[
     c('press','前に出て競う','勝てば影響力＋5・党の資金／負ければ影響力−2・選挙資金が細る'),
     c('yield','今回は譲る','影響力−3／波風は立てない')
    ]:[c('go','地元固めを続ける','各層の好感度が少し上がる')]};
   }
   case 'national_debate':{
    const count=contradictions(s);
    return {speaker:'全国テレビの討論番組',title:'「全国が、見ています」',body:'党を代表して討論に臨みます。弁舌が問われ、公約と採決の食い違い'+count+'件を突かれれば痛手です。',choices:[
     c('debate','正面から論戦する','弁舌で判定／成功で全国的な知名度・都市無党派＋／失敗で都市無党派−8'),
     c('safe','無難にやり過ごす','大きな上下はない／存在感も示せない')
    ]};
   }
   case 'cabinet_offer':return {speaker:'派閥の長老',title:'「そろそろ、党の看板を背負え」',body:'大臣か、党の要職か。どちらか1つを選べます。大臣は政権と運命を共にし、党三役は党の議席計算に直接効きます。',choices:[
    c('minister','大臣を引き受ける','知名度＋15／政権支持率と一蓮托生'),
    c('exec','党三役（幹事長格）を引き受ける','党内影響力＋15／党の全国議席への寄与が大きくなる'),
    c('decline','どちらも受けない','影響力−3／身軽さを保つ')
   ]};
   case 'alliance':
    if(s.ruling)return {speaker:'連立を組む相手党',title:'「連立を続けるなら、条件があります」',body:'相手党が自分たちの看板政策への協力を求めています。飲めば連立は続きますが、負担を背負う層が離れます。拒めば連立を離脱し、党の議席計算が不利になります。',choices:[
     c('accept','要求を飲んで連立を守る','負担層−10／連立相手への借り／議席計算は安定'),
     c('refuse','要求を拒んで連立を離脱する','党の全国議席 −15%／自由な立場に戻る')
    ]};
    return {speaker:'野党共闘の呼びかけ人',title:'「一本化すれば、勝てる選挙区がある」',body:'理念の遠い党との共闘話です。組めば党全体の議席は伸びますが、あなたの固定支持層の一部が離れ、相手党への借りが残ります。',choices:[
     c('join','共闘に加わる','党の全国議席 +10%／理念の遠い層−10／相手党への重い借り'),
     c('solo','単独で戦う','議席計算はそのまま／自分の支持層を守る')
    ]};
   case 'boss_demand':{
    const inFaction=hasParty(s)&&['regional','economic','social'].includes(s.faction);
    return {speaker:'派閥の長老',title:inFaction?'「今回は、お前が出るな」':'「今回は、見送っておけ」',body:'出馬を見送るよう打診されました。実績と人脈があれば、説得や後継指名で支持を保ったまま出馬できます。説得せず逆らうと派閥票を失い、従うと今回はここで終了します。',choices:[
     c('obey','長老の顔を立てて見送る','党首選をスキップ／党内での立場は守られる'),
     c('persuade','実績を示して長老を説得する','影響力60・人脈40・政策力50が必要／派閥の支持を保って出馬',s.influence<60||s.network<40||s.policy<50),
     c('successor','後継候補として推薦を受ける','影響力80・人脈60が必要／党内影響力＋5・派閥の支持を保つ',s.influence<80||s.network<60),
     c('defy','それでも党首選に出る','派閥の議員票がゼロになる／自分の意思を通す')
    ]};
   }
   case 'platform':return {speaker:'秘書のタナカ',title:'総理になったら、何をしますか。',body:'党首選と、その先の政権で掲げる看板政策を1つ選びます。恩恵を受ける層は喜び、負担を背負う層は離れます。',choices:platforms.map((p,i)=>c(String(i),p.name,names(p.benefit)+'が喜ぶ／'+names(p.burden)+'が負担'))};
   case 'general_election':{
    const won=s.result?.won,eligible=hasParty(s)&&s.nomination!=='公認取消'&&!s.nominationCancelled&&!s.usedRescue&&(s.result?.share||0)>=.42;
    if(won)return {speaker:'開票センター',title:'総選挙、開票。',body:'あなたは選挙区で議席を守りました。党全体の獲得議席で、与党か野党かが決まります。',choices:[c('go','党内の力関係を確かめる','党首選が視野に入る')]};
    if(eligible)return {speaker:'開票センター',title:'総選挙、開票。',body:'選挙区では及びませんでした。党の比例名簿での復活が残っています。受ければ議席は守れますが、党本部への重い借りが残ります。',choices:[
     c('rescue','比例復活を受ける','当選扱い／党本部への重さ3の借り'),
     c('accept','結果を受け入れる','ここで議員生活を終える')
    ]};
    return {speaker:'開票センター',title:'総選挙、開票。',body:'選挙区で敗れ、比例復活の条件も満たしませんでした。今回の挑戦は、ここまでです。',choices:[c('accept','結果を受け止める','これまでの歩みを振り返る')]};
   }
   case 'term3_collect':{
    const d=s.debts[s.collection[0]];if(!d)return null;
    return {speaker:d.name+'からの連絡',title:'「そろそろ、けじめを」',body:'古い約束の回収です。党の顔と呼ばれる今こそ、果たしてほしいと迫られています。',choices:[c('fulfill','約束を果たす','相手が喜ぶ／対立層が怒る'),c('partial','一部の協力にとどめる','資金'+G.funds(s,200)+'万円／重さ1の借りが残る',s.money<G.funds(s,200)),c('break','要求を断る','相手の組織票が対抗馬へ／再契約できなくなる')]};
   }
  }
  return base.event(s);
 }
 function choose(s,id){
  if(s.stage!=='event')return false;
  const ev=getEvent(s),opt=ev?.choices.find(c=>c.id===id);if(!opt||opt.disabled)return false;
  const type=s.event;
  if(!allEventIds.includes(type)){
   const historyStart=s.history.length;
   const ok=base.choose(s,id);
   if(ok)s.history.slice(historyStart).forEach(h=>h.chapter=s.chapter);
   // A donation inquiry resumes the pending action completion itself.
   if(ok&&type!=='reform'&&s.stage==='main')advance(s);
   return ok;
  }
  log(s,ev.title+' → '+opt.title);
  if(type==='committee_select')s.committee=Number(id);
  if(type==='faction_select'){
   s.faction=id;
   if(id!=='none'){
    influence(s,5);debt(s,-1,1);s.debts.at(-1).name=id==='aide'?'党首のチーム':'派閥の長老';
    const group={regional:6,economic:4,social:5}[id];if(group!==undefined)change(s,[[group,3]],true);
   }
  }
  if(type==='bill'){
   const {id:billId,b,partyYes}=billInfo(s);
   let position='absent',help=[],hurt=[];
   if(id==='absent'){change(s,G.groups.map((_,i)=>[i,-1]));influence(s,-2);}
   else{
    const yes=id==='yes'||(id==='follow'&&partyYes)||(id==='rebel'&&!partyYes);
    position=yes?'yes':'no';help=yes?b.benefit:b.burden;hurt=yes?b.burden:b.benefit;
    change(s,[...help.map(i=>[i,b.x*(id==='rebel'?1.5:1)]),...hurt.map(i=>[i,-b.x])]);
    if(id==='follow')influence(s,2);
    if(id==='rebel'){
     influence(s,-5*b.force);
     if(s.termDiscipline){s.nominationCancelled=true;log(s,'比例救済の約束に反したため、次回の公認が取り消された。');}
    }
    if(s.party===2&&hasParty(s)&&hurt.includes(5))s.org[5]*=.5;
   }
   s.ballots.push({billId,position,help,hurt,turn:s.turn,rebel:id==='rebel'});
   record(s,b.name+'：'+(position==='yes'?'賛成':position==='no'?'反対':'欠席'),id==='rebel'?'造反':position==='absent'?'欠席':'採決',{billId,position,help,hurt});
  }
  if(type==='officers'){if(hasParty(s))influence(s,id==='support'?3:-5);else if(id==='support')s.network=clamp(s.network+3);}
  if(type==='petitions'){const selected=Number(id);change(s,[0,1,11].map(i=>[i,i===selected?8:-3]));record(s,names([selected])+'の相談を優先','発言');}
  if(type==='term_campaign'&&s.nominationCancelled)s.nomination='公認取消';
  if(type==='term_campaign'&&isTerm2(s)&&hasParty(s)&&s.faction!=='none'){s.money+=G.funds(s,s.factionRank?200:100);log(s,'派閥から選挙資金を受け取った。');}
  if(type==='role_offer'){
   if(id==='accept'){
    s.role='政務官';s.fame=clamp(s.fame+5);influence(s,5);
    const rel=committees[s.committee]?.groups||[];
    const losses=[...new Set(rel.flatMap(i=>G.groups[i][7]))].filter(i=>!rel.includes(i));
    change(s,[...rel.map(i=>[i,5]),...losses.map(i=>[i,-5])]);
    record(s,'政務官に就任','役職');
   }else influence(s,-3);
  }
  if(type==='vice_minister'){
   if(s.influence>=40&&id==='accept'){
    s.viceMinister=true;s.fame=clamp(s.fame+10);influence(s,8);
    const rel=committees[s.committee]?.groups||[];
    const losses=[...new Set(rel.flatMap(i=>G.groups[i][7]))].filter(i=>!rel.includes(i));
    change(s,losses.map(i=>[i,-8]));
    record(s,'副大臣に就任','役職');
   }else if(id==='decline')influence(s,-3);
  }
  if(type==='faction_rank'){
   if(hasParty(s)&&['regional','economic','social'].includes(s.faction)){
    if(id==='press'){
     if(s.influence>=45||s.fame>=55){s.factionRank=true;influence(s,5);s.money+=G.funds(s,150);log(s,'派閥内で優位に立ち、党の資金も回ってきた。');}
     else{influence(s,-2);s.money=Math.max(0,s.money-G.funds(s,100));log(s,'序列争いに競り負け、派閥からの資金が細った。');}
    }else influence(s,-3);
   }else if(id==='go')change(s,G.groups.map((_,i)=>[i,1]));
  }
  if(type==='national_debate'){
   const count=contradictions(s),promised=s.policyStance==='elder'?[0]:s.policyStance==='child'?[1]:s.policyStance==='third'?[0,1]:[];
   if(id==='debate'){
    const success=random(s)<clamp((s.speech+30)/100-count*.1,.1,.95);
    if(success){s.nationalFame=true;s.fame=clamp(s.fame+6);change(s,[[7,4]]);log(s,'全国放送での論戦が高く評価された。');}
    else{change(s,[[7,-8]]);log(s,'討論でつまずき、都市無党派が離れた。');}
    if(count)change(s,promised.map(i=>[i,-5]));
   }
   record(s,'全国テレビ討論に'+(id==='debate'?'臨んだ':'無難に応じた'),'討論',{contradictions:count});
  }
  if(type==='cabinet_offer'){
   if(id==='minister'){s.cabinet='minister';s.fame=clamp(s.fame+15);record(s,'大臣に就任','役職');log(s,'大臣に就任。政権の浮沈と運命を共にする。');}
   else if(id==='exec'){s.cabinet='exec';influence(s,15);record(s,'党三役に就任','役職');log(s,'党の要職に就任。党の看板を背負う。');}
   else influence(s,-3);
  }
  if(type==='alliance'){
   if(id==='accept'){s.alliance='coalition';change(s,[[2,-10],[3,-10]]);debt(s,-1,2);s.debts.at(-1).name='連立を組む相手党';record(s,'連立相手の要求を受け入れた','連立');}
   else if(id==='refuse'){s.alliance='broke';log(s,'連立を離脱。党の議席計算は不利になった。');record(s,'連立を離脱した','連立');}
   else if(id==='join'){s.alliance='joint';change(s,[[9,-10],[8,-10]]);debt(s,-1,2);s.debts.at(-1).name='野党共闘の相手党';record(s,'野党共闘に加わった','共闘');}
   else if(id==='solo')record(s,'単独で戦う道を選んだ','共闘');
  }
  if(type==='boss_demand'){
   if(id==='obey'){s.leadershipSkip=true;log(s,'長老の顔を立て、今回の党首選は見送ることにした。');record(s,'党首選を見送った','党内');}
   else if(id==='persuade'||id==='successor'){s.factionZero=false;if(id==='successor')influence(s,5);record(s,id==='successor'?'長老から後継指名を受けた':'長老を説得して出馬','党内');}
   else{s.factionZero=true;influence(s,-3);log(s,'長老に逆らって党首選へ。派閥の議員票は当てにできない。');record(s,'長老に逆らって出馬を決めた','党内');}
  }
  if(type==='platform'){
   const p=platforms[Number(id)];if(p){s.platform=Number(id);change(s,[...p.benefit.map(i=>[i,10]),...p.burden.map(i=>[i,-8])]);record(s,'看板政策「'+p.name+'」を表明','公約',{group:p.benefit[0]});}
  }
  if(type==='general_election'){
   if(id==='rescue'){s.usedRescue=true;s.lastElectionRescue=true;debt(s,-1,3);s.reelected=true;s.result.won=false;log(s,'比例で復活し、議席を守った。');}
   else if(id==='go'){s.reelected=true;}
   else if(id==='accept'){s.reelected=false;s.term3Failed=true;s.pendingEvents=[];log(s,'選挙区で敗れ、議員生活を終えることになった。');}
   if(s.reelected){
    // 単独過半数、または与党系の党が連立込みで多数を保てるだけの議席。
    s.ruling=s.result.party.seats>=233||(s.alliance!=='broke'&&G.parties[s.party].ruling&&s.result.party.seats>=150)||(s.alliance==='joint'&&s.result.party.seats>=150);
    log(s,'党の獲得議席は約'+s.result.party.seats+'。'+(s.ruling?'与党として政権を担う。':'野党として次を狙う。'));
   }
  }
  if(type==='term3_collect'){
   const debtId=s.collection[0],remaining=s.collection.slice(1);
   const historyStart=s.history.length;
   s.event='collect';base.choose(s,id);s.collectedDebtIds3.push(debtId);
   s.history.slice(historyStart).forEach(h=>{h.chapter=s.chapter;h.turn=s.turn;});
   s.collection=remaining;
   if(remaining.length)s.pendingEvents.unshift('term3_collect');
  }
  if(type==='term_review'){
   const count=contradictions(s),promised=s.policyStance==='elder'?[0]:s.policyStance==='child'?[1]:s.policyStance==='third'?[0,1]:[];
   if(id==='explain'){
    const success=random(s)<clamp((s.speech+35)/100-count*.1,.1,.95);
    change(s,success?[[2,3],[3,3],[7,3]]:[[2,-5],[3,-5],[7,-5]]);
    if(count)change(s,promised.map(i=>[i,-5*count]));
    log(s,success?'説明は届いた。公約との違いは記録に残る。':'説明に苦しんだ。過去の公約が追及された。');
   }else if(count)change(s,promised.map(i=>[i,-5]));
   record(s,'公約と採決の違い'+count+'件について'+opt.title,'説明',{contradictions:count});
  }
  if(type==='term_collect'||type==='term2_collect'){
   const debtId=s.collection[0],remaining=s.collection.slice(1);
   const historyStart=s.history.length;
   s.event='collect';base.choose(s,id);
   (type==='term2_collect'?s.collectedDebtIds2:s.collectedDebtIds).push(debtId);
   s.history.slice(historyStart).forEach(h=>{h.chapter=s.chapter;h.turn=s.turn;});
   s.collection=remaining;
   if(remaining.length)s.pendingEvents.unshift(type);
  }
  advance(s);return true;
 }
 // ===== §7 党首選（leadership phase）=====
 function leaderEvent(s){
  const c=(id,title,hint,disabled=false)=>({id,title,hint,disabled});
  switch(s.event){
   case 'leader_start':return {speaker:'秘書のタナカ',title:'党首選、告示。',body:'対立候補は3人。「派閥の長」は議員票が固く、「改革派スター」は党員票と世論が強く、「バランス型」はどちらも中程度で決選の受け皿になります。1回戦で過半数を取れなければ、上位2人で決選投票です。',choices:[c('go','選挙戦に入る','これから4つの動きを選ぶ')]};
   case 'leader_faction':{
    const backed=hasParty(s)&&['regional','economic','social'].includes(s.faction)&&!s.factionZero;
    return {speaker:'派閥の長老',title:'「ポストの話を、しようか」',body:backed?'閣僚のポストを約束すれば、派閥やほかのグループの議員票が動きます。約束は「借り」として残り、党首になったら必ず守ることになります。':'あなたに派閥の後ろ盾はありません。それでも、ほかのグループにポストをちらつかせて票を集めることはできます。',choices:[
     c('two','2枠を約束して票を固める','議員票が大きく動く／組閣の借り2件'),
     c('one','1枠だけ約束する','議員票がいくらか動く／組閣の借り1件'),
     c('none','ポストは約束しない','クリーンなまま／議員票は伸びない')
    ]};
   }
   case 'leader_policy':return {speaker:'記者クラブ',title:'党員に、何を訴えますか。',body:'党首選で掲げる看板政策です。'+(s.platform!=null?'第3期で表明した「'+platforms[s.platform].name+'」を貫くこともできます。':''),choices:platforms.map((p,i)=>c(String(i),p.name+(s.platform===i?'（貫く）':''),names(p.benefit)+'に響く／'+names(p.burden)+'は離れる'))};
   case 'leader_debate':{
    const count=contradictions(s);
    return {speaker:'党首候補者討論会',title:'「あなたの言葉は、一貫していますか」',body:'弁舌が問われます。過去の採決との食い違い'+count+'件を突かれれば、党員票が削れます。',choices:[
     c('fight','正面から論戦する','弁舌で判定／成功で党員票＋／失敗で党員票−'),
     c('dodge','争点を避けてやり過ごす','党員票は動かない／存在感も示せない')
    ]};
   }
   case 'leader_ground':return {speaker:'秘書のタナカ',title:'残りの時間を、どう使いますか。',body:'地方をまわって都道府県代表の支持を固めるか、対立候補の足元を裏で崩すか。',choices:[
    c('team','全国遊説をチームに委託する','資金'+G.funds(s,100)+'万円／都道府県票＋14〜18・党員への訴求を強化',s.money<G.funds(s,100)),
    c('tour','地方を行脚する','決選投票の都道府県票＋／安全'),
    c('backroom','裏で切り崩す','党内影響力−8／成功で「派閥の長」の議員票−／失敗で「裏切り者」の烙印')
   ]};
   case 'leader_runoff':return {speaker:'決選投票を前に',title:'決選投票。相手は'+(s.leaderResult?.runoffOpp||'対立候補')+'。',body:'党員票は消え、議員票と都道府県票（47票）だけの勝負です。派閥に頭を下げてポストでまとめるか、世論を背負って派閥に圧をかけるか。',choices:[
    c('bow','派閥に頭を下げる','議員票を上積み／組閣の借りが増える'),
    c('public','世論を背負って圧をかける','都道府県票を上積み／派閥との溝は残る')
   ]};
  }
  return null;
 }
 function leadershipCoeffs(s){
  const P=G.parties[s.party];
  const dietTotal=Math.max(60,s.result?.party?.seats||120);
  const backed=hasParty(s)&&['regional','economic','social'].includes(s.faction)&&!s.factionZero;
  const homeSize=.30,otherSize=.24,mukaSize=.22;
  let myFrac=0;
  if(backed){
   let sup=.6;
   sup+=(s.factionRank||s.influence>=60)?.1:0;
   sup+=Math.min(2,s.postPromises||0)*.15;
   const bossDebts=s.debts.filter(d=>d.group<0&&['未回収','一部履行'].includes(d.status)).length;
   sup-=bossDebts*.05;sup-=s.betrayed?.2:0;
   myFrac+=homeSize*clamp(sup,0,1);
  }else myFrac+=homeSize*(s.betrayed?.05:.15);
  myFrac+=otherSize*2*clamp(.1+Math.min(2,s.postPromises||0)*.14,0,.55);
  const muka=(s.likes[3]+s.likes[7]+s.likes[2])/3;
  myFrac+=mukaSize*clamp((muka+20)/120,.1,.9);
  myFrac=clamp(myFrac,.03,.9);
  const myDiet=dietTotal*myFrac,rem=Math.max(0,dietTotal-myDiet);
  const rw=rivals.map((r,k)=>r.diet*(k===0?(1-clamp(s.rivalDietCut||0,0,.6)):1));
  const rwSum=rw.reduce((a,b)=>a+b,0)||1;
  const aiDiet=rw.map(w=>rem*w/rwSum);
  const memberTotal=100;
  const w=G.groups.map((_,i)=>Math.max(0,P.likes[i])+1),wSum=w.reduce((a,b)=>a+b,0);
  let myMember=0;const aiMember=[0,0,0];
  for(let i=0;i<12;i++){
   const mc=Math.max(.02,clamp((s.likes[i]+20)/120,0,1)*(1-clamp(s.debatePenalty||0,0,.6))+(s.memberBoost||0));
   const rc=rivals.map(r=>r.layers.includes(i)?.8:.32);
   const tot=mc+rc.reduce((a,b)=>a+b,0),share=memberTotal*w[i]/wSum;
   myMember+=share*mc/tot;
   rivals.forEach((r,k)=>aiMember[k]+=share*rc[k]/tot);
  }
  return {dietTotal,memberTotal,me:{diet:myDiet,member:myMember},ai:rivals.map((r,k)=>({name:r.name,diet:aiDiet[k],member:aiMember[k]}))};
 }
 function overallScore(s,stage,approval){
  const broken=s.debts.filter(d=>d.status==='踏み倒し').length;
  const betrayed=s.memory.filter(Boolean).length;
  return Math.round(stage*20+(approval||0)+s.clean-broken*10-betrayed*5);
 }
 function finalizeLeadership(s){
  const R=s.leaderResult;
  const broken=s.debts.filter(d=>d.status==='踏み倒し').length;
  const pending=s.debts.filter(d=>['未回収','一部履行'].includes(d.status)).length;
  const rebels=s.history.filter(h=>h.kind==='造反').length;
  let key,grade,label,text,toGovernment=false;
  if(R.won&&s.ruling){
   key='to_government';grade='-';label='与党第一党の党首へ';toGovernment=true;
   text='党首選を制しました。党は与党第一党。次は組閣、そして政権運営です。';
  }else if(R.won){key='eternal_opp';grade='C';label='万年野党の党首';text='党首選には勝ちましたが、党は野党のまま。総理指名選挙では数が足りません。次の総選挙が本当の勝負です。';}
  else if(pending===0&&broken===0&&rebels>=3){key='man_of_principle';grade='B';label='信念の人';text='党首選には敗れました。しかし借りを一つも残さず、筋を通した姿は党の内外に強い印象を残しました。';}
  else{key='party_elder';grade='C';label='党の要職に残る';text='党首選には届きませんでした。派閥の均衡の中で、あなたはなお党の中枢に席を持っています。次の機会を待ちます。';}
  R.ending={key,grade,label,text,toGovernment};
  s.stage='end';s.event=null;
  if(!toGovernment){R.score=overallScore(s,4,0);s.finalScore=R.score;}
  log(s,'党首選：'+label+(toGovernment?'':'（評価 '+grade+'）'));
 }
 function finishLeadership(s){
  const co=leadershipCoeffs(s),P=G.parties[s.party],ratio=P.leader||[.5,.5];
  const score=cd=>ratio[0]*(cd.diet/co.dietTotal)+ratio[1]*(cd.member/co.memberTotal);
  const list=[{name:'あなた',diet:co.me.diet,member:co.me.member,you:true},...co.ai].map(cd=>({...cd,score:score(cd)}));
  const ssum=list.reduce((a,c)=>a+c.score,0)||1;
  list.forEach(c=>c.share=c.score/ssum);
  const sorted=[...list].sort((a,b)=>b.share-a.share);
  const me=list.find(c=>c.you);
  s.leaderResult={
   round1:sorted.map(c=>({name:c.name,you:!!c.you,share:c.share,diet:Math.round(c.diet),member:Math.round(c.member)})),
   dietTotal:Math.round(co.dietTotal)
  };
  if(me.share>.5){s.leaderResult.won=true;s.leaderResult.runoff=null;finalizeLeadership(s);return;}
  const top2=sorted.slice(0,2);
  if(top2.some(c=>c.you)){
   const opp=top2.find(c=>!c.you);
   s.leaderResult.runoffOpp=opp.name;s.leaderResult.meDiet=co.me.diet;s.leaderResult.oppDiet=opp.diet;
   s.event='leader_runoff';s.stage='event';return;
  }
  s.leaderResult.won=false;s.leaderResult.runoff=null;finalizeLeadership(s);
 }
 function runoffTally(s){
  const R=s.leaderResult;
  const pref=Math.min(47,(s.prefVotes||0)+(R.public?12:0));
  // bow: 派閥どうしがまとまり議員票が動く。public: 世論を背負い都道府県票で押す。
  const myR=R.meDiet*(R.bow?1.3:1.02)+pref;
  const oppR=R.oppDiet*(R.bow?.88:R.public?1.06:1)+(47-pref);
  R.runoff={me:Math.round(myR),opp:Math.round(oppR),pref:Math.round(pref)};
  R.won=myR>oppR;
  finalizeLeadership(s);
 }
 function leaderChoose(s,id){
  if(s.stage!=='event')return false;
  const ev=leaderEvent(s),opt=ev?.choices.find(c=>c.id===id);if(!opt||opt.disabled)return false;
  const type=s.event;log(s,ev.title+' → '+opt.title);
  if(type==='leader_start'){s.event='leader_faction';return true;}
  if(type==='leader_faction'){
   if(id==='two'){s.postPromises=2;for(let k=0;k<2;k++){debt(s,-1,2);s.debts.at(-1).name='派閥の長老（党首選のポスト約束）';}}
   else if(id==='one'){s.postPromises=1;debt(s,-1,2);s.debts.at(-1).name='派閥の長老（党首選のポスト約束）';}
   record(s,'党首選：ポスト約束'+(s.postPromises||0)+'枠','党内');
   s.event='leader_policy';return true;
  }
  if(type==='leader_policy'){
   const pick=Number(id),p=platforms[pick];
   if(p&&s.platform!==pick)change(s,[...p.benefit.map(i=>[i,6]),...p.burden.map(i=>[i,-6])]);
   s.platform=pick;s.memberBoost=(s.memberBoost||0)+.06;
   record(s,'党首選：看板政策「'+platforms[pick].name+'」','公約');
   s.event='leader_debate';return true;
  }
  if(type==='leader_debate'){
   const count=contradictions(s);
   if(id==='fight'){
    const success=random(s)<clamp((s.speech+25)/100-count*.1,.1,.95);
    if(success){s.memberBoost=(s.memberBoost||0)+.1;s.fame=clamp(s.fame+3);log(s,'討論で存在感を示した。党員の支持が伸びる。');}
    else{s.debatePenalty=(s.debatePenalty||0)+.15;log(s,'討論で過去の採決を突かれた。党員票が削れる。');}
    record(s,'党首選：討論会に臨んだ','討論',{contradictions:count});
   }
   s.event='leader_ground';return true;
  }
  if(type==='leader_ground'){
   if(id==='team'){s.money-=G.funds(s,100);s.prefVotes=Math.min(32,(s.prefVotes||0)+14+Math.floor(random(s)*5));s.memberBoost=(s.memberBoost||0)+.04;record(s,'党首選：全国遊説を委託','党内');}
   else if(id==='tour'){s.prefVotes=Math.min(32,(s.prefVotes||0)+8+Math.floor(random(s)*5));log(s,'地方行脚で都道府県代表の支持を固めた。');record(s,'党首選：地方を行脚','党内');}
   else{
    s.influence=clamp(s.influence-8);
    if(random(s)<clamp(s.influence/120,.15,.8)){s.rivalDietCut=(s.rivalDietCut||0)+.12;log(s,'裏工作が効き、「派閥の長」の足元が揺らいだ。');record(s,'党首選：裏工作','党内');}
    else{s.betrayed=true;s.influence=clamp(s.influence-3);change(s,[[7,-4]]);log(s,'裏工作が露見。「裏切り者」の烙印がついた。');record(s,'党首選：裏工作が露見','裏切り');}
   }
   finishLeadership(s);return true;
  }
  if(type==='leader_runoff'){
   const R=s.leaderResult;
   if(id==='bow'){R.bow=true;debt(s,-1,2);s.debts.at(-1).name='派閥の長老（決選のポスト約束）';}
   else R.public=true;
   runoffTally(s);return true;
  }
  return false;
 }
 // ===== §12/§13 終章（government phase）=====
 function beginGovernment(s){
  if(s.stage!=='end'||s.chapter!=='leadership'||!s.leaderResult||!s.leaderResult.won||!s.ruling)return false;
  s.chapter='government';s.turn=1;s.govPhase='cabinet';
  s.cabinetPlan=null;s.surpriseSlots=false;s.factionAnger=0;
  s.approval=null;s.policyPushed=0;s.reshuffleUsed=false;s.dissolved=false;
  s.incidentType=null;s.govResult=null;s._noDrop=false;
  s.handoutSeen=false;s.handoutGiven=false;s.dissolveAsked=false;s.sackedRecently=false;
  s.event='gov_cabinet';s.stage='event';
  log(s,'総理指名を受け、組閣に入る。閣僚20枠のうち、約束と連立の枠は決まっている。');
  return true;
 }
 function layerApprovalIndex(s){
  const tot=G.groups.reduce((a,g)=>a+g[1],0);
  let x=0;for(let i=0;i<12;i++)x+=(G.groups[i][1]/tot)*clamp((s.likes[i]+20)/120,0,1);
  return x*100;
 }
 function govInitApproval(s){
  const muka=(s.likes[2]+s.likes[3]+s.likes[7])/3;
  const surprise=Math.min(12,(s.cabinetPlan==='renew'?10:0)+(s.surpriseSlots?6:0));
  const owed=s.debts.filter(d=>['未回収','一部履行'].includes(d.status)).length;
  return clamp(50+muka/5+surprise-owed*2);
 }
 function govEvent(s){
  const c=(id,t,h,d=false)=>({id,title:t,hint:h,disabled:d});
  switch(s.event){
   case 'gov_cabinet':{
    const fixed=(s.postPromises||0)+(['coalition','joint'].includes(s.alliance)?2:0);
    return {speaker:'秘書のタナカ',title:'組閣。20の椅子を、どう埋めますか。',body:'党首選で約束した枠と連立の枠（合わせて'+fixed+'）は自動で埋まります。残りの'+(20-fixed)+'枠の方針を決めましょう。',choices:[
     c('merit','実力で選ぶ','看板政策が通りやすい／派閥の不満が増える'),
     c('balance','派閥の均衡をとる','派閥の不満は出ない／政権の推進力は平凡'),
     c('renew','思い切って刷新する','就任支持率が上がる・無党派が沸く／派閥が強く反発し、実務は弱め')
    ]};
   }
   case 'gov_surprise':return {speaker:'秘書のタナカ',title:'目玉の登用を、もう一枠。',body:'若手や民間からの起用をもう一枠つくると、世間の注目は集まりますが、外された派閥はさらに不満を募らせます。',choices:[
    c('yes','サプライズ枠を追加する','就任支持率＋・無党派＋／派閥不満＋3'),
    c('no','これで組閣を締める','これ以上は動かさない')
   ]};
   case 'gov_incident':{
    const t=s.incidentType;
    if(t==='scandal')return {speaker:'記者のサトウ',title:'閣僚の一人に、疑惑。',body:'あなたが選んだ大臣に、お金の問題が報じられました。辞めさせるか、かばうか。',choices:[
     c('sack','辞めさせる','支持率が下がる／派閥の不満が増える'),
     c('shield','かばう','支持率が大きく下がる／「かばった」と記録される')
    ]};
    if(t==='inflation')return {speaker:'秘書のタナカ',title:'物の値段が、上がり続けています。',body:'物価が上がり、「暮らしが苦しい」という声が増えています。お金を出して支えるか、今は様子を見るか。',choices:[
     c('budget','追加の予算で暮らしを支える','貧困層が喜ぶ／経営者は渋い顔／派閥の駆け引きが増える'),
     c('market','今は様子を見る','支持率と貧困層が下がる')
    ]};
    if(t==='abroad_disaster')return {speaker:'秘書のタナカ',title:'外国にいる間に、国内で災害が起きました。',body:'首脳会談の途中で、国内で大きな災害が起きました。帰るか、会談を続けるか。',choices:[
     c('return','日程を切り上げて帰国する','会談の成果は薄れる／支持率は守れる'),
     c('stay','会談を続ける','支持率と地元が大きく下がる／「冷たい」と記録される')
    ]};
    if(t==='domino')return {speaker:'記者のサトウ',title:'辞めた大臣の後任で、また揉めています。',body:'辞めさせた大臣の後任をめぐって、派閥が自分たちの人を押し込もうとしています。',choices:[
     c('merit','実力で後任を選ぶ','派閥の不満が増える'),
     c('faction','派閥の推薦で埋める','派閥の不満は減る／支持率が下がる')
    ]};
    const body={disaster:'大きな災害が起き、政権の対応が問われています。政策力で乗り切れるかが分かれ目です。',foreign:'外国との間で、危ない問題が起きました。弁舌で乗り切れるかを分けます。',economy:'景気が悪くなり、政権への風当たりが強まっています。経済向けの看板政策があれば、打撃はやわらぎます。',gaffe:'与党の議員が、テレビで問題のある発言をしました。弁舌で早く謝らせられるかが分かれ目です。'}[t]||'政権の対応が問われます。';
    const hint={disaster:'うまくいけば支持率と地元が上がる／失敗すると支持率が下がる',foreign:'うまくいけば支持率と保守層が上がる／失敗すると両方下がる',economy:'支持率と貧困層・経営者が下がる（経済政策があれば軽い）',gaffe:'早く謝れば軽くすむ／遅れると支持率と無党派が下がる'}[t]||'';
    return {speaker:'官邸対策室',title:(incidents[t]?.name||'突発事態')+'。',body,choices:[c('go','対応にあたる',hint)]};
   }
   case 'gov_handout':return {speaker:'秘書のタナカ',title:'「お金を配れば、支持率は戻ります」',body:'支持率が下がり、党内から「国民みんなにお金を配ろう」という案が出ています。喜ぶ人は多いですが、「選挙目当て」とも言われます。',choices:[
    c('give','みんなにお金を配る','貧困層が喜ぶ／経営者と無党派は冷ややか／次に景気が悪くなるときつい'),
    c('skip','見送る','何も起きない')
   ]};
   case 'gov_dissolve':return {speaker:'記者のサトウ',title:'「なぜ今、解散なのですか」',body:'支持率が高いうちに選挙をするのは「勝てるうちにやる」と見られます。理由をどう説明しますか。',choices:[
    c('push','「国民に聞きたい」と押し切る','支持率が少し下がったまま選挙へ'),
    c('policy','看板政策を掲げて選挙にする','看板政策で得をする人が喜ぶ／損をする人は離れる')
   ]};
   case 'gov_resign':return {speaker:'党の長老たち',title:'「もう、潮時ではないか」',body:'支持率は低迷し、党内の不満も限界です。身を引くか、解散して国民に問うか、内閣を組み替えて立て直すか。',choices:[
    c('quit','退陣する','ここで政権を終える'),
    c('dissolve','解散して信を問う','最終選挙へ'),
    c('reshuffle','内閣を改造する','派閥不満−6・支持率−3（一度だけ）',!!s.reshuffleUsed)
   ]};
   case 'gov_election':return {speaker:'開票センター',title:'最終選挙、開票。',body:'あなたの政権への審判が下ります。',choices:[c('go','結果を見届ける','政治家としての、いまの到達点')]};
  }
  return null;
 }
 function govResolveIncident(s,id){
  const t=s.incidentType;s.incidentType=null;
  if(t==='disaster'){
   if(random(s)<clamp((s.policy+20)/100,.1,.95)){s.approval=clamp(s.approval+6);change(s,[[6,5]]);log(s,'災害対応が評価された。');}
   else{s.approval=clamp(s.approval-8);log(s,'災害対応の遅れを批判された。');}
  }else if(t==='foreign'){
   if(random(s)<clamp((s.speech+20)/100,.1,.95)){s.approval=clamp(s.approval+5);change(s,[[8,5]]);log(s,'外交危機を乗り切った。');}
   else{s.approval=clamp(s.approval-6);change(s,[[8,-5]]);log(s,'外交で腰砕けと見られた。');}
  }else if(t==='economy'){
   const soft=[2,3].includes(s.platform);
   s.approval=clamp(s.approval-(soft?2:5)-(s.handoutGiven?2:0));if(!soft)change(s,[[3,-5],[4,-5]]);
   log(s,soft?'景気は悪化したが、経済政策が下支えした。':'景気の悪化が政権を直撃した。');
  }else if(t==='gaffe'){
   if(random(s)<clamp((s.speech+20)/100,.1,.95)){s.approval=clamp(s.approval-2);log(s,'早い謝罪で失言を鎮めた。');}
   else{s.approval=clamp(s.approval-5);change(s,[[7,-8]]);log(s,'失言を放置し、批判が広がった。');}
  }else if(t==='scandal'){
   if(id==='sack'){s.approval=clamp(s.approval-4);s.factionAnger+=2;s.sackedRecently=true;log(s,'閣僚を更迭した。');record(s,'閣僚スキャンダルで更迭','政権');}
   else{s.approval=clamp(s.approval-8);s.clean=clamp(s.clean-5);record(s,'閣僚スキャンダルをかばった','かばい');log(s,'閣僚をかばい、批判を浴びた。');}
  }else if(t==='inflation'){
   if(id==='budget'){s.approval=clamp(s.approval+3);change(s,[[3,4],[4,-3]]);s.factionAnger+=1;log(s,'追加の予算で暮らしを支えた。');}
   else{s.approval=clamp(s.approval-4);change(s,[[3,-4]]);log(s,'物価高を様子見し、不満が広がった。');}
  }else if(t==='abroad_disaster'){
   if(id==='return'){s.approval=clamp(s.approval+2);log(s,'外遊を切り上げて帰国した。');}
   else{s.approval=clamp(s.approval-6);change(s,[[6,-5]]);record(s,'国内の災害中に外遊を続けた','冷たい');log(s,'外遊を続け、「冷たい」と批判された。');}
  }else if(t==='domino'){
   if(id==='merit'){s.factionAnger+=2;log(s,'後任を実力で選び、派閥は不満顔だ。');}
   else{s.factionAnger=Math.max(0,s.factionAnger-2);s.approval=clamp(s.approval-3);log(s,'後任を派閥推薦で埋めた。');}
  }
  govAfterTurn(s);
 }
 function runFinalElection(s,forced){
  s.dissolved=true;
  if(forced){s.approval=clamp(s.approval-5);log(s,'追い込まれ解散。逆風の中での審判となる。');}
  const own=G.votes(s),party=partySeats(s,{approval:s.approval,platform:s.platform});
  s.govResult={
   ownWon:own.player>own.rival,ownShare:own.share,
   seats:party.seats,voteShare:party.voteShare,
   soleMajority:party.seats>=233,
   coalitionMajority:party.seats<233&&['coalition','joint'].includes(s.alliance)&&party.seats>=150,
   forced:!!forced
  };
  s.result={player:own.player,rival:own.rival,total:own.total,share:own.share,won:s.govResult.ownWon,party:{seats:party.seats,voteShare:party.voteShare,total:465,majority:party.seats>=233}};
  s.event='gov_election';s.stage='event';
  log(s,'開票の結果、党の全国議席は約'+party.seats+'。');
 }
 function finalizeGovernment(s){
  const R=s.govResult||{};
  const broken=s.debts.filter(d=>d.status==='踏み倒し').length;
  let key,grade,label,text;
  if(R.resigned){key='short_gov';grade='C';label='短命政権';text='国民に信を問う前に、あなたは政権を手放しました。志の途中での幕引きでした。';}
  else if(R.toppled){key='toppled';grade='D';label='派閥に倒される';text='党内の不満が限界を超え、身内の反乱で政権は崩れました。数の力を甘く見た代償でした。';}
  else if(R.scandalFall){key='scandal_fall';grade='D';label='スキャンダル退陣';text='相次ぐ不祥事で支持率は底を割り、政権は短命に終わりました。';}
  else if(!R.ownWon){key='nobody';grade='E';label='ただの人';text='最終選挙であなた自身が議席を失いました。総理の座も、次の一歩もありません。';}
  else if(R.soleMajority&&s.approval>=60&&broken===0&&s.turn>=4&&s.history.some(h=>h.chapter==='government'&&h.kind==='政策'&&h.text.endsWith('成立'))){key='national_pm';grade='S';label='国民の総理';text='単独過半数、高い支持率、そして誰も裏切らずに。文句なしの信任を得た政権です。';}
  else if(R.soleMajority){key='long_gov';grade='A';label='長期政権';text='単独過半数を守り抜きました。安定した長期政権の土台ができました。';}
  else if(R.coalitionMajority){key='coalition_pm';grade='B';label='連立の総理';text='単独では届かなかったものの、連立を保って過半数を維持しました。';}
  else if(s.influence>=80){key='shadow';grade='B';label='院政';text='過半数は割れましたが、党内にはなお絶大な影響力が残りました。後継を指名し、あなたは一線を退きます。';}
  else{key='short_gov';grade='C';label='短命政権';text='過半数を割り、政権は退場を余儀なくされました。次の巡り合わせを待つことになります。';}
  s.govResult.ending={key,grade,label,text};
  s.govResult.finalApproval=Math.round(s.approval||0);
  s.govResult.score=overallScore(s,5,s.approval);
  s.finalScore=s.govResult.score;
  s.stage='end';s.event=null;s.govPhase='ended';
  log(s,'終章：'+label+'（評価 '+grade+' / スコア '+s.govResult.score+'）');
 }
 function govAfterTurn(s){
  G.settleBudget(s);
  const drop=s._noDrop?0:2;s._noDrop=false;
  s.approval=clamp(s.approval*.82+layerApprovalIndex(s)*.18-drop-(s.factionAnger>10?3:0));
  if(s.factionAnger>=15){s.govResult={toppled:true};finalizeGovernment(s);return;}
  if(s.approval<20){s.govResult={scandalFall:true};finalizeGovernment(s);return;}
  if(s.approval<30&&s.factionAnger>=10&&!s.reshuffleUsed){s.event='gov_resign';s.stage='event';return;}
  if(s.approval<40&&!s.handoutSeen){s.handoutSeen=true;s.event='gov_handout';s.stage='event';return;}
  govNextTurn(s);
 }
 function govNextTurn(s){
  if(s.turn>=16){log(s,'任期満了。');runFinalElection(s,true);return;}
  s.turn++;s.event=null;s.stage='main';
  log(s,'政権'+s.turn+'期目。支持率は'+Math.round(s.approval)+'%、派閥の不満は'+Math.round(s.factionAnger)+'。');
 }
 function govAllowed(s,id){
  return s.stage==='main'&&s.govPhase==='run'&&govActions.some(a=>a[0]===id)&&s.money>=G.actionFunds(s,id)&&!(id==='policy'&&s.policyPushed>=3);
 }
 function govAction(s,id){
  if(!govAllowed(s,id))return false;
  if(id==='dissolve'){
   if(s.approval>=55&&!s.dissolveAsked){s.dissolveAsked=true;s.event='gov_dissolve';s.stage='event';return true;}
   runFinalElection(s,false);return true;
  }
  if(id==='policy'){
   s.policyPushed++;
   const seatRate=(s.result?.party?.seats||150)/465;
   const merit=s.cabinetPlan==='merit'?.15:s.cabinetPlan==='renew'?-.05:0;
   const p=platforms[s.platform]||platforms[0];
   if(random(s)<clamp(seatRate+merit-s.factionAnger*.02,.05,.95)){
    change(s,[...p.benefit.map(i=>[i,15]),...p.burden.map(i=>[i,-12])]);s.approval=clamp(s.approval+5);
    log(s,'看板政策「'+p.name+'」が国会を通過した。');record(s,'看板政策「'+p.name+'」成立','政策');
   }else{s.approval=clamp(s.approval-6);log(s,'看板政策「'+p.name+'」は否決された。');record(s,'看板政策「'+p.name+'」否決','政策');}
  }
  else if(id==='diplomacy'){
   if(random(s)<clamp((s.speech+20)/100,.1,.95)){s.approval=clamp(s.approval+4);change(s,[[8,3]]);log(s,'首脳会談が成果を上げた。');}
   else{s.approval=clamp(s.approval-3);log(s,'外遊は空回りに終わった。');}
   if(random(s)<.2){s.incidentType='abroad_disaster';s.event='gov_incident';s.stage='event';return true;}
  }
  else if(id==='publicity'){s.money-=G.funds(s,100);s._noDrop=true;change(s,[[2,3],[3,3],[7,3]]);s.approval=clamp(s.approval+2);log(s,'党の広報チームが政策を説明した。');}
  else if(id==='presser'){s._noDrop=true;change(s,[[2,2],[3,2],[7,2]]);log(s,'記者会見で政権の考えを説明した。');}
  else if(id==='faction_care'){s.factionAnger=Math.max(0,s.factionAnger-3);change(s,[[2,-3],[3,-3],[7,-3]]);log(s,'派閥に配慮し、不満を抑えた。');}
  else if(id==='tighten'){s.influence=clamp(s.influence+3);s.factionAnger+=1;log(s,'党内を引き締めた。');}
  if(s.sackedRecently){s.sackedRecently=false;if(random(s)<.3){s.incidentType='domino';s.event='gov_incident';s.stage='event';return true;}}
  if(random(s)<.3){
   s.incidentType=['disaster','foreign','economy','scandal','gaffe','inflation'][Math.floor(random(s)*6)];
   s.event='gov_incident';s.stage='event';return true;
  }
  govAfterTurn(s);return true;
 }
 function govChoose(s,id){
  if(s.stage!=='event')return false;
  const ev=govEvent(s),opt=ev?.choices.find(c=>c.id===id);if(!opt||opt.disabled)return false;
  const type=s.event;log(s,ev.title+' → '+opt.title);
  if(type==='gov_cabinet'){
   s.cabinetPlan=id;s.factionAnger+=id==='merit'?4:id==='renew'?6:0;
   if(id==='renew')change(s,[[2,8],[3,4],[7,8]]);
   record(s,'組閣の方針：'+(id==='merit'?'実力重視':id==='balance'?'派閥均衡':'刷新'),'組閣');
   s.event='gov_surprise';return true;
  }
  if(type==='gov_surprise'){
   if(id==='yes'){s.surpriseSlots=true;s.factionAnger+=3;change(s,[[2,6],[7,6]]);}
   s.approval=govInitApproval(s);s.govPhase='run';s.event=null;s.stage='main';
   log(s,'内閣が発足。初期支持率は'+Math.round(s.approval)+'%。');record(s,'内閣発足（初期支持率'+Math.round(s.approval)+'%）','組閣');
   return true;
  }
  if(type==='gov_incident'){govResolveIncident(s,id);return true;}
  if(type==='gov_resign'){
   if(id==='quit'){s.govResult={resigned:true};finalizeGovernment(s);return true;}
   if(id==='dissolve'){runFinalElection(s,true);return true;}
   if(id==='reshuffle'){s.reshuffleUsed=true;s.factionAnger=Math.max(0,s.factionAnger-6);s.approval=clamp(s.approval-3);log(s,'内閣改造で党内の不満をいったん抑えた。');record(s,'内閣改造','政権');govNextTurn(s);return true;}
  }
  if(type==='gov_handout'){
   if(id==='give'){s.handoutGiven=true;s.approval=clamp(s.approval+6);change(s,[[3,5],[4,-5],[7,-4]]);record(s,'一律給付を決めた','政策');log(s,'一律給付で支持率が持ち直したが、「選挙目当て」の声も出た。');}
   govNextTurn(s);return true;
  }
  if(type==='gov_dissolve'){
   if(id==='push'){s.approval=clamp(s.approval-5);log(s,'「国民に聞きたい」と押し切ったが、理由の薄さを突かれた。');}
   else{const p=platforms[s.platform]||platforms[0];change(s,[...p.benefit.map(i=>[i,5]),...p.burden.map(i=>[i,-5])]);log(s,'看板政策「'+p.name+'」を掲げて解散した。');}
   runFinalElection(s,false);return true;
  }
  if(type==='gov_election'){finalizeGovernment(s);return true;}
  return false;
 }
 function allowed(s,id){
  if(s.stage!=='main'||(id!=='rest'&&s.energy===0))return false;
  if(s.mandate&&id!=='hq'&&id!=='rest')return false;
  if(termActions.some(a=>a[0]===id))return !(id==='faction'&&(!hasParty(s)||!s.faction||s.faction==='none'))&&!(id==='committee'&&s.committee===null);
  if(term2Actions.some(a=>a[0]===id)){
   if(!isTerm2(s))return false;
   if(id==='study_group')return s.money>=G.funds(s,100);
   if(id==='stump')return G.campaign(s)&&hasParty(s);
   return false;
  }
  return base.allowed(s,id);
 }
 function action(s,id,target=0,business=false){
  if(!allowed(s,id)||!Number.isInteger(target)||target<0||target>11)return false;
  if(!termActions.some(a=>a[0]===id)&&!term2Actions.some(a=>a[0]===id)){
   const historyStart=s.history.length,before=s.influence;
   const ok=base.action(s,id,target,business);
   if(ok){if(s.influence>before&&hasParty(s)&&[0,2].includes(s.party)&&s.faction==='none')s.influence=before+(s.influence-before)*.5;s.history.slice(historyStart).forEach(h=>h.chapter=s.chapter);}
   return ok;
  }
  if(term2Actions.some(a=>a[0]===id)){
   const c=id==='study_group'?8:5;
   s.energy=clamp(s.energy-(G.Campaign?.energyCost(s,id)??c*(G.campaign(s)?2:1)));s.mandate=false;
   if(id==='study_group'){s.money=Math.max(0,s.money-G.funds(s,100));influence(s,5);s.network=clamp(s.network+3);if(hasParty(s)&&s.faction!=='none'){influence(s,-1);log(s,'派閥の長老は、いい顔をしなかった。');}record(s,'勉強会を立ち上げた','勉強会');}
   if(id==='stump'){influence(s,3);s.partySupport=(s.partySupport||0)+1;change(s,[[7,2],[6,1]]);record(s,'党の候補の応援に立った','応援');}
   G.Campaign?.afterAction(s,id);
   if(!s.energy){s.energy=0;s.fame=clamp(s.fame-3);log(s,'体力を使い果たし、休養した。');}
   log(s,term2Actions.find(a=>a[0]===id)[1]);finishTurn(s);return true;
  }
  const cost={question:12,committee:8,local:10,faction:8,abroad:8}[id];
  s.energy=clamp(s.energy-(G.Campaign?.energyCost(s,id)??cost*(G.campaign(s)?2:1)));s.mandate=false;
  if(id==='question'){
   if(random(s)<clamp((s.policy+20)/100,.1,.95)){s.fame=clamp(s.fame+4);change(s,[[target,5]],true);log(s,'国会質問で'+names([target])+'の課題が注目された。');}
   else{influence(s,-2);record(s,names([target])+'を扱う質問が空回り','質問');}
  }
  if(id==='committee'){
   const related=committees[s.committee].groups;
   const losses=[...new Set(related.flatMap(i=>G.groups[i][7]))].filter(i=>!related.includes(i)&&i!==11);
   change(s,[...related.map(i=>[i,3]),[11,2],...losses.map(i=>[i,-1])]);
  }
  if(id==='local')change(s,G.groups.map((_,i)=>[i,1.25]));
  if(id==='faction'){influence(s,3);s.factionVisits++;if(s.factionVisits%3===0){debt(s,-1,1);s.debts.at(-1).name='派閥の長老';}}
  if(id==='abroad'){const success=random(s)<clamp((s.policy+20)/100,.1,.95);s.policy=clamp(s.policy+(success?5:2));s.fame=clamp(s.fame+(success?3:0));change(s,success?[[2,2],[3,2],[7,2]]:[[2,-2],[3,-2],[7,-2]]);record(s,success?'海外視察の成果を政策に反映':'海外視察で成果を示せず','視察');}
  G.Campaign?.afterAction(s,id);
  if(!s.energy){s.energy=0;s.fame=clamp(s.fame-3);log(s,'体力を使い果たし、休養した。');}
  log(s,termActions.find(a=>a[0]===id)[1]);finishTurn(s);return true;
 }
 function continueResult(s,rescue=false){
  if(s.stage!=='result')return false;
  const eligible=hasParty(s)&&s.nomination!=='公認取消'&&!s.nominationCancelled&&!s.usedRescue&&s.result.share>=.42;
  s.lastElectionRescue=!s.result.won&&rescue&&eligible;
  s.reelected=s.result.won||s.lastElectionRescue;
  if(s.lastElectionRescue){s.usedRescue=true;debt(s,-1,3);}
  s.stage='end';s.event=null;
  log(s,s.reelected?(isTerm2(s)?'3度目の選挙を制した。次は党の顔として与党化を目指す。':'再選を果たした。次は中堅議員としての道へ。'):(isTerm2(s)?'議席を守れず、議会を去ることになった。':'再選に届かず、この任期で議会を去る。'));return true;
 }
 function validate(s){
  const known=allEventIds.concat(['scandal','reform'],G.Campaign?.ids||[],G.Extra?.ids||[]);
  const ok=s.version===2&&s.elected===true&&Number.isFinite(s.governmentApproval)&&s.governmentApproval>=0&&s.governmentApproval<=100&&
   (s.committee===null||Number.isInteger(s.committee)&&!!committees[s.committee])&&
   [null,'none','aide','regional','economic','social'].includes(s.faction)&&Number.isInteger(s.factionVisits)&&s.factionVisits>=0&&
   Array.isArray(s.bills)&&s.bills.length===8&&new Set(s.bills).size===8&&s.bills.every(i=>Number.isInteger(i)&&!!bills[i])&&
   Array.isArray(s.ballots)&&s.ballots.length<=8&&s.ballots.every(v=>Number.isInteger(v.billId)&&!!bills[v.billId]&&['yes','no','absent'].includes(v.position)&&Array.isArray(v.hurt)&&v.hurt.every(i=>Number.isInteger(i)&&i>=0&&i<12))&&
   Array.isArray(s.pendingEvents)&&s.pendingEvents.length<=4&&s.pendingEvents.every(e=>known.includes(e))&&
   typeof s.postAction==='boolean'&&Array.isArray(s.collectedDebtIds)&&s.collectedDebtIds.length<=2&&s.collectedDebtIds.every(i=>Number.isInteger(i)&&!!s.debts[i])&&
   s.stage!=='weekend'&&(s.stage!=='event'||known.includes(s.event))&&
   typeof s.termDiscipline==='boolean'&&typeof s.nominationCancelled==='boolean'&&typeof s.reelected==='boolean'&&typeof s.lastElectionRescue==='boolean'&&
   ((s.event!=='term_collect'&&s.event!=='term2_collect')||s.collection.length>0&&['未回収','一部履行'].includes(s.debts[s.collection[0]]?.status))&&
   (s.turn===1||s.committee!==null);
  if(!ok)return false;
  if(isTerm2(s)||isTerm3(s)){
   if(!['none','政務官'].includes(s.role??'none'))return false;
   if(typeof s.viceMinister!=='boolean'||typeof s.factionRank!=='boolean'||typeof s.nationalFame!=='boolean')return false;
   if(!Number.isInteger(s.partySupport)||s.partySupport<0||s.partySupport>32)return false;
   if(!Array.isArray(s.collectedDebtIds2)||s.collectedDebtIds2.length>2||!s.collectedDebtIds2.every(i=>Number.isInteger(i)&&!!s.debts[i]))return false;
   if(s.result&&s.result.party&&!(Number.isFinite(s.result.party.voteShare)&&Number.isInteger(s.result.party.seats)))return false;
  }
  if(isTerm3(s)){
   if(!['none','minister','exec'].includes(s.cabinet))return false;
   if(!['none','joint','coalition','broke'].includes(s.alliance))return false;
   if(typeof s.leadershipSkip!=='boolean'||typeof s.term3Failed!=='boolean'||typeof s.ruling!=='boolean')return false;
   if(s.platform!=null&&(!Number.isInteger(s.platform)||!platforms[s.platform]))return false;
   if(!Array.isArray(s.collectedDebtIds3)||s.collectedDebtIds3.length>2||!s.collectedDebtIds3.every(i=>Number.isInteger(i)&&!!s.debts[i]))return false;
   if((s.event==='term3_collect')&&!(s.collection.length>0&&['未回収','一部履行'].includes(s.debts[s.collection[0]]?.status)))return false;
  }
  if(isLeader(s)){
   if(s.turn!==1||!['event','end'].includes(s.stage))return false;
   if(![0,1,2].includes(s.postPromises))return false;
   if(!Number.isInteger(s.prefVotes)||s.prefVotes<0||s.prefVotes>47)return false;
   for(const k of ['debatePenalty','memberBoost','rivalDietCut'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>2)return false;
   if(typeof s.betrayed!=='boolean'||typeof s.factionZero!=='boolean'||typeof s.ruling!=='boolean')return false;
   if(s.stage==='event'&&!leaderEventIds.includes(s.event))return false;
   if(s.leaderResult!=null&&(typeof s.leaderResult!=='object'||!Array.isArray(s.leaderResult.round1)))return false;
   if(s.stage==='end'&&!(s.leaderResult&&s.leaderResult.ending))return false;
  }
  if(isGov(s)){
   if(!['cabinet','run','ended'].includes(s.govPhase))return false;
   if(!['event','main','end'].includes(s.stage))return false;
   if(!Number.isInteger(s.turn)||s.turn<1||s.turn>16)return false;
   if(![null,'merit','balance','renew'].includes(s.cabinetPlan))return false;
   if(typeof s.surpriseSlots!=='boolean'||typeof s.reshuffleUsed!=='boolean'||typeof s.dissolved!=='boolean')return false;
   if(!Number.isFinite(s.factionAnger)||s.factionAnger<0||s.factionAnger>80)return false;
   if(s.approval!=null&&(!Number.isFinite(s.approval)||s.approval<0||s.approval>100))return false;
   if(!Number.isInteger(s.policyPushed)||s.policyPushed<0||s.policyPushed>3)return false;
   if(s.incidentType!=null&&!incidents[s.incidentType])return false;
   for(const k of ['handoutSeen','handoutGiven','dissolveAsked','sackedRecently'])if(s[k]!==undefined&&typeof s[k]!=='boolean')return false;
   if(s.stage==='event'&&!govEventIds.includes(s.event))return false;
   if(s.stage==='main'&&s.govPhase!=='run')return false;
   if(s.govResult!=null&&typeof s.govResult!=='object')return false;
   if(s.stage==='end'&&!(s.govResult&&s.govResult.ending))return false;
  }
  if(s.finalScore!=null&&!Number.isFinite(s.finalScore))return false;
  return true;
 }
 G.Legislature={begin,beginSecond,beginThird,beginLeadership,beginGovernment,finishTurn,advance,validate,committees,bills,platforms,rivals,govActions,contradictions,partySeats,leadershipCoeffs,layerApprovalIndex};
 G.actionsFor=s=>isGov(s)?govActions:isLeader(s)?[]:isTerm2(s)?[...termActions,...term2Actions,...G.actions]:isTerm(s)?[...termActions,...G.actions]:G.actions;
 G.event=s=>isGov(s)?govEvent(s):isLeader(s)?leaderEvent(s):isTerm(s)?getEvent(s):base.event(s);
 G.choose=(s,id)=>isGov(s)?govChoose(s,id):isLeader(s)?leaderChoose(s,id):isTerm(s)?choose(s,id):base.choose(s,id);
 G.allowed=(s,id)=>isGov(s)?govAllowed(s,id):isLeader(s)?false:isTerm(s)?allowed(s,id):base.allowed(s,id);
 G.action=(s,id,target=0,business=false)=>isGov(s)?govAction(s,id):isLeader(s)?false:isTerm(s)?action(s,id,target,business):base.action(s,id,target,business);
 G.create=(...args)=>Object.assign(base.create(...args),{version:2,chapter:'prologue'});
 G.continueResult=(s,rescue=false)=>{
  if(isLeader(s)||isGov(s))return false;
  if(isTerm(s))return continueResult(s,rescue);
  const ok=base.continueResult(s,rescue);
  if(ok&&s.version===2&&s.elected&&s.stage==='event'){s.stage='end';begin(s);}
  return ok;
 };
 if(typeof module!=='undefined')module.exports=G.Legislature;
})(typeof window!=='undefined'?window:globalThis);
