#!/usr/bin/env python3
"""Stage two: the palette mapping, the shape library, and the section marks.

    python3 assets/build-shapes.py

Reads what assets/trace-shapes.py left in img/shapes/traced/ and needs nothing
but the standard library, so it runs anywhere. Tracing needs numpy, scipy and
potracer and is run only when the sources change.

    traced/          every plane found in every painting, as vector paths, in
                     the colours they were painted. Written by stage one.
    library/         the ones worth keeping, named, each moved to its own
                     origin -- still in the painting's colours.
    library-mapped/  the same shapes in this site's palette.
    sources/         the whole compositions, painted. Written by stage one.
    sources-mapped/  the same, in the palette.
    marks/           the six the register uses, as masks.
    library.json     the index: name, source region, box, aspect, painted
                     colour, mapped colour, note, path.

COLOUR IS DECIDED HERE, NOT WHILE TRACING

The library is kept in Bolotowsky's colours and translated on the way out.
That is the whole reason the mapping lives in this file: it is a decision, and
decisions get revisited, so it should be one table rather than something baked
irreversibly into a trace.

Mapping by nearest neighbour alone does not work. These paintings are built
out of several close tints -- in `corner` a warm cream, a blue-white and a
lilac, all within a few deltaE of each other -- and this palette has one
near-white. Nearest-neighbour sends all three to Paper and the composition
disappears, which is exactly what it means for a picture to have more
distinctions in it than the palette receiving it. So FORCED holds the places
where the choice has to be made rather than computed: which of the near-greys
becomes Neutral Gray, which stays Paper, and which takes the register's
hairline. The white tip at the head of `corner` stays a white tip.

Everything not named in FORCED falls to nearest-in-Lab, with lightness
weighted above hue -- a translation that keeps light planes light and dark
planes dark reads as the same picture in other colours; one that keeps hue and
loses value does not.
"""

import json
import math
import os

OUT = "assets/img/shapes"

SOURCES = ["corner", "diamond", "tondo-yellow", "oval", "disc-red", "tondo-comb"]

PALETTE = {
    "paper": "#ffffff",
    "rule": "#e4e4e2",
    "grey": "#b5d1cc",
    "yellow": "#ffe600",
    "red": "#ff3319",
    "blue": "#0057ba",
    "sea": "#33ff7d",
    "dusky": "#00592e",
    "muted": "#5c6b63",
    "ink": "#0e1f17",
}

# Painted colour -> palette entry, PER SOURCE, wherever nearest-neighbour
# would collide or would throw away a distinction the picture depends on.
#
# Per source, because the same near-white is a different thing in different
# pictures: #eaebe6 is the canvas's own edge in `corner`, where it has to stay
# separate from the white beside it, and it is the sheet in `oval`, where it
# has to be the sheet. One global table cannot say both.
#
# The entries have to keep VALUE. An earlier version sent two near-whites to
# Neutral Gray's darker neighbour on the grounds that it was free, and the
# mapped pictures came out with heavy dark bands where the paintings have
# almost nothing -- shapes ringed in black. A pale plane maps to a pale entry
# or the translation is a lie. There are three light entries here -- Paper,
# the register's hairline, and Neutral Gray -- so where a painting has four
# pale planes, two of them share, and the pair chosen to share is a pair that
# never touch.
FORCED = {
    "corner": {
        "#eff1f0": "paper",   # the white the diagonal opens onto
        "#e7e8c8": "rule",    # the warm cream across the head
        "#eaebe6": "grey",    # the canvas edge, right side and diagonal
        "#cdc1ce": "grey",    # the lilac bar -- far left, so it never meets it
        "#e7e7cd": "rule",
    },
    "diamond": {
        "#e8e5e1": "paper",   # the sheet
        "#e0dbd1": "paper",   # a lamp across the top of it, not a plane
        "#d4e2e9": "grey",    # the pale trapezoid
    },
    "tondo-yellow": {
        "#f3f2ec": "paper",   # the sheet
        "#f9f3e4": "rule",
        "#dce6ec": "grey",    # the tondo's ground
    },
    "oval": {
        "#eaebe6": "paper",   # here this one is the sheet
        "#ececee": "rule",
        "#e2dfd8": "grey",
        "#fd9f1a": "red",
    },
    "disc-red": {
        "#dfe1e3": "paper",
        "#d6ded5": "grey",
    },
    "tondo-comb": {
        "#edeae2": "paper",
        "#efe8d2": "rule",
        # The orange. It has nowhere of its own to go -- this palette runs
        # Apricot Yellow straight to Peach Red with nothing between -- and it
        # takes the red rather than the yellow because losing the warmth would
        # cost more than losing the separation. The orange rules still read,
        # because there is a cream rule either side of each.
        "#e87e09": "red",
    },
}


