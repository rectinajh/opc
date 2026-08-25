import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("ui/src");
const OUT = path.resolve("scripts/.ui-strings.json");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|\.next|dist|build/i.test(e.name)) continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name) && !/storybook|fixtures|locales/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

const attrRe = /\b(label|placeholder|title|aria-label|description|message|hint|confirm|cancel|name)="([^"]+)"/g;
const textRe = />([^<>{}]{2,120})</g;
const looksEnglish = (v) => /^[A-Za-z][A-Za-z0-9 .,!?()%&:'/+\-]+$/.test(v) && !/^[a-z][a-zA-Z0-9_.:/-]+$/.test(v);

const attrs = new Map();
const texts = new Map();

for (const f of walk(ROOT)) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  attrRe.lastIndex = 0;
  while ((m = attrRe.exec(s))) {
    const v = m[2].trim();
    if (looksEnglish(v)) attrs.set(v, (attrs.get(v) || 0) + 1);
  }
  textRe.lastIndex = 0;
  while ((m = textRe.exec(s))) {
    const v = m[1].trim();
    if (looksEnglish(v)) texts.set(v, (texts.get(v) || 0) + 1);
  }
}

const result = {
  files: walk(ROOT).length,
  attrs: [...attrs.entries()].sort((a, b) => b[1] - a[1]),
  texts: [...texts.entries()].sort((a, b) => b[1] - a[1]),
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("files:", result.files);
console.log("unique attrs:", attrs.size, "total:", [...attrs.values()].reduce((a, b) => a + b, 0));
console.log("unique texts:", texts.size, "total:", [...texts.values()].reduce((a, b) => a + b, 0));
console.log("wrote", OUT);
