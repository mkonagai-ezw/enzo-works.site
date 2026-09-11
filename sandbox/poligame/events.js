(function(root){
 'use strict';
 // 条件イベント：支持層の偏り・災害・政治とカネ・選挙区・党内。
 // 序章は固定イベントのない月、議員期は固定イベントのないターンの主行動前に1本だけ割り込む。
 const G=root.Game,{clamp}=G,{random,log,change,debt,population}=G.mechanics;
 const base={event:G.event,choose:G.choose};
 const chapter=s=>s.chapter||'prologue';
 const isTermCh=s=>['term','term2','term3'].includes(chapter(s));
 const hasParty=s=>s.nomination!=='無所属';
 const inFaction=s=>hasParty(s)&&['regional','economic','social'].includes(s.faction);
 const c=(id,title,hint,disabled=false)=>({id,title,hint,disabled});
 const judge=(s,stat,bonus=20)=>random(s)<clamp((s[stat]+bonus)/100,.1,.95);
 const ensure=s=>(s.extra??={seen:[]});
 const flag=(s,k)=>!!ensure(s)[k];
 const hist=(s,text,kind,extra={})=>s.history.push({turn:s.turn,chapter:chapter(s),text,kind,publicity:3,...extra});
 const TERMS=['term','term2','term3'],ALL=['prologue',...TERMS];
 const defs=[
  // ===== A. 支持層の偏りが招く（確実発生・一度だけ） =====
  {id:'zealots',phases:ALL,sure:true,when:s=>s.likes[8]>=60,
   event:()=>({speaker:'秘書のタナカ',title:'応援してくれる人が、暴走しています。',body:'あなたを熱心に応援する人たちが、SNSで相手候補のうそを広めています。放っておくと「あの人の支持者はこわい」と思われます。止めれば、応援してくれた人はがっかりします。',choices:[
    c('calm','応援する人たちに「やめて」と伝える','保守活動層はがっかり／無党派は安心する'),
    c('watch','見なかったことにする','無党派とリベラル層が離れる／あとで「黙っていた」と言われる'),
    c('ride','自分も相手を批判する','保守活動層が沸く／無党派とリベラル層が大きく離れる')]}),
   apply:(s,id)=>{
    if(id==='calm'){change(s,[[8,-8],[7,4]]);s.clean=clamp(s.clean+2);hist(s,'暴走する支持者をたしなめた','発言');}
    else if(id==='watch'){change(s,[[7,-10],[9,-6]]);hist(s,'支持者のうそを黙認した','黙認',{publicity:2});}
    else{change(s,[[8,6],[7,-15],[9,-10]]);s.fame=clamp(s.fame+3);s.clean=clamp(s.clean-5);hist(s,'支持者に便乗して相手を攻撃した','発言');}
   }},
  {id:'silver',phases:TERMS,sure:true,when:s=>s.likes[0]>=70&&s.likes[1]<=10&&s.likes[2]<=10,
   event:()=>({speaker:'記者のサトウ',title:'「お年寄りの味方ばかりですね」',body:'新聞に「あなたは高齢者のことしか考えていない」という記事が出ました。若い世代からは冷たい目で見られています。ここで何を言うかが分かれ道です。',choices:[
    c('young','若い世代向けの約束を打ち出す','若者と子育て世帯が喜ぶ／高齢者は少しがっかり'),
    c('elder','「選挙に来る人を大事にするのは当然」と言う','高齢者が喜ぶ／若者が離れる')]}),
   apply:(s,id)=>{
    if(id==='young'){change(s,[[2,6],[1,4],[0,-5]]);hist(s,'若い世代向けの約束を表明','公約',{group:2});}
    else{change(s,[[0,5],[2,-8]]);hist(s,'「選挙に来る人を大事にする」と発言','発言');}
   }},
  {id:'mouthpiece',phases:TERMS,sure:true,when:s=>s.likes[11]>=60&&s.debts.filter(d=>d.group===11).length>=2,
   event:()=>({speaker:'記者のサトウ',title:'「業界の言いなりでは？」',body:'週刊誌が、あなたと業界団体の近さを記事にしました。「お金をもらって代わりに発言している」という見方です。説明するか、距離を置くか、無視するか。',choices:[
    c('explain','関係を隠さず、政策の中身で説明する','政策力で判定／うまくいけば無党派が納得する'),
    c('distance','業界と距離を置く','業界が怒る／約束の一部が宙に浮く'),
    c('ignore','相手にしない','無党派が離れる／クリーン度が下がる')]}),
   apply:(s,id)=>{
    if(id==='explain'){if(judge(s,'policy')){change(s,[[7,3]]);log(s,'説明が届き、無党派は納得した。');}else{change(s,[[7,-6]]);log(s,'説明は空回りした。');}}
    else if(id==='distance'){change(s,[[11,-12]]);const d=s.debts.find(d=>d.group===11&&['未回収','一部履行'].includes(d.status));if(d){d.status='一部履行';d.weight=1;}hist(s,'業界と距離を置くと表明','発言');}
    else{change(s,[[7,-8]]);s.clean=clamp(s.clean-4);}
   }},
  {id:'bosses',phases:['prologue','term','term2'],sure:true,when:s=>s.likes[5]>=55&&s.likes[4]<=0,
   event:()=>({speaker:'後援会長のオオクボ',title:'「経営者たちが、相手に付くそうだ」',body:'地元の会社の社長たちが「あの人は働く人の味方ばかりだ」と言って、相手候補を応援すると決めかけています。会って話すか、今の支持者を大事にするか。',choices:[
    c('meet','社長たちと会って話す','経営者が少し戻る／労働組合が不安になる'),
    c('union','働く人との関係を優先する','労働組合は安心／経営者の票が相手候補へ')]}),
   apply:(s,id)=>{
    if(id==='meet'){change(s,[[4,8],[5,-6]]);hist(s,'経営者団体と会合','接触',{group:4,publicity:1});}
    else{s.rivalOrg??=Array(12).fill(0);s.rivalOrg[4]+=population(s,4)*.3;log(s,'経営者団体が相手候補の支援を決めた。');}
   }},
  {id:'cult_report',phases:TERMS,sure:true,when:s=>s.likes[10]>=50||s.debts.some(d=>d.group===10),
   event:()=>({speaker:'記者のサトウ',title:'「あの宗教団体と、親しいのですか」',body:'宗教団体の集まりに出ていた写真が報じられました。信者からの支持は強いですが、ほかの人はその近さを気にしています。',choices:[
    c('admit','関係を認めて、きちんと説明する','無党派は少し離れる／信者は安心'),
    c('deny','「親しくない」と否定する','今は傷が浅い／あとでうそがばれるかもしれない'),
    c('cut','関係を断つと宣言する','信者が怒って相手候補へ／無党派は評価')]}),
   apply:(s,id)=>{
    if(id==='admit'){change(s,[[7,-8],[10,3]]);hist(s,'宗教団体との関係を認めて説明','発言');}
    else if(id==='deny'){change(s,[[7,-3]]);ensure(s).cultDenied=true;hist(s,'宗教団体との関係を否定','発言');}
    else{change(s,[[10,-25],[7,4]]);s.memory[10]=true;s.rivalOrg??=Array(12).fill(0);s.rivalOrg[10]+=s.org[10];s.org[10]=0;s.debts.filter(d=>d.group===10&&['未回収','一部履行'].includes(d.status)).forEach(d=>d.status='踏み倒し');hist(s,'宗教団体との関係を断つと宣言','発言');}
   }},
  {id:'cult_exposed',phases:TERMS,weight:3,when:s=>flag(s,'cultDenied'),
   event:()=>({speaker:'記者のサトウ',title:'「否定していましたよね」',body:'以前「親しくない」と言った宗教団体との、新しい写真が出ました。うそをついたと受け止められています。',choices:[c('accept','受け止める','無党派が大きく離れる／信用が落ちる')]}),
   apply:s=>{change(s,[[7,-20]]);s.clean=clamp(s.clean-15);ensure(s).cultDenied=false;hist(s,'宗教団体との関係で発言のうそが発覚','矛盾');}},
  {id:'fandom',phases:['prologue','term'],sure:true,when:s=>s.likes[2]>=60&&s.fame>=50,
   event:()=>({speaker:'秘書のタナカ',title:'ファンが、相手の演説会場に押しかけています。',body:'あなたを応援する若い人たちが、相手候補の演説にヤジを飛ばして、その動画が広まりました。「あの人のファンはこわい」と言われ始めています。',choices:[
    c('calm','ファンに「落ち着いて」と呼びかける','若者は少しがっかり／無党派と高齢者は安心'),
    c('ride','盛り上がりに乗る','知名度と若者が上がる／高齢者が離れ、炎上するかも')]}),
   apply:(s,id)=>{
    if(id==='calm')change(s,[[2,-4],[7,3],[0,2]]);
    else{s.fame=clamp(s.fame+6);change(s,[[2,4],[0,-6]]);if(random(s)<.25){change(s,[[7,-8]]);log(s,'ファンの騒ぎが炎上した。');}}
   }},
  // ===== B. 災害・突発（ランダム） =====
  {id:'quake',phases:ALL,weight:1,when:s=>chapter(s)!=='prologue'||s.turn>=2,
   event:()=>({speaker:'秘書のタナカ',title:'大きな地震が起きました。',body:'選挙区で大きな地震があり、避難所ができています。今すぐ現地に入るか、東京で対策の実務に回るか、それとも予定どおり動くか。',choices:[
    c('go','現地に入り、泊まり込みで手伝う','今回の活動はこれに使う／地元が喜ぶ／体力を大きく使う'),
    c('hq','東京で対策の実務にあたる','党内で評価される／地元は「顔を見せない」と感じる'),
    c('ignore','予定の活動を続ける','地元とみんなが「冷たい」と感じる')]}),
   apply:(s,id)=>{
    if(id==='go'){s.energy=clamp(s.energy-20);if(judge(s,'policy')){change(s,[[6,8],...G.groups.map((_,i)=>[i,2])]);s.fame=clamp(s.fame+4);log(s,'現地での支援が評価された。');}else{change(s,[[7,-5]]);log(s,'「写真だけ」と批判された。');}hist(s,'震災の現地入り','写真',{publicity:2});return 'skip';}
    if(id==='hq'){s.influence=clamp(s.influence+3);change(s,[[6,-4]]);}
    else{change(s,[[6,-10],...G.groups.map((_,i)=>[i,-3])]);hist(s,'震災の最中に予定を優先','冷たい');}
   }},
  {id:'flood',phases:ALL,weight:2,when:s=>G.campaign(s),
   event:()=>({speaker:'秘書のタナカ',title:'大雨で、川があふれました。',body:'選挙運動の真っ最中に、選挙区で大雨の被害が出ました。運動を止めて手伝うか、予定どおり訴え続けるか。',choices:[
    c('pause','運動を止めて、片づけを手伝う','今回の活動はこれに使う／地元と無党派が喜ぶ'),
    c('go','予定どおり運動を続ける','無党派が「冷たい」と感じる')]}),
   apply:(s,id)=>{
    if(id==='pause'){change(s,[[6,6],[7,3]]);hist(s,'水害の片づけを手伝った','写真',{publicity:2});return 'skip';}
    change(s,[[7,-8]]);hist(s,'水害の最中に選挙運動を続けた','冷たい');
   }},
  {id:'pandemic',phases:TERMS,weight:1,when:()=>true,
   event:()=>({speaker:'秘書のタナカ',title:'感染症が広がり、集会が開けません。',body:'人を集める活動が難しくなりました。ネットに切り替えるか、無理に集会を開くか。',choices:[
    c('online','ネット配信に切り替える','政策力で判定／うまくいけば知名度と若者が上がる'),
    c('force','集会を開く','知名度は少し上がる／クリーン度と無党派が下がる')]}),
   apply:(s,id)=>{
    if(id==='online'){if(judge(s,'policy')){s.fame=clamp(s.fame+4);change(s,[[2,3]]);log(s,'ネット配信が話題になった。');}else log(s,'配信は伸びなかった。');}
    else{s.fame=clamp(s.fame+2);s.clean=clamp(s.clean-6);change(s,[[7,-8]]);}
   }},
  {id:'byelection',phases:TERMS,weight:2,when:hasParty,
   event:()=>({speaker:'党の幹部',title:'「よその選挙区を、手伝ってくれないか」',body:'別の選挙区で急な選挙があり、党から応援を頼まれました。行けば党に貸しができますが、今回の自分の活動はできません。',choices:[
    c('go','応援に行く','今回の活動はこれに使う／党内の評価が上がり、党への借りが1つ減る'),
    c('stay','地元を優先する','党内の評価が下がる')]}),
   apply:(s,id)=>{
    if(id==='go'){s.influence=clamp(s.influence+4);const d=s.debts.find(d=>d.group<0&&['未回収','一部履行'].includes(d.status));if(d){d.status='履行済み';log(s,d.name+'への借りを返した。');}hist(s,'よその選挙区の応援に入った','応援');return 'skip';}
    s.influence=clamp(s.influence-3);
   }},
  // ===== C. 政治とカネ =====
  {id:'ledger',phases:TERMS,weight:3,when:s=>s.clean<50&&s.visits.reduce((a,b)=>a+b,0)>=3,
   event:()=>({speaker:'記者のサトウ',title:'「政治資金の帳簿に、書き漏れがあります」',body:'支援者からもらったお金の一部が、帳簿に書かれていないと報じられました。直して謝るか、秘書のせいにするか、否定するか。',choices:[
    c('fix','帳簿を直して謝る','無党派が離れる／今後の追及は弱まる'),
    c('blame','秘書のミスだと説明する','今は傷が浅い／あとで本人の関与が出るかもしれない'),
    c('deny','事実はないと否定する','今は傷がとても浅い／うそがばれると大きく失う')]}),
   apply:(s,id)=>{
    ensure(s).moneyScandal=true;
    if(id==='fix'){s.clean=clamp(s.clean-5);change(s,[[7,-8]]);hist(s,'帳簿の書き漏れを直して謝罪','謝罪済み');}
    else if(id==='blame'){change(s,[[7,-4]]);ensure(s).ledgerRisk=true;hist(s,'帳簿の書き漏れを秘書のミスと説明','発言');}
    else{change(s,[[7,-2]]);ensure(s).ledgerRisk=true;hist(s,'帳簿の書き漏れを否定','発言');}
   }},
  {id:'ledger_exposed',phases:TERMS,weight:3,when:s=>flag(s,'ledgerRisk'),
   event:()=>({speaker:'記者のサトウ',title:'「やはり本人が知っていた」',body:'帳簿の書き漏れについて、あなたが知っていたことを示すメモが見つかりました。',choices:[c('accept','受け止める','無党派が大きく離れる／信用が落ちる')]}),
   apply:s=>{change(s,[[7,-15]]);s.clean=clamp(s.clean-15);ensure(s).ledgerRisk=false;hist(s,'帳簿の書き漏れで本人の関与が発覚','矛盾');}},
  {id:'kickback',phases:['term2','term3'],weight:2,when:inFaction,
   event:()=>({speaker:'派閥の長老',title:'「これは君の分だ」',body:'パーティで集めたお金の一部が、派閥から「戻し」として届きました。帳簿には書きにくいお金です。',choices:[
    c('refuse','受け取らず、公表する','クリーン度が上がる／長老の機嫌を損ね、党内の評価が下がる'),
    c('take','受け取る','資金が増える／あとで報じられるかもしれない')]}),
   apply:(s,id)=>{
    if(id==='refuse'){s.money=Math.max(0,s.money-100);s.clean=clamp(s.clean+3);s.influence=clamp(s.influence-5);debt(s,-1,1);s.debts.at(-1).name='派閥の長老';hist(s,'派閥からの戻し金を拒んで公表','発言');}
    else{s.money+=200;s.clean=clamp(s.clean-10);ensure(s).kickbackRisk=true;hist(s,'派閥からの戻し金を受け取った','接触',{publicity:1});}
   }},
  {id:'kickback_exposed',phases:TERMS,weight:3,when:s=>flag(s,'kickbackRisk'),
   event:()=>({speaker:'記者のサトウ',title:'「派閥からの戻し金、受け取っていましたね」',body:'派閥から戻ってきたお金を受け取っていたことが報じられました。',choices:[c('accept','受け止める','無党派が離れる／クリーン度が落ちる')]}),
   apply:s=>{change(s,[[7,-12]]);s.clean=clamp(s.clean-12);const x=ensure(s);x.kickbackRisk=false;x.moneyScandal=true;hist(s,'派閥からの戻し金が発覚','報道への対応');}},
  {id:'faction_dissolve',phases:['term2','term3'],sure:true,when:s=>flag(s,'moneyScandal')&&inFaction(s),
   event:()=>({speaker:'同期のカミヤ',title:'「派閥を、なくすべきだと思う」',body:'お金の問題を受けて、党内で「派閥をなくそう」という声が広がっています。賛成すれば身軽になりますが、長老の後ろ盾も消えます。',choices:[
    c('yes','派閥をなくすことに賛成する','無党派が評価／長老への借りが消える／党内の力は伸びにくくなる'),
    c('no','派閥を残す','党内の評価は上がる／無党派とクリーン度が下がる')]}),
   apply:(s,id)=>{
    if(id==='yes'){s.influence=clamp(s.influence-5);change(s,[[7,6]]);s.debts.filter(d=>d.group<0&&d.name==='派閥の長老'&&['未回収','一部履行'].includes(d.status)).forEach(d=>d.status='履行済み');s.faction='none';hist(s,'派閥の解散に賛成','党内');}
    else{s.influence=clamp(s.influence+3);change(s,[[7,-6]]);s.clean=clamp(s.clean-3);hist(s,'派閥の存続を主張','党内');}
   }},
  {id:'secretary',phases:TERMS,weight:2,when:s=>s.network>=40&&s.clean<60,
   event:()=>({speaker:'記者のサトウ',title:'「秘書の方、問題があるようです」',body:'あなたの秘書が、事務所の人を怒鳴ったり、公用車を私用で使ったりしていると報じられました。',choices:[
    c('fire','すぐに辞めさせる','人脈が減る／無党派は少し評価'),
    c('keep','かばって続けさせる','クリーン度が下がる／「かばった」と記録される')]}),
   apply:(s,id)=>{
    if(id==='fire'){s.network=clamp(s.network-5);change(s,[[7,2]]);}
    else{s.clean=clamp(s.clean-8);hist(s,'問題を起こした秘書をかばった','かばい');}
   }},
  {id:'expenses',phases:TERMS,weight:2,when:()=>true,
   event:()=>({speaker:'記者のサトウ',title:'「議員の経費、何に使いましたか」',body:'議員に毎月出る経費の使い道を公開してほしい、と言われています。法律上は公開しなくてもよいお金です。',choices:[
    c('open','全部の使い道を公開する','クリーン度と無党派が上がる／少しお金を返す'),
    c('legal','「法律どおりです」とだけ答える','無党派が離れる')]}),
   apply:(s,id)=>{
    if(id==='open'){s.money=Math.max(0,s.money-50);s.clean=clamp(s.clean+5);change(s,[[7,4]]);hist(s,'経費の使い道を全公開','発言');}
    else{change(s,[[7,-4]]);hist(s,'経費の公開を拒んだ','発言');}
   }},
  // ===== D. 選挙区の出来事 =====
  {id:'mayor',phases:TERMS,weight:2,when:s=>s.district!==1&&hasParty(s),
   event:()=>({speaker:'後援会長のオオクボ',title:'「市長選、どっちを応援する？」',body:'地元の市長選挙で、党が推す人と、後援会が推す人が別々になりました。どちらを応援しても、もう片方が怒ります。',choices:[
    c('party','党が推す候補を応援する','党内の評価が上がる／地元と高齢者が怒る'),
    c('local','後援会が推す候補を応援する','地元が喜ぶ／党内の評価が下がり、党本部への借りができる'),
    c('neutral','どちらにも付かない','両方から「はっきりしない」と言われる')]}),
   apply:(s,id)=>{
    if(id==='party'){s.influence=clamp(s.influence+5);change(s,[[6,-8],[0,-4]]);hist(s,'市長選で党の候補を応援','党内');}
    else if(id==='local'){change(s,[[6,8]]);s.influence=clamp(s.influence-8);debt(s,-1,1);hist(s,'市長選で後援会の候補を応援','党内');}
    else{change(s,[[6,-3]]);s.influence=clamp(s.influence-3);}
   }},
  {id:'closure',phases:TERMS,weight:2,when:s=>s.likes[0]>=40||s.likes[1]>=40,
   event:()=>({speaker:'後援会長のオオクボ',title:'「病院と高校が、なくなるらしい」',body:'市の財政が厳しく、地元の病院と高校をへらす計画が出ました。住民は反対しています。',choices:[
    c('oppose','反対運動の先頭に立つ','高齢者と子育て世帯が喜ぶ／無党派は「財政を無視」と感じる'),
    c('plan','計画を認めつつ、代わりの案を出す','政策力で判定／うまくいけばみんなが納得')]}),
   apply:(s,id)=>{
    if(id==='oppose'){change(s,[[0,6],[1,6],[7,-4]]);hist(s,'病院と高校の存続を約束','公約',{group:0});}
    else if(judge(s,'policy')){change(s,[[0,3],[1,3],[7,3]]);log(s,'代わりの案が受け入れられた。');}
    else{change(s,[[0,-6],[1,-6]]);log(s,'代わりの案は「机上の空論」と言われた。');}
   }},
  {id:'facility',phases:TERMS,weight:2,when:s=>s.district===2,
   event:()=>({speaker:'後援会長のオオクボ',title:'「迷惑な施設を、受け入れるか」',body:'国から、みんなが嫌がる施設を選挙区に置きたいと言われました。受け入れれば補助金と仕事が来ますが、反対する人も多い。',choices:[
    c('accept','補助金と仕事のために受け入れる','地元と業界が喜ぶ／リベラル層と無党派が怒る'),
    c('oppose','反対する','リベラル層が喜ぶ／業界と地元の一部が怒る')]}),
   apply:(s,id)=>{
    if(id==='accept'){change(s,[[6,6],[11,6],[7,-6],[9,-12]]);hist(s,'迷惑施設の受け入れを表明','発言');}
    else{change(s,[[9,8],[7,3],[11,-8],[6,-4]]);hist(s,'迷惑施設に反対','発言');}
   }},
  {id:'parachute',phases:['prologue'],weight:3,when:s=>s.turn>=2&&s.turn<=4,
   event:s=>({speaker:'記者のサトウ',title:'「この街に、住んだことがありますか」',body:'「よそから来た候補だ」「親の地盤を継いだだけだ」という声が出ています。',choices:[
    c('move','家族で選挙区に引っ越す','お金がかかる／地元が喜ぶ',s.money<100),
    c('ignore','気にしない','地元と無党派が少し離れる')]}),
   apply:(s,id)=>{
    if(id==='move'){s.money-=100;change(s,[[6,5],[7,2]]);}
    else change(s,[[6,-5],[7,-3]]);
   }},
  {id:'heckler',phases:['prologue'],weight:3,when:s=>G.campaign(s),
   event:()=>({speaker:'秘書のタナカ',title:'演説中に、大声のヤジが飛んでいます。',body:'街頭演説の最中に、あなたを罵る人が現れました。周りの人が動画を撮っています。',choices:[
    c('calm','落ち着いて受け流す','弁舌で判定／うまくいけば知名度と無党派が上がる'),
    c('fight','言い返す','味方の層は沸く／無党派が離れ、炎上するかも'),
    c('police','警備に外へ出してもらう','リベラル層が怒る／「排除した」と記録される')]}),
   apply:(s,id)=>{
    if(id==='calm'){if(judge(s,'speech')){s.fame=clamp(s.fame+4);change(s,[[7,3]]);}else s.fame=clamp(s.fame+1);}
    else if(id==='fight'){const side=G.parties[s.party].likes[8]>=G.parties[s.party].likes[9]?8:9;change(s,[[side,4],[7,-4]]);if(random(s)<.2){change(s,[[7,-8]]);log(s,'言い返した動画が炎上した。');}}
    else{change(s,[[9,-5],[7,-2]]);hist(s,'ヤジを飛ばした人を排除','排除');}
   }},
  // ===== E. 党内・国会 =====
  {id:'heckle_clip',phases:TERMS,weight:2,when:s=>s.speech<40,
   event:()=>({speaker:'記者のサトウ',title:'国会でのヤジが、動画で広まっています。',body:'本会議中にあなたが飛ばしたヤジが切り抜かれ、ネットで広まりました。',choices:[
    c('sorry','謝る','無党派が少し離れる'),
    c('defiant','「言うべきことを言った」と開き直る','保守活動層が喜ぶ／無党派が離れる')]}),
   apply:(s,id)=>{
    if(id==='sorry')change(s,[[7,-3]]);
    else{change(s,[[8,3],[7,-8]]);hist(s,'国会のヤジを開き直った','発言');}
   }},
  {id:'discipline',phases:TERMS,weight:2,when:hasParty,
   event:()=>({speaker:'同期のカミヤ',title:'「あの人の処分、どうする？」',body:'問題を起こした議員を処分するかどうか、党内で票を取ります。',choices:[
    c('yes','処分に賛成する','党内の評価が上がる／無党派は少し冷たいと感じる'),
    c('no','処分に反対する','党内の評価が下がる／無党派は評価する')]}),
   apply:(s,id)=>{
    if(id==='yes'){s.influence=clamp(s.influence+3);change(s,[[7,-2]]);}
    else{s.influence=clamp(s.influence-4);const rebel=s.history.some(h=>h.kind==='造反');change(s,[[7,rebel?6:3]]);}
   }},
  {id:'grill',phases:TERMS,weight:2,when:s=>s.policy>=35,
   event:()=>({speaker:'秘書のタナカ',title:'「追及が、きつすぎませんか」',body:'国会で役所の人を厳しく問い詰めた場面が話題です。「よくやった」という声と「いじめだ」という声があります。',choices:[
    c('push','追及を続ける','弁舌で判定／うまくいけば知名度と無党派が上がる'),
    c('stop','矛を収める','党内と業界の評価が少し上がる')]}),
   apply:(s,id)=>{
    if(id==='push'){if(judge(s,'speech')){s.fame=clamp(s.fame+5);change(s,[[7,4]]);log(s,'追及が評価された。');}else{change(s,[[7,-6]]);s.influence=clamp(s.influence-3);log(s,'「やりすぎ」と批判された。');}}
    else{s.influence=clamp(s.influence+2);change(s,[[11,2]]);}
   }}
 ];
 const byId=Object.fromEntries(defs.map(d=>[d.id,d]));
 const ids=defs.map(d=>d.id);
 const rate={prologue:.35,term:.35,term2:.35,term3:.35};
 // 1ターン1本。確実イベントを優先し、なければ確率で候補から重み付き抽選。
 function pick(s){
  const x=ensure(s),ch=chapter(s);
  const ready=defs.filter(d=>d.phases.includes(ch)&&!x.seen.includes(d.id)&&d.when(s));
  const sure=ready.find(d=>d.sure);
  if(sure)return sure.id;
  const pool=ready.filter(d=>!d.sure);
  if(!pool.length||random(s)>=(rate[ch]||0))return null;
  const total=pool.reduce((a,d)=>a+(d.weight||1),0);
  let r=random(s)*total;
  for(const d of pool){r-=(d.weight||1);if(r<0)return d.id;}
  return pool[pool.length-1].id;
 }
 function event(s){const d=byId[s.event];return d?d.event(s):base.event(s);}
 function finishSkip(s){
  const exhausted=s.energy===0;
  if(exhausted){s.energy=35;s.fame=clamp(s.fame-3);log(s,'体力が尽き、休養した。');}
  if(isTermCh(s))G.Legislature.finishTurn(s);else if(exhausted)G.finishTurn(s);else s.stage='weekend';
 }
 function choose(s,id){
  const d=byId[s.event];if(!d)return base.choose(s,id);
  if(s.stage!=='event')return false;
  const ev=d.event(s),opt=ev.choices.find(c=>c.id===id);if(!opt||opt.disabled)return false;
  log(s,ev.title+' → '+opt.title);
  const x=ensure(s);if(!x.seen.includes(d.id))x.seen.push(d.id);
  s.event=null;
  const r=d.apply(s,id);
  if(r==='skip')finishSkip(s);else if(isTermCh(s))G.Legislature.advance(s);else s.stage='main';
  return true;
 }
 function validate(s){
  const x=s.extra;if(x===undefined)return true;
  if(!x||typeof x!=='object'||!Array.isArray(x.seen)||new Set(x.seen).size!==x.seen.length||!x.seen.every(id=>byId[id]))return false;
  for(const k of ['cultDenied','ledgerRisk','kickbackRisk','moneyScandal'])if(x[k]!==undefined&&typeof x[k]!=='boolean')return false;
  return true;
 }
 G.Extra={ids,defs,pick,event,validate};
 G.event=event;G.choose=choose;
})(typeof window!=='undefined'?window:globalThis);
