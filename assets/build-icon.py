#!/usr/bin/env python3
"""Draws the site's mark and writes it out as a multi-size .ico.

    python3 assets/build-icon.py

WHAT IT IS

A Neo-Plastic composition after Ilya Bolotowsky, in this site's colours.

The layout is taken from a 1956 Bolotowsky, measured off the painting rather
than guessed at: a band across the head, a narrow bar down the left, a broad
field filling the rest, a band down the right, and a chip of another colour
at the top right where the two bands meet. Its proportions are kept --

    head band   0.1875 of the height    (3/16)
    left bar    0.1667 of the width     (1/6)
    right band  0.125  of the width     (1/8)
    the chip    from 0.70 to the right band, in the head band

-- and everything else about it is changed. The paint is gone: these are flat
colours with hard edges, which is what this site is made of and what a
photograph of a canvas is not.

WHY IT SUITS THE PAGE

Neo-Plasticism divides a field; it does not draw on a ground. That is already
how this site is built. The landing page is not a picture with a margin round
it -- it is a composition set flush against a binding edge with, in the
stylesheet's own words, "everything surplus collect[ing] on the right", which
is the same crop Bolotowsky paints: bands running off the edge, the frame
implied rather than drawn. The page and the painting were asking the same
question before either was put next to the other.

What is kept is the discipline, not the look:

  * FULL BLEED. The bar and the field run off the bottom. The tile is a crop
    of something larger, not a vignette.
  * UNEQUAL INTERVALS. No two measures in the drawing are the same and
    nothing is centred or halved.
  * STRICTLY ORTHOGONAL. Bolotowsky never cuts a diagonal, and neither does
    this -- which is why the rake the controls' rules now carry stays off the
    tile. At sixteen pixels it would be the loudest thing in a drawing made of
    planes, and it is meant to be the quietest thing on the page.
  * ONE SMALL SATURATED NOTE against several quiet ones.

THE COLOURS, AND WHICH PLANE TOOK WHICH

Every one is already in the stylesheets; nothing was mixed for this.

    left bar     Sea Green      #33ff7d   the accent, and the binding edge
    head + right Neutral Gray   #b5d1cc   Wada's pairing with Sea Green (340)
    the field    Paper          #ffffff   the page is white; so is this
    the chip     Apricot Yellow #ffe600   Wada's pairing with Sea Green (284)

The bar is green because on the page the bar IS green -- it is the one mark
the landing page carries, flush to the screen edge, and it lands in this
composition exactly where the painting put its narrowest colour.

The chip is yellow, and that is the one deliberate inversion. Yellow is the
plane that dominates the painting; here it is the smallest thing in the tile.
It is also the only saturated note that is not green, which gives the eye
somewhere to go in a composition that is otherwise pale, and it holds at
sixteen pixels where a subtler colour would silt up.

Both supporting colours are Sanzo Wada pairings of Sea Green in the book the
palette is drawn from, so the three-colour scheme is one the source already
makes rather than one assembled to taste.
"""

import struct
from io import BytesIO

from PIL import Image, ImageDraw

SEA = (0x33, 0xFF, 0x7D, 0xFF)     # the bar
GREY = (0xB5, 0xD1, 0xCC, 0xFF)    # head and right bands
PAPER = (0xFF, 0xFF, 0xFF, 0xFF)   # the field
YELLOW = (0xFF, 0xE6, 0x00, 0xFF)  # the chip

# The painting's proportions, as fractions of the square.
HEAD = 0.1875   # depth of the band across the top
BAR = 1 / 6.0   # width of the left bar
RIGHT = 0.875   # where the right band begins
CHIP = 0.70     # where the chip begins, inside the head band

# A hairline of paper wherever two planes meet, which is Bolotowsky's own
# departure from Mondrian: he stopped drawing the black lattice and let light
# lines do the dividing. Against the white field it is invisible and does no
# harm; against the bar and the chip it is what keeps the joins crisp.
HAIR = 0.008

# Supersample, then come down. Every edge here lands on a fraction of a pixel
# at the sizes that matter, and the hairline is thinner than one; drawing large
# and resampling is what keeps the bands from stepping.
SS = 12

# The sizes an .ico is actually asked for: tab and address bar, retina tab,
# Windows shortcut, and the larger ones a browser reaches for when it wants a
# tile rather than a favicon.
SIZES = (16, 32, 48, 64, 128, 256)


def draw(size):
    """The mark, at one size, drawn on a supersampled canvas."""
    s = size * SS
    h = HAIR * s

    # The bands are the ground: the field and the bar are laid into them, so
    # the head and right bands need no rectangles of their own and cannot
    # leave a seam at the corner where they meet.
    img = Image.new("RGBA", (s, s), GREY)
    d = ImageDraw.Draw(img)

    # The field, running off the bottom edge.
    d.rectangle([BAR * s + h, HEAD * s + h, RIGHT * s - h, s], fill=PAPER)

    # The bar, starting under the head band and running off the bottom too --
    # the head band crosses above it, as it does in the painting.
    d.rectangle([0, HEAD * s + h, BAR * s - h, s], fill=SEA)

    # The chip, at the right-hand end of the head band.
    d.rectangle([CHIP * s + h, 0, RIGHT * s - h, HEAD * s - h], fill=YELLOW)

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
    out.write(struct.pack("<HHH", 0, 1, len(images)))  # reserved, type=icon, count
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
    with open("assets/img/icon/dem_mark.ico", "wb") as fh:
        fh.write(ico(images))
    print("wrote assets/img/icon/dem_mark.ico (%s)"
          % ", ".join(str(n) for n in SIZES))


if __name__ == "__main__":
    main()
