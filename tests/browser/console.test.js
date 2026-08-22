/**
 * NOTHING THROWS, AND NOTHING 404s.
 *
 * The cheapest possible net, and one this site needed: a mask whose url()
 * resolved against the stylesheet 404'd silently for days, and a stylesheet
 * damaged by a bad splice took a whole feature down without a single console
 * line. A 404 for an asset is invisible on the page -- the shape it was
 * masking simply does not appear -- so it has to be asserted, not looked for.
 *
 * Run at several sizes because scripts branch on width: a handler that throws
 * only on a phone would pass a desktop-only check.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../lib/paths.js";
import { REPRESENTATIVE } from "../lib/viewports.js";
import { makeContext } from "../lib/browser.js";

let ctx;
before(async () => { ctx = await makeContext(); }, { timeout: 120000 });
after(async () => { await ctx.close(); });

describe("every page loads clean", () => {
    for (const page of PAGES) {
        for (const vp of REPRESENTATIVE) {
            test(`${page.name} @ ${vp.name}`, async () => {
                const p = await ctx.open(page.url, vp);
                try {
                    // Give scripts a moment to run their first frames.
                    await p.waitForTimeout(250);
                    assert.deepEqual(p.__errors, [], "console errors / uncaught exceptions");
                    assert.deepEqual(p.__failed, [], "requests that failed or 404'd");
                } finally {
                    await p.__close();
                }
            });
        }
    }
});
