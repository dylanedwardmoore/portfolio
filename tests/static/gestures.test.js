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
import { parseCss } from "../lib/css.js";

const IDLE = read("assets/js/idle.js");
const SHEET = read("assets/css/portfolio.css");
const MARKUP = read("portfolio/index.html");

const ENTRY = /\{\s*name:\s*"([\w-]+)",\s*ms:\s*(\d+),\s*weight:\s*(\d+),\s*scope:\s*"(mark|part)"\s*\}/g;

/** The gestures declared in one of idle.js's two repertoires. */
function repertoire(from, to) {
    const src = IDLE.slice(IDLE.indexOf(from), IDLE.indexOf(to));
    assert.ok(src, `idle.js no longer declares ${from}`);
    return [...src.matchAll(ENTRY)].map(m => ({
        name: m[1], ms: Number(m[2]), weight: Number(m[3]), scope: m[4],
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
