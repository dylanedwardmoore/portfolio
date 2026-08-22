/**
 * THE MARKUP IS WELL FORMED AND SAYS WHAT IT IS.
 *
 * Cheap, absolute checks that need no browser: the things that are either
 * right or wrong in the file itself. Anything requiring layout or computed
 * style is in tests/browser/.
 *
 * The duplicate-id check earns its place beyond tidiness: this page uses
 * fragment links and an IntersectionObserver keyed on sections, and two
 * elements sharing an id makes both silently unreliable.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PAGES, read } from "../lib/paths.js";
import { tags, ids, images, links, headings } from "../lib/html.js";

describe("every page", () => {
    for (const page of PAGES) {
        const src = read(page.file);
        const all = tags(src);

        test(`${page.name}: declares a character set and a viewport`, () => {
            const metas = all.filter(t => t.name === "meta");
            assert.ok(metas.some(m => m.attr("charset")),
                "no <meta charset> -- the browser is left guessing the encoding");
            const vp = metas.find(m => (m.attr("name") || "").toLowerCase() === "viewport");
            assert.ok(vp, "no viewport meta: every phone will render this at desktop width");
            assert.match(vp.attr("content") || "", /width\s*=\s*device-width/,
                "viewport does not track the device width");
        });

        test(`${page.name}: declares its language`, () => {
            const html = all.find(t => t.name === "html");
            const lang = html && html.attr("lang");
            assert.ok(lang, "<html> has no lang attribute");
            // The translated dissertation must not claim to be English.
            if (page.name === "dissertation-zh") {
                assert.match(lang, /^zh/,
                    `the Chinese translation declares lang="${lang}"`);
            }
        });

        test(`${page.name}: has exactly one <h1>`, () => {
            const h1s = headings(src).filter(h => h.level === 1);
            assert.equal(h1s.length, 1,
                `found ${h1s.length} level-1 headings: ${h1s.map(h => h.text).join(" | ")}`);
        });

        test(`${page.name}: heading levels never skip`, () => {
            const levels = headings(src).map(h => h.level);
            const skips = [];
            for (let i = 1; i < levels.length; i++) {
                if (levels[i] > levels[i - 1] + 1) {
                    skips.push(`h${levels[i - 1]} -> h${levels[i]}`);
                }
            }
            assert.deepEqual(skips, [], "heading outline jumps a level");
        });

        test(`${page.name}: has a non-empty <title>`, () => {
            const m = src.match(/<title>([\s\S]*?)<\/title>/i);
            assert.ok(m && m[1].trim(), "no title");
        });

        test(`${page.name}: no duplicate ids`, () => {
            const seen = ids(src);
            const dupes = seen.filter((v, i) => seen.indexOf(v) !== i);
            assert.deepEqual([...new Set(dupes)], [], "ids must be unique in a document");
        });

        test(`${page.name}: every image carries alt text`, () => {
            // alt="" is correct and deliberate for decorative images; a MISSING
            // alt is the fault, because it makes a screen reader read the URL.
            const bad = images(src).filter(i => i.alt === null)
                .map(i => i.src);
            assert.deepEqual(bad, [], "images with no alt attribute at all");
        });

        test(`${page.name}: external links cannot reach back through window.opener`, () => {
            const bad = links(src)
                .filter(l => l.target === "_blank")
                .filter(l => !/noopener/.test(l.rel || ""))
                .map(l => l.href);
            assert.deepEqual(bad, [], 'target="_blank" without rel="noopener"');
        });

        test(`${page.name}: no inline event handlers`, () => {
            const bad = all
                .filter(t => /\son[a-z]+\s*=/i.test(t.raw))
                .map(t => t.raw.slice(0, 60));
            assert.deepEqual(bad, [],
                "inline handlers cannot be cached, versioned, or disabled with the rest "
                + "of the scripts");
        });
    }
});

describe("decorative markup is hidden from assistive tech", () => {
    /*  These carry meaning only as pictures. Read aloud they are noise, and
        <i> in particular is announced as emphasis by some screen readers.

        aria-hidden INHERITS, so the test asks only about the outermost element
        of each decorative thing -- requiring it on the thumb inside an already
        hidden rail would be asking for a redundant attribute and would fail
        correct markup.

        The register's number is deliberately NOT covered: "01" is visible
        content sitting beside a heading, not decoration.  */
    const DECORATIVE = [
        { file: "index.html", cls: "edge-rule" },
        { file: "portfolio/index.html", cls: "scrollrail" },
    ];

    for (const { file, cls } of DECORATIVE) {
        test(`${cls} in ${file} is aria-hidden`, () => {
            const found = tags(read(file)).filter(t =>
                (t.attr("class") || "").split(/\s+/).includes(cls));
            assert.ok(found.length > 0, `no .${cls} in ${file} -- has the markup changed?`);
            const speaking = found.filter(t => t.attr("aria-hidden") !== "true");
            assert.equal(speaking.length, 0,
                `.${cls} will be announced by a screen reader`);
        });
    }

    test("every shape in the register is aria-hidden", () => {
        const src = read("portfolio/index.html");
        const shapes = tags(src).filter(t =>
            t.name === "i" && /mask-image/.test(t.attr("style") || ""));
        assert.ok(shapes.length > 0, "no masked shapes found -- has the generator changed?");
        const speaking = shapes.filter(t => t.attr("aria-hidden") !== "true").length;
        assert.equal(speaking, 0,
            `${speaking} of ${shapes.length} register shapes are not aria-hidden`);
    });
});
