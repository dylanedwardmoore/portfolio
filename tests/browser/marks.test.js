/**
 * THE REGISTER'S SECTION MARKS.
 *
 * Each heading in the portfolio carries a small group of masked shapes that
 * separate and recombine as that section takes and loses the sticky header.
 * The parts are placed in PERCENTAGES of the mark's own width, which is what
 * makes this worth testing rather than eyeballing: get the width wrong and
 * every shape stretches proportionally, which looks like a design decision
 * rather than a fault. It was hardcoded per tone once and did exactly that.
 *
 * The masks are the other risk. A mask that fails to load leaves an element
 * with size and no picture -- nothing throws, nothing logs, the shape is just
 * absent. That is how a url() resolving against the stylesheet instead of the
 * document went unnoticed.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { REPRESENTATIVE } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

const PORTFOLIO = PAGES.find(p => p.name === "portfolio");

describe("every section is marked", () => {
    test("each mark has parts, and each part has a mask that loaded", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const report = await p.evaluate(async () => {
                const marks = [...document.querySelectorAll(".section-index")];
                const out = [];
                for (const m of marks) {
                    const parts = [...m.querySelectorAll("i")];
                    const bad = [];
                    for (const part of parts) {
                        const cs = getComputedStyle(part);
                        const mask = cs.maskImage || cs.webkitMaskImage;
                        if (!mask || mask === "none") { bad.push("no mask"); continue; }
                        const url = (mask.match(/url\("?([^")]+)"?\)/) || [])[1];
                        if (!url) { bad.push("mask is not a url"); continue; }
                        // Actually fetch it: a mask that 404s still computes.
                        const res = await fetch(url, { method: "GET" });
                        if (!res.ok) bad.push(`${res.status} ${url}`);
                        const r = part.getBoundingClientRect();
                        if (!r.width || !r.height) bad.push("zero size");
                    }
                    out.push({ mark: m.dataset.mark, parts: parts.length, bad });
                }
                return out;
            });
            assert.ok(report.length >= 5, `only ${report.length} marks found`);
            for (const m of report) {
                assert.ok(m.parts >= 2,
                    `${m.mark} has ${m.parts} part(s); a mark is a group`);
                assert.deepEqual(m.bad, [], `${m.mark} has broken parts`);
            }
        } finally { await p.__close(); }
    });

    test("the declared width is the width the mark actually occupies", async () => {
        for (const vp of REPRESENTATIVE) {
            const p = await ctx.openPage(PORTFOLIO, vp);
            try {
                const wrong = await p.evaluate(() => {
                    const out = [];
                    for (const m of document.querySelectorAll(".section-index")) {
                        const declared = parseFloat(
                            m.style.getPropertyValue("--mark-w"));
                        if (!Number.isFinite(declared)) {
                            out.push(`${m.dataset.mark}: no --mark-w`);
                            continue;
                        }
                        // The lead part is drawn at the mark's full width.
                        const lead = m.querySelector("i[data-lead]");
                        if (!lead) { out.push(`${m.dataset.mark}: no lead part`); continue; }
                        const box = m.getBoundingClientRect();
                        if (box.width && Math.abs(box.width - declared) > declared * 0.5) {
                            out.push(`${m.dataset.mark}: declared ${declared}px, `
                                + `occupies ${box.width.toFixed(1)}px`);
                        }
                    }
                    return out;
                });
                assert.deepEqual(wrong, [], `at ${vp.name}`);
            } finally { await p.__close(); }
        }
    });
});

describe("the register's first section is open at the top of the page", () => {
    /*  A deliberate special case: at the top of the portfolio nothing has
        taken the sticky header yet, so without this the first mark sat closed
        and the page opened on a register whose first entry looked inactive.  */
    test("ventures is open on load", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.waitForTimeout(400);
            const state = await p.evaluate(() => {
                const m = document.querySelector('.section-index[data-mark="ventures"]');
                return { found: Boolean(m), open: m && m.classList.contains("is-open") };
            });
            assert.ok(state.found, "no ventures mark");
            assert.equal(state.open, true, "ventures is closed at the top of the page");
        } finally { await p.__close(); }
    });

    test("and open again after scrolling back to the top", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 3000));
            await p.waitForTimeout(400);
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(600);
            const open = await p.evaluate(() =>
                document.querySelector('.section-index[data-mark="ventures"]')
                    .classList.contains("is-open"));
            assert.equal(open, true, "ventures did not reopen at the top");
        } finally { await p.__close(); }
    });
});

