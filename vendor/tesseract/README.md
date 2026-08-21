# Vendored text recognition (OCR)

Used by **Quick Command → 📷 Photo** to read a scale ticket, delivery slip,
material label, odometer or business card instead of typing it in. Everything
here runs in the browser on the user's own device — no account, no key, and no
image ever leaves the phone.

| File | Source | Why |
|---|---|---|
| `tesseract.min.js`, `worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) v6.0.1 (Apache-2.0) | The JS wrapper and its web worker |
| `tesseract-core-simd-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) v6.0.0 (Apache-2.0) | The engine itself, for devices with WASM SIMD (nearly all) |
| `tesseract-core-lstm.wasm.js` | same | Fallback for older devices without SIMD (iOS before 16.4) |
| `eng.traineddata` | [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (Apache-2.0) | English language model — the `fast` variant, which is plenty for printed slips |

Only the LSTM builds are vendored (the modern engine); the legacy Tesseract 3
engine isn't used, which halves the download.

## Notes for future changes

- **Not in the service worker's `SHELL` list, on purpose.** These files are ~6 MB
  for a device that scans, and the vast majority of sessions never scan anything.
  They load on first use and the service worker caches them on the way past, so
  the second scan works with no signal.
- **The language model is stored uncompressed** and loaded with `gzip: false`.
  Tesseract normally fetches a `.gz` and unzips it in JS, which breaks whenever a
  host serves `.gz` with `Content-Encoding: gzip` (the browser silently
  decompresses first). Serving it plain sidesteps that entirely — GitHub Pages
  compresses it over the wire anyway, so the transfer size is about the same.
- **`corePath` points at this directory, not a file.** Tesseract appends the
  right core filename itself after feature-detecting SIMD; hardcoding one would
  break the older-device fallback.
- To upgrade, replace the files with matching versions of tesseract.js and
  tesseract.js-core (they are released in lockstep) and re-test a scan.
