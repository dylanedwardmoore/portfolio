#!/usr/bin/env python3
"""Stage one: turn the source paintings into traced, flat-colour vectors.

    <venv>/bin/python assets/trace-shapes.py

Needs numpy, scipy and potracer, so it is kept apart from build-shapes.py --
which turns what this writes into the library and the marks, and needs nothing
but the standard library.

The source photographs are NOT in the repository: they are reference material
rather than site assets, and not ours to redistribute. This stage is run by
hand when they change, and what it writes into img/shapes/traced/ is the
committed record. Everything downstream builds from that, so a checkout can
rebuild the library and the marks without them; only re-tracing needs them
back in the working directory.

IN THE PAINTINGS' OWN COLOURS

Nothing here knows about this site's palette. That is the important decision
in the file.

An earlier version mapped every plane onto the nearest palette entry while
tracing, and it cost the pictures their composition. These works are built out
of several close tints -- a warm cream against a blue-white, an orange beside
a yellow -- and this palette has one near-white and no orange at all, so
distinct planes kept colliding. Fighting that (forbid collisions; price them;
weight lightness) only moved the damage around, and the damage was already
done: information had been thrown away at the earliest possible stage, to
satisfy a decision that belongs at the latest one.

So the planes are kept as they were painted. build-shapes.py maps them when it
pulls from the library, where the mapping is one table that can be changed
without re-tracing anything.

HOW A PLANE IS FOUND

  1. DENOISE. A median filter over the canvas weave and the print grain, which
     would otherwise become thousands of specks to trace around.

  2. CLUSTER. k-means on colour with the chroma amplified, because these
     compositions lean on very pale tints that plain RGB merges into one
     near-white. Centres within a few deltaE of each other are then merged:
     that is JPEG noise, not two planes.

  3. REGULARISE. A majority filter over the labels. Where two planes are
     within a hair of each other the clusterer does not draw a line between
     them, it dithers, and a dithered boundary traces as a coastline of ragged
     one-pixel teeth. A vote over a small window loses the speckle and keeps
     the edge.

  4. CLEAN. An opening and a closing at a radius of about two pixels in 1200 --
     a hundredth of an inch of canvas -- which takes the fringe off a boundary
     without touching the wander of the edge itself. Specks below a threshold
     go; pinholes are filled, but only pinholes.

  5. TRACE. potrace at a low curve tolerance. The tolerance is the point: at
     its default it smooths a hand-painted edge into an idealised one, and
     what makes these shapes worth having is that they are not idealised. A
     Bolotowsky edge is ruled but not machined, and at this setting the slight
     wander of a brush along a straightedge survives into the path.

Each source yields a flat SVG in its own colours and a JSON record holding
every traced region -- painted colour, area, bounding box, path -- one entry
per connected component. The components ARE the sub-shapes; nothing is cut out
by hand at any point.
"""

import json
import os

import numpy as np
import potrace
from PIL import Image, ImageFilter
from scipy import ndimage

OUT = "assets/img/shapes"

# Per source: the file, how many flat planes to look for, how close two of them
# have to be before they are the same plane, and what to crop away first. The
# counts are the number of planes actually in each picture, counted off it.
SOURCES = [
    # Seven, not five. Down the right of this crop there are three separate
    # pale planes -- the diagonal bar where the top edge of the canvas is seen
    # at an angle, the white beyond it, and the grey edge carrying the
    # signature -- and at a lower count they collapse into one white field and
    # two of the picture's shapes disappear.
    # Ten, not five. Down the right of this crop the canvas shows two of its
    # own faces -- a diagonal where the top edge is seen at an angle, and the
    # edge beside it -- and they are the same grey as each other (deltaE 2.1)
    # but four to five off the white beyond them. At a lower count k-means
    # spends every centre on the yellow and the creams, allocates none to the
    # pale end, and both shapes vanish into one white field. The extra centres
    # cost nothing: any that land on the same colour merge straight back.
    dict(name="corner", file="ilya bolotowsky.jpeg", k=10, merge=3.0),
    # The large pale lozenge that seems to hang behind this composition is not
    # in the painting. Measured, the region is LIGHTER and LESS saturated than
    # the paper around it -- L 92 against 88, chroma 0.9 against 5.4 -- which
    # is a lamp falling across a canvas, not a plane laid under one. Left
    # separate it traces as a ragged blob and gets mistaken for a ghosted
    # square; merged, the composition sits on plain ground, which is what it
    # actually does.
    dict(name="diamond", file="ilya shapes 2.jpeg", k=7, merge=5.0),
    dict(name="tondo-yellow", file="ilya shapes 3.jpg", k=6,
         crop=(0.10, 0.02, 0.90, 0.99)),
    dict(name="oval", file="ilya shapes 4.jpg", k=8, merge=3.5, speck=0.0016),
    # The pale disc under these shapes is not recoverable and is deliberately
    # not chased. It is a green whisper off the paper -- deltaE under two,
    # inside this small reproduction's own JPEG noise -- and the settings that
    # do separate it (chroma way up, merge near zero, and a vote wide enough
    # to stop the boundary tracing as a coastline) round every corner in the
    # picture off on the way. The four red planes are the composition, and
    # they carry the disc's arcs on their own cut edges, so the circle is
    # still in the drawing even though it is not a plane in it.
    dict(name="disc-red", file="ilya shapes 6.jpeg", k=4),

    # Photographed on cloth, with a deckle-edged margin round the print.
    dict(name="tondo-comb", file="ilya shapes 7.jpg", k=8,
         crop=(0.205, 0.085, 0.80, 0.925)),
]

