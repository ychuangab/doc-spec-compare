import { GoogleGenAI, type Part } from "@google/genai";
import { COMPARE_PROMPT, EXTRACT_PROMPT } from "./prompts.ts";
import type { Comparison, Item } from "./types.ts";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// 主模型忙碌（503／429）時最後一次改用備援模型
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
const ATTEMPTS = [MODEL, MODEL, FALLBACK_MODEL];

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error("伺服器未設定 GEMINI_API_KEY");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const str = { type: "string" };
const strArr = { type: "array", items: str };

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { loc: str, topic: str, text: str },
        required: ["loc", "topic", "text"],
      },
    },
  },
  required: ["title", "items"],
};

const COMPARE_SCHEMA = {
  type: "object",
  properties: {
    matched: {
      type: "array",
      items: { type: "object", properties: { t_id: str, s_ids: strArr }, required: ["t_id", "s_ids"] },
    },
    diffs: {
      type: "array",
      items: {
        type: "object",
        properties: { t_id: str, s_ids: strArr, kind: str, summary: str, uncertain: { type: "boolean" } },
        required: ["t_id", "s_ids", "kind", "summary", "uncertain"],
      },
    },
    missing: {
      type: "array",
      items: {
        type: "object",
        properties: { t_id: str, note: str, applicability_unknown: { type: "boolean" } },
        required: ["t_id", "note", "applicability_unknown"],
      },
    },
    added: {
      type: "array",
      items: { type: "object", properties: { s_id: str, note: str }, required: ["s_id", "note"] },
    },
    notes: strArr,
  },
  required: ["matched", "diffs", "missing", "added", "notes"],
};

function retryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|503|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL)\b/.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 回傳結果與實際使用的模型
async function generateJson<T>(system: string, parts: Part[], schema: object): Promise<{ data: T; model: string }> {
  let lastErr: unknown;
  for (const [i, model] of ATTEMPTS.entries()) {
    try {
      const res = await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          temperature: 0,
        },
      });
      const text = res.text;
      if (!text) throw new Error("模型沒有回傳內容");
      return { data: JSON.parse(text) as T, model };
    } catch (err) {
      lastErr = err;
      if (!retryable(err) || i === ATTEMPTS.length - 1) break;
      await sleep(1500 * (i + 1));
    }
  }
  if (retryable(lastErr)) throw new Error("Gemini 服務暫時忙碌，請稍後再試");
  throw lastErr;
}

export type DocInput =
  | { kind: "text"; text: string }
  | { kind: "pdf"; data: Uint8Array };

export async function extractItems(
  doc: DocInput,
  prefix: "T" | "S",
): Promise<{ title: string; items: Item[]; model: string }> {
  const part: Part =
    doc.kind === "text"
      ? { text: doc.text }
      : { inlineData: { mimeType: "application/pdf", data: Buffer.from(doc.data).toString("base64") } };
  const { data, model } = await generateJson<{ title: string; items: Omit<Item, "id">[] }>(EXTRACT_PROMPT, [part], EXTRACT_SCHEMA);
  return {
    title: data.title,
    items: data.items.slice(0, 80).map((it, i) => ({ id: `${prefix}${i + 1}`, ...it })),
    model,
  };
}

export async function compareItems(template: Item[], submission: Item[]): Promise<{ data: Comparison; model: string }> {
  const fmt = (items: Item[]) => items.map((i) => `${i.id}｜${i.loc}｜${i.topic}｜${i.text}`).join("\n");
  const input = `【公版】\n${fmt(template)}\n\n【送審】\n${fmt(submission)}`;
  return generateJson<Comparison>(COMPARE_PROMPT, [{ text: input }], COMPARE_SCHEMA);
}
