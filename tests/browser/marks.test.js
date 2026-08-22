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
