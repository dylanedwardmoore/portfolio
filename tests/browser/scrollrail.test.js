/**
 * THE SCROLL RAIL BEHAVES LIKE AN INSTRUMENT.
 *
 * Every assertion here is a bug that happened, and several of them are bugs
 * introduced while fixing another one, which is the reason this file exists at
 * all -- the rail is the piece of this site where a plausible fix is most
 * likely to be wrong in a way nobody notices until they look at a phone.
 *
 *   MONOTONIC TRAVEL. A fix that made the track follow the sticky bar's real
 *   position shortened the track from the top as the bar pinned, and the thumb
 *   -- held at the top of a track whose top was rising faster than the thumb
 *   descended -- travelled 68px UPWARD on the first scroll down. It looked
 *   right in a still and was obviously wrong in motion.
 *
 *   VISIBLE AT THE TOP. The next attempt covered the thumb with opaque
 *   headers, which at the top of the page covered ALL of it: the instrument
 *   vanished exactly when the page was at the top.
 *
 *   CLEAN AT REST. The strain grows the ink layer beyond the mark and clips it
 *   back. A page transition morphs this bar between views by snapshotting it,
 *   and a snapshot is bounded by what the element paints -- so an ink layer
 *   left grown at rest hands the morph an image with transparent margins.
 *
 *   ABOVE THE LABELS. The rail crosses a sticky section label in every section
 *   of the register. If a label outranks it the thumb blinks out at each one.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { DEVICES, REPRESENTATIVE } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

const PORTFOLIO = PAGES.find(p => p.name === "portfolio");

/** Walks the page top to bottom, reporting the thumb's absolute position. */
const SWEEP = (steps) => {
    const rail = document.querySelector(".scrollrail");
    const thumb = document.querySelector(".scrollrail-thumb");
    const d = document.documentElement;
    const max = d.scrollHeight - window.innerHeight;
    const out = [];
    for (let i = 0; i <= steps; i++) {
        const y = Math.round(max * i / steps);
        window.scrollTo(0, y);
        window.dispatchEvent(new Event("scroll"));
        const rb = rail.getBoundingClientRect();
        out.push({
            y,
            hidden: rail.hidden,
            railTop: +rb.top.toFixed(2),
            railBottom: +rb.bottom.toFixed(2),
            top: +(rb.top + parseFloat(thumb.style.top || 0)).toFixed(2),
            height: +parseFloat(thumb.style.height || 0).toFixed(2),
        });
    }
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("scroll"));
    return out;
};

describe("the rail only exists where there is something to represent", () => {
    test("the landing page has no rail at all", async () => {
        const p = await ctx.openPage(PAGES[0], REPRESENTATIVE[3]);
        try {
            const n = await p.evaluate(() => document.querySelectorAll(".scrollrail").length);
            assert.equal(n, 0, "the landing page does not scroll and draws no rail");
        } finally { await p.__close(); }
    });

    test("the rail hides itself when the page fits the screen", async () => {
        // A very tall viewport makes even the register fit.
        const p = await ctx.openPage(PORTFOLIO, { width: 1200, height: 900 });
        try {
            const hidden = await p.evaluate(() => {
                // Take the register out of flow entirely. Capping the body's
                // height does not work -- the sections simply overflow it and
                // the document is exactly as tall as it was.
                const reg = document.querySelector(".register");
                const before = reg.style.display;
                reg.style.display = "none";
                window.dispatchEvent(new Event("resize"));
                const was = document.querySelector(".scrollrail").hidden;
                reg.style.display = before;
                window.dispatchEvent(new Event("resize"));
                return was;
            });
            assert.equal(hidden, true, "a rail with nothing to show must not draw");
        } finally { await p.__close(); }
    });
});

describe("the thumb travels correctly", () => {
    for (const vp of REPRESENTATIVE) {
        test(`${vp.name}: never runs backwards, and stays on its track`, async () => {
            const p = await ctx.openPage(PORTFOLIO, vp);
            try {
                const sweep = await p.evaluate(SWEEP, 60);
                const live = sweep.filter(s => !s.hidden);
                if (!live.length) return;   // nothing to scroll at this size

                const backwards = [];
                for (let i = 1; i < live.length; i++) {
                    const step = live[i].top - live[i - 1].top;
                    if (step < -0.01) {
                        backwards.push(`at y=${live[i].y}: moved ${step.toFixed(1)}px up`);
                    }
                }
                assert.deepEqual(backwards, [],
                    "the thumb moved up while the page scrolled down");

                const escaped = live.filter(s =>
                    s.top < s.railTop - 0.5
                    || s.top + s.height > s.railBottom + 0.5);
                assert.deepEqual(escaped.map(s => `y=${s.y}`), [],
                    "the thumb left its track");
            } finally { await p.__close(); }
        });
    }

    test("it reaches both ends", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const sweep = await p.evaluate(SWEEP, 40);
            const live = sweep.filter(s => !s.hidden);
            const first = live[0], last = live[live.length - 1];
            assert.ok(Math.abs(first.top - first.railTop) < 1.5,
                `at the top of the page the thumb sits ${(first.top - first.railTop).toFixed(1)}px `
                + "from the top of its track");
            assert.ok(Math.abs((last.top + last.height) - last.railBottom) < 1.5,
                "at the bottom of the page the thumb does not reach the end of its track");
        } finally { await p.__close(); }
    });
});