CHROMA = 2.0      # how far a and b are scaled up before clustering
MERGE_DE = 5.0    # centres closer than this in Lab are the same plane
LONG_EDGE = 1200  # trace at this resolution
MEDIAN = 5        # denoise window, in pixels at that resolution
SMOOTH = 21       # majority-filter window over the labels, same units
OPT_TOL = 0.06    # potrace curve tolerance; low, so the hand survives
SPECK = 0.0009    # drop components under this share of the picture

# Small, for closing a boundary without rounding the corners off it.
CROSS = np.array([[0, 1, 0],
                  [1, 1, 1],
                  [0, 1, 0]], bool)


# ------------------------------------------------------------------ colour

def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805],
                  [0.2126, 0.7152, 0.0722],
                  [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    d = 6.0 / 29.0
    fx = np.where(xyz > d ** 3, np.cbrt(xyz), xyz / (3 * d * d) + 4.0 / 29.0)
    return np.stack([116 * fx[..., 1] - 16,
                     500 * (fx[..., 0] - fx[..., 1]),
                     200 * (fx[..., 1] - fx[..., 2])], -1)


def rgb_hex(c):
    return "#%02x%02x%02x" % tuple(int(round(min(255, max(0, v)))) for v in c)


# ---------------------------------------------------------------- clustering

def kmeans(x, k, iters=90, seed=3):
    rng = np.random.default_rng(seed)
    c = x[rng.choice(len(x), k, replace=False)].copy()
    for _ in range(iters):
        lab = ((x[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
        for i in range(k):
            m = lab == i
            if m.any():
                c[i] = x[m].mean(0)
    return c


def feature(a, gain=None):
    """Colour, in the space the clustering actually works in.

    CIE Lab, with a and b scaled up a little. Two reasons for each half.

    Lab, because plain RGB distance under-weights hue among light colours,
    and these paintings lean on pale tints -- a warm cream against a
    blue-white -- that RGB merges into one near-white.

    Only a LITTLE scaling, because the opposite error is just as easy. An
    earlier version clustered on grey plus a heavily amplified RGB deviation,
    which weighted chroma several times above lightness; that separated the
    tints and then quietly merged everything that differed only in VALUE. In
    `corner` that cost two planes outright -- the diagonal where the top edge
    of the canvas is seen at an angle, and the grey edge beside it carrying the
    signature -- because all three of those pale planes are the same hue and
    differ only in how light they are. A gain near two separates hue without
    going deaf to value.
    """
    lab = srgb_to_lab(a)
    g = CHROMA if gain is None else gain
    return np.stack([lab[..., 0], lab[..., 1] * g, lab[..., 2] * g], -1)


def regularise(idx, n, size):
    """Majority filter over the labels.

    Each plane's indicator is blurred and the winner taken per pixel, which is
    a vote over a small window. Speckle loses every vote it is in; a real edge
    keeps its shape, because the vote only flips where the edge actually is.
    The window is what separates the two -- wide enough to outvote noise a few
    pixels across, narrow enough to leave the slow wander of a painted edge
    exactly where the brush put it.
    """
    prob = np.stack([ndimage.uniform_filter((idx == i).astype(np.float32), size)
                     for i in range(n)])
    return prob.argmax(0)


def flatten(img, k, merge, chroma=None, smooth=None):
    """Find the flat planes, in the colours they were painted."""
    a = np.asarray(img, float)
    h, w, _ = a.shape
    flat = a.reshape(-1, 3)
    sample = flat[::max(1, len(flat) // 40000)]
    centres = kmeans(feature(sample, chroma), k)
    lab = ((feature(flat, chroma)[:, None, :] - centres[None]) ** 2).sum(2).argmin(1)
    mean = np.array([flat[lab == i].mean(0) if (lab == i).any() else [0, 0, 0]
                     for i in range(k)])

    # Merge the centres that are the same colour: JPEG noise and canvas
    # texture routinely split one plane into two.
    dl = srgb_to_lab(mean)
    group = list(range(k))
    for i in range(k):
        for j in range(i):
            if group[j] == j and np.sqrt(((dl[i] - dl[j]) ** 2).sum()) < merge:
                group[i] = j
                break
    keys = sorted(set(group))
    remap = {g: i for i, g in enumerate(keys)}
    idx = np.array([remap[group[i]] for i in range(k)])[lab].reshape(h, w)

    n = len(keys)
    idx = regularise(idx, n, SMOOTH if smooth is None else smooth)
    painted = np.array([flat[np.isin(lab, [i for i in range(k)
                                           if remap[group[i]] == p])].mean(0)
                        for p in range(n)])
    return idx, painted


# ------------------------------------------------------------------ tracing

def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def curve_to_path(curve, sx, sy):
    """potrace's own output, rescaled. Corners stay corners, arcs stay curves."""
    def pt(p):
        return f(p.x * sx), f(p.y * sy)

    d = ["M %s %s" % pt(curve.start_point)]
    for seg in curve:
        if seg.is_corner:
            d.append("L %s %s" % pt(seg.c))
            d.append("L %s %s" % pt(seg.end_point))
        else:
            d.append("C %s %s %s %s %s %s"
                     % (pt(seg.c1) + pt(seg.c2) + pt(seg.end_point)))
    d.append("Z")
    return " ".join(d)


def shoelace(d):
    """Twice the signed area of a path's on-curve points. Sign is winding."""
    pts, cur = [], None
    for tok in d.replace(",", " ").split():
        try:
            v = float(tok)
        except ValueError:
            cur = tok
            continue
        pts.append(v)
    xy = [(pts[i], pts[i + 1]) for i in range(0, len(pts) - 1, 2)]
    n = len(xy)
    return sum(xy[i][0] * xy[(i + 1) % n][1] - xy[(i + 1) % n][0] * xy[i][1]
               for i in range(n)) if n > 2 else 0.0


def trace_mask(mask, sx, sy, turd):
    """Trace one plane. The mask goes in INVERTED, and as bool.

    potrace works on ink: it traces what falls BELOW its black level, so a
    mask passed straight in has the plane read as paper and the rest of the
    picture read as the shape -- every region comes back as the whole canvas
    with the region punched out of it, which renders as a solid rectangle and
    looks, misleadingly, like a plausible result.

    Bool, because inverting an integer mask with ~ is a bitwise not: 0 and 1
    become 255 and 254, both well above the black level, and the whole plane
    vanishes into background.
    """
    return [curve_to_path(c, sx, sy)
            for c in potrace.Bitmap(~mask).trace(
                turdsize=turd, opticurve=True, opttolerance=OPT_TOL)]


def fill_pinholes(mask, turd):
    """Close specks inside a plane without closing the planes inside it.

    A plain fill-holes is catastrophic here. Every one of these compositions
    has colour enclosed by other colour -- a yellow block inside a disc, a
    stripe inside a field -- and filling holes swallows all of it, so each
    plane becomes its own bounding blob and the picture flattens to whichever
    one is painted last. Only holes smaller than a speck are closed.
    """
    filled = ndimage.binary_fill_holes(mask)
    holes, n = ndimage.label(filled & ~mask)
    if not n:
        return mask
    sizes = ndimage.sum(np.ones_like(holes), holes, range(1, n + 1))
    small = np.zeros(n + 1, bool)
    small[1:] = sizes < turd
    return mask | small[holes]


# --------------------------------------------------------------------- main

def run(spec, box=100.0):
    img = Image.open(spec["file"]).convert("RGB")
    if spec.get("crop"):
        x0, y0, x1, y1 = spec["crop"]
        img = img.crop((int(x0 * img.width), int(y0 * img.height),
                        int(x1 * img.width), int(y1 * img.height)))
    scale = LONG_EDGE / max(img.size)
    img = img.resize((round(img.width * scale), round(img.height * scale)),
                     Image.LANCZOS).filter(ImageFilter.MedianFilter(MEDIAN))

    idx, painted = flatten(img, spec["k"], spec.get("merge", MERGE_DE),
                           spec.get("chroma"), spec.get("smooth"))
    h, w = idx.shape
    bw, bh = (box, box * h / w) if w >= h else (box * w / h, box)
    sx, sy = bw / w, bh / h
    turd = max(4, int(spec.get("speck", SPECK) * w * h))

    regions, layers = [], []
    for pi in range(len(painted)):
        mask = idx == pi
        # Closing only, and on a small element.
        #
        # There used to be an opening here as well, on a five-pixel disk. An
        # opening erodes before it dilates, so it deletes anything narrower
        # than its element outright -- which is exactly what the thin planes
        # in these pictures are. It broke the diagonal along the top edge of
        # `corner` into three fragments and thinned the narrowest rules of the
        # comb. The majority filter above already does the work it was there
        # for, and does it without a width threshold.
        mask = ndimage.binary_closing(mask, CROSS)
        mask = fill_pinholes(mask, turd)
        if not mask.any():
            continue
        colour = rgb_hex(painted[pi])

        comp, n = ndimage.label(mask)
        keep = np.zeros_like(mask)
        for c in range(1, n + 1):
            m = comp == c
            if m.sum() < turd:
                continue
            keep |= m
            ys, xs = np.where(m)
            paths = trace_mask(m, sx, sy, turd)
            if not paths:
                continue
            # The outer boundary on its own, as well as the whole region.
            #
            # A plane that has other planes lying on top of it comes back with
            # them punched out as holes -- the ghosted square behind the small
            # composition is a diamond with a trapezoid, a band and a block
            # missing from it. As a record of the painting that is right. As a
            # shape to reuse it is not: what is wanted is the diamond. The
            # largest contour by absolute area is the outline; everything else
            # is something that was sitting on it.
            outer = max(paths, key=lambda q: abs(shoelace(q)))
            regions.append(dict(
                plane=pi, painted=colour,
                area=round(float(m.sum()) / (w * h), 5),
                holes=len(paths) - 1,
                box=[round(xs.min() * sx, 2), round(ys.min() * sy, 2),
                     round((xs.max() + 1) * sx, 2), round((ys.max() + 1) * sy, 2)],
                d=" ".join(paths), outer=outer))
        if keep.any():
            paths = trace_mask(keep, sx, sy, turd)
            if paths:
                layers.append(dict(plane=pi, painted=colour,
                                   area=round(float(keep.sum()) / (w * h), 5),
                                   d=" ".join(paths)))

    layers.sort(key=lambda r: -r["area"])
    regions.sort(key=lambda r: -r["area"])
    for i, r in enumerate(regions):
        r["id"] = "%s-%02d" % (spec["name"], i)

    body = "\n".join('  <path d="%s" fill="%s" fill-rule="evenodd"/>'
                     % (l["d"], l["painted"]) for l in layers)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" '
           'width="%s" height="%s">\n%s\n</svg>\n'
           % (f(bw), f(bh), f(bw), f(bh), body))
    open("%s/sources/%s.svg" % (OUT, spec["name"]), "w").write(svg)

    rec = dict(name=spec["name"], source=spec["file"], box=[round(bw, 2), round(bh, 2)],
               painted=[l["painted"] for l in layers],
               layers=layers, regions=regions)
    open("%s/traced/%s.json" % (OUT, spec["name"]), "w").write(
        json.dumps(rec, indent=1) + "\n")
    print("  %-13s %5.1fx%-5.1f  %d planes, %2d regions   %s"
          % (spec["name"], bw, bh, len(layers), len(regions),
             " ".join(l["painted"] for l in layers)))
    return rec


def main():
    for sub in ("sources", "traced"):
        os.makedirs("%s/%s" % (OUT, sub), exist_ok=True)
    print("tracing:")
    for spec in SOURCES:
        run(spec)


if __name__ == "__main__":
    main()
