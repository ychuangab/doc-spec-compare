import assert from "node:assert/strict";
import { test } from "node:test";
import { isGrounded, numbersOf, sameNumbers, verify } from "./verify.ts";
import { clauseOf, score } from "./score.ts";
import type { ParsedDoc, Report } from "./types.ts";

test("引用比對忽略 PDF 斷行與全半形", () => {
  const src = "精密過濾器 \n過濾精度 0.01 μm，出口含油量 0.01 \nppm 以下";
  assert.ok(isGrounded("精密過濾器｜過濾精度 0.01 μm，出口含油量 0.01 ppm 以下", src));
  assert.ok(!isGrounded("出口含油量 0.02 ppm 以下", src));
});

test("數值抽取去掉開頭條號", () => {
  assert.deepEqual(numbersOf("3.6 運轉噪音於機體 1 m 處量測不得超過 72 dB(A)。"), ["1", "72"]);
  assert.ok(sameNumbers("4.1 壓力露點應達 3°C 以下。", "乾燥機壓力露點｜3°C 以下"));
  assert.ok(!sameNumbers("3.6 噪音不得超過 72 dB(A)", "噪音｜75 dB(A) 以下（距機體 1 m）"));
});

const doc = (side: string, items: [string, string][], src: string | null): ParsedDoc => ({
  name: side,
  title: side,
  items: items.map(([loc, text], i) => ({ id: `${side[0].toUpperCase()}${i + 1}`, loc, topic: "", text })),
  sourceText: src,
});

test("驗證抓出未歸類、重複歸類與數值不一致", () => {
  const t = doc("template", [["1.1", "保固 24 個月"], ["1.2", "噪音 72 dB"], ["1.3", "附手冊"]], "1.1 保固 24 個月 1.2 噪音 72 dB 1.3 附手冊");
  const s = doc("submission", [["2.1", "保固 12 個月"], ["2.2", "噪音 72 dB"]], "2.1 保固 12 個月 2.2 噪音 72 dB");
  const checks = verify(t, s, {
    matched: [{ t_id: "T1", s_ids: ["S1"] }, { t_id: "T2", s_ids: ["S2"] }],
    diffs: [{ t_id: "T2", s_ids: ["S2"], kind: "數值", summary: "", uncertain: false }],
    missing: [],
    added: [],
    notes: [],
  });
  const byTitle = Object.fromEntries(checks.map((c) => [c.title, c]));
  assert.equal(byTitle["公版原文引用"].level, "ok");
  const cov = byTitle["歸類完整性"].detail.join("\n");
  assert.match(cov, /1\.3 沒有被歸類/);
  assert.match(cov, /1\.2 被重複歸類 2 次/);
  assert.match(byTitle["相同條文數值複核"].detail.join("\n"), /1\.1 判為相同/);
});

test("掃描檔沒有文字層時跳過引用核對", () => {
  const t = doc("template", [["1.1", "x"]], null);
  const checks = verify(t, doc("submission", [], ""), { matched: [], diffs: [], missing: [], added: [], notes: [] });
  assert.equal(checks[0].level, "warn");
});

test("對答案：條號、關鍵字與陷阱", () => {
  assert.equal(clauseOf("第 3.2 條"), "3.2");
  assert.equal(clauseOf("表 主要規格／噪音"), null);
  const report = {
    template: doc("template", [["3.6", "噪音 72"], ["5.2", "Modbus"], ["4.1", "露點 3"]], ""),
    submission: doc("submission", [["表／噪音", "75"], ["3.3", "4G 雲端"]], ""),
    comparison: {
      matched: [],
      diffs: [{ t_id: "T1", s_ids: ["S1"], kind: "數值", summary: "", uncertain: false }],
      missing: [{ t_id: "T2", note: "", applicability_unknown: false }],
      added: [{ s_id: "S2", note: "" }],
      notes: [],
    },
  } as unknown as Report;
  const rows = score(report, {
    diff: [{ template: "3.6", label: "噪音" }],
    missing: [],
    added: [{ submission: "3.3", keyword: "4G", label: "4G" }],
    traps: [
      { template: "5.2", label: "Modbus 移位，不應列為缺漏" },
      { template: "4.1", label: "露點相同，不應列為差異" },
    ],
  });
  assert.deepEqual(rows.map((r) => r.pass), [true, true, false, true]);
});