describe("the thumb can actually be seen", () => {
    /*  Not "is it in the DOM" -- it always was. Whether anything opaque is
        painted over it, which is how it disappeared once.  */
    test("nothing opaque covers it at the top of the page", async () => {
        for (const vp of REPRESENTATIVE) {
            const p = await ctx.openPage(PORTFOLIO, vp);
            try {
                const verdict = await p.evaluate(() => {
                    const rail = document.querySelector(".scrollrail");
                    const thumb = document.querySelector(".scrollrail-thumb");
                    if (rail.hidden) return { skip: true };
                    window.scrollTo(0, 0);
                    window.dispatchEvent(new Event("scroll"));
                    const rb = rail.getBoundingClientRect();
                    const top = rb.top + parseFloat(thumb.style.top || 0);
                    const h = parseFloat(thumb.style.height || 0);
                    const railZ = parseInt(getComputedStyle(rail).zIndex) || 0;

                    // Anything with a ground of its own, stacked above the
                    // rail, overlapping the thumb's band in the same lane.
                    const covering = [];
                    for (const el of document.body.querySelectorAll("*")) {
                        if (el === rail || rail.contains(el)) continue;
                        const cs = getComputedStyle(el);
                        const z = parseInt(cs.zIndex);
                        if (!Number.isFinite(z) || z <= railZ) continue;
                        if (cs.backgroundColor === "rgba(0, 0, 0, 0)") continue;
                        const r = el.getBoundingClientRect();
                        if (r.left > rb.right || r.right < rb.left) continue;
                        // Fully covering the thumb's band is the fault.
                        if (r.top <= top && r.bottom >= top + h) {
                            covering.push(`${el.tagName.toLowerCase()}.`
                                + String(el.className || "").split(" ")[0]);
                        }
                    }
                    return { covering, top, h };
                });
                if (verdict.skip) continue;
                assert.deepEqual(verdict.covering, [],
                    `${vp.name}: the thumb is completely hidden at the top of the page`);
            } finally { await p.__close(); }
        }
    });

    test("the rail outranks the sticky section labels", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const z = await p.evaluate(() => {
                const zi = s => {
                    const el = document.querySelector(s);
                    return el ? parseInt(getComputedStyle(el).zIndex) || 0 : null;
                };
                return { rail: zi(".scrollrail"), label: zi(".section-label") };
            });
            assert.ok(z.label !== null, "no section label found");
            assert.ok(z.rail > z.label,
                `rail z-index ${z.rail} does not outrank labels at ${z.label}; the thumb `
                + "will blink out at every section");
        } finally { await p.__close(); }
    });
});

describe("the mark is clean when nobody is touching it", () => {
    test("no strain properties survive at rest", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            // Scroll about, then let the spring settle.
            await p.evaluate(() => window.scrollTo(0, 600));
            await p.waitForTimeout(120);
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(1200);
            const left = await p.evaluate(() => {
                const t = document.querySelector(".scrollrail-thumb");
                return ["--strain-cut", "--strain-grow", "--strain-clip"]
                    .filter(n => t.style.getPropertyValue(n) !== "");
            });
            assert.deepEqual(left, [],
                "strain properties left set at rest -- the view transition "
                + "snapshots this bar and will capture transparent margins");
        } finally { await p.__close(); }
    });
});

describe("a viewport change is not a scroll", () => {
    /*  On a phone the address bar collapsing IS a resize, and it happens in
        the middle of the scroll that caused it. The strain reads a velocity by
        differencing two thumb positions, which only means anything if both
        were measured of the same layout.  */
    test("resizing mid-scroll leaves the rail consistent", async () => {
        const p = await ctx.openPage(PORTFOLIO, { width: 400, height: 800, phone: true });
        try {
            await p.evaluate(() => window.scrollTo(0, 1500));
            await p.waitForTimeout(80);
            // The address bar collapsing.
            await p.setViewportSize({ width: 400, height: 880 });
            await p.waitForTimeout(120);
            const state = await p.evaluate(() => {
                const rail = document.querySelector(".scrollrail");
                const thumb = document.querySelector(".scrollrail-thumb");
                const rb = rail.getBoundingClientRect();
                const top = rb.top + parseFloat(thumb.style.top || 0);
                const h = parseFloat(thumb.style.height || 0);
                return {
                    hidden: rail.hidden,
                    onTrack: top >= rb.top - 0.5 && top + h <= rb.bottom + 0.5,
                    finite: Number.isFinite(top) && Number.isFinite(h) && h > 0,
                };
            });
            assert.ok(state.finite, "thumb geometry went non-finite across a resize");
            assert.ok(state.onTrack, "thumb left its track across a resize");
        } finally { await p.__close(); }
    });
});
