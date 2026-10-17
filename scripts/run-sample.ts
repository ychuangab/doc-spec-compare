// 本機用範例文件跑完整流程並對答案：node --env-file=.env.local --experimental-strip-types scripts/run-sample.ts
import { readFile } from "node:fs/promises";
import { compareItems, extractItems, MODEL } from "../lib/gemini.ts";
import { parseFile } from "../lib/parse.ts";
import { score } from "../lib/score.ts";
import { verify } from "../lib/verify.ts";
import type { Report } from "../lib/types.ts";

const dir = new URL("../public/samples/", import.meta.url);
const load = async (n: string) => new File([await readFile(new URL(n, dir))], n);
const t0 = Date.now();
const [tp, sp] = await Promise.all([parseFile(await load("公版_空壓機系統標準規範.docx")), parseFile(await load("送審_空壓機系統規格書.pdf"))]);
const [te, se] = await Promise.all([extractItems(tp.input, "T"), extractItems(sp.input, "S")]);
const t1 = Date.now();
const comparison = await compareItems(te.items, se.items);
const template = { name: "t", ...te, sourceText: tp.sourceText };
const submission = { name: "s", ...se, sourceText: sp.sourceText };
const checks = verify(template, submission, comparison);
const report: Report = { template, submission, comparison, checks, model: MODEL, elapsedMs: Date.now() - t0 };
const key = JSON.parse(await readFile(new URL("../lib/answer_key.json", import.meta.url), "utf8"));
const rows = score(report, key);
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 1));
console.log(`model=${MODEL} extract=${t1 - t0}ms total=${report.elapsedMs}ms T=${te.items.length} S=${se.items.length}`);
for (const r of rows) console.log(r.pass ? "✔" : "✘", r.group, r.label);
console.log(`score ${rows.filter((r) => r.pass).length}/${rows.length}`);
for (const c of checks) console.log(`[${c.level}] ${c.title}: ${c.detail.slice(0, 4).join(" / ")}`);
