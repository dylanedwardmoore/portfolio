/**
 * One browser and one server per test file, and a page that reports what went
 * wrong in it.
 *
 * WHY A REAL BROWSER. Everything in tests/static/ reads files. Nothing there
 * can tell you whether a rule actually applied, what won a specificity
 * contest, whether an element overflows its viewport at 320px, or whether a
 * script threw. Those are the questions that produced most of this site's
 * bugs, and only an engine answers them.
 *
 * WHY CHROMIUM ONLY. The site's two riskiest features -- view transitions and
 * a masked, clipped scroll rail -- are Chromium-first, and this is where they
 * are exercised. The static tier is engine-independent and covers the rest.
 * A second engine would be worth adding the day a Safari-specific bug appears.
 */
import { chromium } from "playwright";
import { startServer } from "./server.js";

/**
 * Opens a page and attaches recorders. Everything a test might want to assert
 * about failure is collected here rather than in each test, so no test can
 * forget to check for a thrown script.
 */
export async function makeContext() {
    const server = await startServer();
    const browser = await chromium.launch();

    async function open(url, viewport, opts = {}) {
        const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.dpr || 1,
            hasTouch: Boolean(viewport.phone),
            isMobile: Boolean(viewport.phone),
            reducedMotion: opts.reducedMotion ? "reduce" : "no-preference",
        });
        const page = await context.newPage();

        const errors = [];
        const failed = [];

        /*  The redirect pages send the browser straight to a PDF. Headless
            Chromium cannot render one, so the navigation never settles and
            every assertion below would be about a blank tab.

            Blocking the PDF leaves the browser on the fallback markup, which
            is the part of those pages that is HTML and the only part worth
            asserting about. The block is what makes the request fail, so it is
            not counted as a failure -- the test caused it.  */
        const blocked = new Set();
        await page.route("**/*.pdf", route => {
            blocked.add(route.request().url());
            return route.abort();
        });
        page.on("console", m => {
            if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", e => errors.push(`uncaught: ${e.message}`));
        page.on("requestfailed", r => {
            if (blocked.has(r.url())) return;
            failed.push(`${r.url()} ${r.failure()?.errorText || ""}`);
        });
        page.on("response", r => {
            if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
        });

        /*  domcontentloaded, then load with a short leash. Waiting on `load`
            outright means waiting on 42 lazy images on the portfolio and on a
            redirect that will never complete on the other three. What the
            layout assertions actually need is fonts, which is awaited next. */
        await page.goto(server.origin + url, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
        // Fonts change metrics, and every layout assertion below depends on
        // them having settled. Awaited inside the page and reduced to a
        // boolean: document.fonts.ready resolves to a FontFaceSet, which
        // cannot cross the bridge, and returning it hangs the call.
        await page.evaluate(async () => {
            if (document.fonts) await document.fonts.ready;
            return true;
        });
        await page.waitForTimeout(opts.settle ?? 120);

        page.__errors = errors;
        page.__failed = failed;
        // What the page tried to navigate to and was stopped from reaching.
        // The redirect test asserts on this: it is the only evidence that a
        // redirect fired, since the navigation never completes.
        page.__blocked = blocked;
        page.__close = () => context.close();
        return page;
    }

    /**
     * Opens one of the entries from PAGES, applying the no-redirect seam to
     * the three that would otherwise navigate to a PDF. Tests should prefer
     * this to open(): it means a test cannot accidentally assert about a blank
     * tab because it forgot which pages redirect.
     */
    function openPage(entry, viewport, opts = {}) {
        const url = entry.redirects && !opts.allowRedirect
            ? entry.url + "?no-redirect=1"
            : entry.url;
        return open(url, viewport, opts);
    }

    return {
        open,
        openPage,
        server,
        origin: server.origin,
        async close() {
            await browser.close();
            await server.close();
        },
    };
}
