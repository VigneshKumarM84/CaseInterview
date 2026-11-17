# pdf.js (vendored)

Mozilla's [pdf.js](https://mozilla.github.io/pdf.js/), used only by the résumé checker to read the text of an uploaded PDF in the browser.

- Package: `pdfjs-dist` **6.5.438** (released 2026-11-01), the `legacy/build` files, chosen because they support older mobile browsers and also run in Node for the tests.
- Files: `pdf.min.mjs` and `pdf.worker.min.mjs`, copied unchanged from `pdfjs-dist-6.5.438.tgz` on npm.
- Licence: Apache License 2.0. See `LICENSE` in this folder. Copyright Mozilla Foundation and pdf.js contributors.

They are stored in the repository rather than loaded from a CDN so that "nothing leaves your device" is easy to check: the only requests the résumé checker makes are for these two files, from the same site. `src/resume-files.js` loads them with a dynamic `import()` only when a PDF is chosen, so no other page downloads them. It does not set `cMapUrl`, `standardFontDataUrl` or `wasmUrl`, so pdf.js fetches nothing else (text extraction does not need them; some PDFs that rely on external CJK character maps may come out with missing text).

SHA-256:

```
522ad2c83bc8a0010e7f0cc60d0892b77c8d2bf2c9702dc12288311d94270f42  pdf.min.mjs
b4c8353ded0d88d2e2009574a29eb4e0c3ff7e942ecdf51ef5f71566a9667f31  pdf.worker.min.mjs
```

To update: `npm pack pdfjs-dist@<version>`, copy `package/legacy/build/pdf.min.mjs`, `package/legacy/build/pdf.worker.min.mjs` and `package/LICENSE` here, update this file, and run `npm test` with Node 22.13 or newer (the PDF integration tests are skipped on older Node).
