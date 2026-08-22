/**
 * The static server the browser tests run against.
 *
 * It serves the repository the way GitHub Pages does -- a directory maps to
 * its index.html -- because a test that passes against a cleverer server than
 * production is not a test of production. It also records every request, so a
 * test can assert that a page asked for nothing that 404s, which is how a
 * mistyped asset path gets caught rather than silently degrading.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.js";

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
};

export async function startServer() {
    const requests = [];
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        let p = decodeURIComponent(url.pathname);
        if (p.endsWith("/")) p += "index.html";
        // Never escape the repository, whatever the request says.
        const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
        if (!file.startsWith(ROOT)) {
            requests.push({ url: req.url, status: 403 });
            res.writeHead(403).end("no");
            return;
        }
        fs.readFile(file, (err, body) => {
            const status = err ? 404 : 200;
            requests.push({ url: req.url, path: p, status });
            if (err) { res.writeHead(404).end("not found"); return; }

            /*  THE ONE TEST SEAM IN THIS SERVER, and it exists because three
                of the five pages are redirects.

                /resume/, /dissertation/ and /dissertation/chinese/ each carry
                a meta refresh and a location.replace() straight to a PDF. The
                markup underneath is a real page -- it is what a crawler, a
                script-blocked browser, or anyone on a slow connection sees --
                and it has layout worth asserting about. But a browser sent
                there lands on a PDF it cannot render, and blocking the PDF
                mid-navigation just leaves a blank tab, which is what the first
                attempt at this measured: zero elements on all three pages.

                With ?no-redirect=1 the two lines that navigate are removed and
                nothing else is touched, so what the browser lays out is the
                fallback exactly as written. That the redirect itself works is
                asserted separately, without the seam, in redirects.test.js.  */
            if (url.searchParams.has("no-redirect") && file.endsWith(".html")) {
                body = Buffer.from(String(body)
                    .replace(/<meta\s+http-equiv=["']refresh["'][^>]*>/gi, "")
                    .replace(/window\.location\.replace\([^)]*\);?/g, ""));
            }

            res.writeHead(200, {
                "content-type": MIME[path.extname(file).toLowerCase()]
                    || "application/octet-stream",
                "cache-control": "no-store",
            });
            res.end(body);
        });
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();
    return {
        origin: `http://127.0.0.1:${port}`,
        requests,
        /** Requests that failed, ignoring anything the test itself asked for. */
        failures: () => requests.filter(r => r.status >= 400),
        reset: () => { requests.length = 0; },
        close: () => new Promise(r => server.close(r)),
    };
}
