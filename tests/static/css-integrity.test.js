/**
 * THE STYLESHEET REFERS ONLY TO THINGS THAT EXIST.
 *
 * CSS has no compiler and fails silently in both directions: a rule naming an
 * animation that does not exist simply does nothing, and an animation nothing
 * names simply never runs. Neither is an error, neither appears in a console,
 * and both look exactly like "the feature is finished" until someone hovers
 * the one element that needed it.
 *
 * Every check here corresponds to a bug this repo actually shipped:
 *
 *   Teaching's lean was deleted by a bad splice. The @keyframes survived with
 *   nothing referencing them, so the gesture was silently absent for days.
 *
 *   A relative url() in a stylesheet resolved against the stylesheet, giving
 *   /assets/css/assets/img/... and a 404. (Checked in assets.test.js.)
 *
 *   overflow-clip-margin: calc(...) is rejected outright by Chrome, so the
 *   declaration dropped and the clip did nothing.
 *
 *   --ink was already the page's ink COLOUR on :root, so re-using the name
 *   for a clip-path substituted a colour into a clip-path and invalidated the
 *   whole declaration at computed-value time -- which does NOT fall back.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { OWN_CSS, OWN_JS, PAGES, read } from "../lib/paths.js";
import { parseCss, keyframeNames, animationNames, customProps, stripComments } from "../lib/css.js";

/** Classes a script puts on or takes off at runtime. */
function scriptClasses() {
    const found = new Set();
    for (const js of OWN_JS) {
        const src = read(js);
        for (const m of src.matchAll(/classList\.(?:add|remove|toggle|contains)\(([^)]*)\)/g)) {
            for (const q of m[1].matchAll(/["'`]([\w-]+)["'`]/g)) found.add(q[1]);
        }
        for (const m of src.matchAll(/className\s*=\s*["'`]([^"'`]*)["'`]/g)) {
            for (const c of m[1].split(/\s+/)) if (c) found.add(c);
        }
        // Selectors the script queries for are equally proof of intent.
        for (const m of src.matchAll(/querySelector(?:All)?\(\s*["'`]([^"'`]+)["'`]/g)) {
            for (const c of m[1].matchAll(/\.([\w-]+)/g)) found.add(c[1]);
        }
    }
    // Set by the inline <head> script on every page, not by a module.
    for (const p of PAGES) {
        for (const m of read(p.file).matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
            for (const q of m[1].matchAll(/["'`]([\w-]+)["'`]/g)) found.add(q[1]);
        }
    }
    return found;
}

/** Classes present in the committed markup. */
function markupClasses() {
    const found = new Set();
    for (const p of PAGES) {
        for (const m of read(p.file).matchAll(/\sclass\s*=\s*"([^"]*)"/g)) {
            for (const c of m[1].split(/\s+/)) if (c) found.add(c);
        }
    }
    return found;
}

describe("stylesheet structure", () => {
    for (const sheet of OWN_CSS) {
        const name = path.basename(sheet);
        const src = read(sheet);

        test(`${name}: braces balance`, () => {
            const { unbalanced } = parseCss(src);
            assert.equal(unbalanced, 0,
                `${name} has ${unbalanced} unclosed block(s) -- everything after `
                + "the first one is being parsed as part of it");
        });

        test(`${name}: every animation names a @keyframes that exists`, () => {
            const defined = new Set(keyframeNames(src));
            // Both sheets load together, so either may define what the other uses.
            for (const other of OWN_CSS) {
                for (const k of keyframeNames(read(other))) defined.add(k);
            }
            const { rules } = parseCss(src);
            const dangling = [];
            for (const r of rules) {
                for (const prop of ["animation", "animation-name"]) {
                    if (!r.decls[prop]) continue;
                    for (const n of animationNames(r.decls[prop])) {
                        if (!defined.has(n)) dangling.push(`${r.selector} { ${prop}: ${n} }`);
                    }
                }
            }
            assert.deepEqual(dangling, [],
                `${name} references animations with no @keyframes -- these do nothing`);
        });

        test(`${name}: every @keyframes is referenced by something`, () => {
            const used = new Set();
            for (const other of OWN_CSS) {
                for (const r of parseCss(read(other)).rules) {
                    for (const prop of ["animation", "animation-name"]) {
                        if (r.decls[prop]) {
                            for (const n of animationNames(r.decls[prop])) used.add(n);
                        }
                    }
                }
            }
            // A script may set an animation directly.
            for (const js of OWN_JS) {
                for (const m of read(js).matchAll(/["'`]([\w-]+)["'`]/g)) used.add(m[1]);
            }
            const orphans = keyframeNames(src).filter(k => !used.has(k));
            assert.deepEqual(orphans, [],
                `${name} defines animations nothing runs -- either wire them up or `
                + "delete them; a dead @keyframes reads as a working feature");
        });

        test(`${name}: no calc() where Chrome will not take it`, () => {
            const { rules } = parseCss(src);
            const bad = rules
                .filter(r => r.decls["overflow-clip-margin"]
                    && /calc\(/i.test(r.decls["overflow-clip-margin"]))
                .map(r => r.selector);
            assert.deepEqual(bad, [],
                "overflow-clip-margin rejects calc() in Chrome and the declaration "
                + "is dropped entirely");
        });

        test(`${name}: every custom property is defined, or every use has a fallback`, () => {
            const mine = customProps(src);
            const defined = new Set(mine.defined);
            for (const other of OWN_CSS) {
                for (const d of customProps(read(other)).defined) defined.add(d);
            }
            // Scripts set custom properties too.
            for (const js of OWN_JS) {
                for (const m of read(js).matchAll(/setProperty\(\s*["'`](--[\w-]+)/g)) {
                    defined.add(m[1]);
                }
            }
            for (const p of PAGES) {
                for (const m of read(p.file).matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
            }
            const risky = [];
            for (const [prop, everyUseHasFallback] of mine.used) {
                if (!defined.has(prop) && !everyUseHasFallback) risky.push(prop);
            }
            assert.deepEqual(risky, [],
                `${name} reads custom properties that are never set and do not always `
                + "supply a fallback -- an unset var makes the whole declaration invalid");
        });
    }
});

describe("selectors point at real things", () => {
    test("every class the stylesheets target exists in markup or in a script", () => {
        const known = new Set([...markupClasses(), ...scriptClasses()]);
        // State classes the view-transition machinery and the browser own.
        const OWNED_ELSEWHERE = /^(vt-|js-|is-|has-|no-)/;
        const orphans = new Set();
        for (const sheet of OWN_CSS) {
            for (const r of parseCss(read(sheet)).rules) {
                if (r.keyframes) continue;
                for (const cls of r.selector.matchAll(/\.([\w-]+)/g)) {
                    const c = cls[1];
                    if (known.has(c) || OWNED_ELSEWHERE.test(c)) continue;
                    orphans.add(c);
                }
            }
        }
        assert.deepEqual([...orphans].sort(), [],
            "these classes are styled but appear in no page and no script -- either "
            + "dead rules left behind by a removal, or a typo that silently does nothing");
    });
});
