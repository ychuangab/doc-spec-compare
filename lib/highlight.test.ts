import assert from "node:assert/strict";
import { test } from "node:test";
import { markAgainst, replaceIds } from "./highlight.ts";

const marked = (segs: { text: string; mark: boolean }[]) => segs.filter((s) => s.mark).map((s) => s.text.trim());

test("只標出對方沒有的數值與等級", () => {
  const t = "3.6 運轉噪音於機體 1 m 處量測不得超過 72 dB(A)。";
  const s = "噪音｜75 dB(A) 以下（距機體 1 m）";
  assert.deepEqual(marked(markAgainst(t, s)), ["72 dB(A)"]);
  assert.deepEqual(marked(markAgainst(s, t)), ["75 dB(A)"]);
  assert.deepEqual(marked(markAgainst("3.4 驅動馬達效率等級應達 IE4。", "馬達效率等級｜IE3")), ["IE4"]);
});

test("條號不算差異，片段接回原文", () => {
  const segs = markAgainst("2.2 保固不得少於 24 個月", "保固 12 個月");
  assert.equal(segs.map((s) => s.text).join(""), "2.2 保固不得少於 24 個月");
  assert.deepEqual(marked(segs), ["24 個月"]);
});

test("內部編號換成條號", () => {
  const items = new Map([["T13", { id: "T13", loc: "4.2", topic: "", text: "" }]]);
  assert.equal(replaceIds("T13精密過濾器待確認", items), "公版 4.2精密過濾器待確認");
});
