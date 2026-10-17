"use client";

import { useState } from "react";
import { toCsv, toMarkdown } from "@/lib/export.ts";
import { markAgainst, replaceIds, type Segment } from "@/lib/highlight.ts";
import { score, type AnswerKey } from "@/lib/score.ts";
import type { Item, Report } from "@/lib/types.ts";

function Marked({ segs }: { segs: Segment[] }) {
  return <>{segs.map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = "diff" | "missing" | "added" | "verify" | "score";

export function ReportView({ report, answerKey }: { report: Report; answerKey: AnswerKey | null }) {
  const [tab, setTab] = useState<Tab>("diff");
  const items = new Map<string, Item>([...report.template.items, ...report.submission.items].map((i) => [i.id, i]));
  const get = (id: string) => items.get(id);
  const c = report.comparison;
  const rows = answerKey ? score(report, answerKey) : null;
  const passed = rows?.filter((r) => r.pass).length ?? 0;
  const warns = report.checks.filter((k) => k.level !== "ok").length;

  const tabs: [Tab, string][] = [
    ["diff", `規格差異 ${c.diffs.length}`],
    ["missing", `送審缺漏 ${c.missing.length}`],
    ["added", `送審新增 ${c.added.length}`],
    ["verify", `程式驗證${warns ? ` ⚠${warns}` : " ✓"}`],
    ...(rows ? ([["score", `對答案 ${passed}/${rows.length}`]] as [Tab, string][]) : []),
  ];

  return (
    <section className="result">
      <div className="chips">
        <span className="chip"><b>{c.diffs.length}</b> 差異</span>
        <span className="chip"><b>{c.missing.length}</b> 缺漏</span>
        <span className="chip"><b>{c.added.length}</b> 新增</span>
        <span className="chip"><b>{c.matched.length}</b> 相同</span>
        {rows && <span className="chip score">範例命中 <b>{passed}/{rows.length}</b></span>}
        <span className="hint">{(report.elapsedMs / 1000).toFixed(0)} 秒・{report.model}</span>
      </div>

      <div className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "diff" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>公版</th><th>公版原文</th><th>送審</th><th>送審原文</th><th>差異</th></tr></thead>
            <tbody>
              {c.diffs.map((d, i) => {
                const t = get(d.t_id)?.text ?? "";
                const s = d.s_ids.map((id) => get(id)?.text ?? "").join("；");
                return (
                  <tr key={i}>
                    <td className="loc">{get(d.t_id)?.loc}</td>
                    <td><Marked segs={markAgainst(t, s)} /></td>
                    <td className="loc">{d.s_ids.map((id) => get(id)?.loc).join("、")}</td>
                    <td><Marked segs={markAgainst(s, t)} /></td>
                    <td>
                      <span className="tag">{d.kind}</span>
                      {d.uncertain && <span className="tag warn">待確認</span>}
                      {d.summary}
                    </td>
                  </tr>
                );
              })}
              {c.diffs.length === 0 && <tr><td colSpan={5}>本次未發現</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "missing" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>公版</th><th>公版原文</th><th>說明</th></tr></thead>
            <tbody>
              {c.missing.map((m, i) => (
                <tr key={i}>
                  <td className="loc">{get(m.t_id)?.loc}</td>
                  <td>{get(m.t_id)?.text}</td>
                  <td>{m.applicability_unknown && <span className="tag warn">適用性待確認</span>}{m.note}</td>
                </tr>
              ))}
              {c.missing.length === 0 && <tr><td colSpan={3}>本次未發現</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "added" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>送審</th><th>送審原文</th><th>說明</th></tr></thead>
            <tbody>
              {c.added.map((a, i) => (
                <tr key={i}>
                  <td className="loc">{get(a.s_id)?.loc}</td>
                  <td>{get(a.s_id)?.text}</td>
                  <td>{a.note}</td>
                </tr>
              ))}
              {c.added.length === 0 && <tr><td colSpan={3}>本次未發現</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "verify" && (
        <div>
          {report.checks.map((k, i) => (
            <div key={i} className="check">
              <span className={k.level === "ok" ? "pass" : "fail"}>{k.level === "ok" ? "✓" : "⚠"}</span> {k.title}
              <ul>{k.detail.map((d, j) => <li key={j}>{d}</li>)}</ul>
            </div>
          ))}
          {c.notes.length > 0 && (
            <div className="check">
              補充說明
              <ul>{c.notes.map((n, i) => <li key={i}>{replaceIds(n, items)}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {tab === "score" && rows && (
        <div className="score-list">
          {rows.map((r, i) => (
            <div key={i} className={r.pass ? "pass" : "fail"}>
              {r.pass ? "✓" : "✗"} <span className="hint">{r.group}</span> {r.label}
            </div>
          ))}
        </div>
      )}

      <div className="exports">
        <button onClick={() => download("比對報告.md", toMarkdown(report), "text/markdown")}>匯出 Markdown</button>
        <button onClick={() => download("比對報告.csv", toCsv(report), "text/csv")}>匯出 CSV</button>
      </div>
    </section>
  );
}
