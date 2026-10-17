// 不靠模型的程式驗證：引用原文是否真的存在、每一條是否都被歸類、判為相同的條文數值是否一致。
import type { Check, Comparison, Item, ParsedDoc } from "./types.ts";

// NFKC 統一全半形，去掉所有空白（PDF 抽出的文字常在句中斷行）
export function normalize(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "");
}

// 表格列寫成「列名｜值」，分段各自比對
export function isGrounded(text: string, source: string): boolean {
  const src = normalize(source);
  return text
    .split(/[｜|]/)
    .map(normalize)
    .filter(Boolean)
    .every((frag) => src.includes(frag));
}

// 去掉開頭條號後抽出數值，用來比較兩段文字的數值是否相同
export function numbersOf(text: string): string[] {
  const body = normalize(text).replace(/^(第)?\d+(\.\d+)*(條)?/, "");
  return (body.match(/\d+(\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

export function sameNumbers(a: string, b: string): boolean {
  const na = numbersOf(a);
  const nb = new Set(numbersOf(b));
  return na.every((n) => nb.has(n));
}

function groundingCheck(doc: ParsedDoc, label: string): Check {
  if (doc.sourceText === null) {
    return { level: "warn", title: `${label}原文引用`, detail: ["掃描檔沒有文字層，無法以程式核對引用，請人工對照原檔。"] };
  }
  const bad = doc.items.filter((it) => !isGrounded(it.text, doc.sourceText!));
  if (bad.length === 0) {
    return { level: "ok", title: `${label}原文引用`, detail: [`${doc.items.length} 條引用都能在原文找到。`] };
  }
  return {
    level: "warn",
    title: `${label}原文引用`,
    detail: bad.map((it) => `${it.id}（${it.loc}）在原文找不到逐字對應：「${it.text}」`),
  };
}

function coverageCheck(t: Item[], s: Item[], c: Comparison): Check {
  const tCount = new Map<string, number>();
  const sSeen = new Set<string>();
  const bump = (id: string) => tCount.set(id, (tCount.get(id) ?? 0) + 1);
  c.matched.forEach((m) => { bump(m.t_id); m.s_ids.forEach((x) => sSeen.add(x)); });
  c.diffs.forEach((d) => { bump(d.t_id); d.s_ids.forEach((x) => sSeen.add(x)); });
  c.missing.forEach((m) => bump(m.t_id));
  c.added.forEach((a) => sSeen.add(a.s_id));

  const detail: string[] = [];
  const known = new Set([...t, ...s].map((i) => i.id));
  for (const id of [...tCount.keys(), ...sSeen]) {
    if (!known.has(id)) detail.push(`比對結果引用了不存在的條目 ${id}`);
  }
  for (const it of t) {
    const n = tCount.get(it.id) ?? 0;
    if (n === 0) detail.push(`公版 ${it.loc} 沒有被歸類（相同、差異或缺漏都沒有）`);
    if (n > 1) detail.push(`公版 ${it.loc} 被重複歸類 ${n} 次`);
  }
  for (const it of s) {
    if (!sSeen.has(it.id)) detail.push(`送審 ${it.loc} 沒有被歸類（相同、差異或新增都沒有）`);
  }
  if (detail.length === 0) {
    return { level: "ok", title: "歸類完整性", detail: [`公版 ${t.length} 條、送審 ${s.length} 條全部歸類，沒有重複。`] };
  }
  return { level: "warn", title: "歸類完整性", detail };
}

function numberCheck(t: Item[], s: Item[], c: Comparison): Check {
  const byId = new Map([...t, ...s].map((i) => [i.id, i]));
  const detail: string[] = [];
  for (const m of c.matched) {
    const ti = byId.get(m.t_id);
    const ss = m.s_ids.map((x) => byId.get(x)).filter((x): x is Item => !!x);
    if (!ti || ss.length === 0) continue;
    if (!sameNumbers(ti.text, ss.map((x) => x.text).join(" "))) {
      detail.push(`公版 ${ti.loc} 判為相同，但數值不一致：「${ti.text}」vs「${ss.map((x) => x.text).join("；")}」`);
    }
  }
  if (detail.length === 0) {
    return { level: "ok", title: "相同條文數值複核", detail: [`${c.matched.length} 組判為相同的條文，數值都一致。`] };
  }
  return { level: "warn", title: "相同條文數值複核", detail };
}

export function verify(template: ParsedDoc, submission: ParsedDoc, c: Comparison): Check[] {
  return [
    groundingCheck(template, "公版"),
    groundingCheck(submission, "送審"),
    coverageCheck(template.items, submission.items, c),
    numberCheck(template.items, submission.items, c),
  ];
}
