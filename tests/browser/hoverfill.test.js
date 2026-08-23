/**
 * THE GROUND THAT ARRIVES FROM WHERE THE POINTER CROSSED.
 *
 * assets/js/hoverfill.js fills the landing page's three blocks and the
 * register's back control by springing two hard stops apart along a gradient
 * line whose angle is the direction the pointer was travelling. The tests
 * that matter are not "does it animate" -- they are the three ways this
 * particular mechanism can be wrong:
 *
 *   IT MUST LEAVE NOTHING BEHIND. The stops are inline custom properties. A
 *   control the pointer has left must be back to the file it loaded as, for
 *   the same reason the rail's strain has to come off: a page transition
 *   snapshots these blocks, and a snapshot is bounded by what the element
 *   paints.
 *
 *   THE AXIS MUST NOT TURN MID-SWEEP. The stops are percentages along the
 *   gradient LINE, so they only mean anything paired with the angle that drew
 *   it. Turning the line while a band is part way across makes the same two
 *   numbers describe a different shape, and the ground jumps sideways in one
 *   frame. It is only safe to turn when the band is empty or when it covers
 *   everything.
 *
 *   IT MUST NOT RUN AT ALL WHERE IT WAS NOT WANTED. Reduced motion, and touch
 *   -- iOS applies :hover to a finger that is only passing through on its way
 *   to scrolling, and leaves it applied.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

const DESKTOP = { width: 1200, height: 900 };
const LANDING = PAGES[0];
const PORTFOLIO = PAGES.find(p => p.name === "portfolio");

/** Boxes the control and starts a per-frame recorder on its inline props. */
async function watch(p, sel) {
    const box = await p.evaluate(s => {
        const el = document.querySelector(s);
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, sel);
    await p.evaluate(s => {
        window.__frames = [];
        const el = document.querySelector(s);
        const t0 = performance.now();
        const tick = () => {
            const a = el.style.getPropertyValue("--fill-a");
            if (a !== "") {
                window.__frames.push([
                    Math.round(performance.now() - t0),
                    parseFloat(a),
                    parseFloat(el.style.getPropertyValue("--fill-b")),
                    parseFloat(el.style.getPropertyValue("--fill-rake")),
                ]);
            }
            window.__raf = requestAnimationFrame(tick);
        };
        tick();
    }, sel);
    return box;
}

const frames = p => p.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return window.__frames;
});

describe("the fill is armed only where it belongs", () => {
    test("a fine pointer with motion allowed gets it", async () => {
        const p = await ctx.openPage(LANDING, DESKTOP);
        try {
            assert.equal(await p.evaluate(() =>
                document.documentElement.classList.contains("fill-js")), true);
        } finally { await p.__close(); }
    });

    test("reduced motion does not, and still fills plainly", async () => {
        const p = await ctx.openPage(LANDING, DESKTOP, { reducedMotion: true });
        try {
            assert.equal(await p.evaluate(() =>
                document.documentElement.classList.contains("fill-js")), false,
                "the spring ran despite reduced motion");
            /*  And the plain fill still has to happen, or asking for less
                motion would mean no hover feedback at all. Asserted by
                hovering and reading the colour rather than by looking for the
                rule: a declaration whose value is a var() reports an empty
                string through the CSSOM, so the rule can be present, correct,
                and invisible to a test that goes looking for it.  */
            const box = await p.evaluate(() => {
                const r = document.querySelector(".doclink").getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
            });
            await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
            await p.waitForTimeout(260);
            const bg = await p.evaluate(() =>
                getComputedStyle(document.querySelector(".doclink")).backgroundColor);
            assert.equal(bg, "rgb(51, 255, 125)",
                `under reduced motion the block did not take the plain ground (${bg})`);
        } finally { await p.__close(); }
    });

    test("a touch pointer does not", async () => {
        const p = await ctx.openPage(LANDING,
            { width: 390, height: 844, phone: true });
        try {
            assert.equal(await p.evaluate(() =>
                document.documentElement.classList.contains("fill-js")), false,
                "a finger passing through would light the block up and leave it lit");
        } finally { await p.__close(); }
    });
});

