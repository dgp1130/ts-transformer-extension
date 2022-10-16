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
            // Proxy the requested TypeScript file.
            const res = await fetch(req.url);

            // Bail on any errors in the proxied request.
            if (res.status !== 200) {
                responseFilter.write(await res.arrayBuffer());
                responseFilter.close();
            }

            // Transform the TypeScript into JavaScript.
            const ts = await res.text();
            await esBuildInit;
            const js = await esbuild.transform(ts, {
                loader: 'ts',
                sourcemap: true,
                sourcefile: req.url.split('/').at(-1)!,
            });

            // Print warnings to the console.
            for (const warning of js.warnings) {
                console.warn(warning.text);
            }

            // Respond with the transformed JavaScript.
            responseFilter.write(new TextEncoder().encode(`${
                js.code}\n//# sourceMappingURL=data:application/json;base64,${
                btoa(js.map)}\n`));
            responseFilter.close();
        };
    },
    {
        urls: [ 'http://localhost/*', 'https://localhost/*' ],
        types: [ 'script' ],
    },
    [ 'blocking' ],
);
