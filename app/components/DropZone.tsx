"use client";

import { useState } from "react";

type Props = { role: string; file: File | null; onFile: (f: File) => void; disabled?: boolean };

// 附件膠囊：點擊選檔或拖曳
export function DropZone({ role, file, onFile, disabled }: Props) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`attach${file ? " filled" : ""}${over ? " over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !disabled) onFile(f);
      }}
    >
      <input
        type="file"
        accept=".docx,.pdf,.txt,.md"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <span>📎</span>
      <span>
        <div className="role">{role}</div>
        <div className="fname">{file ? file.name : "選擇檔案"}</div>
      </span>
    </label>
  );
}
