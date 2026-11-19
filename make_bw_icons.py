#!/usr/bin/env python3
"""Make this site's icons: bible-study's own icons converted to black and white,
so the two sites look identical in the browser but are easy to tell apart on a
home screen. Usage: python3 make_bw_icons.py path/to/bible-study"""
import os, sys
from PIL import Image, ImageOps

src = os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".bible-study-src", "docs")
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
for rel in ["site/icon-192.png", "site/icon-512.png", "site/icon-maskable-512.png",
            "site/apple-touch-icon.png", "favicon.ico"]:
    im = Image.open(os.path.join(src, rel))
    if rel.endswith(".ico"):
        im = im.convert("RGBA")
        sizes = [(16, 16), (32, 32), (48, 48)]
    rgba = im.convert("RGBA")
    gray = ImageOps.grayscale(rgba.convert("RGB"))
    gray = ImageOps.autocontrast(gray, cutoff=1)
    out = Image.merge("RGBA", (gray, gray, gray, rgba.getchannel("A")))
    path = os.path.join(dst, rel)
    if rel.endswith(".ico"):
        out.save(path, sizes=sizes)
    else:
        out.save(path, optimize=True)
    print("wrote", rel)
