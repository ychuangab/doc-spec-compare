// 報告匯出：Markdown（三表）與 CSV（每列一項，Excel 可直接開）
import { replaceIds } from "./highlight.ts";
import type { Item, Report } from "./types.ts";

function lookup(report: Report) {
  const items = new Map<string, Item>([...report.template.items, ...report.submission.items].map((i) => [i.id, i]));
  const get = (id: string) => items.get(id);
  const locs = (ids: string[]) => ids.map((id) => get(id)?.loc ?? id).join("、");
  const texts = (ids: string[]) => ids.map((id) => get(id)?.text ?? "").join("；");
  return { items, get, locs, texts };
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function toMarkdown(r: Report): string {
  const { items, get, locs, texts } = lookup(r);
  const c = r.comparison;
  const lines = [
    `# 規格書比對報告`,
    ``,
    `- 公版：${r.template.title}（${r.template.name}）`,
    `- 送審：${r.submission.title}（${r.submission.name}）`,
    `- 模型：${r.model}，耗時 ${(r.elapsedMs / 1000).toFixed(0)} 秒`,
    ``,
    `## 表一 規格差異`,
    ``,
    `| 公版位置 | 公版原文 | 送審位置 | 送審原文 | 差異說明 |`,
    `|---|---|---|---|---|`,
    ...c.diffs.map((d) =>
      `| ${cell(get(d.t_id)?.loc ?? "")} | ${cell(get(d.t_id)?.text ?? "")} | ${cell(locs(d.s_ids))} | ${cell(texts(d.s_ids))} | ${cell(d.summary)}${d.uncertain ? "（待確認）" : ""} |`),
    ``,
    `## 表二 送審版缺漏`,
    ``,
    `| 公版位置 | 公版原文 | 查核說明 |`,
    `|---|---|---|`,
    ...c.missing.map((m) =>
      `| ${cell(get(m.t_id)?.loc ?? "")} | ${cell(get(m.t_id)?.text ?? "")} | ${cell(m.note)}${m.applicability_unknown ? "（適用性待確認）" : ""} |`),
    ``,
    `## 表三 送審版新增`,
    ``,
    `| 送審位置 | 送審原文 | 說明 |`,
    `|---|---|---|`,
    ...c.added.map((a) => `| ${cell(get(a.s_id)?.loc ?? "")} | ${cell(get(a.s_id)?.text ?? "")} | ${cell(a.note)} |`),
    ``,
    `## 補充說明`,
    ``,
    ...(c.notes.length ? c.notes.map((n) => `- ${replaceIds(n, items)}`) : ["- 無"]),
    ``,
    `## 程式驗證`,
    ``,
    ...r.checks.flatMap((k) => [`- ${k.level === "ok" ? "通過" : "注意"}：${k.title}`, ...k.detail.map((d) => `  - ${d}`)]),
    ``,
  ];
  return lines.join("\n");
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function toCsv(r: Report): string {
  const { get, locs, texts } = lookup(r);
  const c = r.comparison;
  const rows: string[][] = [["類別", "公版位置", "公版原文", "送審位置", "送審原文", "說明", "待確認"]];
  for (const d of c.diffs) {
    rows.push(["規格差異", get(d.t_id)?.loc ?? "", get(d.t_id)?.text ?? "", locs(d.s_ids), texts(d.s_ids), d.summary, d.uncertain ? "是" : ""]);
  }
  for (const m of c.missing) {
    rows.push(["送審缺漏", get(m.t_id)?.loc ?? "", get(m.t_id)?.text ?? "", "", "", m.note, m.applicability_unknown ? "是" : ""]);
  }
  for (const a of c.added) {
    rows.push(["送審新增", "", "", get(a.s_id)?.loc ?? "", get(a.s_id)?.text ?? "", a.note, ""]);
  }
  // BOM 讓 Excel 正確辨識 UTF-8
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
