// 差異標示：找出一方有、另一方沒有的數值與等級片段。比逐字 diff 適合換句話說的規格文字。
import type { Item } from "./types.ts";

const TOKEN = /IE\d|\d+(?:\.\d+)?\s*(?:%|MPa|m³\/min|dB\(A\)|小時|個月|°C|μm|mg\/m³|ppm|m\b)?/g;

export type Segment = { text: string; mark: boolean };

function stripLoc(text: string): string {
  return text.replace(/^\s*\d+(\.\d+)*\s*/, "");
}

function tokens(text: string): Set<string> {
  return new Set((stripLoc(text).normalize("NFKC").match(TOKEN) ?? []).map((t) => t.replace(/\s+/g, "")));
}

// 把 text 切成片段，other 裡沒有的 token 標記起來
export function markAgainst(text: string, other: string): Segment[] {
  const theirs = tokens(other);
  const out: Segment[] = [];
  const prefix = text.match(/^\s*\d+(\.\d+)*\s*/)?.[0] ?? "";
  if (prefix) out.push({ text: prefix, mark: false });
  const body = text.slice(prefix.length);
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    const tok = m[0].normalize("NFKC").replace(/\s+/g, "");
    if (!m[0].trim() || theirs.has(tok)) continue;
    if (m.index! > last) out.push({ text: body.slice(last, m.index), mark: false });
    out.push({ text: m[0], mark: true });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), mark: false });
  return out;
}

// 補充說明裡模型可能寫出內部編號 T13、S4，換成條號
export function replaceIds(text: string, items: Map<string, Item>): string {
  return text.replace(/\b([TS])(\d+)\b/g, (whole, side: string) => {
    const it = items.get(whole);
    if (!it) return whole;
    return `${side === "T" ? "公版" : "送審"} ${it.loc}`;
  });
}
