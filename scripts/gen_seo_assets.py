#!/usr/bin/env python3
"""Task 43 SEO assets: OG cover (1200x630) + PWA icons 192/512."""
from PIL import Image, ImageDraw, ImageFont

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BOOK = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
OUT = "/home/z/my-project/public/images"

INK = (10, 10, 10, 255)
WHITE = (245, 247, 250, 255)
BLUE = (91, 155, 213, 255)
ICE = (168, 207, 234, 255)
CORAL = (255, 77, 109, 255)


def og_cover():
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), INK)
    d = ImageDraw.Draw(img)

    # pearl radial glow
    glow = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((720, -260, 1560, 560), fill=52)
    gd.ellipse((-260, 380, 420, 940), fill=34)
    img = Image.composite(Image.new("RGB", (w, h), (34, 66, 104)), img, glow)
    d = ImageDraw.Draw(img)

    # wordmark
    f_logo = ImageFont.truetype(BOLD, 148)
    d.text((84, 168), "no reality.", font=f_logo, fill=WHITE)

    # tagline
    f_tag = ImageFont.truetype(BOOK, 40)
    d.text((90, 356), "your only limit is mind", font=f_tag, fill=ICE)

    # feature row
    f_feat = ImageFont.truetype(BOLD, 30)
    feats = ["AI video feed", "prediction markets", "prompt market"]
    x = 90
    for t in feats:
        tw = d.textlength(t, font=f_feat)
        d.rounded_rectangle((x - 20, 468, x + tw + 20, 528), radius=30, outline=BLUE, width=3)
        d.text((x, 480), t, font=f_feat, fill=WHITE)
        x += tw + 76

    # heart dot row (favorites nod)
    f_small = ImageFont.truetype(BOOK, 26)
    d.text((90, 566), "no-reality.fun  ·  watch the clip, call the ending, split the pool", font=f_small, fill=(150, 168, 188))

    img.save(f"{OUT}/og-cover.png", optimize=True)
    print("og-cover.png", img.size)


def icon(size: int):
    s = 4  # supersample
    W = size * s
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, W - 1, W - 1), radius=W // 5, fill=INK)
    f = ImageFont.truetype(BOLD, int(W * 0.5))
    tw = d.textlength("nr", font=f)
    bbox = f.getbbox("nr")
    th = bbox[3] - bbox[1]
    d.text(((W - tw) / 2, (W - th) / 2 - bbox[1]), "nr", font=f, fill=WHITE)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(f"{OUT}/icon-{size}.png", optimize=True)
    print(f"icon-{size}.png")


og_cover()
icon(192)
icon(512)
