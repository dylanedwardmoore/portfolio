/**
 * Where everything is, and what counts as a page.
 *
 * Every other test module asks here rather than building paths of its own, so
 * adding a view is a one-line change and nothing can silently test four pages
 * while believing it tested five.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const rel = (...p) => path.join(ROOT, ...p);
export const read = (...p) => fs.readFileSync(rel(...p), "utf8");
export const exists = (...p) => fs.existsSync(rel(...p));

/**
 * The site's views.
 *
 *   url   what the server (and GitHub Pages) serves it as
 *   file  the file on disk that answers that url
 *   name  what a failing test calls it
 */
export const PAGES = [
    { name: "landing", url: "/", file: "index.html" },
    { name: "portfolio", url: "/portfolio/", file: "portfolio/index.html" },
    /*  THESE THREE ARE REDIRECTS, not views. Each carries a meta refresh and a
        location.replace() straight to a PDF, and the markup under it is the
        fallback for when neither fires -- a script-blocked browser, a slow
        connection, a crawler.

        It matters to the browser tests: navigating to one normally ends up at
        a PDF, which a headless browser cannot render and never finishes
        loading. The fixture blocks the PDF so what gets tested is the fallback
        page, which is the only part of these that is HTML at all.  */
    { name: "resume", url: "/resume/", file: "resume/index.html", redirects: true },
    {
        name: "dissertation",
        url: "/dissertation/",
        file: "dissertation/index.html",
        redirects: true,
    },
    {
        name: "dissertation-zh",
        url: "/dissertation/chinese/",
        file: "dissertation/chinese/index.html",
        redirects: true,
    },
];

/** The stylesheets and scripts this site actually wrote. */
export const OWN_CSS = ["assets/css/site.css", "assets/css/portfolio.css"];
export const OWN_JS = [
    "assets/js/scrollrail.js",
    "assets/js/figures.js",
    "assets/js/marks.js",
    "assets/js/idle.js",
];

/**
 * Vendor files that came with the original template. They are not held to the
 * house rules -- they are minified third-party code -- but they still have to
 * EXIST if something references them, which the asset test checks separately.
 */
export const VENDOR = /(?:bootstrap|jquery|isotope|imagesloaded|magnific|slicknav|font-awesome|flaticon|plugins|vendor)/i;
