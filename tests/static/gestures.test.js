/**
 * THE MARKS' SMALL GESTURES ARE WIRED UP AT BOTH ENDS.
 *
 * A gesture is three things that have to agree and are written in two files:
 * a name and a scope in idle.js, a rule and a @keyframes in portfolio.css,
 * and the entry in the one call that takes the class off again. Every way
 * they can disagree fails silently, which is why this file exists:
 *
 *   A gesture played on the MARK but styled on the PART (or the other way
 *   round) is valid CSS that animates nothing. The class goes on, the timer
 *   runs, the class comes off, and the shape never moved.
 *
 *   A gesture missing from the removal list is worse than absent. Its rule
 *   carries !important, so it outranks the story about to start, and the
 *   shape it is holding stays stranded half way out of the body until some
 *   later gesture happens to clear it.
 *
 *   A timer shorter than the animation it is timing takes the class off
 *   mid-flight, and the shape snaps home in one frame from wherever it had
 *   got to. That is the one fault here an eye can definitely see.
 *
 *   A gesture missing from the reduced-motion list runs for somebody who
 *   asked the whole site to hold still.
 *
 * None of these throws, logs, or shows up anywhere but the pixels.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { read } from "../lib/paths.js";
import { parseCss, splitTop } from "../lib/css.js";

const IDLE = read("assets/js/idle.js");
const SHEET = read("assets/css/portfolio.css");
const MARKUP = read("portfolio/index.html");

const ENTRY = /\{\s*name:\s*"([\w-]+)",\s*ms:\s*(\d+),\s*weight:\s*(\d+),\s*scope:\s*"(mark|part)"(?:,\s*grain:\s*(true|false))?\s*\}/g;

/** The gestures declared in one of idle.js's two repertoires. */
function repertoire(from, to) {
    const src = IDLE.slice(IDLE.indexOf(from), IDLE.indexOf(to));
    assert.ok(src, `idle.js no longer declares ${from}`);
    return [...src.matchAll(ENTRY)].map(m => ({
        name: m[1], ms: Number(m[2]), weight: Number(m[3]), scope: m[4],
        grain: m[5] === "true",
    }));
}

const GATHERED = repertoire("var GATHERED", "var OPEN");
const OPEN = repertoire("var OPEN", "function pick");
const ALL = [...GATHERED, ...OPEN];

/** The classes idle.js is able to take off again. */
function removable() {
    const m = IDLE.match(/classList\.remove\(([^)]*)\)/);
    assert.ok(m, "idle.js no longer clears its gestures in one place");
    return new Set([...m[1].matchAll(/"([\w-]+)"/g)].map(q => q[1]));
}

/** Rules in portfolio.css, minus the ones inside a reduced-motion query. */
const RULES = parseCss(SHEET).rules;
const MOTION_OK = RULES.filter(
    r => !r.at.some(a => /prefers-reduced-motion/.test(a)));
const MOTION_OFF = RULES.filter(
    r => r.at.some(a => /prefers-reduced-motion/.test(a)));

/**
 * The top-level functions in a transform, each with its arguments unparsed.
 *
 * A regex cannot do this: the values here nest two deep -- calc(var(--px,
 * 1px) * -1) -- and var() takes a comma inside its own brackets, so both
 * "find the calls" and "split the arguments" go wrong on the obvious pattern.
 * This walks the string instead and hands the argument splitting to splitTop,
 * which already knows not to split inside brackets.
 */
