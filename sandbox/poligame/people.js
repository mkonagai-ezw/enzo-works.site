(function(root){
 'use strict';
 const G=root.Game,phases=['prologue','term','term2','term3'];
 const profiles=[
  {id:'mio',name:'小野ミオ',group:2,job:'不安定なシフトで働く28歳',place:'街の相談室',problem:'勤務先のシフトが減り、家賃の支払いが苦しくなっています。相談窓口へ行っても、働ける時間に合う仕事が見つかりません。',wish:'仕事を続けながら住まいを守れる支援',alternative:'勤務時間に合う職業相談と、住居支援の窓口をつなぐ案',conflict:'「自助と言われても、今月の家賃は待ってくれません。制度そのものを変えてほしいんです」',later:'住まいと働き方を考える住民の集まり',alt:'赤茶色のカーディガンを着た若い女性が、街の相談室で話している'},
  {id:'gen',name:'川原ゲン',group:6,job:'集落で農業を続ける58歳',place:'集落の集会所',problem:'共同の集荷便が減り、収穫物を運ぶ負担が増えています。家業を続けたいのに、配送費を払うと手元にはほとんど残りません。',wish:'小さな農家も出荷を続けられる仕組み',alternative:'近隣の生産者が共同で使える配送便を調整する案',conflict:'「効率のいい所だけ残せばいい、では、この集落はなくなる。暮らしを残すことも考えてほしい」',later:'地域の交通と物流を話し合う協議会',alt:'紺の作業着を着た白髪交じりの農家が、田畑の見える集会所で話している'},
  {id:'rei',name:'真鍋レイ',group:4,job:'小さな工場を営む42歳',place:'町工場の事務室',problem:'材料費が上がり、取引先からの入金も遅れています。従業員の給料を上げたいのに、来月の支払いさえ不安になっています。',wish:'雇用と賃金を守りながら事業を続ける方法',alternative:'取引条件の相談と、利用できる資金繰り支援をつなぐ案',conflict:'「経営者だから余裕があると思われる。でも、働く人の暮らしと会社の存続は切り離せません」',later:'働く人と小さな事業者の意見交換会',alt:'青灰色の作業ジャケットの女性経営者が、機械の見える町工場の事務室で話している'},
  {id:'haru',name:'水野ハル',group:9,job:'地域の環境活動に取り組む34歳',place:'図書館の交流室',problem:'再開発の説明会が昼間だけ開かれ、仕事や介護のある住民が参加できません。計画への反対意見も届けられないまま、手続きが進んでいます。',wish:'賛否にかかわらず住民が意見を届けられる場',alternative:'夜間の意見交換と書面提出の窓口を設ける案',conflict:'「意見を届ける場は必要です。ただ、話し合えることと、開発計画への賛成は別なんです」',later:'再開発をめぐる住民の対話集会',alt:'丸眼鏡とからし色の上着の男性が、図書館の交流室で資料を前に話している'}
  ,{id:'shun',name:'岩崎シュン',group:8,job:'地域の防災活動を担う51歳',place:'自治会の防災準備室',problem:'避難所の備品が古くなり、点検や訓練を担う住民も減っています。地域で守りたいと思っても、会費と善意だけでは備えを更新できません。',wish:'地域のつながりを生かしながら災害への備えを続ける仕組み',alternative:'必要な備品の点検と公的支援の相談を進め、新しい住民も参加できる訓練を組む案',conflict:'「変えることは必要でしょう。でも、長く地域を支えてきた人の役割まで、古いからと切り捨ててほしくないんです」',later:'地域の防災体制を見直す住民会議',alt:'えんじ色のポロシャツを着た壮年男性が、防災用品のある自治会の部屋で話している'},
  {id:'aya',name:'藤井アヤ',group:1,job:'小学生を育てながら働く36歳',place:'放課後の相談室',problem:'学校の長期休暇中、学童の開所時間が出勤時間に合いません。祖父母には頼れず、仕事を休めば収入も減るため、毎朝の預け先に困っています。',wish:'働く時間に合う安全な子どもの居場所',alternative:'学童と地域の預かり窓口をつなぎ、長期休暇中の受け入れ時間を調整する案',conflict:'「家庭の努力も大切です。でも、家族だけで何とかして、と言われたら働き続けられません。支える仕組みが必要なんです」',later:'長期休暇の子どもの居場所を考える意見交換会',alt:'青緑色のブラウスを着た女性が、子ども用の棚のある相談室で話している'},
  {id:'fumi',name:'佐伯フミ',group:0,job:'一人暮らしを続ける76歳',place:'地域の暮らし相談室',problem:'近所のバス路線が減便され、通院と買い物を同じ日に済ませるのが難しくなりました。毎回タクシーを使う余裕はなく、離れて暮らす家族にも頼り切りたくありません。',wish:'自分で予定を決めて通院や買い物へ行ける足',alternative:'予約制の乗り合い交通と既存の送迎窓口をつなぎ、利用できる時間帯を広げる案',conflict:'「若い人への支援も必要です。でも、年寄りだから我慢して、で終わらせないでほしい。自分の暮らしを自分で選びたいんです」',later:'世代を越えて地域の移動を考える集まり',alt:'薄紫のカーディガンを着た銀髪の高齢女性が、バス停の見える相談室で話している'}
 ];
 const ch=s=>s.chapter||'prologue',clock=s=>phases.indexOf(ch(s))*16+s.turn;
 const entries=s=>s.people?.entries||[];
 const find=(s,id)=>entries(s).find(x=>x.id===id);
 const key=(id,stage)=>'person_'+id+'_'+stage;
 const personPattern=new RegExp('^person_('+profiles.map(p=>p.id).join('|')+')_([1-4])$');
 const parse=id=>personPattern.exec(id||'');
 const seed=(s,p)=>({id:p.id,stage:0,trust:20,agreement:-40,life:20,plan:'none',last:clock(s),met:clock(s),origin:s.likes[p.group],history:[]});
 function candidate(s){
  if(entries(s).length>=2)return null;
  return profiles.filter(p=>!find(s,p.id)&&s.likes[p.group]<=10&&Math.max(...s.likes)-s.likes[p.group]>=15).sort((a,b)=>s.likes[a.group]-s.likes[b.group]||profiles.indexOf(a)-profiles.indexOf(b))[0];
 }
 function due(s,p,stage){
  if(!phases.includes(ch(s))||s.turn<2)return false;
  const r=find(s,p.id);
  if(stage===1)return !r&&candidate(s)?.id===p.id;
  if(!r||r.stage!==stage-1)return false;
  const elapsed=clock(s)-r.last;
  return stage===2?elapsed>=3:stage===3?elapsed>=5:elapsed>=2&&(ch(s)==='prologue'?s.turn>=10:s.turn>=13);
 }
 const preferred=s=>s.likes.indexOf(Math.max(...s.likes));
 const cost=(s,n)=>G.funds(s,n);
 const opt=(s,id,title,hint,energy=0,money=0,locked=false)=>({id,title,hint:hint+(energy?' ／ 体力−'+energy:'')+(money?'・資金−'+cost(s,money)+'万円':''),disabled:locked||s.energy<energy||s.money<cost(s,money)});
 function status(r){return {trust:r.trust>=60?'信頼している':r.trust>=35?'話を聞いてくれる':r.trust>=15?'慎重に見ている':'距離を置いている',agreement:r.agreement>=10?'一部の政策に賛成':r.agreement>=-10?'賛否を考えている':'政策には反対',life:r.life>=70?'相談した問題が改善':r.life>=40?'改善に向けて前進':'困りごとは残っている'};}
 function event(s,p,stage){
  const r=find(s,p.id)||seed(s,p),v=status(r),support=G.groups[preferred(s)][0];
  let title,body,choices;
  if(stage===1){
   title='「あなたを支持していません。でも、相談したい」';
   body=p.name+'、'+p.job+'。'+p.problem+' 求めているのは、'+p.wish+'です。この人は'+G.groups[p.group][0]+'の一人で、層全体の代弁者ではありません。';
   choices=[
    opt(s,'help','相談の同行・専門家への接続を支える','本人の信頼＋20・生活＋25／政策への賛否は変わらない',10,30),
    opt(s,'principle','自分の理念に沿う代案を一緒に考える','政策力35が必要／信頼＋12・生活＋15・政策への賛否＋15',8,0,s.policy<35),
    opt(s,'delegate','支持団体に協力を頼む','人脈25が必要／信頼＋8・生活＋25・政策への賛否−5／'+support+'への約束が1件できる',6,0,s.network<25),
    opt(s,'explain','今は引き受けられない理由を伝える','信頼＋6／生活の問題と政策への反対は残る',4),
    opt(s,'avoid','選挙活動を優先して距離を置く','信頼−10／体力・資金の消費なし')
   ];
  }else if(stage===2){
   title=p.name+'から、その後の連絡';
   body=(r.life>=40?'支援で一歩前へ進みましたが、まだ解決していません。':r.plan==='principle'?'代案を検討しましたが、実行にはもう一歩必要です。':'「あの相談は、その後どうなりましたか」。困りごとは今も残っています。')+' '+p.alternative+'が、具体的な選択肢になっています。';
   choices=[opt(s,'follow','窓口と調整し、解決まで伴走する','信頼＋18・生活＋25／本人の政策への反対は残り得る',8,15),opt(s,'adapt','代案を具体化し、実行につなげる','政策力40が必要／信頼＋12・生活＋20・政策への賛否＋15',8,0,s.policy<40),opt(s,'listen','話を聞き、できたことと限界を説明する','信頼＋6／生活の改善は進まない',4),opt(s,'drop','対応を打ち切る','信頼−15／約束していた場合、失望が残る')];
  }else if(stage===3){
   title='再会：'+p.later;
   body=p.name+'が、住民の立場で発言しています。'+(r.life>=70?'相談した問題は改善しました。':'相談した問題には、まだ課題が残っています。')+' '+(r.trust>=35?'あなたへの信頼はあっても、政策への賛否は別です。':'これまでの対応を、本人は覚えています。')+' '+p.conflict;
   choices=[opt(s,'revise','相手の意見を政策に取り入れる','信頼＋12・政策への賛否＋35・生活＋10／政策力＋2／'+support+'の好感度−2',8),opt(s,'dialogue','方針の違いを認め、対話を続ける','信頼＋15・人脈＋2／政策への賛否と生活は変わらない',6),opt(s,'stand','自分の方針を変えない理由を説明する','信頼＋6・政策への賛否−10／支持層全体への効果なし',4),opt(s,'dismiss','議論を切り上げ、支持者との約束を優先する','信頼−15・政策への賛否−10／'+support+'の好感度＋1')];
  }else{
   title='選挙前、'+p.name+'が伝えたいこと';
   body=r.trust>=55?(r.agreement>=10?'「全てに賛成ではありません。でも、今回はあなたの話を周りにも伝えたい」':'「助けてもらったことと、投票先は別です。でも、あなたは話を聞いてくれる人だと思っています」'):'「これまでの対応を見てきました。選挙の時だけ、都合のいい関係にはなれません」';
   choices=[opt(s,'respect','支持しない自由も尊重する','信頼＋6／支持層の好感度や得票は増えない'),opt(s,'work','政策が違っても、次の課題で協力する','信頼45が必要／人脈＋3・政策力＋2・本人の信頼＋6／投票の約束は求めない',8,0,r.trust<45),opt(s,'endorse','納得してくれた範囲で、応援をお願いする','信頼55・政策への賛否10が必要／知名度＋2・'+G.groups[p.group][0]+'の好感度＋2',4,0,r.trust<55||r.agreement<10),opt(s,'close','お礼を伝えて、活動に戻る','関係と政策への賛否はそのまま')];
  }
  return {speaker:p.name+' ／ '+p.job,title,body,choices};
 }
 function apply(s,p,stage,id){
  s.people??={version:1,entries:[]};let r=find(s,p.id);
  if(!r){r=seed(s,p);s.people.entries.push(r);}
  const before={trust:r.trust,agreement:r.agreement,life:r.life};
  const spend=(energy,money=0)=>{s.energy=G.clamp(s.energy-energy);s.money-=cost(s,money);};
  const gain=(trust,life=0,agreement=0)=>{r.trust=G.clamp(r.trust+trust);r.life=G.clamp(r.life+life);r.agreement=G.clamp(r.agreement+agreement,-100,100);};
  if(stage===1){r.plan=id;if(id==='help'){spend(10,30);gain(20,25);}if(id==='principle'){spend(8);gain(12,15,15);}if(id==='delegate'){spend(6);gain(8,25,-5);G.mechanics.debt(s,preferred(s),1);}if(id==='explain'){spend(4);gain(6);}if(id==='avoid')gain(-10);}
  if(stage===2){if(id==='follow'){spend(8,15);gain(18,25);}if(id==='adapt'){spend(8);gain(12,20,15);}if(id==='listen'){spend(4);gain(6);}if(id==='drop')gain(-15);}
  if(stage===3){if(id==='revise'){spend(8);gain(12,10,35);s.policy=G.clamp(s.policy+2);s.likes[preferred(s)]=G.clamp(s.likes[preferred(s)]-2,-50,100);}if(id==='dialogue'){spend(6);gain(15);s.network=G.clamp(s.network+2);}if(id==='stand'){spend(4);gain(6,0,-10);}if(id==='dismiss'){gain(-15,0,-10);s.likes[preferred(s)]=G.clamp(s.likes[preferred(s)]+1,-50,100);}}
  if(stage===4){if(id==='respect')gain(6);if(id==='work'){spend(8);gain(6);s.network=G.clamp(s.network+3);s.policy=G.clamp(s.policy+2);}if(id==='endorse'){spend(4);s.fame=G.clamp(s.fame+2);s.likes[p.group]=G.clamp(s.likes[p.group]+2,-50,100);}}
  r.stage=stage;r.last=clock(s);
  const label=event(s,p,stage).choices.find(x=>x.id===id).title;
  r.history.push({chapter:ch(s),turn:s.turn,stage,id,label});
  const delta=Object.keys(before).map(k=>({trust:'信頼',agreement:'政策への賛否',life:'生活'}[k])+((r[k]-before[k])>=0?'+':'')+(r[k]-before[k])).join(' ／ ');
  G.mechanics.log(s,p.name+'：'+delta+'。'+status(r).agreement+'。');
  s.history.push({chapter:ch(s),turn:s.turn,text:p.name+'：'+label,kind:'人物との関係',publicity:1});
 }
 const defs=profiles.flatMap(p=>[1,2,3,4].map(stage=>({id:key(p.id,stage),phases,sure:true,when:s=>due(s,p,stage),event:s=>event(s,p,stage),apply:(s,id)=>apply(s,p,stage,id)})));
 function pick(s){return defs.filter(d=>d.when(s)).sort((a,b)=>Number(b.id.at(-1))-Number(a.id.at(-1)))[0]?.id||null;}
 function forEvent(s){const m=parse(s.event);if(!m)return null;const p=profiles.find(p=>p.id===m[1]);return {profile:p,relation:find(s,p.id)||seed(s,p),stage:Number(m[2])};}
 function canChoose(s,id){const m=parse(id);if(!m)return true;const r=find(s,m[1]);return Number(m[2])===1?!r&&entries(s).length<2:r?.stage===Number(m[2])-1;}
 function validate(s){
  if(s.people===undefined)return !parse(s.event)||Number(parse(s.event)[2])===1;
  const x=s.people,int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
  if(!x||x.version!==1||!Array.isArray(x.entries)||x.entries.length>2||new Set(x.entries.map(r=>r?.id)).size!==x.entries.length)return false;
  for(const r of x.entries){if(!r||!profiles.some(p=>p.id===r.id)||!int(r.stage,1,4)||!int(r.trust,0,100)||!int(r.agreement,-100,100)||!int(r.life,0,100)||!int(r.met,1,64)||!int(r.last,r.met,64)||!Number.isFinite(r.origin)||r.origin<-50||r.origin>100||!['help','principle','delegate','explain','avoid'].includes(r.plan)||!Array.isArray(r.history)||r.history.length!==r.stage||!r.history.every((h,i)=>h&&h.stage===i+1&&phases.includes(h.chapter)&&int(h.turn,1,16)&&typeof h.id==='string'&&typeof h.label==='string'&&h.label.length<=150))return false;}
  return s.stage!=='event'||canChoose(s,s.event);
 }
 G.People={profiles,defs,pick,forEvent,entries,status,validate,canChoose};
})(typeof window!=='undefined'?window:globalThis);
