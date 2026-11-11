// Each pair refers only to what the corresponding drawing can show.
// The identity of the player is reserved for the ending.
export const CORRIDOR_CHOICES=Object.freeze([
 {question:'あの子は、どこへ。',left:'遠くへ出かけた。',right:'もう、帰らない。',correct:'right'},
 {question:'あの男が求めたもの。',left:'代わりになる子。',right:'新しい人形。',correct:'left'},
 {question:'あの部屋は。',left:'守るための部屋。',right:'逃がさないための部屋。',correct:'right'},
 {question:'あの戸口に来たのは。',left:'いつも、同じ子。',right:'そのたび、違う子。',correct:'right'},
 {question:'あの子が消えたあと。',left:'二人も、戻らなかった。',right:'二人は、待ち続けた。',correct:'left'},
 {question:'あの人が塞いだのは。',left:'外へ逃げる道。',right:'奥から伸びる手。',correct:'right'},
 {question:'あの手が伸びるのは。',left:'帰さないため。',right:'見送るため。',correct:'left'},
 {question:'戸の向こうにいたのは。',left:'赤い服と、青い服の二人。',right:'黒い帽子の男。',correct:'left'}
].map(Object.freeze));
export const CORRIDOR_COUNT=CORRIDOR_CHOICES.length;

export function corridorMessage(floor,side){
 const choice=Number.isInteger(floor)?CORRIDOR_CHOICES[floor-1]:null;
 if(!choice||!['left','right'].includes(side))return null;
 return {title:side==='left'?'左の僧侶':'右の僧侶',text:choice.question+'\n\n「'+choice[side]+'」'};
}

// The answer is committed at the concealed end of either return corridor,
// not while reading a monk or walking across the T junction.
export function evaluateCorridorExit(floor,{x,z}){
 const choice=Number.isInteger(floor)?CORRIDOR_CHOICES[floor-1]:null;
 if(!choice||!Number.isFinite(x)||!Number.isFinite(z)||z>-32.8||z<-33.98)return null;
 const side=x>=-7.98&&x<=-4.02?'left':x>=4.02&&x<=7.98?'right':null;
 return side?{side,correct:choice.correct===side}:null;
}
