(function(root){
 'use strict';
 const G=root.Game;
 const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 const text=(v,max=300)=>typeof v==='string'&&v.length<=max;
 const list=(a,check,length)=>Array.isArray(a)&&(length===undefined?a.length<=1000:a.length===length)&&a.every(check);
 G.restore=function(raw){
  try{
   if(typeof raw!=='string'||raw.length>1000000)return null;
   const s=JSON.parse(raw);
   if(!s||![1,2].includes(s.version)||!text(s.name,20)||!Number.isInteger(s.party)||!G.parties[s.party]||!Number.isInteger(s.district)||s.district<0||s.district>2)return null;
   const maxTurn=s.chapter==='leadership'?1:['term','term2','term3','government'].includes(s.chapter)?16:13;
   if(!Number.isInteger(s.turn)||s.turn<1||s.turn>maxTurn||!Number.isInteger(s.seed)||!finite(s.seed,0,4294967295))return null;
   if(!['main','event','weekend','result','end'].includes(s.stage)||!['未公認','公認','無所属','比例下位','公認取消'].includes(s.nomination))return null;
   for(const k of ['fame','speech','policy','network','energy','clean','influence','rivalFame'])if(!finite(s[k],0,100))return null;
   if(!finite(s.money,0,100000000)||!finite(s.wind,-1,1)||!Number.isInteger(s.newBusiness)||s.newBusiness<0)return null;
   for(const k of ['likes','rival'])if(!list(s[k],x=>finite(x,-50,100),12))return null;
   if(!list(s.memory,x=>typeof x==='boolean',12)||!list(s.org,x=>finite(x,0,100000),12)||!list(s.visits,x=>Number.isInteger(x)&&x>=0,12))return null;
   if(s.rivalOrg!==undefined&&!list(s.rivalOrg,x=>finite(x,0,100000),12))return null;
   if(!list(s.debts,(d)=>d&&Number.isInteger(d.id)&&s.debts[d.id]===d&&Number.isInteger(d.group)&&d.group>=-1&&d.group<12&&text(d.name)&&Number.isInteger(d.weight)&&d.weight>=1&&d.weight<=3&&['未回収','一部履行','履行済み','踏み倒し'].includes(d.status)))return null;
   if(!list(s.logs,l=>l&&Number.isInteger(l.turn)&&text(l.text,1000))||!list(s.history,h=>h&&Number.isInteger(h.turn)&&text(h.text,1000)&&text(h.kind)&&Number.isInteger(h.publicity)&&h.publicity>=1&&h.publicity<=3))return null;
   if(!list(s.collection,id=>Number.isInteger(id)&&!!s.debts[id])||new Set(s.collection).size!==s.collection.length)return null;
   for(const k of ['usedRescue','mandate'])if(typeof s[k]!=='boolean')return null;
   if(s.result&&( !finite(s.result.player,0,100000)||!finite(s.result.rival,0,100000)||!finite(s.result.share,0,1)||typeof s.result.won!=='boolean'))return null;
   if(s.stage==='result'&&!s.result)return null;
   if(s.chapter&&!['prologue','term','term2','term3','leadership','government'].includes(s.chapter))return null;
   if(['term','term2','term3','leadership','government'].includes(s.chapter)&&!G.Legislature?.validate(s))return null;
   if(G.Campaign&&!G.Campaign.validate(s))return null;
   if(G.Extra&&!G.Extra.validate(s))return null;
   if(G.Career&&!G.Career.validate(s))return null;
   if(s.stage==='event'){
    if(typeof s.event!=='string'||!G.event(s))return null;
    if(s.event==='collect'&&(!s.collection.length||!['未回収','一部履行'].includes(s.debts[s.collection[0]].status)))return null;
    if(s.event==='reform'&&(!['main','weekend','finish'].includes(s.resume)||!finite(s.donationRefund,0,100000)))return null;
   }
   // Only parse and validate. Loading must never consume random numbers or run actions.
   return s;
  }catch{return null;}
 };
 if(typeof module!=='undefined')module.exports=G.restore;
})(typeof window!=='undefined'?window:globalThis);
