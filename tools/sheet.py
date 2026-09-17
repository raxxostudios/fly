import sys, glob
from PIL import Image, ImageDraw
out, pattern, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
fs = sorted(glob.glob(pattern))
ims = [Image.open(f).convert('RGB') for f in fs]
th = int(tw * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * tw, rows * th), (40, 40, 40))
d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * tw, (i // cols) * th
    S.paste(im.resize((tw, th)), (x, y))
    d.text((x + 6, y + 4), f.split('/')[-1], fill=(255, 0, 255))
S.save(out, quality=88)
print(out, len(fs))
