/**
 * A small CSS reader, good enough for this stylesheet and honest about it.
 *
 * WHY NOT A REAL PARSER. Pulling in postcss to check a hand-written stylesheet
 * would mean the tests depend on a parser that is more permissive than the
 * browser and disagrees with it in exactly the corners bugs live in. What is
 * wanted here is the shape of the file -- which selectors set which
 * properties, inside which at-rules -- and that is a brace walk.
 *
 * It IS careful about the two things a naive regex gets wrong and which have
 * both caused real bugs in this repo: comments (a commented-out rule is not a
 * rule) and nesting (@media and @keyframes hold rules inside them, and a flat
 * split on "}" tears them in half).
 */

/** Strips comments without being fooled by "/*" inside a string. */
export function stripComments(src) {
    let out = "";
    let i = 0;
    let quote = null;
    while (i < src.length) {
        const c = src[i];
        if (quote) {
            out += c;
            if (c === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
            if (c === quote) quote = null;
            i++;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; out += c; i++; continue; }
        if (c === "/" && src[i + 1] === "*") {
            const end = src.indexOf("*/", i + 2);
            i = end === -1 ? src.length : end + 2;
            // Keep a space so `a/*x*/b` does not become `ab`.
            out += " ";
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Every rule in the sheet, flattened, each carrying the at-rules it sits
 * inside.
 *
 *   { selector, decls: {prop: value}, at: ["@media (max-width: 767px)"],
 *     keyframes: "dm-emerge" | null }
 *
 * Declarations are last-wins within a block, which is what the cascade does.
 */
export function parseCss(src) {
    const text = stripComments(src);
    const rules = [];
    const stack = [];
    let buf = "";
    let i = 0;
    let quote = null;

    while (i < text.length) {
        const c = text[i];
        if (quote) {
            buf += c;
            if (c === "\\") { buf += text[i + 1] ?? ""; i += 2; continue; }
            if (c === quote) quote = null;
            i++;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; buf += c; i++; continue; }

        if (c === "{") {
            const head = buf.trim().replace(/\s+/g, " ");
            buf = "";
            stack.push(head);
            i++;
            continue;
        }
        if (c === "}") {
            const head = stack[stack.length - 1] ?? "";
            const body = buf.trim();
            buf = "";
            // A block whose body has no nested block is a rule; one that held
            // rules has already emitted them and closes with nothing left.
            if (body && !body.includes("{")) {
                const kf = stack.slice(0, -1).find(h => h.startsWith("@keyframes"));
                rules.push({
                    selector: head,
                    decls: parseDecls(body),
                    at: stack.slice(0, -1).filter(
                        h => h.startsWith("@") && !h.startsWith("@keyframes")),
                    keyframes: kf ? kf.replace(/^@keyframes\s+/, "").trim() : null,
                });
            }
            stack.pop();
            i++;
            continue;
        }
        buf += c;
        i++;
    }
    return { rules, unbalanced: stack.length };
}

function parseDecls(body) {
    const out = {};
    let depth = 0;
    let cur = "";
    let quote = null;
    const push = () => {
        const d = cur.trim();
        cur = "";
        if (!d) return;
        const k = d.indexOf(":");
        if (k === -1) return;
        out[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim();
    };
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) {
            cur += c;
            if (c === "\\") { cur += body[i + 1] ?? ""; i++; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; cur += c; continue; }
        if (c === "(") depth++;
        if (c === ")") depth--;
        // Semicolons inside url(...) or a clip-path polygon are not separators.
        if (c === ";" && depth === 0) { push(); continue; }
        cur += c;
    }
    push();
    return out;
}

/** Every `@keyframes NAME` defined in the sheet. */
export function keyframeNames(src) {
    return [...stripComments(src).matchAll(/@keyframes\s+([\w-]+)/g)]
        .map(m => m[1]);
}

/**
 * Every animation NAME a rule asks for, from either `animation-name` or the
 * `animation` shorthand.
 *
 * The shorthand is the awkward one: the name can sit anywhere among the
 * durations, easings and keywords. Rather than guess by position, drop every
 * token that is a time, a number, a function, or one of the shorthand's own
 * keywords -- what is left is the name.
 */
const ANIM_KEYWORDS = new Set([
    "none", "normal", "reverse", "alternate", "alternate-reverse",
    "forwards", "backwards", "both", "running", "paused", "infinite",
    "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start",
    "step-end", "initial", "inherit", "unset", "revert", "revert-layer",
]);

export function animationNames(value) {
    const names = [];
    for (const part of splitTop(value, ",")) {
        for (const raw of part.trim().split(/\s+/)) {
            const t = raw.replace(/!important/i, "").trim();
            if (!t) continue;
            if (ANIM_KEYWORDS.has(t.toLowerCase())) continue;
            if (/^-?[\d.]+m?s$/i.test(t)) continue;         // 400ms, 0.64s
            if (/^-?[\d.]+$/.test(t)) continue;             // iteration counts
            if (/^[\w-]+\(/.test(t)) continue;              // cubic-bezier(...)
            if (t.startsWith("var(")) continue;
            if (/^[a-zA-Z_-][\w-]*$/.test(t)) names.push(t);
        }
    }
    return names;
}

/** Splits on a separator that is not inside brackets. */
export function splitTop(value, sep) {
    const out = [];
    let depth = 0;
    let cur = "";
    let quote = null;
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (quote) {
            cur += c;
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; cur += c; continue; }
        if (c === "(" || c === "[") depth++;
        if (c === ")" || c === "]") depth--;
        if (c === sep && depth === 0) { out.push(cur); cur = ""; continue; }
        cur += c;
    }
    out.push(cur);
    return out;
}

/** Every url(...) target in the sheet, unquoted. */
export function urls(src) {
    return [...stripComments(src).matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)]
        .map(m => m[2].trim())
        .filter(u => !u.startsWith("data:"));
}

/** Custom properties: what is defined, and what is asked for. */
export function customProps(src) {
    const text = stripComments(src);
    const defined = new Set(
        [...text.matchAll(/(^|[;{\s])(--[\w-]+)\s*:/g)].map(m => m[2]));
    const used = new Map();
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
        // Recorded per name: does EVERY use supply a fallback?
        const prev = used.get(m[1]);
        const hasFallback = Boolean(m[2]);
        used.set(m[1], prev === undefined ? hasFallback : prev && hasFallback);
    }
    return { defined, used };
}

/** Rough specificity of a single (non-comma) selector: [ids, classes, types]. */
export function specificity(sel) {
    let s = sel.replace(/::?[\w-]+\([^)]*\)/g, m => {
        // :not(...) / :is(...) contribute their argument's specificity.
        if (/^:(not|is|has)\(/i.test(m)) return m.slice(m.indexOf("(") + 1, -1);
        return " PSEUDO ";
    });
    const ids = (s.match(/#[\w-]+/g) || []).length;
    const classes = (s.match(/\.[\w-]+/g) || []).length
        + (s.match(/\[[^\]]+\]/g) || []).length
        + (s.match(/:[\w-]+/g) || []).length;
    const types = (s.replace(/[#.][\w-]+/g, " ").replace(/\[[^\]]+\]/g, " ")
        .match(/\b[a-zA-Z][\w-]*\b/g) || []).length;
    return [ids, classes, types];
}
