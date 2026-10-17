"use client";

import { useEffect, useRef, useState } from "react";
import answerKey from "@/lib/answer_key.json";
import type { Report, StreamEvent } from "@/lib/types.ts";
import { AgentGraph, type NodeState } from "./components/AgentGraph.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { ReportView } from "./components/ReportView.tsx";

const SAMPLE_T = "公版_空壓機系統標準規範.docx";
const SAMPLE_S = "送審_空壓機系統規格書.pdf";
const REPO_URL = "https://github.com/ychuangab/doc-spec-compare";

type Stage = "parse" | "extract" | "compare" | "verify";
type Nodes = Record<Stage, NodeState>;
const idle = (): Nodes => ({ parse: { status: "idle" }, extract: { status: "idle" }, compare: { status: "idle" }, verify: { status: "idle" } });

async function fetchSample(name: string): Promise<File> {
  const res = await fetch(`/samples/${encodeURIComponent(name)}`);
  return new File([await res.blob()], name);
}

export default function Page() {
  const [template, setTemplate] = useState<File | null>(null);
  const [submission, setSubmission] = useState<File | null>(null);
  const [nodes, setNodes] = useState<Nodes>(idle);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const autoRan = useRef(false);

  async function run(t: File, s: File, sample: boolean) {
    setRunning(true);
    setReport(null);
    setError(null);
    setIsSample(sample);
    setNodes(idle());
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 500);
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
            setNodes((p) => ({ ...p, [e.stage]: { status: e.status === "start" ? "running" : "done", detail: e.detail } }));
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
      clearInterval(timer);
      setRunning(false);
    }
  }

  async function runSample() {
    const [t, s] = await Promise.all([fetchSample(SAMPLE_T), fetchSample(SAMPLE_S)]);
    setTemplate(t);
    setSubmission(s);
    run(t, s, true);
  }

  // 網址帶 ?sample=1 時自動跑範例，方便從作品集一鍵展示
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (new URLSearchParams(window.location.search).get("sample") === "1") runSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主代理：任一步驟執行中就亮，全部完成才打勾
  const busy = Object.values(nodes).some((n) => n.status === "running");
  const main: NodeState = report
    ? { status: "done", detail: `已彙整三表・${(report.elapsedMs / 1000).toFixed(0)} 秒` }
    : busy
      ? { status: "running", detail: `處理中・${(elapsed / 1000).toFixed(0)} 秒` }
      : { status: "idle" };

  return (
    <>
      <header className="topbar">
        <span className="spark">✦</span>
        <span className="name">規格書比對助手</span>
        <span className="kind">Agent</span>
        <span className="spacer" />
        <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a>
      </header>

      <main>
        <AgentGraph main={main} extract={nodes.extract} compare={nodes.compare} verify={nodes.verify} />

        <section className="composer">
          <div className="attachments">
            <DropZone role="公版規範" file={template} onFile={setTemplate} disabled={running} />
            <DropZone role="送審規格書" file={submission} onFile={setSubmission} disabled={running} />
          </div>
          <p className="prompt">比對整份送審文件與公版，輸出規格差異、缺漏、新增三表。</p>
          <div className="composer-actions">
            <button className="sample" disabled={running} onClick={runSample}>▶ 跑範例</button>
            <span className="hint">
              <a href={`/samples/${SAMPLE_T}`} download>公版.docx</a>・<a href={`/samples/${SAMPLE_S}`} download>送審.pdf</a>
            </span>
            <span className="spacer" />
            <button className="primary" disabled={running || !template || !submission} onClick={() => run(template!, submission!, false)}>
              {running ? "比對中…" : "送出"}
            </button>
          </div>
          {error && <div className="error-box">⚠ {error}</div>}
        </section>

        {report && <ReportView report={report} answerKey={isSample ? answerKey : null} />}

        <footer>DOCX／PDF／TXT，每份 2 MB 內・範例為虛構文件・檔案不保存</footer>
      </main>
    </>
  );
}
