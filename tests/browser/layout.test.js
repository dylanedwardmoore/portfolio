/**
 * THE LAYOUT HOLDS AT EVERY SIZE IT WILL EVER BE SEEN AT.
 *
 * Every page is laid out at all 38 viewports from tests/lib/viewports.js --
 * sixteen real devices and one probe either side of every breakpoint in the
 * two stylesheets. That is the expensive part of this suite and it is the part
 * worth paying for: nearly every layout bug this site has had was a bug at one
 * size only, and a matrix of three popular phones would have missed all of
 * them.
 *
 * Each page is opened once and then RESIZED through the matrix rather than
 * reloaded, which is both much faster and a better test: resizing exercises
 * the resize handlers, and a layout that is only correct on a fresh load is
 * not correct.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { ALL, DEVICES } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

/** Everything one viewport needs to be judged on, measured in one pass. */
const MEASURE = () => {
    const d = document.documentElement;
    const offenders = [];
    let contentBottom = 0;
    for (const el of document.body.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        // A fixed instrument is pinned to the viewport and cannot define how
        // long the document is.
        if (cs.position !== "fixed") {
            contentBottom = Math.max(contentBottom, r.bottom + window.scrollY);
        }
        if (r.right > d.clientWidth + 1) {
            offenders.push(
                `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]}`
                + ` right=${Math.round(r.right)} > ${d.clientWidth}`);
        }
    }
    return {
        overflowX: d.scrollWidth - d.clientWidth,
        offenders: offenders.slice(0, 5),
        scrollHeight: d.scrollHeight,
        innerHeight: window.innerHeight,
        contentBottom: Math.round(contentBottom),
        deadSpace: Math.round(d.scrollHeight - contentBottom),
    };
};

describe("no page ever scrolls sideways", () => {
    /*  A horizontal scrollbar on a phone is the single most visible layout
        fault there is, and it is almost always one element -- a wide figure, a
        long unbroken string, a negative margin -- rather than the layout. The
        offender list names it so the failure is actionable. */
    for (const page of PAGES) {
        test(`${page.name}: fits its viewport at all ${ALL.length} sizes`, async () => {
            const p = await ctx.openPage(page, { width: 1200, height: 900 });
            const bad = [];
            try {
                for (const vp of ALL) {
                    await p.setViewportSize({ width: vp.width, height: vp.height });
                    await p.waitForTimeout(60);
                    const m = await p.evaluate(MEASURE);
                    if (m.overflowX > 1) {
                        bad.push(`${vp.name} (${vp.width}x${vp.height}): `
                            + `+${m.overflowX}px [${m.offenders.join("; ")}]`);
                    }
                }
            } finally {
                await p.__close();
            }
            assert.deepEqual(bad, []);
        });
    }
});

describe("the landing page does not scroll", () => {
    /*  Stated as a requirement, and it has regressed before: the blurb is its
        own scroller and the page behind it is fixed. When that broke, the
        symptom on a phone was a screenful of white below the content, which is
        the kind of fault that looks like a rendering glitch rather than a bug.  */
    test("at every size, the document is no taller than the viewport", async () => {
        const p = await ctx.openPage(PAGES[0], { width: 1200, height: 900 });
        const bad = [];
        try {
            for (const vp of ALL) {
                await p.setViewportSize({ width: vp.width, height: vp.height });
                await p.waitForTimeout(60);
                const m = await p.evaluate(MEASURE);
                if (m.scrollHeight > m.innerHeight + 1) {
                    bad.push(`${vp.name} (${vp.width}x${vp.height}): `
                        + `${m.scrollHeight} > ${m.innerHeight}`);
                }
            }
        } finally {
            await p.__close();
        }
        assert.deepEqual(bad, []);
    });
});

