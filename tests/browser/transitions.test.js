/**
 * MOVING BETWEEN VIEWS.
 *
 * The site morphs its green bar from one page to the next with a view
 * transition, which depends on a name being unique in each document: two
 * elements claiming view-transition-name: scroll-rail at once and the
 * transition is abandoned. Two selectors DO claim it -- the landing page's
 * edge rule and the portfolio's rail thumb -- and they are only ever safe
 * because no document matches both. That is an invariant, so it is asserted
 * rather than assumed.
 *
 * The cascade is the other thing here. Content is revealed by an animation
 * armed with a .js-cascade class, so a browser with no script sees the page
 * plainly rather than never at all. The class is removed on a timer as a
 * safety net; if that net ever failed, the page would stay invisible.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { REPRESENTATIVE } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

describe("view transition names", () => {
    for (const page of PAGES) {
        test(`${page.name}: no name is claimed twice`, async () => {
            const p = await ctx.openPage(page, REPRESENTATIVE[3]);
            try {
                const dupes = await p.evaluate(() => {
                    const seen = new Map();
                    for (const el of document.querySelectorAll("*")) {
                        const n = getComputedStyle(el).viewTransitionName;
                        if (!n || n === "none") continue;
                        seen.set(n, (seen.get(n) || 0) + 1);
                    }
                    return [...seen].filter(([, c]) => c > 1)
                        .map(([n, c]) => `${n} x${c}`);
                });
                assert.deepEqual(dupes, [],
                    "a duplicated view-transition-name abandons the whole transition");
            } finally { await p.__close(); }
        });
    }
});

describe("the cascade always lets go", () => {
    for (const page of PAGES) {
        test(`${page.name}: content is visible after load`, async () => {
            const p = await ctx.openPage(page, REPRESENTATIVE[3]);
            try {
                // Longer than the safety net's own timer.
                await p.waitForTimeout(2800);
                const invisible = await p.evaluate(() => {
                    const out = [];
                    for (const sel of ["h1", "main", ".sheet", ".register", ".masthead"]) {
                        for (const el of document.querySelectorAll(sel)) {
                            const cs = getComputedStyle(el);
                            if (Number(cs.opacity) < 0.99) {
                                out.push(`${sel} opacity ${cs.opacity}`);
                            }
                        }
                    }
                    return out;
                });
                assert.deepEqual(invisible, [],
                    "content is still partly transparent long after load -- the cascade "
                    + "safety net did not fire");
            } finally { await p.__close(); }
        });
    }
});

describe("navigating between views", () => {
    test("landing -> portfolio -> back leaves both pages working", async () => {
        const p = await ctx.open("/", REPRESENTATIVE[3]);
        try {
            await p.click('a[href="portfolio/"]');
            await p.waitForURL("**/portfolio/");
            await p.waitForTimeout(500);
            const onPortfolio = await p.evaluate(() => ({
                marks: document.querySelectorAll(".section-index").length,
                rail: document.querySelectorAll(".scrollrail").length,
                h1: document.querySelector("h1")?.textContent?.trim(),
            }));
            assert.ok(onPortfolio.marks >= 5, "register did not render after navigation");
            assert.equal(onPortfolio.rail, 1, "no rail after navigation");

            await p.goBack();
            await p.waitForTimeout(500);
            const backHome = await p.evaluate(() => ({
                links: document.querySelectorAll(".doclink").length,
                h1: document.querySelector("h1")?.textContent?.trim(),
                bodyOverflow: getComputedStyle(document.body).overflow,
            }));
            assert.equal(backHome.links, 3, "landing page lost its links on the way back");
            assert.equal(backHome.bodyOverflow, "hidden",
                "the landing page became scrollable after navigating back");
        } finally { await p.__close(); }
    });
});

describe("the redirect pages really do redirect", () => {
    /*  Asserted WITHOUT the no-redirect seam the other browser tests use, so
        this is the real behaviour: three pages whose job is to hand the
        browser a PDF. If the meta refresh or the script were lost, the
        fallback page would look perfectly fine and the site would quietly
        stop delivering the documents.  */
    for (const page of PAGES.filter(p => p.redirects)) {
        test(`${page.name} sends the browser to its PDF`, async () => {
            const context = ctx;
            const p = await context.open(page.url, REPRESENTATIVE[3],
                { allowRedirect: true, settle: 0 });
            try {
                // The PDF request is blocked by the fixture, so the evidence
                // that the redirect fired is the attempt, not the arrival.
                await p.waitForTimeout(900);
                const tried = [...p.__blocked];
                assert.ok(tried.some(u => /\.pdf$/i.test(u)),
                    `${page.name} never tried to load a PDF; the meta refresh and the `
                    + "script that replace the location are both gone");
            } finally { await p.__close(); }
        });
    }
});
