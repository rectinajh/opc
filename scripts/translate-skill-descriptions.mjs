import fs from "node:fs";
import path from "node:path";

function readDeepSeekToken() {
  const cfg = fs.readFileSync(path.join(process.env.HOME, ".codex", "config.toml"), "utf8");
  const m = cfg.match(/experimental_bearer_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("DeepSeek token not found in config.toml");
  return m[1];
}

function extractFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
  return m ? { fm: m[1], start: 0, end: m[0].length } : null;
}

function getDescription(fm) {
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^description:/.test(lines[i])) {
      const inline = lines[i].replace(/^description:\s*/, "");
      if (inline.length > 0 && !/^>/.test(inline)) return { value: inline.replace(/\s+/g, " ").trim(), start: i, end: i };
      // block scalar
      let end = i + 1;
      while (end < lines.length && /^[ \t]+/.test(lines[end])) end++;
      const block = lines.slice(i + 1, end).map((l) => l.trim()).join(" ").replace(/\s+/g, " ").trim();
      return { value: block, start: i, end };
    }
  }
  return null;
}

function setDescription(fm, zh) {
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^description:/.test(lines[i])) {
      const inline = lines[i].replace(/^description:\s*/, "");
      let end = i + 1;
      if (inline.length === 0 || /^>/.test(inline)) {
        while (end < lines.length && /^[ \t]+/.test(lines[end])) end++;
      }
      const before = lines.slice(0, i);
      const after = lines.slice(end);
      return [...before, `description: ${zh}`, ...after].join("\n");
    }
  }
  return fm;
}

function collectFiles(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (/node_modules|\.git/.test(entry.name)) continue;
      out.push(...collectFiles(p));
    } else if (entry.name === "SKILL.md") {
      out.push(p);
    }
  }
  return out;
}

async function translate(text) {
  const token = readDeepSeekToken();
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "Translate the given English skill description into concise, natural Simplified Chinese for a UI card. " +
            "Keep technical proper nouns (Paperclip, Agent Skills, GitHub, Ramp, MCP, ASD-STE100, etc.) in English when appropriate. " +
            "Return ONLY the Chinese translation, no quotes, no explanation. It must be at least 40 Chinese characters.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  let out = data.choices?.[0]?.message?.content ?? "";
  out = out.trim().replace(/^["']|["']$/g, "");
  return out;
}

async function main() {
  const roots = ["packages/skills-catalog/catalog", "skills"];
  const files = roots.flatMap((r) => collectFiles(r));
  console.log("SKILL.md files:", files.length);
  let count = 0;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const parsed = extractFrontmatter(content);
    if (!parsed) continue;
    const desc = getDescription(parsed.fm);
    if (!desc || !desc.value) continue;
    const zh = await translate(desc.value);
    if (!zh) continue;
    const newFm = setDescription(parsed.fm, zh);
    const newContent = "---\n" + newFm + "\n---\n" + content.slice(parsed.end);
    fs.writeFileSync(file, newContent);
    count++;
    process.stdout.write(`\rtranslated ${count}  ${path.relative(".", file)}`);
  }
  process.stdout.write("\n");
  console.log("done, updated", count, "files");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