describe("marks respond to the sticky header", () => {
    test("scrolling through the register opens a different mark", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.waitForTimeout(300);
            const openAt = async (y) => {
                await p.evaluate(v => window.scrollTo(0, v), y);
                await p.waitForTimeout(450);
                return p.evaluate(() => {
                    const m = document.querySelector(".section-index.is-open");
                    return m ? m.dataset.mark : null;
                });
            };
            const top = await openAt(0);
            const deep = await openAt(Math.round(
                await p.evaluate(() => document.documentElement.scrollHeight * 0.55)));
            assert.ok(top, "no mark open at the top");
            assert.ok(deep, "no mark open in the middle of the register");
            assert.notEqual(deep, top,
                "the same mark is open at the top and in the middle -- the observer "
                + "is not tracking the sticky header");
        } finally { await p.__close(); }
    });

    test("only one mark is open at a time", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const counts = [];
            for (const frac of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
                await p.evaluate(f => window.scrollTo(
                    0, document.documentElement.scrollHeight * f), frac);
                await p.waitForTimeout(400);
                counts.push(await p.evaluate(() =>
                    document.querySelectorAll(".section-index.is-open").length));
            }
            const bad = counts.filter(c => c > 1);
            assert.deepEqual(bad, [],
                `more than one mark open at once (${counts.join(", ")})`);
        } finally { await p.__close(); }
    });
});

