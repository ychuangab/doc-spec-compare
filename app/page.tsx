"use client";

import { useRef, useState } from "react";
import answerKey from "@/lib/answer_key.json";
import { toCsv, toMarkdown } from "@/lib/export.ts";
import type { Report, StreamEvent } from "@/lib/types.ts";
import { DropZone } from "./components/DropZone.tsx";
import { ReportView } from "./components/ReportView.tsx";

const SAMPLE_T = "公版_空壓機系統標準規範.docx";
const SAMPLE_S = "送審_空壓機系統規格書.pdf";
const REPO_URL = "https://github.com/ychuangab/doc-spec-compare";

type Stage = "parse" | "extract" | "compare" | "verify";
const STEPS: { key: Stage; name: string; desc: string }[] = [
  { key: "parse", name: "讀取文件", desc: "DOCX 取文字，PDF 交給模型直接讀（含掃描檔）" },
  { key: "extract", name: "拆解要求", desc: "兩份文件同時拆成逐條要求，原文逐字保留" },
  { key: "compare", name: "逐條比對", desc: "依功能對照而非條號，分成相同、差異、缺漏、新增" },
  { key: "verify", name: "程式驗證", desc: "核對引用原文、歸類完整性、相同條文的數值" },
];

type StepState = Record<Stage, { status: "idle" | "running" | "done"; detail?: string }>;
const initialSteps = (): StepState => ({
  parse: { status: "idle" },
  extract: { status: "idle" },
  compare: { status: "idle" },
  verify: { status: "idle" },
});

async function fetchSample(name: string): Promise<File> {
  const res = await fetch(`/samples/${encodeURIComponent(name)}`);
  return new File([await res.blob()], name);
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Page() {
  const [template, setTemplate] = useState<File | null>(null);
  const [submission, setSubmission] = useState<File | null>(null);
  const [steps, setSteps] = useState<StepState>(initialSteps);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function run(t: File, s: File, sample: boolean) {
    setRunning(true);
    setReport(null);
    setError(null);
    setIsSample(sample);
    setSteps(initialSteps());
    const started = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => setElapsed(Date.now() - started), 500);

    try {
      const body = new FormData();
      body.append("template", t);
      body.append("submission", s);
      const res = await fetch("/api/compare", { method: "POST", body });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `伺服器錯誤 ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as StreamEvent;
          if (e.type === "stage") {
            setSteps((prev) => ({ ...prev, [e.stage]: { status: e.status === "start" ? "running" : "done", detail: e.detail } }));
          } else if (e.type === "result") {
            setReport(e.report);
          } else {
            throw new Error(e.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (timer.current) clearInterval(timer.current);
      setRunning(false);
    }
  }

  async function runSample() {
    const [t, s] = await Promise.all([fetchSample(SAMPLE_T), fetchSample(SAMPLE_S)]);
    setTemplate(t);
    setSubmission(s);
    run(t, s, true);
  }

  return (
    <main>
      <h1>規格書比對助手</h1>
      <p className="lead">
        上傳公版規範與廠商送審規格書，AI 逐條比對，輸出「規格差異、送審缺漏、送審新增」三張表；
        引用原文與歸類完整性再由程式核對，不只相信模型。
      </p>
      <div className="tags">
        <span className="tag">Gemini 結構化輸出</span>
        <span className="tag">兩階段：拆解 → 比對</span>
        <span className="tag">程式驗證</span>
        <span className="tag">Next.js</span>
      </div>

      <section className="card">
        <h2>1. 上傳文件</h2>
        <div className="uploads">
          <DropZone role="公版規範（比較基準）" file={template} onFile={setTemplate} disabled={running} />
          <DropZone role="送審規格書（待審文件）" file={submission} onFile={setSubmission} disabled={running} />
        </div>
        <div className="actions">
          <button className="primary" disabled={running || !template || !submission} onClick={() => run(template!, submission!, false)}>
            開始比對
          </button>
          <button disabled={running} onClick={runSample}>用範例文件比對</button>
          <span className="small">
            範例：<a href={`/samples/${SAMPLE_T}`} download>公版 DOCX</a>、<a href={`/samples/${SAMPLE_S}`} download>送審 PDF</a>
            （虛構的空壓機規範，預埋 13 處差異與 3 個陷阱）
          </span>
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          支援 DOCX、PDF、TXT，每份 2 MB、PDF 10 頁以內。檔案只用於本次比對，不保存。請勿上傳機密文件。
        </p>
      </section>

      <section className="card">
        <h2>
          2. 處理流程 {(running || report) && <span className="small">（{((report?.elapsedMs ?? elapsed) / 1000).toFixed(0)} 秒）</span>}
        </h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`step ${steps[s.key].status}`}>
              <div className="no">步驟 {i + 1}</div>
              <div className="name">{s.name}</div>
              <div className="desc">{steps[s.key].detail ?? s.desc}</div>
            </div>
          ))}
        </div>
        {error && <div className="error-box">比對失敗：{error}</div>}
      </section>

      {report && (
        <>
          <div className="actions">
            <button onClick={() => download("比對報告.md", toMarkdown(report), "text/markdown")}>下載 Markdown</button>
            <button onClick={() => download("比對報告.csv", toCsv(report), "text/csv")}>下載 CSV</button>
          </div>
          <ReportView report={report} answerKey={isSample ? answerKey : null} />
        </>
      )}

      <footer>
        原型來自實際工作：審查廠商送審規格與集團公版的差異。公開版改用虛構文件重新實作。
        原始碼：<a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </main>
  );
}
