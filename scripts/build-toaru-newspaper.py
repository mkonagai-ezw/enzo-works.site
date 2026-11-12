"""Typeset the fictional in-game clipping with exact, readable Japanese text."""
from pathlib import Path
import json, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

root=Path(__file__).resolve().parents[1]/'sandbox/utsuro/dist/assets/newspaper'
article=json.loads((root/'article.json').read_text(encoding='utf-8'))
w,h=900,1100
rng=np.random.default_rng(214)
y,x=np.mgrid[0:h,0:w]
edge=np.minimum.reduce([x,w-1-x,y,h-1-y])
noise=rng.normal(0,2.2,(h,w))
shade=16*np.exp(-edge/48)+7*np.exp(-((x-w*.51)/12)**2)+5*np.exp(-((y-h*.49)/10)**2)
for cx,cy,r in [(70,120,120),(940,1180,170),(630,1380,95),(1000,480,120)]:
 shade+=9*np.exp(-((x-cx)**2+(y-cy)**2)/(r*r))
paper=np.clip(np.stack([214+noise-shade,201+noise-shade,169+noise-shade],axis=-1),0,255).astype('uint8')
im=Image.fromarray(paper,'RGB');draw=ImageDraw.Draw(im)
font=lambda size:ImageFont.truetype('C:/Windows/Fonts/yumin.ttf',size)
bold=lambda size:ImageFont.truetype('C:/Windows/Fonts/yumindb.ttf',size)
ink=(37,35,30)
def vertical(text,px,py,size,step=None,heavy=False):
 f=bold(size) if heavy else font(size);step=step or size+2
 for i,ch in enumerate(text):
  yy=py+i*step
  if ch in '「」『』（）ー―':
   glyph=Image.new('RGBA',(size+8,size+8));ImageDraw.Draw(glyph).text((0,0),ch,font=f,fill=(*ink,255));glyph=glyph.rotate(-90);im.paste(glyph,(px,yy),glyph)
  else:draw.text((px+(size*.6 if ch in '、。' else 0),yy-(size*.5 if ch in '、。' else 0)),ch,font=f,fill=ink,stroke_width=0)
def columns(paragraphs,right,top,rows,size=28,pitch=38):
 # Each column is read top-to-bottom, then the reader moves one column left.
 text=''.join('　'+p for p in paragraphs)
 for col in range(math.ceil(len(text)/rows)):
  vertical(text[col*rows:(col+1)*rows],right-col*pitch,top,size,size+3)
 return math.ceil(len(text)/rows)
# Compact running head, edition/date, folio and double rules.
draw.rectangle((34,30,159,79),fill=ink)
draw.text((49,32),'社　会',font=bold(29),fill=(217,206,179))
draw.text((345,28),article['masthead'],font=bold(36),fill=ink)
draw.text((812,32),'⑦',font=font(28),fill=ink)
draw.text((34,89),article['date'],font=font(17),fill=ink)
draw.text((659,89),'地 域 ・ 捜 査',font=font(17),fill=ink)
draw.line((32,122,868,122),fill=ink,width=3);draw.line((32,128,868,128),fill=ink,width=1)
# Main story: large vertical headline on the right, narrow body columns on left.
vertical('児童の失踪',794,159,58,64,True)
vertical('相次ぐ',726,165,58,64,True)
draw.rectangle((736,397,784,639),outline=ink,width=2)
vertical('半年で五人',745,408,30,38,True)
vertical('県警、関連を捜査',656,166,30,37,True)
draw.line((641,158,641,684),fill=ink,width=1)
n=columns(article['paragraphs'][:3],588,162,17,28,38)
assert 588-(n-1)*38>=32
# Separate follow-up deck, as in a local newspaper's social affairs page.
draw.line((34,718,866,718),fill=ink,width=1)
draw.line((34,726,866,726),fill=ink,width=3)
vertical('集団下校を実施',802,754,30,34,True)
vertical('地域で見回り',754,764,27,34,True)
draw.line((727,754,727,1036),fill=ink,width=1)
columns([article['paragraphs'][3]],670,762,9,28,38)
draw.line((316,758,316,1036),fill=ink,width=1)
vertical('家族、帰りを待つ',253,765,25,29,True)
vertical('「無事でいてほしい」',195,765,25,27)
# Fine printer's rules and small footer, without decorative poster-like spacing.
draw.line((34,1053,866,1053),fill=ink,width=1)
draw.text((36,1062),'夕凪新聞　／　社会',font=font(16),fill=ink)
draw.text((723,1062),'朝刊　七面',font=font(16),fill=ink)
# A few faded spots and irregular edges retain the aged-paper appearance.
random.seed(214)
overlay=Image.new('RGBA',(w,h));od=ImageDraw.Draw(overlay)
for _ in range(330):
 px=random.randrange(w);py=random.randrange(h);r=random.uniform(.5,2.5)
 od.ellipse((px-r,py-r,px+r,py+r),fill=(92,65,35,random.randrange(8,32)))
im=Image.alpha_composite(im.convert('RGBA'),overlay)
mask=Image.new('L',(w,h),0);md=ImageDraw.Draw(mask)
outline=[(random.randrange(6,15),i) for i in range(8,h-8,16)]+[(i,h-random.randrange(6,15)) for i in range(8,w-8,16)]+[(w-random.randrange(6,15),i) for i in range(h-8,8,-16)]+[(i,random.randrange(6,15)) for i in range(w-8,8,-16)]
md.polygon(outline,fill=255);im.putalpha(mask.filter(ImageFilter.GaussianBlur(.4)))
im.save(root/'missing-children.webp',quality=88,method=6)
print(root/'missing-children.webp')