# ------------------------------------------------------------------ colour

def srgb_to_lab(rgb):
    c = [v / 255.0 for v in rgb]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047
    y = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
    z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883
    d = 6.0 / 29.0

    def g(t):
        return t ** (1.0 / 3.0) if t > d ** 3 else t / (3 * d * d) + 4.0 / 29.0

    fx, fy, fz = g(x), g(y), g(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def hex_rgb(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


PAL_LAB = {n: srgb_to_lab(hex_rgb(h)) for n, h in PALETTE.items()}

L_WEIGHT = 1.7   # lightness counts this much more than hue when matching
EXPECT_TOL = 6.0  # how far a region's colour may drift before it is not it


def delta_e(a, b):
    x, y = srgb_to_lab(hex_rgb(a)), srgb_to_lab(hex_rgb(b))
    return math.sqrt(sum((p - q) ** 2 for p, q in zip(x, y)))


def map_colour(painted, source=None):
    """Palette entry for a painted colour: forced if named, else nearest."""
    forced = FORCED.get(source, {})
    if painted in forced:
        return forced[painted]
    a = srgb_to_lab(hex_rgb(painted))
    return min(PAL_LAB, key=lambda n: (
        (L_WEIGHT * (a[0] - PAL_LAB[n][0])) ** 2
        + (a[1] - PAL_LAB[n][1]) ** 2 + (a[2] - PAL_LAB[n][2]) ** 2))


# ---------------------------------------------------------------- the library
#
# Which traced regions are worth keeping, and what they are called. Nothing
# here invents geometry: every path is a region potrace found in a painting,
# moved to its own origin and given a name. The only judgement is which ones
# are worth keeping.

# Each entry names the traced regions it is made of AND the colour those
# regions are painted. The colour is not decoration: region ids are positional,
# so re-tracing a source can renumber every region after the one that changed,
# and a library entry that silently starts pointing at its neighbour is the
# worst kind of breakage -- everything still builds and every shape is wrong.
# Checked at build time, a re-trace that moves things fails loudly instead.
LIBRARY = [
    # corner -----------------------------------------------------------------
    dict(name="field", ids=["corner-00"], expect=["#efca02"],
         note="The broad plane everything else in the picture is placed against."),
    dict(name="notch-band", ids=["corner-01"], expect=["#e7e8c8"],
         note="The band across the head, cut at forty-five where the canvas "
              "turns. The one diagonal in an otherwise entirely square painting."),
    dict(name="bar", ids=["corner-02"], expect=["#cdc1ce"],
         note="The binding edge: a plain vertical, full height."),
    dict(name="edge-bar", ids=["corner-03"], expect=["#eaebe6"],
         note="The grey bar down the right: the canvas showing its own edge."),
    dict(name="white-corner", ids=["corner-04"], expect=["#eff1f0"],
         note="The white the diagonal opens onto at the head."),
    dict(name="edge-diagonal", ids=["corner-07", "corner-06"],
         expect=["#eaebe6", "#eaebe6"],
         note="The diagonal grey bar between the two, where the top edge of "
              "the canvas is seen at an angle."),

    # diamond ----------------------------------------------------------------
    dict(name="rake-trapezoid", ids=["diamond-02"], expect=["#d4e2e9"],
         note="A block with one edge raked off."),
    dict(name="band", ids=["diamond-03"], expect=["#4596e5"],
         note="A rule that carries that same rake on past the block above it."),
    dict(name="block", ids=["diamond-04"], expect=["#f3dd1d"],
         note="A rectangle hung off a vertical."),
    dict(name="stub", ids=["diamond-05"], expect=["#4596e5"],
         note="The vertical it hangs from."),
    dict(name="wedge", ids=["diamond-06"], expect=["#f3dd1d"],
         note="A right angle with the opposite corner taken off on the diagonal."),

    # tondo-yellow -----------------------------------------------------------
    dict(name="arc-panel", ids=["tondo-yellow-01"], expect=["#f2d944"],
         note="A broad plane with one end turned by the circle it sits in."),
    dict(name="arc-block", ids=["tondo-yellow-02"], expect=["#dce6ec"],
         note="A block with its outer side machined round."),
    dict(name="pillar", ids=["tondo-yellow-03"], expect=["#f4c600"],
         note="A tall plane, square at the top, arc at the foot."),
    dict(name="arc-quarter", ids=["tondo-yellow-04"], expect=["#f2d944"],
         note="A quarter of a tondo: two straight edges meeting, an arc closing."),
    dict(name="cap", ids=["tondo-yellow-05"], expect=["#dce6ec"],
         note="A circle cut straight across, the part above the line kept."),

    # oval -------------------------------------------------------------------
    dict(name="lens", ids=["oval-05", "oval-04", "oval-03"],
         expect=["#f4d429", "#fd9f1a", "#f4d429"],
         note="The whole oval, cut flat down the side it faces. Three bands in "
              "the painting; one silhouette here."),
    dict(name="oval-cap", ids=["oval-05"], expect=["#f4d429"],
         note="The cap at the head of it."),
    dict(name="oval-band", ids=["oval-04"], expect=["#fd9f1a"],
         note="The band laid across it."),
    dict(name="oval-foot", ids=["oval-03"], expect=["#f4d429"],
         note="And the deeper plane below that."),
    dict(name="sliver", ids=["oval-06"], expect=["#fd9f1a"],
         note="A narrow curved plane out of the lens set beside the oval."),
    dict(name="chip", ids=["oval-08"], expect=["#303237"],
         note="The smallest plane in any of these, and the only near-black note."),

    # disc-red ---------------------------------------------------------------
    dict(name="plank", ids=["disc-red-01"], expect=["#dc3e2c"],
         note="A plain wide rectangle laid on a disc."),
    dict(name="notch-block", ids=["disc-red-02"], expect=["#dc3e2c"],
         note="A block with its foot taken off by the edge it crosses."),
    dict(name="disc-panel", ids=["disc-red-03"], expect=["#dc3e2c"],
         note="Flat where it was placed, round where it ran out."),
    dict(name="quarter-round", ids=["disc-red-04"], expect=["#dc3e2c"],
         note="A corner swelling into a quarter of a circle."),

    # tondo-comb -------------------------------------------------------------
    dict(name="arc-corner", ids=["tondo-comb-01"], expect=["#f1d707"],
         note="A rectangle with one corner turned by the circle it sits inside."),
    dict(name="arc-scoop", ids=["tondo-comb-02"], expect=["#ce2b08"],
         note="The same block from the other side, the arc taken out rather "
              "than added."),
    dict(name="rule-wide", ids=["tondo-comb-03"], expect=["#0d2eaa"],
         note="The broadest rule of the comb."),
    dict(name="cap-wide", ids=["tondo-comb-04"], expect=["#ce2b08"],
         note="A shallow cap, most of a circle's width."),
    dict(name="rule", ids=["tondo-comb-06"], expect=["#f1d707"],
         note="A middling rule of the comb."),
    dict(name="rule-short", ids=["tondo-comb-10"], expect=["#ce2b08"],
         note="A short one, stopped early by the circle."),
    dict(name="corner-piece", ids=["tondo-comb-12"], expect=["#ce2b08"],
         note="The last scrap the circle leaves."),
]

# ------------------------------------------------------------------- the marks
#
# The register used to mark each section with a 13px square. A square is the
# absence of a decision: it says a colour is coming and nothing else.
#
# These are small COMPOSITIONS instead -- two or three shapes from the library,
# set side by side with the intervals chosen rather than defaulted, in the
# manner the paintings themselves use. Bolotowsky's arrangements are what is
# borrowed: a narrow plane beside a broad one, rules of no two equal widths, a
# large form with a small satellite, and generous ground left between.
#
# ONE COLOUR EACH. The mark is masked out of the section's existing tone, so
# the register's palette is untouched and a shape can be changed without going
# near a colour. Where a part wants to sit back it is given alpha rather than
# another colour: through a mask that renders as the same hue at less strength,
# which keeps the whole mark inside the one entry the section already owns.
#
# Every mark is the same height and only the width varies. The mark sits
# directly above its heading; one that changed height would push the heading
# with it and the headings would stop agreeing down the register.

MARK_H = 16

# h: the part's height as a fraction of the mark's. gap: the interval BEFORE
# this part, in the same units. base: where it sits, 0 the foot and 1 the head.
MARKS = [
    ("ventures", "sea",
     "Companies built, and what building one looks like: a thin start, "
     "something solid after it, and then the largest thing in the mark, which "
     "has had a corner machined off it and is still the largest thing.",
     [dict(shape="pillar", h=0.45, base=0),
      dict(shape="block", h=0.72, base=0, gap=0.16),
      dict(shape="arc-corner", h=1.00, base=0, gap=0.18)]),

    ("research", "dusky",
     "Rules of no two equal widths or lengths, ruled off side by side: the "
     "comb, which is the one device in these paintings that is plainly a list "
     "of separate things. The last is set back, because there is always one "
     "more than is finished.",
     [dict(shape="pillar", h=1.00, base=0),
      dict(shape="rule", h=0.72, base=0, gap=0.26),
      dict(shape="rule-short", h=0.52, base=0, gap=0.18),
      dict(shape="rule-wide", h=0.86, base=0, gap=0.26, alpha=0.45)]),

    ("industry", "red",
     "A large plane machined down one edge to fit what was already there, and "
     "the offcut set beside it.",
     [dict(shape="arc-corner", h=1.00, base=0),
      dict(shape="corner-piece", h=0.42, base=0, gap=0.24, alpha=0.45)]),

    ("teaching", "yellow",
     "A form, and the horizon it is handed across: a quarter circle, then a "
     "shallow cap lying flat and well back from it.",
     [dict(shape="arc-quarter", h=0.92, base=0),
      dict(shape="cap-wide", h=0.20, base=0, gap=0.20, alpha=0.5)]),

    ("recognition", "blue",
     "A seal -- round on three sides, flat where it is presented -- and the "
     "plate it is pressed onto.",
     [dict(shape="lens", h=1.00, base=0),
      dict(shape="plank", h=0.30, base=0, gap=0.26, alpha=0.45)]),

    ("earlier", "grey",
     "Three fragments and the ground between them, each smaller than the last. "
     "The back matter takes the quietest mark, as it already takes no colour.",
     [dict(shape="sliver", h=0.90, base=0),
      dict(shape="chip", h=0.50, base=0, gap=0.25),
      dict(shape="rule", h=0.62, base=0, gap=0.20, alpha=0.55)]),
]


# ------------------------------------------------------------------- emitting

def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def write(path, body):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)


def prune(folder, keep):
    """Delete anything in a generated folder this build did not write.

    Renaming a shape used to leave the old file sitting there looking current,
    which is how a stale one gets picked up and puzzled over long after the
    entry that made it was gone. A generated directory should contain exactly
    what the generator says it contains.
    """
    d = "%s/%s" % (OUT, folder)
    gone = [f for f in os.listdir(d) if f.endswith(".svg")
            and f[:-4] not in keep]
    for f in gone:
        os.remove("%s/%s" % (d, f))
    return gone


def svg(w, h, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" '
            'width="%s" height="%s">\n%s\n</svg>\n'
            % (f(w), f(h), f(w), f(h), body))


def placed(d, x0, y0, fill, alpha=1.0):
    a = "" if alpha >= 1 else ' fill-opacity="%s"' % f(alpha)
    return ('  <g transform="translate(%s %s)">\n'
            '    <path d="%s" fill="%s"%s fill-rule="evenodd"/>\n  </g>'
            % (f(-x0), f(-y0), d, fill, a))


def load():
    regions, records = {}, {}
    for name in SOURCES:
        with open("%s/traced/%s.json" % (OUT, name), encoding="utf-8") as fh:
            rec = json.load(fh)
        records[name] = rec
        for r in rec["regions"]:
            r["src"] = name
            regions[r["id"]] = r
    return regions, records


def assemble(regions, ids, solid=False):
    """Join one or more traced regions and move them to their own origin.

    `solid` takes each region's outer contour instead of the whole thing. A
    plane with other planes lying on it is traced with them punched out --
    correct as a record, useless as a shape, since what is wanted from the
    ghosted square behind that small composition is the square.
    """
    parts = [regions[i] for i in ids]
    x0 = min(p["box"][0] for p in parts)
    y0 = min(p["box"][1] for p in parts)
    x1 = max(p["box"][2] for p in parts)
    y1 = max(p["box"][3] for p in parts)
    key = "outer" if solid else "d"
    return " ".join(p[key] for p in parts), (x0, y0, x1 - x0, y1 - y0)


def emit_mapped_sources(records):
    for name, rec in records.items():
        body = "\n".join(
            '  <path d="%s" fill="%s" fill-rule="evenodd"/>'
            % (l["d"], PALETTE[map_colour(l["painted"], name)])
            for l in rec["layers"])
        w, h = rec["box"]
        write("%s/sources-mapped/%s.svg" % (OUT, name), svg(w, h, body))


def emit_library(regions):
    index = {}
    for e in LIBRARY:
        name, ids, solid = e["name"], e["ids"], e.get("solid", False)
        missing = [i for i in ids if i not in regions]
        if missing:
            raise SystemExit("%s: no such traced region: %s"
                             % (name, ", ".join(missing)))
        got = [regions[i]["painted"] for i in ids]
        # Compared by distance, not equality. Re-running the trace shifts a
        # plane's mean by a bit or two -- that is a different average of the
        # same paint, and failing on it would make the check noise. A region
        # that has become a DIFFERENT plane is tens of deltaE away, so the
        # tolerance separates the two cases cleanly.
        for i, (a, b) in enumerate(zip(got, e["expect"])):
            if delta_e(a, b) > EXPECT_TOL:
                raise SystemExit(
                    "%s points at %s, which is now %s and not %s (dE %.1f).\n"
                    "The trace has renumbered its regions; re-pick them before "
                    "trusting any of this." % (name, ids[i], a, b, delta_e(a, b)))
        d, (x0, y0, w, h) = assemble(regions, ids, solid)
        painted = got[0]
        mapped = map_colour(painted, regions[ids[0]]["src"])
        write("%s/library/%s.svg" % (OUT, name),
              svg(w, h, placed(d, x0, y0, painted)))
        write("%s/library-mapped/%s.svg" % (OUT, name),
              svg(w, h, placed(d, x0, y0, PALETTE[mapped])))
        index[name] = dict(regions=ids, source=regions[ids[0]]["src"],
                           box=[round(w, 2), round(h, 2)],
                           aspect=round(w / h, 3) if h else 0,
                           painted=painted, mapped=mapped, solid=bool(solid),
                           mapped_hex=PALETTE[mapped], note=e["note"], d=d,
                           origin=[round(x0, 2), round(y0, 2)])
    return index


def compose(regions, index, parts):
    """Lay parts out left to right and return (svg body, width).

    Each part is drawn at its own proportion -- the height is given and the
    width follows -- so nothing is ever stretched to fill a box. Intervals are
    fractions of the mark's height, which keeps a composition's spacing the
    same shape whatever height the marks are drawn at.
    """
    body, x = [], 0.0
    for p in parts:
        spec = index[p["shape"]]
        d, (x0, y0, w, h) = assemble(regions, spec["regions"], spec["solid"])
        s = (p["h"] * MARK_H) / h
        x += p.get("gap", 0) * MARK_H
        y = (1 - p.get("base", 0)) * MARK_H - h * s
        body.append('  <g transform="translate(%s %s) scale(%s)">\n'
                    '    <path d="%s" fill="#000"%s fill-rule="evenodd"/>\n  </g>'
                    % (f(x - x0 * s), f(y - y0 * s), f(s), d,
                       "" if p.get("alpha", 1) >= 1
                       else ' fill-opacity="%s"' % f(p["alpha"])))
        x += w * s
    return "\n".join(body), x


def emit_marks(regions, index):
    marks = {}
    for name, tone, note, parts in MARKS:
        for p in parts:
            if p["shape"] not in index:
                raise SystemExit("mark %s wants missing shape %s" % (name, p["shape"]))
        body, width = compose(regions, index, parts)
        write("%s/marks/%s.svg" % (OUT, name), svg(width, MARK_H, body))
        marks[name] = dict(tone=tone, height=MARK_H, width=int(math.ceil(width)),
                           shapes=[p["shape"] for p in parts], note=note)
    return marks


def main():
    for sub in ("library", "library-mapped", "marks", "sources-mapped"):
        os.makedirs("%s/%s" % (OUT, sub), exist_ok=True)
    regions, records = load()
    emit_mapped_sources(records)
    index = emit_library(regions)
    marks = emit_marks(regions, index)

    stale = (prune("library", index) + prune("library-mapped", index)
             + prune("marks", marks) + prune("sources-mapped", set(SOURCES)))
    if stale:
        print("pruned %d stale file(s): %s" % (len(stale), ", ".join(sorted(stale))))

    write("%s/library.json" % OUT, json.dumps(
        dict(note="Generated by assets/build-shapes.py from img/shapes/traced/. "
                  "Do not edit by hand.",
             palette=PALETTE, sources=SOURCES, shapes=index, marks=marks),
        indent=2, sort_keys=True) + "\n")

    print("library %d | marks %d" % (len(index), len(marks)))
    for name, tone, _, parts in MARKS:
        print("   %-12s %-6s %2dx%-2d  %s" % (name, tone, marks[name]["width"],
                                              MARK_H,
                                              " + ".join(p["shape"] for p in parts)))
    print("mapping:")
    for src in SOURCES:
        rec = records[src]
        print("   %-13s %s" % (src, "  ".join(
            "%s>%s" % (l["painted"], map_colour(l["painted"], src))
            for l in rec["layers"])))


if __name__ == "__main__":
    main()
