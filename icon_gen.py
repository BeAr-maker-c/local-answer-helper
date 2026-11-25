import os
from PIL import Image, ImageDraw, ImageFont

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(out_dir, exist_ok=True)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角方形背景（蓝色渐变感：用两段色块近似）
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=(61, 126, 184, 255))
    # 顶部高光
    d.rounded_rectangle([int(size*0.06), int(size*0.06), int(size*0.94), int(size*0.45)],
                        radius=int(size*0.16), fill=(86, 152, 210, 255))
    # 白色文字 AI
    text = "AI"
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(size * 0.5))
    except Exception:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", int(size * 0.5))
        except Exception:
            font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), text, font=font, fill=(255, 255, 255, 255))
    return img

for s in (16, 48, 128):
    make_icon(s).save(os.path.join(out_dir, f"icon{s}.png"))
print("icons generated")
