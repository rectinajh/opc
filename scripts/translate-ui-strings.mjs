import fs from "node:fs";
import path from "node:path";

const DATA = JSON.parse(fs.readFileSync("scripts/.ui-strings.json", "utf8"));

function readDeepSeekToken() {
  const cfg = fs.readFileSync(path.join(process.env.HOME, ".codex", "config.toml"), "utf8");
  const m = cfg.match(/experimental_bearer_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("DeepSeek token not found in config.toml");
  return m[1];
}

function isEligible(v) {
  if (v.length < 2) return false;
  // Code-like lowercase tokens (statuses, enums, file paths, ids) stay English.
  if (/^[a-z0-9_.,:/#-]+$/.test(v)) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (/\$\{/.test(v)) return false;
  return true;
}

function collect() {
  const set = new Set();
  for (const [v] of DATA.attrs) if (isEligible(v)) set.add(v);
  for (const [v] of DATA.texts) if (isEligible(v)) set.add(v);
  return [...set];
}

async function translateBatch(strings) {
  const token = readDeepSeekToken();
  const req = {
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content:
          "You are a UI localization assistant. Translate each English UI string into concise, natural Simplified Chinese. " +
          "Preserve placeholders like {count}, {name}, {{var}}, %s, and keep product/technical proper nouns in English when necessary (e.g. API, JSON, key names). " +
          "Return ONLY a JSON object where each key is the original English string and each value is its Chinese translation. Do not add commentary.",
      },
      { role: "user", content: JSON.stringify(strings) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 8000,
  };
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

async function main() {
  const strings = collect();
  console.log("eligible strings:", strings.length);
  const mapping = {};
  const BATCH = 60;
  for (let i = 0; i < strings.length; i += BATCH) {
    const chunk = strings.slice(i, i + BATCH);
    const part = await translateBatch(chunk);
    Object.assign(mapping, part);
    process.stdout.write(`\rtranslated ${Math.min(i + BATCH, strings.length)}/${strings.length}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  process.stdout.write("\n");
  fs.writeFileSync("scripts/.ui-translations.json", JSON.stringify(mapping, null, 2));
  console.log("wrote scripts/.ui-translations.json with", Object.keys(mapping).length, "entries");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
