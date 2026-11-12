"""Typeset the fictional in-game clipping with exact, readable Japanese text."""
from pathlib import Path
import json, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

root=Path(__file__).resolve().parents[1]/'sandbox/utsuro/dist/assets/newspaper'
article=json.loads((root/'article.json').read_text(encoding='utf-8'))
w,h=1024,1408
rng=np.random.default_rng(214)
y,x=np.mgrid[0:h,0:w]
edge=np.minimum.reduce([x,w-1-x,y,h-1-y])
noise=rng.normal(0,2.2,(h,w))
shade=16*np.exp(-edge/48)+7*np.exp(-((x-w*.51)/12)**2)+5*np.exp(-((y-h*.49)/10)**2)
for cx,cy,r in [(70,120,120),(940,1180,170),(630,1380,95),(1000,480,120)]:
 shade+=9*np.exp(-((x-cx)**2+(y-cy)**2)/(r*r))
paper=np.clip(np.stack([214+noise-shade,201+noise-shade,169+noise-shade],axis=-1),0,255).astype('uint8')
im=Image.fromarray(paper,'RGB');draw=ImageDraw.Draw(im)
font=lambda size:ImageFont.truetype('C:/Windows/Fonts/msmincho.ttc',size)
ink=(49,45,36)
draw.text((52,32),article['masthead'],font=font(62),fill=ink)
draw.text((52,112),article['date'],font=font(23),fill=ink)
draw.text((876,51),'七',font=font(38),fill=ink)
draw.line((48,151,976,151),fill=ink,width=5);draw.line((48,160,976,160),fill=ink,width=1)
draw.text((58,190),article['title'],font=font(82),fill=ink,stroke_width=1)
draw.text((62,302),article['subtitle'],font=font(37),fill=ink)
draw.line((52,371,972,371),fill=ink,width=2)
# Traditional vertical columns, read from right to left; no invented filler text.
text=''.join('　'+p for p in article['paragraphs']);rows=22;advance=40;colwidth=64
for n,ch in enumerate(text):
 col,row=divmod(n,rows);px=938-col*colwidth;py=407+row*advance
 if ch in '「」':
  glyph=Image.new('RGBA',(44,44));ImageDraw.Draw(glyph).text((0,0),ch,font=font(36),fill=(*ink,255));glyph=glyph.rotate(-90);im.paste(glyph,(px,py),glyph)
 else:draw.text((px+(21 if ch in '、。' else 0),py-(18 if ch in '、。' else 0)),ch,font=font(36),fill=ink)
draw.line((52,1320,972,1320),fill=ink,width=2)
draw.text((58,1338),'社会　／　続報',font=font(22),fill=ink)
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