describe("the sweep", () => {
    for (const [label, page, sel] of [
        ["landing block", LANDING, ".doclink"],
        ["back control", PORTFOLIO, ".backlink"],
    ]) {
        test(`${label}: covers, then comes off completely`, async () => {
            const p = await ctx.openPage(page, DESKTOP);
            try {
                const box = await watch(p, sel);
                await p.mouse.move(box.x + box.w * 0.4, box.y - 50);
                await p.mouse.move(box.x + box.w * 0.4, box.y + box.h * 0.5, { steps: 3 });
                await p.waitForTimeout(700);

                const settled = await p.evaluate(s => {
                    const el = document.querySelector(s);
                    return {
                        a: parseFloat(el.style.getPropertyValue("--fill-a")),
                        b: parseFloat(el.style.getPropertyValue("--fill-b")),
                    };
                }, sel);
                assert.ok(settled.a <= 0.6 && settled.b >= 99.4,
                    `settled short of the edges: ${settled.a}..${settled.b}`);

                await p.mouse.move(box.x + box.w + 60, box.y + box.h * 0.5, { steps: 3 });
                await p.waitForTimeout(800);
                const left = await p.evaluate(s => {
                    const el = document.querySelector(s);
                    return ["--fill-a", "--fill-b", "--fill-rake"]
                        .filter(n => el.style.getPropertyValue(n) !== "");
                }, sel);
                assert.deepEqual(left, [],
                    "properties left on the element after the pointer went");
            } finally { await p.__close(); }
        });

        test(`${label}: bounces, and never turns its axis mid-sweep`, async () => {
            const p = await ctx.openPage(page, DESKTOP);
            try {
                const box = await watch(p, sel);
                // In one side and straight out the other, no dwell: the case
                // where a naive implementation re-maps the stops onto a new
                // axis while the band is part way across.
                await p.mouse.move(box.x - 40, box.y + box.h * 0.5);
                await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 2 });
                await p.mouse.move(box.x + box.w + 40, box.y + box.h * 0.5, { steps: 2 });
                await p.waitForTimeout(800);
                const f = await frames(p);
                assert.ok(f.length > 10, `only ${f.length} animated frames`);

                // A jump is a large single-frame swing in the angle. The rake
                // relaxing moves it a degree or two a frame and is the point
                // of the gesture; an axis switch is ninety.
                const jumps = [];
                for (let i = 1; i < f.length; i++) {
                    const d = Math.abs(f[i][3] - f[i - 1][3]);
                    const [, a0, b0] = f[i - 1];
                    const empty = Math.abs(b0 - a0) < 1;
                    const full = a0 <= 1 && b0 >= 99;
                    if (d > 20 && !empty && !full) {
                        jumps.push(`t=${f[i][0]}: ${d.toFixed(0)}deg while band `
                            + `was ${a0.toFixed(1)}..${b0.toFixed(1)}`);
                    }
                }
                assert.deepEqual(jumps, [], "the ground jumped sideways");
            } finally { await p.__close(); }
        });
    }

    test("it starts where the pointer crossed, not at the edge", async () => {
        /*  The whole point of the gesture. Entering near one end must open the
            ground near that end -- if the first frame is always 50% or always
            0%, the direction work is doing nothing and nobody would see it.  */
        const p = await ctx.openPage(LANDING, DESKTOP);
        try {
            const box = await watch(p, ".doclink");
            // Come in from the left, low, so the projection is nowhere near
            // the middle.
            await p.mouse.move(box.x - 60, box.y + box.h * 0.5);
            await p.mouse.move(box.x + 6, box.y + box.h * 0.5, { steps: 3 });
            await p.waitForTimeout(500);
            const f = await frames(p);
            const first = f[0];
            assert.ok(first, "nothing was drawn");
            // Opened as a narrow band, near the entry end.
            assert.ok(Math.abs(first[2] - first[1]) < 25,
                `opened ${(first[2] - first[1]).toFixed(1)}% wide; that is not a point`);
            assert.ok(first[1] < 35,
                `opened at ${first[1].toFixed(1)}%, but the pointer came in at the left edge`);
        } finally { await p.__close(); }
    });

    test("the direction it sweeps follows the direction of travel", async () => {
        const p = await ctx.openPage(LANDING, DESKTOP);
        try {
            const box = await watch(p, ".doclink");
            // Straight down onto it: the gradient should run top-to-bottom,
            // which in CSS angles is 180deg.
            await p.mouse.move(box.x + box.w * 0.5, box.y - 60);
            await p.mouse.move(box.x + box.w * 0.5, box.y + 8, { steps: 3 });
            await p.waitForTimeout(500);
            const f = await frames(p);
            // Late enough that the rake has settled out of the reading.
            const late = f[f.length - 1][3];
            const off = Math.min(Math.abs(late - 180), Math.abs(late - 180 + 360),
                Math.abs(late - 180 - 360));
            assert.ok(off < 35,
                `came straight down but the ground swept at ${late.toFixed(0)}deg, `
                + "not 180deg");
        } finally { await p.__close(); }
    });
});
