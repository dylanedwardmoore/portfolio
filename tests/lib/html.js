/**
 * Reads the facts out of a page that the static tests need.
 *
 * These documents are hand-written and well-formed, so attribute scraping is
 * enough and keeps the suite dependency-free. Anything that needs a real DOM
 * -- computed styles, layout, what a script does -- belongs in the browser
 * tests, not here.
 */
import { stripComments as stripCssComments } from "./css.js";

/** Removes <!-- --> so a commented-out tag is not read as markup. */
export function stripHtmlComments(src) {
    return src.replace(/<!--[\s\S]*?-->/g, " ");
}

const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
    return m ? (m[2] ?? m[3]) : null;
};

/** Every tag in the document, as { name, raw, attr(n) }. */
export function tags(src) {
    const clean = stripHtmlComments(src);
    return [...clean.matchAll(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)]
        .map(m => ({
            name: m[1].toLowerCase(),
            raw: m[0],
            attr: n => attr(m[0], n),
        }));
}

/**
 * Everything the page asks the network for: stylesheets, scripts, images,
 * icons, preloads, and any url() inside a style attribute.
 *
 * Returns the raw reference, so a test can check both that it resolves and
 * that it carries the version stamp.
 */
export function references(src) {
    const out = [];
    for (const t of tags(src)) {
        for (const a of ["href", "src"]) {
            const v = t.attr(a);
            if (!v) continue;
            if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(v)) continue;
            out.push({ tag: t.name, attr: a, value: v });
        }
        const style = t.attr("style");
        if (style) {
            for (const m of stripCssComments(style)
                .matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
                if (!m[2].startsWith("data:")) {
                    out.push({ tag: t.name, attr: "style-url", value: m[2].trim() });
                }
            }
        }
    }
    return out;
}

export const ids = src => tags(src).map(t => t.attr("id")).filter(Boolean);

export const images = src => tags(src)
    .filter(t => t.name === "img")
    .map(t => ({ src: t.attr("src"), alt: t.attr("alt"), raw: t.raw }));

export const links = src => tags(src)
    .filter(t => t.name === "a")
    .map(t => ({ href: t.attr("href"), target: t.attr("target"), rel: t.attr("rel"), raw: t.raw }));

/** Headings in document order, as { level, text }. */
export function headings(src) {
    const clean = stripHtmlComments(src);
    return [...clean.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({
        level: Number(m[1]),
        text: m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
    }));
}

/**
 * The version stamp on every LOCAL reference.
 *
 * Derived from references() rather than scraped off the raw source, because
 * "v=" is also YouTube's video-id parameter and this page embeds two of them.
 * Reading the source directly reported eNy72ObvKXU as a version of this site.
 */
export function stamps(src) {
    return references(src)
        .map(r => r.value.match(/[?&]v=([\w.-]+)/))
        .filter(Boolean)
        .map(m => m[1]);
}
