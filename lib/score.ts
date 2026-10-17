// 範例案例的對答案：只用在內建範例，上傳的文件沒有答案可對。
import type { Item, Report } from "./types.ts";

export type AnswerKey = {
  diff: { template: string; label: string }[];
  missing: { template: string; label: string }[];
  added: { submission: string; keyword: string; label: string }[];
  traps: { template: string; label: string }[];
};

export type ScoreRow = { group: string; label: string; pass: boolean };

// 從「3.2」「第 3.2 條」「表 主要規格／噪音」等位置字串取出條號
export function clauseOf(loc: string): string | null {
  const m = loc.normalize("NFKC").match(/\d+(\.\d+)+/);
  return m ? m[0] : null;
}

export function score(report: Report, key: AnswerKey): ScoreRow[] {
  const items = new Map<string, Item>(
    [...report.template.items, ...report.submission.items].map((i) => [i.id, i]),
  );
  const tClause = (id: string) => clauseOf(items.get(id)?.loc ?? "");
  const c = report.comparison;
  const diffClauses = new Set(c.diffs.map((d) => tClause(d.t_id)));
  const missingClauses = new Set(c.missing.map((m) => tClause(m.t_id)));

  const rows: ScoreRow[] = [];
  for (const k of key.diff) {
    rows.push({ group: "規格差異", label: k.label, pass: diffClauses.has(k.template) });
  }
  for (const k of key.missing) {
    rows.push({ group: "送審缺漏", label: k.label, pass: missingClauses.has(k.template) });
  }
  for (const k of key.added) {
    const pass = c.added.some((a) => (items.get(a.s_id)?.text ?? "").includes(k.keyword));
    rows.push({ group: "送審新增", label: k.label, pass });
  }
  for (const k of key.traps) {
    // 陷阱條文應判為相同：出現在差異或缺漏都算錯
    const flagged = diffClauses.has(k.template) || missingClauses.has(k.template);
    rows.push({ group: "陷阱（不應列出）", label: k.label, pass: !flagged });
  }
  return rows;
}
