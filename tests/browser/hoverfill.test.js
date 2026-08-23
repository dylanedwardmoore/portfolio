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
const DISSERTATION = PAGES.find(p => p.name === "dissertation");

/**
 * Boxes the control and starts a per-frame recorder on its inline props.
 *
 * Returns TWO boxes, because for an inline link they are not the same thing.
 * getBoundingClientRect() gives the union of every line fragment, and a link
 * that wraps has a union whose middle falls in the gap between the end of one
 * line and the start of the next -- empty page, nothing to hover. Aiming a
 * pointer there is how these tests first "proved" the prose links were not
 * animating when they were animating perfectly well.
 *
 *   box  the union, which is the box the gradient is painted across and the
 *        one the script projects the pointer onto
 *   hit  the first line fragment, which is somewhere the pointer can land
 */
async function watch(p, sel) {
    const { box, hit } = await p.evaluate(s => {
        const el = document.querySelector(s);
        el.scrollIntoView({ block: "center" });
        const u = el.getBoundingClientRect();
        const f = el.getClientRects()[0] || u;
        const b = r => ({ x: r.x, y: r.y, w: r.width, h: r.height });
        return { box: b(u), hit: b(f) };
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
    return { box, hit };
}

const frames = p => p.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return window.__frames;
});

describe("the fill is armed only where it belongs", () => {
    /*  There is no marker class to look for any more -- the stylesheet and
        the spring drive the same two properties, so nothing needs to know
        whether the script ran. What separates the two cases is whether the
        stops MOVE: the rule puts them at the edges in one step, the spring
        walks them there. So that is what is asked.  */
    async function stopsAfterHover(vp, opts) {
        const p = await ctx.openPage(LANDING, vp, opts);
        try {
            const box = await p.evaluate(() => {
                const r = document.querySelector(".doclink").getBoundingClientRect();
                return { x: r.x, y: r.y, w: r.width, h: r.height };
            });
            await p.mouse.move(box.x + box.w * 0.5, box.y - 40);
            await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5, { steps: 3 });
            await p.waitForTimeout(40);
            const mid = await p.evaluate(() => {
                const el = document.querySelector(".doclink");
                return {
                    inline: el.style.getPropertyValue("--fill-a"),
                    computed: getComputedStyle(el).getPropertyValue("--fill-a").trim(),
                };
            });
            await p.waitForTimeout(600);
            const settled = await p.evaluate(() =>
                getComputedStyle(document.querySelector(".doclink"))
                    .getPropertyValue("--fill-a").trim());
            return { mid, settled };
        } finally { await p.__close(); }
    }

    test("a fine pointer with motion allowed gets the spring", async () => {
        const r = await stopsAfterHover(DESKTOP, {});
        assert.notEqual(r.mid.inline, "",
            "no inline stops part way through the sweep -- the spring is not running");
        assert.ok(parseFloat(r.mid.inline) > 0.5,
            `the stops were already at the edge (${r.mid.inline}) 40ms in; `
            + "that is the stylesheet's one-step fill, not a sweep");
    });

    test("reduced motion does not, and still fills", async () => {
        const r = await stopsAfterHover(DESKTOP, { reducedMotion: true });
        assert.equal(r.mid.inline, "",
            "the spring ran despite reduced motion");
        assert.equal(r.mid.computed, "0%",
            `asking for less motion left the block unfilled (${r.mid.computed})`);
    });

    test("a touch pointer does not", async () => {
        const p = await ctx.openPage(LANDING,
            { width: 390, height: 844, phone: true });
        try {
            // A finger passing through on its way to scrolling must not light
            // a block up and leave it lit, which is what iOS :hover does.
            await p.waitForTimeout(200);
            const inline = await p.evaluate(() =>
                document.querySelector(".doclink").style.getPropertyValue("--fill-a"));
            assert.equal(inline, "", "the spring attached on a touch pointer");
        } finally { await p.__close(); }
    });
});

describe("the sweep", () => {
    /*  Every kind of link that fills, including the inline ones. Those are
        the interesting case: an inline box can wrap, and its background is
        painted across the union of its fragments, which is the same box the
        script projects the pointer onto. If those two ever disagreed the
        ground would sweep somewhere the words are not.  */
    for (const [label, page, sel] of [
        ["landing block", LANDING, ".doclink"],
        ["blurb link", LANDING, ".bio a"],
        ["back control", PORTFOLIO, ".backlink"],
        ["register link", PORTFOLIO, ".entry-links a"],
        ["way back", DISSERTATION, ".doclink-inline"],
        ["prose link", DISSERTATION, ".prose a"],
    ]) {
        test(`${label}: covers, then comes off completely`, async () => {
            const p = await ctx.openPage(page, DESKTOP);
            try {
                const { hit } = await watch(p, sel);
                await p.mouse.move(hit.x + hit.w * 0.4, hit.y - 50);
                await p.mouse.move(hit.x + hit.w * 0.4, hit.y + hit.h * 0.5, { steps: 3 });
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

                await p.mouse.move(hit.x + hit.w + 60, hit.y + hit.h * 0.5, { steps: 3 });
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
                const { hit } = await watch(p, sel);
                // In one side and straight out the other, no dwell: the case
                // where a naive implementation re-maps the stops onto a new
                // axis while the band is part way across.
                await p.mouse.move(hit.x - 40, hit.y + hit.h * 0.5);
                await p.mouse.move(hit.x + hit.w * 0.5, hit.y + hit.h * 0.5, { steps: 2 });
                await p.mouse.move(hit.x + hit.w + 40, hit.y + hit.h * 0.5, { steps: 2 });
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
            const { hit } = await watch(p, ".doclink");
            // Come in from the left, low, so the projection is nowhere near
            // the middle.
            await p.mouse.move(hit.x - 60, hit.y + hit.h * 0.5);
            await p.mouse.move(hit.x + 6, hit.y + hit.h * 0.5, { steps: 3 });
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
            const { hit } = await watch(p, ".doclink");
            // Straight down onto it: the gradient should run top-to-bottom,
            // which in CSS angles is 180deg.
            await p.mouse.move(hit.x + hit.w * 0.5, hit.y - 60);
            await p.mouse.move(hit.x + hit.w * 0.5, hit.y + 8, { steps: 3 });
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
