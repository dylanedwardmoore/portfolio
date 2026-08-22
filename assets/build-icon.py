#!/usr/bin/env python3
"""Draws the site's mark and writes it out as a multi-size .ico.

    python3 assets/build-icon.py

WHAT IT IS

A section mark, written for a square.

The register marks each of its six sections with a small composition -- two or
three shapes from the traced library, set side by side with the intervals
chosen rather than defaulted, in the manner the paintings themselves use. That
is the site's visual language, and it did not exist when the previous icon was
drawn. This one is made out of it: the same library, the same grammar, the same
palette, arranged for a tile instead of a strip.

    bar          Sea Green      the binding edge, full height, bled top and
                                foot -- the one mark both pages carry, and the
                                only thing on this site that is always green
    disc-panel   Dusky Green     "flat where it was placed, round where it ran
                                out" -- one machined shoulder, which is the
                                gesture that separates the register's marks
                                from the flat planes of everything else
    chip         Apricot Yellow  the small saturated note, cropped by the right
                                edge so the tile reads as part of something
                                larger

WHY THESE THREE AND NOT SIX

The register has six tones and the obvious idea is to put all six in. It was
tried and it is mud: at sixteen pixels six hues come to two or three pixels
each and the tile turns to grey noise. The mark is not a census of the sections.
It is written in their hand, which is the thing that actually generalises --
shapes from their library, ground left between them, and no two measures in the
drawing alike.

WHAT IS KEPT FROM THE PAINTINGS

  * REAL SHAPES. These are the traced outlines themselves, loaded from
    img/shapes/library and rasterised, not rectangles standing in for them.
    Nothing is stretched: each is scaled by height and takes whatever width its
    own proportion gives it, exactly as the register's marks do. A traced plane
    squashed to fit is a plane about which something has been decided twice.
  * UNEQUAL EVERYTHING. Heights 1.00, 0.92, 0.54. Widths 0.20, 0.29, 0.28.
    Intervals 0.078 and 0.170. Nothing is centred, halved, or repeated.
  * A COMMON FOOT. All three stand on the bottom edge and run off it, which is
    what the marks do and what stops the tile being a vignette.
  * ONE SMALL SATURATED NOTE against several quiet ones.

The ground is Paper because the page is Paper. On a dark tab strip the tile
reads as a white card with a green edge, which is what the site looks like.
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
YELLOW = (0xFF, 0xE6, 0x00, 0xFF)
PAPER = (0xFF, 0xFF, 0xFF, 0xFF)

# shape, colour, height as a fraction of the tile, and the interval BEFORE it.
# The chip's interval is more than twice the first, which is what leaves the
# open ground on the right for it to be cropped against.
PARTS = [
    ("bar", SEA, 1.00, 0.000),
    ("disc-panel", DUSKY, 0.92, 0.078),
    ("chip", YELLOW, 0.54, 0.170),
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
    img = Image.new("RGBA", (s, s), PAPER)
    d = ImageDraw.Draw(img)

    x = 0.0
    for name, colour, h, gap in PARTS:
        polys, w0, h0 = load(name)
        x += gap
        w = h * (w0 / h0)          # its own proportion, never forced
        k = (h * s) / h0           # one scale for both axes
        top = (1.0 - h) * s        # every part stands on the foot
        for poly in polys:
            d.polygon([(x * s + a * k, top + b * k) for a, b in poly],
                      fill=colour)
        x += w

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
