"use client";

export type NodeState = { status: "idle" | "running" | "done"; detail?: string };

type Props = { main: NodeState; extract: NodeState; compare: NodeState; verify: NodeState };

function Node({ kind, title, desc, s }: { kind: "main" | "sub" | "code"; title: string; desc: string; s: NodeState }) {
  return (
    <div className={`node ${kind} ${s.status}`}>
      <div className="head">
        <span className="spark">{kind === "code" ? "{ }" : "✦"}</span>
        {title}
        <span className="state">{s.status === "done" ? "✓" : s.status === "running" ? "執行中" : ""}</span>
      </div>
      <div className="body">{s.detail ?? desc}</div>
    </div>
  );
}

// 版面沿用企業平台的代理設定圖：主代理在上，子代理在下，虛線連接
export function AgentGraph({ main, extract, compare, verify }: Props) {
  return (
    <div className="graph">
      <div className="row">
        <Node kind="main" title="規格書比對助手" desc="讀取文件、分派子代理、彙整三表" s={main} />
      </div>
      <svg viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden>
        {[50, 150, 250].map((x) => (
          <path key={x} d={`M150 0 C150 24, ${x} 24, ${x} 48`} fill="none" stroke="#6b6e76" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="row">
        <Node kind="sub" title="拆解代理" desc="逐條拆出要求，原文逐字保留" s={extract} />
        <Node kind="sub" title="比對代理" desc="依功能雙向比對，分差異、缺漏、新增" s={compare} />
        <Node kind="code" title="程式驗證" desc="核對引用、歸類完整、數值一致" s={verify} />
      </div>
    </div>
  );
}
