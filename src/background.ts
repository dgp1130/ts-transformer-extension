import * as esbuild from 'esbuild-wasm';
import type { Browser } from 'webextension-polyfill';

declare const browser: Browser;

const esBuildInit = esbuild.initialize({
    wasmURL: '/esbuild.wasm',
    // Disable workers as this seems to be done by pointing a worker at a blob URL which
    // breaks CSP. TODO: Manually initialize the worker?
    worker: false,
});

// Rewrite `Content-Type` header for transformed responses.
browser.webRequest.onHeadersReceived.addListener(
    (req) => {
        // Limit to obviously TypeScript files.
        if (!req.url.endsWith('.ts')) return;

        return {
            responseHeaders: [
                { name: 'Content-Type', value: 'application/javascript' },
            ],
        };
    },
    {
        urls: [ 'http://localhost/*', 'https://localhost/*' ],
        types: [ 'script' ],
    },
    [ 'blocking', 'responseHeaders' ],
);

// Transform the HTTP response of TypeScript requests.
browser.webRequest.onBeforeRequest.addListener(
    (req) => {
        // Limit to obviously TypeScript files.
        if (!req.url.endsWith('.ts')) return;

        const responseFilter = browser.webRequest.filterResponseData(req.requestId);
        responseFilter.onstart = async () => {
            const res = await fetch(req.url);
            if (res.status !== 200) {
                responseFilter.write(await res.arrayBuffer());
                responseFilter.close();
            }

            // TODO: Sourcemap
            const ts = await res.text();
            await esBuildInit;
            const js = await esbuild.transform(ts, { loader: 'ts' });

            responseFilter.write(new TextEncoder().encode(js.code));
            responseFilter.close();
        };
    },
    {
        urls: [ 'http://localhost/*', 'https://localhost/*' ],
        types: [ 'script' ],
    },
    [ 'blocking' ],
);
