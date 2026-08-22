#!/usr/bin/env python3
"""Draws the site's mark and writes it out as a multi-size .ico.

    python3 assets/build-icon.py

WHAT IT IS

One field, divided, with a curve through it.

    the ground   Dusky Green     the whole tile, so nothing anywhere is white
    the bar      Sea Green       down the left, and where it ends it does not
                                 end square: disc-panel is "flat where it was
                                 placed, round where it ran out", and it runs
                                 out into the grey in one long sweep
    three chips  Yellow, Red,    a block in the corner with a stripe under one
                 Sea Green       end of it, and a third at the foot answering
                                 the bar from across the tile

WHY IT IS NOT A ROW OF PLANES

The version before this stood three shapes side by side on a common foot, in
the register's own grammar, and read as a diminishing line of blocks -- a bar
chart, which is a picture of a quantity and this is not one. The trouble was
the grammar: marks in the register stand in a row because they sit above a
heading in a strip. A tile is not a strip. It wants a field divided, which is
what the paintings do with a square and what this site does with a page.

So the dusky green is not a plane among planes here, it is the ground, and
there is no paper showing anywhere in the tile. The one curve is the only event, and it is a
boundary between two colours rather than a shape sitting on a background -- the
same reason Neo-Plasticism divides a field instead of drawing on one.

The chips are what keep it from being a diagram. Three of them, each a different
size, none aligned with another, one of them the same green as the bar so the
eye has somewhere to go back to.

Everything is the site's own palette and the bar is the site's own shape, traced
out of a Bolotowsky and scaled by height at its own proportion -- 0.315 wide to
its own height, which is what it is, not what would have been convenient.
"""

import os
import re
import struct
from io import BytesIO

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "img", "shapes", "library")

SEA = (0x33, 0xFF, 0x7D, 0xFF)
DUSKY = (0x00, 0x59, 0x2E, 0xFF)
GREY = (0xB5, 0xD1, 0xCC, 0xFF)
RED = (0xFF, 0x33, 0x19, 0xFF)
YELLOW = (0xFF, 0xE6, 0x00, 0xFF)

# The ground. Not a plane in the composition -- the field everything else is
# cut out of, which is why no part of this tile is ever paper.
#
# Dusky Green, which is the page's other green: the one the links are set in,
# deep enough to carry white at 8.5:1. Against it Sea Green stops being a
# surface and becomes a light, which is the right way round for a mark that has
# to hold at sixteen pixels on a strip of browser chrome. Neutral Gray was here
# and was too polite -- a pale tile among pale tiles reads as an empty one.
GROUND = DUSKY

# The bar: a traced shape at its own proportion, full height, hard on the left.
BAR = ("disc-panel", SEA, 1.00)

# The chips, as (x, y, w, h) in fractions of the tile.
#
# Three, and they are not scattered. Two of them are one thing -- a yellow
# block in the corner with a red stripe under its right-hand end, which reads
# as a single note with an accent rather than as two specks -- and the third is
# a green one at the foot, well away from both, echoing the bar. Chips spread
# evenly over the field looked like a spill; grouped and answered, they look
# placed.
#
# Every one runs off the side it is nearest, so the tile stays a crop of
# something larger and nothing floats in the middle of it.
CHIPS = [
    (0.760, 0.000, 0.240, 0.210, YELLOW),
    (0.900, 0.210, 0.100, 0.070, RED),
    (0.520, 0.920, 0.100, 0.080, SEA),
]

# Supersample, then come down. Every edge lands on a fraction of a pixel at the
# sizes that matter; drawing large and resampling is what keeps the curve from
# stepping and the bar from shimmering.
SS = 12

SIZES = (16, 32, 48, 64, 128, 256)


# --------------------------------------------------------------- the library

def _nums(s):
    return [float(t) for t in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", s)]


def _bezier(p0, p1, p2, p3, n=24):
    """A cubic, flattened. PIL fills polygons and knows nothing about curves,
    so every C in the path becomes twenty-four segments -- far finer than the
    supersampled grid can resolve, which is the point."""
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]))
    return out


def load(name):
    """One traced shape, as polygons in its own units, with its box."""
    with open(os.path.join(LIB, name + ".svg")) as fh:
        src = fh.read()
    box = _nums(re.search(r'viewBox="([^"]+)"', src).group(1))
    tx = ty = 0.0
    m = re.search(r'transform="translate\(([^)]+)\)"', src)
    if m:
        t = _nums(m.group(1))
        tx, ty = t[0], (t[1] if len(t) > 1 else 0.0)

    polys = []
    for d in re.findall(r'\sd="([^"]+)"', src):
        cur, pt, start = [], (0.0, 0.0), None
        for cmd, args in re.findall(r"([MCLZmclz])([^MCLZmclz]*)", d):
            a = _nums(args)
            if cmd in "Mm":
                if cur:
                    polys.append(cur)
                pt = (a[0], a[1])
                start, cur = pt, [pt]
                for i in range(2, len(a), 2):
                    pt = (a[i], a[i + 1])
                    cur.append(pt)
            elif cmd in "Ll":
                for i in range(0, len(a), 2):
                    pt = (a[i], a[i + 1])
                    cur.append(pt)
            elif cmd in "Cc":
                for i in range(0, len(a), 6):
                    p3 = (a[i + 4], a[i + 5])
                    cur.extend(_bezier(pt, (a[i], a[i + 1]),
                                       (a[i + 2], a[i + 3]), p3))
                    pt = p3
            elif cmd in "Zz":
                if cur:
                    polys.append(cur)
                cur = []
                if start:
                    pt = start
        if cur:
            polys.append(cur)

    return [[(x + tx, y + ty) for x, y in p] for p in polys], box[2], box[3]


# ------------------------------------------------------------------ the mark

def draw(size):
    """The mark, at one size, drawn on a supersampled canvas."""
    s = size * SS
    img = Image.new("RGBA", (s, s), GROUND)
    d = ImageDraw.Draw(img)

    name, colour, h = BAR
    polys, w0, h0 = load(name)
    k = (h * s) / h0                # one scale for both axes, never forced
    for poly in polys:
        d.polygon([(a * k, b * k) for a, b in poly], fill=colour)

    for x, y, w, ch, colour in CHIPS:
        d.rectangle([x * s, y * s, (x + w) * s, (y + ch) * s], fill=colour)

    return img.resize((size, size), Image.LANCZOS)


def ico(images):
    """An ICO holding a PNG payload per size.

    PIL will write one from a single source and resample the rest itself. Each
    size here is drawn at its own scale instead, so every edge is resolved
    against the pixel grid it will actually be seen on. That means assembling
    the container by hand, which is a three-field header and a directory entry
    apiece.
    """
    payloads = []
    for im in images:
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=True)
        payloads.append(buf.getvalue())

    out = BytesIO()
    out.write(struct.pack("<HHH", 0, 1, len(images)))
    offset = 6 + 16 * len(images)
    for im, data in zip(images, payloads):
        # 0 means 256 in these fields, which is why they are only a byte wide.
        out.write(struct.pack(
            "<BBBBHHII",
            im.width % 256, im.height % 256, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    for data in payloads:
        out.write(data)
    return out.getvalue()


def main():
    images = [draw(n) for n in SIZES]
    path = os.path.join(HERE, "img", "icon", "dem_mark.ico")
    with open(path, "wb") as fh:
        fh.write(ico(images))
    print("wrote assets/img/icon/dem_mark.ico (%s)"
          % ", ".join(str(n) for n in SIZES))


if __name__ == "__main__":
    main()
