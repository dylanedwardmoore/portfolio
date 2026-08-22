/**
 * EVERYTHING A PAGE ASKS FOR EXISTS, AND ASKS FOR THE SAME VERSION.
 *
 * Two failures this catches, both of which have actually happened here:
 *
 *   A path that resolves against the wrong base. A relative url() inside a
 *   stylesheet resolves against the STYLESHEET, not the document, so a mask
 *   written as assets/img/... from a file in assets/css/ became
 *   /assets/css/assets/img/... and 404'd. Nothing reports that but the
 *   network panel, and the shape it was masking simply did not appear.
 *
 *   A stale cache stamp. Every reference carries ?v=STAMP and the stamp is
 *   bumped by hand on release. Miss one file and a browser holds an old
 *   stylesheet against new markup, which is worse than either alone.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { PAGES, OWN_CSS, ROOT, rel, read, exists } from "../lib/paths.js";
import { references, stamps } from "../lib/html.js";
import { urls } from "../lib/css.js";

/** Strips the query and resolves a reference the way a browser would. */
function resolveFrom(baseFile, ref) {
    const clean = ref.split("?")[0].split("#")[0];
    if (!clean) return null;
    const base = path.dirname(rel(baseFile));
    const abs = clean.startsWith("/")
        ? path.join(ROOT, clean)
        : path.resolve(base, clean);
    return abs;
}

describe("assets referenced by pages", () => {
    for (const page of PAGES) {
        const src = read(page.file);
        const refs = references(src);

        test(`${page.name}: every reference resolves on disk`, () => {
            const missing = [];
            for (const r of refs) {
                const abs = resolveFrom(page.file, r.value);
                if (!abs) continue;
                // A directory reference is served as its index.html.
                const target = fs.existsSync(abs) && fs.statSync(abs).isDirectory()
                    ? path.join(abs, "index.html")
                    : abs;
                if (!fs.existsSync(target)) {
                    missing.push(`${r.tag}[${r.attr}] ${r.value}`);
                }
            }
            assert.deepEqual(missing, [], `${page.file} references files that do not exist`);
        });

        test(`${page.name}: one version stamp, used everywhere`, () => {
            const found = [...new Set(stamps(src))];
            assert.equal(found.length, 1,
                `${page.file} carries ${found.length} different stamps: ${found.join(", ")}`);
        });

        test(`${page.name}: every local css/js reference is stamped`, () => {
            const unstamped = refs
                .filter(r => /\.(css|js)$/i.test(r.value.split("?")[0]))
                .filter(r => !/[?&]v=/.test(r.value))
                .map(r => r.value);
            assert.deepEqual(unstamped, [],
                `${page.file} has stylesheets or scripts with no cache stamp`);
        });
    }

    test("all pages agree on the version stamp", () => {
        const perPage = PAGES.map(p => ({
            page: p.name,
            stamp: [...new Set(stamps(read(p.file)))][0],
        }));
        const distinct = [...new Set(perPage.map(p => p.stamp))];
        assert.equal(distinct.length, 1,
            "pages disagree: " + perPage.map(p => `${p.page}=${p.stamp}`).join(", "));
    });

    test("the generator writes the same stamp the pages carry", () => {
        const gen = read("assets/build-portfolio.py");
        const m = gen.match(/V\s*=\s*"v=([\w.-]+)"/);
        assert.ok(m, "build-portfolio.py no longer declares V = \"v=...\"");
        const pageStamp = [...new Set(stamps(read("portfolio/index.html")))][0];
        assert.equal(m[1], pageStamp,
            "build-portfolio.py would rewrite the portfolio with a different stamp");
    });
});

describe("assets referenced by stylesheets", () => {
    for (const sheet of OWN_CSS) {
        test(`${path.basename(sheet)}: every url() resolves`, () => {
            const missing = urls(read(sheet))
                .filter(u => !/^(https?:|\/\/)/i.test(u))
                .filter(u => {
                    const abs = resolveFrom(sheet, u);
                    return abs && !fs.existsSync(abs);
                });
            assert.deepEqual(missing, [],
                `${sheet} has url() targets that do not exist -- remember these `
                + "resolve against the stylesheet, not the document");
        });
    }
});

describe("the icon", () => {
    test("the .ico exists and is a real multi-size icon", () => {
        assert.ok(exists("assets/img/icon/dem_mark.ico"), "icon missing");
        const buf = fs.readFileSync(rel("assets/img/icon/dem_mark.ico"));
        assert.equal(buf.readUInt16LE(0), 0, "not an ICO (reserved field)");
        assert.equal(buf.readUInt16LE(2), 1, "not an ICO (type field)");
        const count = buf.readUInt16LE(4);
        assert.ok(count >= 4, `icon carries only ${count} sizes; expected the full set`);
    });
});
