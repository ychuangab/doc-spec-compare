"use client";

import { markAgainst, replaceIds, type Segment } from "@/lib/highlight.ts";
import { score, type AnswerKey } from "@/lib/score.ts";
import type { Item, Report } from "@/lib/types.ts";

function Marked({ segs }: { segs: Segment[] }) {
  return <>{segs.map((s, i) => (s.mark ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}</>;
}

export function ReportView({ report, answerKey }: { report: Report; answerKey: AnswerKey | null }) {
  const items = new Map<string, Item>([...report.template.items, ...report.submission.items].map((i) => [i.id, i]));
  const get = (id: string) => items.get(id);
  const c = report.comparison;
  const rows = answerKey ? score(report, answerKey) : null;

  return (
    <>
      <section className="card">
        <h2>3. 比對結果</h2>
        <p className="small" style={{ marginBottom: 10 }}>
          公版：{report.template.title}　｜　送審：{report.submission.title}　｜　模型 {report.model}
        </p>
        <div className="summary">
          <div className="stat"><div className="n">{c.diffs.length}</div><div className="l">規格差異</div></div>
          <div className="stat"><div className="n">{c.missing.length}</div><div className="l">送審缺漏</div></div>
          <div className="stat"><div className="n">{c.added.length}</div><div className="l">送審新增</div></div>
          <div className="stat"><div className="n">{c.matched.length}</div><div className="l">內容相同</div></div>
        </div>
      </section>

      {rows && (
        <section className="card">
          <h2>範例對答案：{rows.filter((r) => r.pass).length} / {rows.length}</h2>
          <p className="small">範例文件預埋的差異、缺漏、新增，以及不應被列出的陷阱（要求移到別章、內容相同）。</p>
          <div className="score-list">
            {rows.map((r, i) => (
              <div key={i} className={r.pass ? "pass" : "fail"}>
                {r.pass ? "✔" : "✘"} <span className="small">{r.group}</span> {r.label}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>表一　規格差異</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>公版位置</th><th>公版原文</th><th>送審位置</th><th>送審原文</th><th>差異說明</th></tr>
            </thead>
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
                      <span className="badge">{d.kind}</span>
                      {d.uncertain && <span className="badge warn">待確認</span>}
                      {d.summary}
                    </td>
                  </tr>
                );
              })}
              {c.diffs.length === 0 && <tr><td colSpan={5}>本次未發現</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>表二　送審版缺漏</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>公版位置</th><th>公版原文</th><th>查核說明</th></tr></thead>
            <tbody>
              {c.missing.map((m, i) => (
                <tr key={i}>
                  <td className="loc">{get(m.t_id)?.loc}</td>
                  <td>{get(m.t_id)?.text}</td>
                  <td>{m.applicability_unknown && <span className="badge warn">適用性待確認</span>}{m.note}</td>
                </tr>
              ))}
              {c.missing.length === 0 && <tr><td colSpan={3}>本次未發現</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>表三　送審版新增</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>送審位置</th><th>送審原文</th><th>說明</th></tr></thead>
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
      </section>

      <section className="card">
        <h2>補充說明</h2>
        {c.notes.length ? (
          <ul>{c.notes.map((n, i) => <li key={i}>{replaceIds(n, items)}</li>)}</ul>
        ) : (
          <p className="small">無</p>
        )}
        <details style={{ marginTop: 12 }}>
          <summary>內容相同的 {c.matched.length} 組條文</summary>
          <div className="table-wrap">
            <table>
              <thead><tr><th>公版位置</th><th>公版原文</th><th>送審位置</th><th>送審原文</th></tr></thead>
              <tbody>
                {c.matched.map((m, i) => (
                  <tr key={i}>
                    <td className="loc">{get(m.t_id)?.loc}</td>
                    <td>{get(m.t_id)?.text}</td>
                    <td className="loc">{m.s_ids.map((id) => get(id)?.loc).join("、")}</td>
                    <td>{m.s_ids.map((id) => get(id)?.text).join("；")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card">
        <h2>程式驗證</h2>
        <p className="small" style={{ marginBottom: 8 }}>以下檢查不經過模型，由程式對照原文與比對結果。</p>
        <div className="checks">
          {report.checks.map((k, i) => (
            <div key={i} className={`check ${k.level}`}>
              <div className="t">{k.level === "ok" ? "✔" : "⚠"} {k.title}</div>
              <ul>{k.detail.map((d, j) => <li key={j}>{d}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