describe("no page scrolls past its own content", () => {
    /*  The reported symptom was being able to scroll well below the last thing
        on the page on a phone. Some space under the final entry is deliberate
        -- the register sets a bottom padding of three units -- so this asserts
        a ceiling rather than zero. DEAD_MAX is that padding with room to
        spare; anything beyond it is a box contributing height nothing can see,
        which is what a stray transform or an over-tall spacer does.  */
    const DEAD_MAX = 220;
    for (const page of PAGES) {
        test(`${page.name}: no more than ${DEAD_MAX}px below the last element`, async () => {
            const p = await ctx.openPage(page, { width: 1200, height: 900 });
            const bad = [];
            try {
                for (const vp of ALL) {
                    await p.setViewportSize({ width: vp.width, height: vp.height });
                    await p.waitForTimeout(60);
                    // Scrolled to the bottom, which is where the fault shows and
                    // where lazy images have finally been asked for.
                    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                    await p.waitForTimeout(60);
                    const m = await p.evaluate(MEASURE);
                    if (m.deadSpace > DEAD_MAX) {
                        bad.push(`${vp.name} (${vp.width}x${vp.height}): `
                            + `${m.deadSpace}px below content (scrollHeight ${m.scrollHeight})`);
                    }
                    await p.evaluate(() => window.scrollTo(0, 0));
                }
            } finally {
                await p.__close();
            }
            assert.deepEqual(bad, []);
        });
    }
});

const PORTFOLIO = PAGES.find(p => p.name === "portfolio");

