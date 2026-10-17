// 抽取後的單條要求。id 由程式指派：公版 T1、T2…，送審 S1、S2…
export type Item = {
  id: string;
  loc: string; // 條號，或表格位置「表 主要規格／噪音」
  topic: string; // 簡短主題，例如「排氣壓力」
  text: string; // 原文逐字；表格列寫成「列名｜值」
};

export type DocSide = "template" | "submission";

export type ParsedDoc = {
  name: string;
  title: string;
  items: Item[];
  // 程式驗證用的來源全文；掃描 PDF 沒有文字層時為 null
  sourceText: string | null;
};

export type Diff = {
  t_id: string;
  s_ids: string[];
  kind: string; // 數值／範圍／單位／等級／條件／其他
  summary: string;
  uncertain: boolean; // 計量定義不同等需人工確認
};

export type Missing = { t_id: string; note: string; applicability_unknown: boolean };
export type Added = { s_id: string; note: string };
export type Matched = { t_id: string; s_ids: string[] };

export type Comparison = {
  matched: Matched[];
  diffs: Diff[];
  missing: Missing[];
  added: Added[];
  notes: string[]; // 補充說明、待確認事項
};

export type Check = {
  level: "ok" | "warn" | "error";
  title: string;
  detail: string[];
};

export type Report = {
  template: ParsedDoc;
  submission: ParsedDoc;
  comparison: Comparison;
  checks: Check[];
  model: string;
  elapsedMs: number;
};

export type StreamEvent =
  | { type: "stage"; stage: "parse" | "extract" | "compare" | "verify"; status: "start" | "done"; detail?: string }
  | { type: "result"; report: Report }
  | { type: "error"; message: string };
