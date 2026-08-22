/**
 * REDUCED MOTION IS HONOURED EVERYWHERE.
 *
 * This site is mostly motion: a strained scroll bar, marks that separate and
 * recombine, idle wiggles, page transitions. Someone who has asked their
 * system for less of that has usually asked for a reason, and the request has
 * to reach every one of those mechanisms -- CSS animations, the rAF loop the
 * rail runs, and the timers that stir the marks.
 *
 * The rail's guard is deliberately doubled -- the script declines to run and
 * the stylesheet resets the ink -- because a spring left mid-swing by a loop
 * that stopped is a resting state nobody asked for.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { REPRESENTATIVE } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

describe("with prefers-reduced-motion: reduce", () => {
    for (const page of PAGES) {
        test(`${page.name}: nothing is animating`, async () => {
            const p = await ctx.openPage(page, REPRESENTATIVE[3], { reducedMotion: true });
            try {
                await p.waitForTimeout(600);
                // Provoke the things that would otherwise start something.
                await p.evaluate(() => {
                    window.scrollTo(0, 400);
                    window.dispatchEvent(new Event("scroll"));
                    window.scrollTo(0, 0);
                    window.dispatchEvent(new Event("scroll"));
                });
                await p.waitForTimeout(700);
                const running = await p.evaluate(() =>
                    document.getAnimations()
                        .filter(a => a.playState === "running")
                        .map(a => (a.animationName || a.constructor.name)
                            + ":" + (a.effect?.target?.className || "")));
                assert.deepEqual(running, [],
                    "animations still running under reduced motion");
            } finally { await p.__close(); }
        });
    }

    test("the rail leaves no strain on the mark", async () => {
        const portfolio = PAGES.find(p => p.name === "portfolio");
        const p = await ctx.openPage(portfolio, REPRESENTATIVE[3], { reducedMotion: true });
        try {
            await p.evaluate(() => {
                for (let i = 0; i < 8; i++) {
                    window.scrollTo(0, i * 220);
                    window.dispatchEvent(new Event("scroll"));
                }
            });
            await p.waitForTimeout(400);
            const state = await p.evaluate(() => {
                const t = document.querySelector(".scrollrail-thumb");
                const cs = getComputedStyle(t, "::before");
                return {
                    props: ["--strain-cut", "--strain-grow", "--strain-clip"]
                        .filter(n => t.style.getPropertyValue(n) !== ""),
                    clip: cs.clipPath,
                };
            });
            assert.deepEqual(state.props, [],
                "the strain ran despite reduced motion");
            assert.ok(state.clip === "none" || state.clip === "",
                `the ink is still clipped (${state.clip})`);
        } finally { await p.__close(); }
    });
});