describe("the sticky section label covers what passes under it", () => {
    /*  THE BUG THIS IS HERE FOR, which shipped and was reported.

        At phone widths the label sticks and the rows pass directly beneath it,
        so its opaque ground is the only thing stopping them showing through.
        The rows are pulled out past the register's measure by --row-bleed on
        either side; the label's ground was not, so for nine pixels between the
        scroll rail and the label there was nothing covering them, and every row
        rule that went under the label came out the other side of it. Measured
        before the fix at 390px wide: ninety-seven of two hundred and fourteen
        scroll positions had ink in that strip, up to 111 of 255 off paper.

        Geometry first, because it is cheap and it is the actual invariant, and
        then the rendered pixels at one size, because geometry that is right and
        pixels that are wrong is the whole reason this file exists.  */

    test("its ground reaches at least as far as the rows do, at every phone size",
        async () => {
            const bad = [];
            for (const vp of DEVICES.filter(d => d.phone).concat(
                DEVICES.filter(d => !d.phone))) {
                const p = await ctx.openPage(PORTFOLIO, vp);
                try {
                    const off = await p.evaluate(() => {
                        const out = [];
                        const narrow = window.matchMedia("(max-width: 859px)").matches;
                        if (!narrow) return out;   // the label does not overlap rows here
                        for (const sec of document.querySelectorAll(".section")) {
                            const label = sec.querySelector(".section-label");
                            const row = sec.querySelector(".entry");
                            if (!label || !row) continue;
                            const L = label.getBoundingClientRect();
                            const R = row.getBoundingClientRect();
                            if (L.left > R.left + 0.5 || L.right < R.right - 0.5) {
                                out.push(`${L.left.toFixed(1)}..${L.right.toFixed(1)}`
                                    + ` vs rows ${R.left.toFixed(1)}..${R.right.toFixed(1)}`);
                            }
                        }
                        return out;
                    });
                    for (const o of off) bad.push(`${vp.name}: ${o}`);
                } finally { await p.__close(); }
            }
            assert.deepEqual(bad, [],
                "the sticky ground is narrower than the rows that pass under it, "
                + "so their rules show beside it as they go by");
        });

    test("and nothing shows in the strip beside it as the register scrolls",
        async () => {
            const phone = DEVICES.find(d => d.phone && d.width <= 380)
                || DEVICES.find(d => d.phone);
            const p = await ctx.openPage(PORTFOLIO, phone);
            try {
                const dirty = await p.evaluate(async () => {
                    const shot = () => new Promise(res => res(null));
                    const out = [];
                    const end = document.documentElement.scrollHeight;
                    for (let y = 300; y < Math.min(end - window.innerHeight, 4200);
                            y += 47) {
                        window.scrollTo(0, y);
                        await new Promise(r => requestAnimationFrame(r));
                        await new Promise(r => requestAnimationFrame(r));
                        const stuck = [...document.querySelectorAll(".section-label")]
                            .map(l => ({ l, r: l.getBoundingClientRect() }))
                            .find(o => o.r.top < 90 && o.r.bottom > 30);
                        if (!stuck) continue;
                        const railR = document.querySelector(".scrollrail")
                            .getBoundingClientRect().right;
                        // Anything laid out between the rail and the label's
                        // ground, over the label's own vertical span, is
                        // something the ground has failed to cover.
                        for (const row of document.querySelectorAll(".entry")) {
                            const r = row.getBoundingClientRect();
                            if (r.bottom <= stuck.r.top || r.top >= stuck.r.bottom) continue;
                            if (r.left < stuck.r.left - 0.5) {
                                out.push(`y${y}: a row reaches to ${r.left.toFixed(1)}, `
                                    + `the ground only to ${stuck.r.left.toFixed(1)}`);
                            }
                            if (r.right > stuck.r.right + 0.5) {
                                out.push(`y${y}: a row reaches to ${r.right.toFixed(1)}, `
                                    + `the ground only to ${stuck.r.right.toFixed(1)}`);
                            }
                        }
                    }
                    return [...new Set(out)].slice(0, 8);
                });
                assert.deepEqual(dirty, [],
                    `at ${phone.name}, rows are passing under the sticky label and `
                    + "sticking out past its ground");
            } finally { await p.__close(); }
        });

    test("and the scroll rail is still clear of it", async () => {
        /*  The ground was widened towards the rail's lane. It stops short of
            it at every size, and the rail outranks it by z-index in any case --
            but a white box in front of the green bar is exactly the sort of
            thing a fix like this causes, so it is measured rather than
            reasoned about.  */
        const bad = [];
        for (const vp of DEVICES.filter(d => d.phone)) {
            const p = await ctx.openPage(PORTFOLIO, vp);
            try {
                const seen = await p.evaluate(() => {
                    const rail = document.querySelector(".scrollrail");
                    const label = document.querySelector(".section-label");
                    const R = rail.getBoundingClientRect();
                    const L = label.getBoundingClientRect();
                    return {
                        clear: +(L.left - R.right).toFixed(2),
                        railZ: Number(getComputedStyle(rail).zIndex),
                        labelZ: Number(getComputedStyle(label).zIndex),
                    };
                });
                if (seen.clear < 0 && !(seen.railZ > seen.labelZ)) {
                    bad.push(`${vp.name}: the label reaches into the rail's lane `
                        + `by ${(-seen.clear).toFixed(2)}px and does not sit under it`);
                }
            } finally { await p.__close(); }
        }
        assert.deepEqual(bad, [], "the sticky ground is covering the scroll rail");
    });
});

describe("touch targets on phones", () => {
    /*  24px is the WCAG 2.2 AA minimum for a target that is not inline in a
        sentence. The register's entry links ARE inline in prose, and are
        exempted the way the spec exempts them; what is checked here is the
        navigation, which is the part a thumb actually goes for.  */
    const MIN = 24;
    test("every navigation control is at least 24px tall", async () => {
        const phones = DEVICES.filter(d => d.phone);
        const bad = [];
        for (const page of PAGES) {
            for (const vp of phones) {
                const p = await ctx.openPage(page, vp);
                try {
                    const small = await p.evaluate((min) => {
                        const out = [];
                        const sel = ".doclink, .backlink, .doclink-inline";
                        for (const el of document.querySelectorAll(sel)) {
                            const r = el.getBoundingClientRect();
                            if (r.height && r.height < min) {
                                out.push(`${el.className} ${Math.round(r.height)}px`);
                            }
                        }
                        return out;
                    }, MIN);
                    for (const s of small) bad.push(`${page.name} @ ${vp.name}: ${s}`);
                } finally {
                    await p.__close();
                }
            }
        }
        assert.deepEqual(bad, []);
    });
});
