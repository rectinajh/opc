// Applies the hand-authored part of the Simplified Chinese UI overlay.
//
// `scripts/apply-ui-translations.mjs` covers JSX text nodes and a fixed set of
// attributes with a bulk English -> Chinese map. A few screens needed edits a
// string map cannot express:
//
//   * display-label maps keyed by a stable English code (status codes, skill
//     tags) where only the rendered text should be localized,
//   * strings sitting inside JSX expressions (`a ? "x" : "y"`, `?? "x"`,
//     object literals) that the JSX-position scan does not reach,
//   * the default locale.
//
// Those edits live in `.ui-zh-overlay.json` as line-anchored replacements of
// the map-translated source, and are replayed at image build time. The
// committed source therefore stays English and the upstream test suite keeps
// matching the components it tests, while the shipped image stays Chinese.
//
// Each entry is `{ line, remove, text }`: replace `remove` lines starting at
// `line` (1-based, measured on the map-translated source) with `text`. Entries
// are stored bottom-up so an earlier anchor is never shifted by a later edit.
// Every edit is range-checked, so a drifting source file fails the build
// instead of shipping a half-translated UI.

import fs from "node:fs";

const overlayPath = "scripts/.ui-zh-overlay.json";
const entries = JSON.parse(fs.readFileSync(overlayPath, "utf8"));

let applied = 0;
let touched = 0;

for (const { file, edits } of entries) {
  if (!fs.existsSync(file)) {
    throw new Error(`overlay target is missing: ${file}`);
  }

  const lines = fs.readFileSync(file, "utf8").split("\n");
  const trailingNewline = lines[lines.length - 1] === "";
  if (trailingNewline) lines.pop();

  for (const { line, remove, text } of [...edits].sort((a, b) => b.line - a.line)) {
    if (line < 1 || line - 1 + remove > lines.length) {
      throw new Error(`overlay entry is out of range in ${file} at line ${line} (remove ${remove})`);
    }
    const parts = text.split("\n");
    if (parts[parts.length - 1] === "") parts.pop();
    lines.splice(line - 1, remove, ...parts);
    applied++;
  }

  fs.writeFileSync(file, lines.join("\n") + (trailingNewline ? "\n" : ""));
  touched++;
}

console.log(`overlay edits: ${applied} across ${touched} files`);