function functions(value) {
    const src = value.replace(/\s+/g, " ").trim();
    const out = [];
    let i = 0;
    while (i < src.length) {
        if (src[i] === " " || src[i] === ",") { i++; continue; }
        const head = /^([a-zA-Z-]+)\(/.exec(src.slice(i));
        if (!head) {
            const end = src.indexOf(" ", i);
            out.push({ name: null, raw: src.slice(i, end === -1 ? undefined : end) });
            if (end === -1) break;
            i = end;
            continue;
        }
        let depth = 0;
        let j = i + head[0].length - 1;
        for (; j < src.length; j++) {
            if (src[j] === "(") depth++;
            else if (src[j] === ")" && --depth === 0) break;
        }
        out.push({ name: head[1], args: src.slice(i + head[0].length, j) });
        i = j + 1;
    }
    return out;
}

/** The first time in an `animation` shorthand, in milliseconds. */
function seconds(value) {
    const t = (value || "").match(/(-?[\d.]+)(ms|s)\b/);
    if (!t) return null;
    return Number(t[1]) * (t[2] === "s" ? 1000 : 1);
}

describe("every gesture idle.js can play", () => {
    test("both states have a repertoire, not a single gesture", () => {
        assert.ok(GATHERED.length >= 4,
            `a gathered mark has only ${GATHERED.length} gesture(s) to draw from`);
        assert.ok(OPEN.length >= 4,
            `an open mark has only ${OPEN.length} gesture(s) to draw from`);
    });

    test("no repertoire offers the same gesture twice", () => {
        for (const [label, list] of [["gathered", GATHERED], ["open", OPEN]]) {
            const names = list.map(g => g.name);
            assert.deepEqual([...new Set(names)].sort(), [...names].sort(),
                `the ${label} repertoire names a gesture twice, `
                + "which quietly doubles its share of the draw");
        }
    });

    test("and the open mark is the one that stirs on its own", () => {
        /*  The open mark is the one the reader is beside and the one whose
            pieces have room to be seen moving; the rest are scenery a screen
            away. Drawn rather than ruled, so a gathered mark does still stir
            -- but far less often, and if the two weights ever came level the
            register would fidget hardest exactly where nobody is looking.  */
        const m = IDLE.match(
            /weight:\s*m\.classList\.contains\("is-open"\)\s*\?\s*(\d+)\s*:\s*(\d+)/);
        assert.ok(m, "stir() no longer draws its marks by state");
        const [open, shut] = [Number(m[1]), Number(m[2])];
        assert.ok(shut > 0, "a gathered mark can never stir at all");
        assert.ok(open > shut * 2,
            `an open mark is only ${(open / shut).toFixed(1)}x as likely to stir `
            + "as a gathered one, which is not the difference between the thing "
            + "being read and the scenery");
    });

    test("has a rule that targets what the class is actually put on", () => {
        const wrong = [];
        for (const g of ALL) {
            // scope "mark" puts the class on .section-index; scope "part" puts
            // it on one <i>. A selector written for the other one matches
            // nothing, and matching nothing is not an error in CSS.
            const want = g.scope === "mark"
                ? new RegExp(`\\.section-index\\.wiggle-${g.name}\\b`)
                : new RegExp(`\\.section-index i\\.wiggle-${g.name}\\b`);
            const hit = MOTION_OK.find(
                r => !r.keyframes && want.test(r.selector)
                    && (r.decls.animation || r.decls["animation-name"]));
            if (!hit) wrong.push(`${g.name} (scope ${g.scope})`);
        }
        assert.deepEqual(wrong, [],
            "these gestures have no rule at the scope they are played on -- "
            + "the class goes on and nothing moves");
    });

    test("can be taken off again", () => {
        const off = removable();
        const stuck = ALL.map(g => "wiggle-" + g.name).filter(c => !off.has(c));
        assert.deepEqual([...new Set(stuck)], [],
            "these gestures are never removed -- their !important would "
            + "outrank the next story and strand a shape half way out");
    });

    test("and nothing is removed that is never played", () => {
        const played = new Set(ALL.map(g => "wiggle-" + g.name));
        const dead = [...removable()].filter(c => !played.has(c));
        assert.deepEqual(dead, [],
            "these are cleared but never played -- left behind by a rename");
    });

    test("is silenced under reduced motion", () => {
        const loud = [];
        for (const g of ALL) {
            const quiet = MOTION_OFF.some(
                r => r.decls.animation === "none !important"
                    && new RegExp(`\\.wiggle-${g.name}\\b`).test(r.selector));
            if (!quiet) loud.push(g.name);
        }
        assert.deepEqual([...new Set(loud)], [],
            "these still run for somebody who asked the site to hold still");
    });

    test("nothing a piece is asked to do moves it off the pixel grid", () => {
        /*  THE MEASUREMENT THIS EXISTS FOR. Seven of the register's eighteen
            pieces are between 1.2 and 2.7 pixels wide, and a piece that narrow
            is drawn as one or two solid columns of pixels -- solid only while
            its edges sit on the grid. Measured on the register itself at
            dpr 2, against the count of pixels a piece puts down at full
            strength:

                1.19px wide, moved half a pixel sideways      keeps  50%
                1.19px wide, turned 1.6 degrees               keeps  68%
                8.98 x 3.19, breathed at 3%                   keeps  75%
                7.16 x 11.52, shrugged                        keeps  79%
                any of them, moved a WHOLE device pixel       keeps 100%

            None of the first four reads as a shape moving; they read as a
            shape going out, which is how they were reported twice. So every
            open gesture travels in whole multiples of --px and does nothing
            else -- no rotate, which has no whole-pixel version of itself, and
            no scale, which changes the width and is the same fault renamed.

            Written as a test rather than a comment because all four faults are
            one careless keyframe away, and every one of them is valid CSS that
            animates smoothly and looks like a working feature.  */
        const pieces = [
            ...OPEN.filter(g => g.scope === "part").map(g => "wg-" + g.name),
            "wg-ripple",
        ];
        const bad = [];
        for (const name of pieces) {
            const steps = RULES.filter(r => r.keyframes === name);
            assert.ok(steps.length, `${name} has no keyframes`);
            for (const r of steps) {
                if (!r.decls.transform) continue;
                const where = `${name} ${r.selector}`;
                for (const fn of functions(r.decls.transform)) {
                    if (fn.name === null) {
                        // A bare keyword. `none` is the only one that means
                        // anything here, and only the ripple uses it.
                        if (fn.raw !== "none") bad.push(`${where}: ${fn.raw}`);
                        continue;
                    }
                    // The resting delta the gesture is composed onto.
                    if (fn.name === "var") {
                        if (fn.args.trim() !== "--at") {
                            bad.push(`${where}: reads ${fn.args}`);
                        }
                        continue;
                    }
                    if (!/^translate[XY]?$/.test(fn.name)) {
                        bad.push(`${where}: ${fn.name}() is not travel`);
                        continue;
                    }
                    for (const raw of splitTop(fn.args, ",")) {
                        const v = raw.trim().replace(/\s+/g, " ");
                        if (!v) continue;
                        if (/^0(px)?$/.test(v)) continue;
                        if (/^var\( *--px *(?:, *[^)]*)?\)$/.test(v)) continue;
                        if (/^calc\( *var\( *--px *(?:, *[^)]*)?\) *\* *-?\d+ *\)$/.test(v)) {
                            continue;
                        }
                        bad.push(`${where}: travels ${v}, which is not a whole pixel`);
                    }
                }
            }
        }
        assert.deepEqual([...new Set(bad)], [],
            "these move a piece somewhere between two pixels, where a piece "
            + "1.2px wide loses half of itself");
    });

    test("and it holds and jumps rather than sliding between the two", () => {
        /*  Whole-pixel keyframes are only half of it. Interpolated smoothly,
            a piece still passes through every fraction between one pixel and
            the next on its way -- which is the same fault, just briefer. The
            stepped easing is what keeps it out of that space, so it is not
            optional and it is not a stylistic choice.  */
        const notStepped = [];
        for (const g of OPEN) {
            const want = g.scope === "mark"
                ? new RegExp(`\\.section-index\\.wiggle-${g.name}\\b`)
                : new RegExp(`\\.section-index i\\.wiggle-${g.name}\\b`);
            for (const r of MOTION_OK) {
                if (r.keyframes || !want.test(r.selector) || !r.decls.animation) continue;
                if (!/\bsteps\(/.test(r.decls.animation)) notStepped.push(g.name);
            }
        }
        assert.deepEqual([...new Set(notStepped)], [],
            "these slide between pixels instead of holding and jumping");
    });

    test("while the body, which is big enough to, still glides", () => {
        /*  The mirror of it. A gathered mark is one silhouette sixteen pixels
            tall and twenty to thirty-four wide, and the worst any of these
            costs it is five per cent -- so it is free to turn and swell and
            move by fractions, and it should, because a body that ticks reads
            as a mechanism. If these ever picked up the pieces' stepped easing
            the register would lose the difference between the two.  */
        const stepped = [];
        for (const g of GATHERED) {
            for (const r of MOTION_OK) {
                if (r.keyframes) continue;
                if (!new RegExp(`\\.section-index\\.wiggle-${g.name}\\b`).test(r.selector)) continue;
                if (r.decls.animation && /\bsteps\(/.test(r.decls.animation)) {
                    stepped.push(g.name);
                }
            }
        }
        assert.deepEqual([...new Set(stepped)], [],
            "the body is ticking like a piece");
    });

    test("and the ripple's one assumption still holds", () => {
        /*  Every other gesture is written as a delta on --at, the resting
            transform the script reads off whatever it is about to move. The
            ripple cannot be: it moves every piece at once and they would each
            need their own. It gets away with it because it is only ever
            offered to an OPEN mark, and an open piece rests at none -- both in
            the stylesheet's resting rule and at the end of every story that
            puts it there. Change either and the ripple starts by snapping
            every piece to the origin.  */
        const resting = MOTION_OK.find(
            r => !r.keyframes && /\.section-index\.is-open i$/.test(r.selector));
        assert.ok(resting, "the open resting rule has been renamed");
        assert.equal(resting.decls.transform, "none",
            "an open piece no longer rests at none");

        const wrong = RULES
            .filter(r => /^mark-.*-open$/.test(r.keyframes || "")
                && /\b100%/.test(r.selector))
            .filter(r => r.decls.transform !== "none")
            .map(r => `${r.keyframes} ends at ${r.decls.transform}`);
        assert.deepEqual(wrong, [],
            "a story no longer leaves its pieces at none when it opens a mark");
    });

    test("and every story ends exactly where the resting rules already put it", () => {
        /*  marks.js takes .anim off once a telling is over, and it has to,
            because an animation that is merely finished is still there: take
            its name away and give it back -- which is what every gesture does
            -- and the browser starts it again from the beginning. That shipped,
            and read as the small shapes diving back into the big one.

            Dropping the class is only safe while the fill it removes was
            holding each piece exactly where the stylesheet puts it anyway.
            Every open story must therefore end at none, which is the rule
            above, and every shut story at the gathered transform, which is
            this one. Change either end and marks will flinch when they
            settle -- once per section, on every scroll.  */
        const RESTING = "translate(var(--gx), var(--gy)) scale(var(--gs))";
        // The lead gathers in place, so its --gx and --gy are zero and its
        // story is written as the scale alone.
        const LEAD = "scale(var(--gs))";
        const wrong = RULES
            .filter(r => /^mark-.*-shut$/.test(r.keyframes || "")
                && /\b100%/.test(r.selector))
            .filter(r => {
                const t = (r.decls.transform || "").replace(/\s+/g, " ").trim();
                return t !== RESTING && t !== LEAD;
            })
            .map(r => `${r.keyframes} ends at ${r.decls.transform}`);
        assert.deepEqual(wrong, [],
            "a story no longer leaves its pieces where the gathered rule puts "
            + "them, so taking .anim off at the end of it will move something");
    });

    test("and the drag rides on scale, where the gestures cannot reach it", () => {
        /*  THE ONE THING THAT MAKES THE TWO COEXIST.

            drag.js strains a mark as it is scrolled past; idle.js plays small
            gestures on it. Both are deformations of the same element, and if
            both were written on `transform` one would have to fight the other
            or wait for it -- a gesture cancelled by a scroll, or a strain that
            stutters whenever a mark fidgets.

            They do not, because the drag is on `scale`, which is its own
            property: the browser composes translate, rotate and scale with
            transform without either side knowing. Measured in the browser, a
            mark mid-gesture during a hard scroll carries scale 0.986 1.025 and
            a transform of its own at the same moment, and the gesture's clock
            advances through it untouched.

            It also keeps --at honest. idle.js reads a target's resting
            transform off the element to compose a gesture on top of it, and if
            the strain were in `transform` every gesture begun during a scroll
            would bake that instant's strain into its own resting pose and hold
            it for the gesture's whole length.

            So: the drag rule sets scale and never transform, and nothing in
            the gesture repertoire sets scale. Either half breaks it.  */
        const dragged = MOTION_OK.filter(
            r => !r.keyframes && /\.section-index\.is-dragged\b/.test(r.selector));
        assert.equal(dragged.length, 1,
            `expected one rule for the drag, found ${dragged.length}`);
        assert.ok(dragged[0].decls.scale,
            "the drag rule no longer sets scale");
        assert.ok(!dragged[0].decls.transform,
            "the drag rule sets transform, which the gestures are already using");

        const clash = [];
        for (const g of [...GATHERED, ...OPEN]) {
            for (const r of RULES) {
                const isRule = !r.keyframes
                    && new RegExp(`\\.wiggle-${g.name}\\b`).test(r.selector);
                const isFrame = r.keyframes === "wg-" + g.name;
                if ((isRule || isFrame) && r.decls.scale) {
                    clash.push(`${g.name} sets the scale property`);
                }
            }
        }
        assert.deepEqual([...new Set(clash)], [],
            "a gesture is writing the property the drag is carried on");
    });

    test("outlives the timer that clears it", () => {
        /*  idle.js holds a gesture for its declared ms and then puts the mark
            back to rest. Shorter than the animation and the class comes off
            mid-flight: the shape snaps home from wherever it had reached, in
            one frame, which is the one fault in this file an eye can see.

            The ripple is the awkward one -- it runs every piece in turn, so it
            lasts its own duration plus the last piece's delay, and the last
            piece is whichever mark in the register has the most of them.  */
        const steps = Math.max(...[...MARKUP.matchAll(/--i:(\d+)/g)]
            .map(m => Number(m[1])));
        assert.ok(Number.isFinite(steps) && steps > 0,
            "no --i in the markup; has the stagger been renamed?");

        const short = [];
        for (const g of ALL) {
            const rules = MOTION_OK.filter(
                r => !r.keyframes
                    && new RegExp(`\\.wiggle-${g.name}\\b`).test(r.selector)
                    && r.decls.animation);
            if (!rules.length) continue;                 // covered above
            for (const r of rules) {
                let needs = seconds(r.decls.animation);
                if (needs === null) continue;
                const delay = r.decls["animation-delay"];
                if (delay && delay.includes("--i")) needs += seconds(delay) * steps;
                if (g.ms < needs) {
                    short.push(`${g.name}: held ${g.ms}ms, runs ${needs}ms`);
                }
            }
        }
        assert.deepEqual(short, [],
            "these are cleared before they finish and snap home");
    });
});
