/**
 * THE GENERATED PAGE MATCHES ITS GENERATOR.
 *
 * portfolio/index.html is written by assets/build-portfolio.py. It is also
 * committed, because GitHub Pages serves files and not scripts. That is a
 * standing invitation to edit the committed copy directly, after which the
 * next person to run the generator silently reverts the change.
 *
 * So: run the generator and check nothing moved. A failure here means either
 * the page was hand-edited, or the generator was changed without regenerating.
 *
 * The mark geometry check is the other half. Every part of a section mark is
 * positioned in PERCENTAGES of the mark's own width, and that width is written
 * into the markup as --mark-w. Get the width wrong and every shape in that
 * mark stretches, quietly and proportionally, which reads as a design choice
 * rather than a bug. It was hardcoded per tone once and did exactly that.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { rel, read, exists } from "../lib/paths.js";
import { tags } from "../lib/html.js";

const hash = s => crypto.createHash("sha256").update(s).digest("hex");

describe("build-portfolio.py", () => {
    test("regenerating the portfolio changes nothing", () => {
        const path = rel("portfolio/index.html");
        const before = fs.readFileSync(path, "utf8");
        try {
            execFileSync("python3", [rel("assets/build-portfolio.py")], {
                cwd: rel("."), stdio: "pipe",
            });
        } catch (e) {
            assert.fail("the generator failed to run: " + (e.stderr?.toString() || e.message));
        }
        const after = fs.readFileSync(path, "utf8");
        if (hash(before) !== hash(after)) {
            // Put it back so a failing test does not also leave a dirty tree.
            fs.writeFileSync(path, before);
            assert.fail(
                "portfolio/index.html differs from what build-portfolio.py produces. "
                + "Either it was edited by hand, or the generator changed and the page "
                + "was not rebuilt. Run: python3 assets/build-portfolio.py");
        }
    });
});

describe("register mark geometry", () => {
    const src = read("portfolio/index.html");
    const marks = tags(src).filter(t =>
        (t.attr("class") || "").split(/\s+/).includes("section-index"));

    test("every mark declares a width and a span", () => {
        assert.ok(marks.length >= 5, `only ${marks.length} marks found`);
        for (const m of marks) {
            const style = m.attr("style") || "";
            assert.match(style, /--mark-w:\s*[\d.]+px/,
                `${m.attr("data-mark")} has no --mark-w; its parts are placed in `
                + "percentages of it and will stretch without it");
            assert.match(style, /--span:\s*[\d.]+/,
                `${m.attr("data-mark")} has no --span`);
        }
    });

    test("every part sits inside its mark", () => {
        // Parts are placed as percentages; anything over 100% hangs outside the
        // box the mark reserves and will be clipped or overlap the heading.
        const shapes = tags(src).filter(t =>
            t.name === "i" && /mask-image/.test(t.attr("style") || ""));
        assert.ok(shapes.length > 0, "no shapes found");
        const escaping = [];
        for (const s of shapes) {
            const style = s.attr("style");
            const num = k => {
                const m = style.match(new RegExp(`(?:^|;)${k}:\\s*([\\d.]+)%`));
                return m ? Number(m[1]) : null;
            };
            const [l, t, w, h] = [num("left"), num("top"), num("width"), num("height")];
            if ([l, t, w, h].some(v => v === null)) continue;
            if (l + w > 100.01 || t + h > 100.01) {
                escaping.push(`left ${l}+${w}, top ${t}+${h}`);
            }
        }
        assert.deepEqual(escaping, [], "mark parts extending past their own box");
    });

    test("every mask the register asks for exists in the shape library", () => {
        const shapes = tags(src).filter(t =>
            t.name === "i" && /mask-image/.test(t.attr("style") || ""));
        const missing = new Set();
        for (const s of shapes) {
            for (const m of (s.attr("style") || "").matchAll(/mask-image:url\(([^)]+)\)/g)) {
                const file = m[1].replace(/^\.\.\//, "");
                if (!exists(file)) missing.add(file);
            }
        }
        assert.deepEqual([...missing], [], "masks referenced but not in the library");
    });
});
