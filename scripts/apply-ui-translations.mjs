import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("ui/src");
const mapping = JSON.parse(fs.readFileSync("scripts/.ui-translations.json", "utf8"));

const ATTR_NAMES = "label|placeholder|title|aria-label|description|message|hint|confirm|cancel";
const attrRe = new RegExp(`\\b(${ATTR_NAMES})="([^"]*)"`, "g");
const textRe = /(?<!=)>([^<>{}]+)</g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|\.next|dist|build/i.test(e.name)) continue;
      walk(p, out);
    } else if (/\.tsx$/.test(e.name) && !/\.(test|spec)\./.test(e.name) && !/storybook|fixtures|locales/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

function translateAttr(value) {
  const key = value.trim();
  const zh = mapping[key];
  if (!zh || /[<>"]/.test(zh)) return value;
  return value.replace(key, zh);
}

function translateText(text) {
  const key = text.trim();
  if (/\bas\b/.test(key)) return text;
  const zh = mapping[key];
  if (!zh || /[<>"]/.test(zh)) return text;
  return text.replace(key, zh);
}

let totalReplacements = 0;
const changedFiles = [];

for (const file of walk(ROOT)) {
  const original = fs.readFileSync(file, "utf8");
  let s = original;
  let n = 0;
  s = s.replace(attrRe, (m, attr, value) => {
    const out = translateAttr(value);
    if (out !== value) n++;
    return `${attr}="${out}"`;
  });
  s = s.replace(textRe, (m, text) => {
    const out = translateText(text);
    if (out !== text) n++;
    return `>${out}<`;
  });
  if (n > 0) {
    fs.writeFileSync(file, s);
    totalReplacements += n;
    changedFiles.push(path.relative(ROOT, file));
  }
}

console.log("replacements:", totalReplacements);
console.log("changed files:", changedFiles.length);
