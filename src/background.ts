// Don't use a typical `import` because that would make TypeScript treat this file as a
// module (even for a type-only import) and generate an `export {};` statement which
// breaks Firefox extension background scripts.
type Browser = import('webextension-polyfill').Browser;

declare const browser: Browser;

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

        const res = browser.webRequest.filterResponseData(req.requestId);
        res.onstart = () => {
            res.write(new TextEncoder().encode(`console.log('test');\n`));
            res.close();
        };
    },
    {
        urls: [ 'http://localhost/*', 'https://localhost/*' ],
        types: [ 'script' ],
    },
    [ 'blocking' ],
);
