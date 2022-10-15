# TypeScript Transformer Extension

A browser extension which watches the network for TypeScript source code and transforms
them to JavaScript.

This is an alternative approach to the
[JavaScript type annotations TC39 proposal](https://github.com/tc39/proposal-type-annotations/)
which should provide many of the same technical benefits without requiring changes to
the language specification.

## Local development

Install the [pinned version of Node.js](/.nvmrc) or use `nvm use` to do this
automatically.

Then build the extension with:

```shell
npm run build
```

This will generate a `dist/` directory with the extension contents. To install it in
Chrome:

1. Visit [chrome://extensions](chrome://extensions).
1. Check "Developer mode" in the top right.
1. Click the newly visible "Load unpacked" button in the top left.
1. Select the `dist/` directory of the built application.

Next, run the example application with:

```shell
npm run serve
```

And then open your browser and visit [http://localhost:8080/](http://localhost:8080)
and the site should work despite serving pure TypeScript and not having a build step.
