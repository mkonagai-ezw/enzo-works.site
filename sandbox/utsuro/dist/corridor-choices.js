// Each pair refers only to what the corresponding drawing can show.
// The identity of the player is reserved for the ending.
export const CORRIDOR_CHOICES=Object.freeze([
 {question:'あの男が求めたもの。',left:'新しい人形。',right:'代わりになる子。',correct:'right'},
 {question:'あの戸口に来たのは。',left:'そのたび、違う子。',right:'いつも、同じ子。',correct:'left'},
 {question:'最後に、井戸へ向かったのは。',left:'飾りの帽子の男。',right:'赤と青の服の二人。',correct:'right'},
 {question:'あの人が止めていたのは。',left:'後を追う手。',right:'外へ出る子。',correct:'left'}
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
