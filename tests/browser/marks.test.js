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

    test("and never sends a piece back into the body", async () => {
        /*  THE BUG THIS IS HERE FOR, which shipped and was reported.

            A story runs with animation-fill-mode: both, so while .anim is on,
            every piece is held at its last keyframe by an animation that has
            finished but is still there. A gesture carries its own animation
            shorthand, so for as long as it runs the story's name is off the
            piece -- and when the gesture ends and the name comes back, the
            browser sees a NEW animation and starts it from the beginning.

            The piece replayed its whole opening: it jumped into the body and
            travelled out again, up to twenty-four pixels, in the middle of
            what was meant to be a one-pixel tick. On the register it read as
            the small shapes disappearing into the big one.

            THE SECTION HAS TO BE SCROLLED TO, and that is most of what makes
            this test work. At the top of the page the first mark is open
            without ever having PLAYED anything -- the observer takes that
            state up rather than performing it -- so there is no finished
            animation sitting on it and nothing to replay. Written the obvious
            way, against whichever mark is open on load, this passes against
            the bug it is named after.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            const watched = [];
            for (const name of ["industry", "research"]) {
                await p.evaluate((n) => {
                    document.querySelector(`.section-index[data-mark="${n}"]`)
                        .closest(".section").scrollIntoView();
                }, name);
                // Long enough for the story to run and for marks.js to call it
                // settled, which is when the class it is held by comes off.
                await p.waitForTimeout(2600);

                watched.push(...await p.evaluate(async (n) => {
                    const mark = document.querySelector(`.section-index[data-mark="${n}"]`);
                    if (!mark.classList.contains("is-open")) return [];
                    const parts = [...mark.querySelectorAll("i")];
                    const at = (el) => {
                        const m = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
                        if (!m) return { x: 0, y: 0 };
                        const v = m[1].split(",").map(Number);
                        return { x: v[4], y: v[5] };
                    };
                    const rest = parts.map(at);
                    const out = [];
                    for (let k = 0; k < 8; k++) {
                        mark.click();
                        const played = [mark, ...parts]
                            .map(el => [...el.classList].find(c => c.startsWith("wiggle-")))
                            .filter(Boolean)[0] || "(none)";
                        const t0 = performance.now();
                        let far = 0;
                        await new Promise(done => {
                            const tick = () => {
                                parts.forEach((el, i) => {
                                    const a = at(el);
                                    far = Math.max(far,
                                        Math.hypot(a.x - rest[i].x, a.y - rest[i].y));
                                });
                                // Past the longest gesture and its timer's slack.
                                if (performance.now() - t0 > 1300) return done();
                                requestAnimationFrame(tick);
                            };
                            tick();
                        });
                        out.push({ mark: n, played, far: +far.toFixed(2) });
                        await new Promise(r => setTimeout(r, 120));
                    }
                    return out;
                }, name));
            }

            assert.ok(watched.length >= 8,
                `only ${watched.length} gestures were watched -- neither section `
                + "took the header, so nothing was actually tested");
            /*  One device pixel on the diagonal is the most any of these can
                travel. Three is loose enough to survive a fractional device
                pixel ratio, and tight enough that a piece heading back into
                the body -- eight pixels at the very least, twenty-four at
                worst -- cannot hide under it.  */
            const ran = watched.filter(w => w.far > 3);
            assert.deepEqual(ran, [],
                "a piece travelled far further than a gesture can take it, which "
                + "means it is replaying its story rather than fidgeting");
        } finally { await p.__close(); }
    });

    test("and a link under the pointer stirs its own section's mark", async () => {
        /*  Every link in the register belongs to a section and every section
            has a mark, so crossing a link answers on that mark -- the same
            gesture a click on the shapes would have played. A real pointer
            rather than a dispatched event: half of what is worth checking is
            that the link is reachable at all.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollTo(0, 0));
            await p.waitForTimeout(900);

            const before = await p.evaluate(() =>
                [...document.querySelectorAll(".section-index")]
                    .map(m => m.dataset.mark + ":"
                        + (m.classList.contains("is-open") ? "open" : "shut")));

            await p.hover(".section a[href]");
            const answered = await p.evaluate(() => {
                const mark = document.querySelector(".section a[href]")
                    .closest(".section").querySelector(".section-index");
                return {
                    held: [mark, ...mark.querySelectorAll("i")]
                        .some(el => [...el.classList].some(c => c.startsWith("wiggle-"))),
                    running: mark.getAnimations({ subtree: true })
                        .filter(a => a.playState === "running")
                        .map(a => a.animationName),
                };
            });
            assert.ok(answered.held || answered.running.some(n => /^wg-/.test(n)),
                "crossing a link stirred nothing on its section's mark");

            assert.deepEqual(await p.evaluate(() =>
                [...document.querySelectorAll(".section-index")]
                    .map(m => m.dataset.mark + ":"
                        + (m.classList.contains("is-open") ? "open" : "shut"))), before,
                "crossing a link changed which mark the register calls the header");

            await p.waitForTimeout(1400);
            assert.deepEqual(await atRest(p), [], "left holding a gesture");
        } finally { await p.__close(); }
    });

    test("and it draws from the repertoire that fits that mark's state", async () => {
        /*  The whole point of routing it through the same door as a click:
            a gathered mark still moves as one body and an open one still moves
            a piece. Wired to its own gesture instead, this is the assertion
            that would have gone quietly false.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.waitForTimeout(600);
            const drawn = await p.evaluate(async () => {
                const out = [];
                const links = [...document.querySelectorAll(".section a[href]")];
                for (let n = 0; n < 26; n++) {
                    const a = links[Math.floor(n * links.length / 26)];
                    a.scrollIntoView({ block: "center" });
                    await new Promise(r => setTimeout(r, 320));
                    const mark = a.closest(".section").querySelector(".section-index");
                    const open = mark.classList.contains("is-open");
                    a.dispatchEvent(new MouseEvent("mouseenter"));
                    for (const el of [mark, ...mark.querySelectorAll("i")]) {
                        const name = [...el.classList].find(c => c.startsWith("wiggle-"));
                        if (name) out.push({ open, name, where: el === mark ? "mark" : "part" });
                    }
                    await new Promise(r => setTimeout(r, 1150));
                }
                return out;
            });

            assert.ok(drawn.length >= 6,
                `only ${drawn.length} crossings played anything`);
            assert.deepEqual(drawn.filter(d => !d.open && d.where !== "mark"), [],
                "a gathered mark stirred one of its pieces, which is inside the "
                + "body where nothing can be seen to move");
            assert.deepEqual(
                drawn.filter(d => d.open && d.where === "mark" && d.name !== "wiggle-ripple"),
                [], "an open mark moved as one body -- only the ripple does that");
        } finally { await p.__close(); }
    });

    test("but a crossing never interrupts, where a click always does", async () => {
        /*  A click is a request and gets an answer every time. A pointer
            crossing a link is not a request -- it is what happens on the way
            to somewhere else -- so it leaves anything already under way alone.
            That distinction is also what keeps a hand swept down a column of
            links from setting the register off like a till.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.waitForTimeout(1200);
            const seen = await p.evaluate(async () => {
                const a = document.querySelector(".section a[href]");
                const mark = a.closest(".section").querySelector(".section-index");
                const running = () => mark.getAnimations({ subtree: true })
                    .filter(x => x.playState === "running" && /^wg-/.test(x.animationName))
                    .map(x => ({ name: x.animationName, t: Math.round(x.currentTime) }));
                for (let i = 0; i < 40 && (mark.dataset.stirring || running().length); i++) {
                    await new Promise(r => setTimeout(r, 100));
                }
                a.dispatchEvent(new MouseEvent("mouseenter"));
                await new Promise(r => setTimeout(r, 120));
                const before = running();
                a.dispatchEvent(new MouseEvent("mouseenter"));
                const afterCross = running();
                await new Promise(r => setTimeout(r, 60));
                mark.click();
                const afterClick = running();
                return { before, afterCross, afterClick };
            });

            assert.ok(seen.before.length, "nothing was running to be interrupted");
            assert.ok(seen.afterCross.length
                && seen.afterCross[0].t >= seen.before[0].t,
                `a second crossing restarted the gesture `
                + `(${seen.before[0]?.t}ms -> ${seen.afterCross[0]?.t}ms)`);
            assert.ok(seen.afterClick.length && seen.afterClick[0].t <= 40,
                "a click did not interrupt what the pointer had started");

            await p.waitForTimeout(1400);
            assert.deepEqual(await atRest(p), [], "left holding a gesture");
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


describe("the marks are dragged by the scroll", () => {
    /*  A mark being scrolled past is being carried, and a thing being carried
        does not hold its shape perfectly. drag.js stretches it a little the
        way it is going and lets it gather itself back when the scrolling
        stops. What is worth asserting is not the look of it -- nothing here
        compares pixels -- but the four things about it that can silently stop
        being true.  */

    /** Park so one section owns the header and the next mark is still short
        of it: that one is on screen and free to be strained, this one is
        pinned and should not be, and a small scroll changes neither. */
    const park = (p, which, past) => p.evaluate(([which, past]) => {
        const top = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top")) || 48;
        const marks = [...document.querySelectorAll(".section-index")];
        const sec = marks[which].closest(".section");
        // past > 0 lands INSIDE that section, so its own label is stuck;
        // past undefined stops short of it, so the one above is.
        window.scrollTo(0, window.pageYOffset + sec.getBoundingClientRect().top
            - top + (past === undefined ? -200 : past));
        return null;
    }, [which, past]);

    const strain = (p) => p.evaluate(() => {
        const top = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue("--sticky-top")) || 48;
        return [...document.querySelectorAll(".section-index")].map(m => {
            const r = m.closest(".section").getBoundingClientRect();
            const box = m.getBoundingClientRect();
            const y = parseFloat(m.style.getPropertyValue("--drag-y"));
            return {
                mark: m.dataset.mark,
                pinned: r.top <= top && r.bottom > top,
                onScreen: box.bottom > 0 && box.top < window.innerHeight,
                strain: Number.isFinite(y) ? Math.abs(y - 1) : 0,
            };
        });
    });

    test("scrolling strains every mark on screen, the pinned one included",
        async () => {
            /*  The pinned mark was exempt at first, on the argument that a
                label stuck at the sticky line is not moving relative to the
                screen and so has nothing to be in arrears of. That is correct
                about the local physics and wrong about the page: what is
                moving is the register, the mark is part of it, and it is the
                one mark the reader is looking straight at while it happens.
                Exempting it took the effect out of the only place it was
                certain to be seen.

                Small scrolls, and only about a mark that is pinned for the
                WHOLE run, so that what is measured is a mark that was stuck
                the entire time rather than one that happened to be passing.  */
            const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
            try {
                await park(p, 2, 260);
                await p.waitForTimeout(2600);

                const first = await strain(p);
                const pinnedNow = first.filter(s => s.pinned).map(s => s.mark);
                assert.equal(pinnedNow.length, 1,
                    `expected exactly one pinned mark, got ${pinnedNow.length}`);
                const held = pinnedNow[0];

                let onThePinnedOne = 0;
                let onTheRest = 0;
                for (let i = 0; i < 20; i++) {
                    // Small enough that which section owns the header cannot
                    // change under them, fast enough to be a real scroll:
                    // thirty pixels in a frame is eighteen hundred a second.
                    await p.evaluate((d) => window.scrollBy(0, d), i % 2 ? -30 : 32);
                    await p.waitForTimeout(20);
                    for (const s of await strain(p)) {
                        if (s.mark === held) {
                            assert.ok(s.pinned,
                                `${held} stopped being pinned mid-run; the scroll `
                                + "steps are too big for this test to mean anything");
                            onThePinnedOne = Math.max(onThePinnedOne, s.strain);
                        } else if (s.onScreen) {
                            onTheRest = Math.max(onTheRest, s.strain);
                        }
                    }
                }

                assert.ok(onThePinnedOne > 0.004,
                    `${held} was pinned throughout and picked up no strain at all `
                    + `(${onThePinnedOne}) -- the mark under the reader's eye is `
                    + "the one place this has to be visible");
                assert.ok(onTheRest > 0.004 || onTheRest === 0,
                    "the marks that were not pinned behaved oddly");
            } finally { await p.__close(); }
        });

    test("and it comes all the way home, leaving no transform behind", async () => {
        /*  The pieces in these compositions are between 1.2 and 2.7px wide and
            a fractional scale softens them, so a strain left on -- even one
            far too small to see as a shape -- is a mark quietly out of focus
            for the rest of the session.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await p.evaluate(() => window.scrollBy(0, 1400));
            await p.waitForTimeout(2600);
            const left = await p.evaluate(() =>
                [...document.querySelectorAll(".section-index")]
                    .filter(m => m.classList.contains("is-dragged")
                        || m.style.getPropertyValue("--drag-y")
                        || getComputedStyle(m).scale !== "none")
                    .map(m => `${m.dataset.mark}: ${getComputedStyle(m).scale}`));
            assert.deepEqual(left, [],
                "a mark is still carrying a strain long after the scroll stopped");
        } finally { await p.__close(); }
    });

    test("a gesture under way is neither interrupted nor restarted by it", async () => {
        /*  The reason the drag is written on `scale` rather than `transform`.
            Both are deformations of the same element; on the same property one
            would have to fight the other, and the gestures would be at the
            mercy of how fast somebody scrolls.  */
        const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
        try {
            await park(p, 2);
            await p.waitForTimeout(2600);
            const seen = await p.evaluate(async () => {
                const top = parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue("--sticky-top")) || 48;
                const mark = [...document.querySelectorAll(".section-index")][2];
                const sec = mark.closest(".section");
                if (sec.getBoundingClientRect().top <= top) return { skip: true };

                const running = () => mark.getAnimations({ subtree: true })
                    .filter(a => a.playState === "running"
                        && /^wg-/.test(a.animationName))
                    .map(a => ({ name: a.animationName, t: Math.round(a.currentTime) }));
                for (let i = 0; i < 40; i++) {
                    const telling = mark.classList.contains("anim")
                        && mark.dataset.settled !== "1";
                    if (!telling && !mark.dataset.stirring && !running().length) break;
                    await new Promise(r => setTimeout(r, 100));
                }
                const was = mark.classList.contains("is-open");
                mark.click();
                const started = running();
                // Small, so nothing opens or closes: a story would cancel the
                // gesture legitimately and prove nothing.
                for (let i = 0; i < 6; i++) {
                    window.scrollBy(0, i % 2 ? -46 : 52);
                    await new Promise(r => requestAnimationFrame(r));
                }
                const during = running();
                return {
                    started, during,
                    strained: Math.abs(
                        (parseFloat(mark.style.getPropertyValue("--drag-y")) || 1) - 1),
                    sameState: mark.classList.contains("is-open") === was,
                };
            });

            if (seen.skip) { assert.ok(true, "could not park an unpinned mark"); return; }
            assert.ok(seen.started.length, "the click started no gesture");
            assert.ok(seen.sameState, "the mark opened or closed; test inconclusive");
            assert.ok(seen.strained > 0.004,
                `the scroll strained nothing (${seen.strained})`);
            assert.ok(seen.during.length
                && seen.during[0].name === seen.started[0].name
                && seen.during[0].t > seen.started[0].t,
                "the gesture was cancelled or restarted by the scroll "
                + `(${JSON.stringify(seen.started)} -> ${JSON.stringify(seen.during)})`);
        } finally { await p.__close(); }
    });

    test("and the page landing at an end lands on every mark", async () => {
            /*  An impulse of its own, on top of whatever the scroll was
                already doing: the page arriving at its end is the whole
                register stopping at once rather than content slowing down, and
                it is delivered against the direction of travel.  */
            const p = await ctx.openPage(PORTFOLIO, REPRESENTATIVE[3]);
            try {
                await p.waitForTimeout(600);
                const felt = await p.evaluate(async () => {
                    const top = parseFloat(getComputedStyle(document.documentElement)
                        .getPropertyValue("--sticky-top")) || 48;
                    const marks = [...document.querySelectorAll(".section-index")];
                    const maxY = document.documentElement.scrollHeight
                        - window.innerHeight;
                    window.scrollTo(0, maxY - 1500);
                    await new Promise(r => requestAnimationFrame(r));
                    for (let i = 0; i < 6; i++) {
                        window.scrollBy(0, 320);
                        await new Promise(r => requestAnimationFrame(r));
                    }
                    let pinned = 0;
                    for (let i = 0; i < 30; i++) {
                        await new Promise(r => requestAnimationFrame(r));
                        for (const m of marks) {
                            const r = m.closest(".section").getBoundingClientRect();
                            if (!(r.top <= top && r.bottom > top)) continue;
                            const y = parseFloat(m.style.getPropertyValue("--drag-y"));
                            if (Number.isFinite(y)) pinned = Math.max(pinned, Math.abs(y - 1));
                        }
                    }
                    return pinned;
                });
                assert.ok(felt > 0.004,
                    `the pinned mark did not feel the page land (${felt})`);
            } finally { await p.__close(); }
        });
});
