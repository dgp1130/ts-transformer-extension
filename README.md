# TypeScript Transformer Extension

A browser extension which watches the network for TypeScript source code and transforms
them to JavaScript.

This is an alternative approach to the
[JavaScript type annotations TC39 proposal](https://github.com/tc39/proposal-type-annotations/)
which should provide many of the same technical benefits without requiring changes to
the language specification.

**Only Firefox is supported because Chrome has some ludicrous policies around blocking
web requests in an extension.**

## Motivation

While the exact goals of the type annotations proposal aren't clearly specified, most of
the clear benefits come from removing `tsc` as a required build step and simplifying
developer tooling for projects that don't otherwise require a build process at all for
development. This proposal attempts to capture the same tooling benefits without
modifying the JavaScript language specification.

## Proposal

https://twitter.com/develwoutacause/status/1513416629752762370

The general idea here is that a browser could strip types via a non-standard,
developer-only feature. Development servers could just serve raw TypeScript source code
to browsers which would automatically strip types and execute the transformed
JavaScript. This feature would be developer-only, meaning it would be disabled by
default and require checking a box in DevTools to enable so it doesn't affect production
users and doesn't need to be standardized. It would _not_ actually run any type
checking, only strip types just like the JS type annotations proposal.

This has a few potential benefits over the TC39 proposal:
1.  This does not require modifying the JavaScript specification.
1.  This does not limit the evolution of TypeScript syntax.
1.  Any compile-to-JS language could work with this model (regardless of syntax
    similarities to JS).

Unfortunately, I don't know anything about browser development, so implementing a real
prototype sounds hard. Instead, I decided to test this out with a browser extension
which emulates the proposed behavior as closely as possible and see how well it works in
practice.

*   See [`background.ts`](/src/background.ts) for the core implementation.
*   See [`site/`](/src/site/) for an example application built using this model. It has
    no required build step and uses a plain static file server
    ([`http-server`](https://www.npmjs.com/package/http-server)), yet is able to run
    TypeScript as long as you have this extension installed.
*   See [local development](#local-development) for instructions on how to build and
    install the extension and test it out yourself.

## Comparison with JS type annotations proposal

So how does this proposal actually hold up compared to the TC39 JS type annotations
proposal?

The main problem with this proposal is that there is no clear mechanism for determining
which scripts require TypeScript transformation and which don't (see
[file extensions](#file-extensions)). This extension assumes that all `*.js` files are
actually `*.ts` files that require transformation, which isn't a great assumption to
make. Other mechanisms like `Content-Type: application/typescript` or
`<script src="/index.ts" type="typescript" />`
[have their own flaws](#what-if-browsers-implemented-this-directly) (the former requires
dev server support while the latter won't work in production).

Both the TC39 proposal and this one effectively eliminate the required build step to use
TypeScript in development workflows. However, neither is able to remove the development
_server_. ESM-based dev servers like Vite already support TypeScript transformation in a
similar mold. This proposal is compatible with any static file server, and puts less
work in the dev server, which is one benefit. However, from the perspective of developer
ergonomics and usability, there's not that much difference between
`npm install http-server` and `npm install vite`. In fact, doing the transformation in
the dev server directly actually has
[several advantages](#what-about-a-more-powerful-dev-server-like-vite).

In fairness, converging JS and TS can have other benefits which are not achieved with
Vite or this proposal. However, assuming the primary objective of the TC39 proposal is to
allow developers to use compile-to-JS languages like TypeScript in development without a
build step, I think ESM dev servers like Vite actually do this today more effectively
than either proposal.

## Specific takeaways

In the process of this project I've identified a few more specific takeaways and
learnings about what does and does not work with this approach.

### File extensions

An unexpected problem I encountered is what file extension to use? Users author code in
`*.ts` files so if we're skipping a build step, I expected the runtime to use `*.ts`
files as well. So I expected to write:

```html
<script src="/index.ts" type="module"></script>
```

This works as expected, however I forgot about `import` statements. Applying the same
logic there requires users to write:

```typescript
import './index.ts';
```

The `*.ts` file extension is wrong here and TypeScript
[explicitly disallows it](https://github.com/microsoft/TypeScript/issues/37582). There's
complex reasoning as to why, but I think the main concern is about trying to avoid
altering the runtime semantics of the program.

I opted to leave `import` specifiers with `*.js` extensions like the TypeScript team
recommends and which is usually leveraged for native ESM (which is required here due to
the lack of a build step). The extension makes that work by redirecting `*.js` files to
their equivalent `*.ts` URLs and then transforming the result. This does mean the
extension expects the project to have no real `*.js` files, which isn't always a correct
assumption. It's not ideal, but seems like the most straightforward solution to this
particular problem.

### Dependencies

In order to load NPM dependencies correctly, we need to use
[import maps](https://github.com/WICG/import-maps) to resolve bare specifiers like
`import { /* ... */ } from 'lit';`. Firefox doesn't actually support import maps by
default yet, so they need to be manually enabled. This also requires serving
`node_modules/`, yet there's no standard convention for exactly what that looks like.
This example accomplishes this by symlinking `node_modules/` in the served directory,
though this leaks `node_modules/` into the served URL paths. This is actually _required_
too, because the extension special cases `node_modules/` paths to skip the
[`*.js` -> `*.ts` redirect](#file-extensions) since everything in NPM is pre-built JS
(usually). This breaks the assumption that "No real JS files exist", so we need to
special case `node_modules/` to fix that.

### `file:///` URLs

I was curious if this approach would allow us to ditch development servers altogether
and just load the application in the browser via `file:///path/to/my/app/index.html`.
Turns out this doesn't work because CORS has been updated to treat every `file:///` URL
[as a unique, opaque origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSRequestNotHttp).
This means that `<script src="/index.js"></script>` loaded at a `file:///` URL actually
fails because it is cross-origin. The recommended solution is to use a real development
server.

Even if we worked around this, my experience has shown that `file:///` URLs are very
weird in the browser security model anyways, so other things in the application break
and it's not really a scalable solution anyways.

### Sourcemaps

Sourcemaps _mostly_ work without too many issues. ESBuild generates a sourcemap when it
transforms to JavaScript and the sourcemap is appended to the script.

The one edge case is that any existing sourcemaps in the input are discarded, so if the
TypeScript is generated from something else and includes its own sourcemap, that will be
dropped. While this could probably be supported given some additional effort, the use
case is likely quite rare as very few applications generate their entire TypeScript
codebase, while many teams will generate their entire JavaScript codebase by using
TypeScript. Also the assumption that the project doesn't have any required build tooling
means generated code is much less likely (though not impossible).

### Dev vs prod

There is still a significant divergence between the development and production
deployments of an application using this extension, meaning developers still need to
maintain a production build pipeline. The main divergences are:

1.  Import maps are required to load dependencies for development, but aren't yet
    supported well enough across browsers to feasibly use in production.
1.  Development can get away with just serving all of `node_modules/`, but production
    likely doesn't want to do that and should be restricted to only runtime
    dependencies.
1.  Bundling and minifying still should be done to reduce unnecessary bytes over the
    wire.

Solving these problems is non-trivial and still required (to varying extents) for
production-level applications, even if they aren't strictly required for the
edit/refresh loop.

### What about a more powerful dev server like Vite?

An astute reader might notice some similarities to [Vite](https://vitejs.dev/) and other
ESM based dev servers. The main difference is that this approach is executed in a
browser extension instead of a dev server. So what is the advantage there?

To be honest: Not much. As mentioned in [`file:///` URLs](#file-urls), a development
server is still required to use this extension, it can just be a static file server.
Vite makes the server a bit more complex and does _technically_ introduce build tooling,
it just executes those tools at serve-time rather than requiring a separate build-time
step.

Vite's dev server approach actually makes a lot of the challenges with this extension
much easier. It has direct access to user source code on the file system, so things
like running Node module resolution or auto-bundling dependencies become much easier. It
also can enforce conventions like "dependencies are always served at
`/node_modules/...`", which is easy to do when you own the dev server and a very weird
assumption to make in a browser extension.

Frankly, Vite does this way better than an extension can without sacrificing much
usability and is probably a better approach overall.

## What if browsers implemented this directly?

Of course the original idea here was that a browser would do this automatically, rather
than require developers to install a specific extension. So are any of these challenges
improved by solving the problem directly in the browser instead of an extension?

The [file extension problem](#file-extensions) still exists for browsers, though
slightly differently. When it sees a `<script src="/index.js" />`, it needs to know
whether that is a real JS file, or a transformed TS file, and there's no obvious way to
know. The simplest answer would be to have the server respond with
`Content-Type: application/typescript`, but this requires the dev server to handle a
request for `index.js` by returning `index.ts` as `application/typescript`. If the dev
server needs to do that anyways, then why not just transform to JS in the dev server
directly like Vite?

Alternatively, browsers could support `<script src="/index.js" type="typescript" />`
which would hint to the browser that it should actually request `/index.ts` and/or
transform the TypeScript result. Doing so further forks the dev and prod builds though,
since you'd need to change that `<script />` tag in production, since you don't want to
ship TypeScript to real users (and this feature would be disabled by default, since it
wouldn't be a real standard).

Serving dependencies is still the same problem even if this approach is implemented in
browsers since you'll still be reliant on native ES modules and import maps to resolve
served NPM dependencies. The same divergences with dev and prod also still exist.

Ultimately, I don't think a browser implementing this proposal would meaningfully
improve its usability.

## Local development

Install the [pinned version of Node.js](/.nvmrc) or use `nvm use` to do this
automatically.

Then build the extension with:

```shell
npm run build
```

This will generate a `dist/extension/` directory with the extension contents. To install
it in Firefox:

1.  Visit `about:debugging`.
1.  Click "This Firefox" in the left tab bar.
1.  Click "Load temporary Add-on..." and pick any file under `dist/extension/`.

You'll also want to enable import maps since they are disabled by default and required
for the demo of a [Lit](https://lit.dev/) component.

1.  Visit `about:config`.
1.  Set `dom.importMaps.enable` to `true`.

Next, run the example application with:

```shell
npm run serve
```

And then open your browser and visit [http://localhost:8080/](http://localhost:8080)
and the site should work despite serving pure TypeScript and not having a build step.