describe("a mark answers a click", () => {
    /*  The marks are not controls and are deliberately not dressed as any --
        no pointer, no focus ring, no role. But a small drawing that moves on
        its own and then ignores being pressed is worse than one that never
        moved, so a click gets one of the same small gestures the idle timer
        plays.

        Everything here is about the two ways that can go wrong. A gesture
        holds its target with !important, so one that is not cleared outranks
        the next opening or closing story and strands a shape half way out of
        the body. And a click that changed which mark was open would put the
        register's header and its marks out of step with each other.  */

    const MARK = ".section-index";

    /** Nothing anywhere is still holding a gesture. */
    const atRest = (p) => p.evaluate(() => {
        const out = [];
        for (const m of document.querySelectorAll(".section-index")) {
            for (const el of [m, ...m.querySelectorAll("i")]) {
                const held = [...el.classList].filter(c => c.startsWith("wiggle-"));
                if (held.length) out.push(`${m.dataset.mark}: ${held.join(" ")}`);
                if (el.style.getPropertyValue("--at")) {
                    out.push(`${m.dataset.mark}: --at left set`);
                }
            }
            if (m.dataset.stirring) out.push(`${m.dataset.mark}: still stirring`);
        }
        return out;
    });

    test("clicking one starts a gesture, and the gesture ends", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(400);
            assert.deepEqual(await atRest(p), [], "something was moving before the click");

            // A real pointer, not a dispatched event: half the point is that
            // the mark is actually reachable and not covered by the sticky bar.
            await p.click(`${MARK}[data-mark="ventures"]`);
            const running = await p.evaluate(() =>
                document.querySelector('.section-index[data-mark="ventures"]')
                    .getAnimations({ subtree: true })
                    .filter(a => a.playState === "running")
                    .map(a => a.animationName));
            assert.ok(running.some(n => /^wg-/.test(n)),
                `the click started nothing (running: ${running.join(", ") || "none"})`);

            // The longest gesture is 1500ms and the timer clears at ms + 40.
            await p.waitForTimeout(2200);
            assert.deepEqual(await atRest(p), [],
                "a gesture was left holding its target after it finished");
        } finally { await p.__close(); }
    });

    test("clicking one does not open or close anything", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(400);
            const state = () => p.evaluate(() =>
                [...document.querySelectorAll(".section-index")]
                    .map(m => m.dataset.mark + ":"
                        + (m.classList.contains("is-open") ? "open" : "shut")));
            const before = await state();
            await p.click(`${MARK}[data-mark="ventures"]`);
            await p.waitForTimeout(2200);
            assert.deepEqual(await state(), before,
                "a click changed which mark the register thinks is the header");
        } finally { await p.__close(); }
    });

    test("a gathered mark moves as one body; an open one moves a piece", async () => {
        /*  Gathered, every part is the same colour and lies on top of the
            others, so the silhouette is a single shape and stirring one part
            inside it is invisible -- those gestures go on the mark. Open, the
            pieces stand apart and one of them moving is the whole point, so
            those go on a part. Wired the wrong way round, the class goes on,
            the timer runs, and nothing moves.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(400);

            const drawn = await p.evaluate(() => {
                const held = (m) => [m, ...m.querySelectorAll("i")]
                    .map(el => ({
                        where: el === m ? "mark" : "part",
                        name: [...el.classList].find(c => c.startsWith("wiggle-")),
                    }))
                    .filter(x => x.name);
                const sample = (m) => {
                    const out = [];
                    // The click handler puts the class on synchronously, and a
                    // second click clears the first, so a tight loop samples
                    // the draw without waiting out sixteen gestures.
                    for (let i = 0; i < 24; i++) { m.click(); out.push(...held(m)); }
                    return out;
                };
                const marks = [...document.querySelectorAll(".section-index")];
                const open = marks.find(m => m.classList.contains("is-open"));
                const shut = marks.find(m => !m.classList.contains("is-open")
                    && m.getBoundingClientRect().top < window.innerHeight);
                return {
                    open: open && sample(open),
                    shut: shut && sample(shut),
                };
            });

            assert.ok(drawn.open && drawn.open.length, "the open mark drew nothing");
            assert.ok(drawn.shut && drawn.shut.length, "the gathered mark drew nothing");

            assert.deepEqual(
                [...new Set(drawn.shut.map(x => x.where))], ["mark"],
                "a gathered mark played a gesture on one of its parts, which is "
                + "inside the body and cannot be seen");
            assert.ok(drawn.open.some(x => x.where === "part"),
                "an open mark never moved a single piece in 24 draws");

            await p.waitForTimeout(2200);
            assert.deepEqual(await atRest(p), [], "left holding a gesture");
        } finally { await p.__close(); }
    });

    test("a gesture interrupted by a story leaves nothing behind", async () => {
        /*  The one failure that shows. A wiggle carries !important, so one
            still on when a mark is asked to open or close outranks the story
            and pins that shape where the wiggle had it until some later
            gesture happens to clear it.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(400);
            await p.evaluate(() => {
                document.querySelector('.section-index[data-mark="ventures"]').click();
                // And scroll out from under it while it is still going.
                window.scrollTo(0, document.documentElement.scrollHeight * 0.5);
            });
            await p.waitForTimeout(2600);
            assert.deepEqual(await atRest(p),
                [], "a gesture survived the story that interrupted it");
        } finally { await p.__close(); }
    });

    test("and it also stirs on its own, without being asked", async () => {
        /*  Nothing else here exercises the timer -- every other assertion in
            this file provokes the marks and then watches. The idle loop is
            the half of the feature nobody triggers, which makes it exactly
            the half that can stop working without anyone noticing.

            The first stir is drawn between five and fourteen seconds in, so
            eighteen seconds is one guaranteed stir and usually two. What is
            asserted about it is the part that can go quietly wrong: that
            whatever it played belongs to the repertoire for the state the
            mark was in. A gathered mark playing a part gesture would move
            something buried inside its own silhouette.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(600);
            await p.evaluate(() => {
                window.__stirs = [];
                new MutationObserver(records => {
                    for (const r of records) {
                        const el = r.target;
                        const name = [...el.classList].find(c => c.startsWith("wiggle-"));
                        if (!name) continue;
                        const mark = el.closest(".section-index");
                        window.__stirs.push({
                            mark: mark.dataset.mark,
                            open: mark.classList.contains("is-open"),
                            where: el === mark ? "mark" : "part",
                            name,
                        });
                    }
                }).observe(document.body, {
                    subtree: true, attributes: true, attributeFilter: ["class"],
                });
            });
            await p.waitForTimeout(18000);
            const stirs = await p.evaluate(() => window.__stirs);

            assert.ok(stirs.length >= 1,
                "nothing stirred in eighteen seconds -- the idle loop is not running");

            // Gathered marks move as one body; open marks may move a piece or,
            // for the ripple, run the whole ensemble.
            const wrong = stirs.filter(s => !s.open && s.where !== "mark");
            assert.deepEqual(wrong, [],
                "a gathered mark stirred one of its parts, which is inside the "
                + "body where nothing can be seen to move");
            const strays = stirs.filter(s => s.open && s.where === "mark"
                && s.name !== "wiggle-ripple");
            assert.deepEqual(strays, [],
                "an open mark moved as one body -- only the ripple does that");

            await p.waitForTimeout(2200);
            assert.deepEqual(await atRest(p), [], "a stir was left holding on");
        } finally { await p.__close(); }
    });

    test("but it is never dressed as a control", async () => {
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const dressed = await p.evaluate(() => {
                const out = [];
                for (const m of document.querySelectorAll(".section-index")) {
                    const cs = getComputedStyle(m);
                    if (cs.cursor === "pointer") out.push(`${m.dataset.mark}: pointer`);
                    for (const attr of ["role", "tabindex", "href", "onclick"]) {
                        if (m.hasAttribute(attr)) out.push(`${m.dataset.mark}: ${attr}`);
                    }
                }
                return out;
            });
            assert.deepEqual(dressed, [],
                "the mark is advertising itself as something to press");
        } finally { await p.__close(); }
    });
});
