// 上傳檔案轉成模型輸入與驗證用全文。DOCX、TXT 給模型純文字；PDF 直接交給模型讀（掃描檔也能處理），
// 另外用 unpdf 取文字層，只供程式核對引用。
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { DocInput } from "./gemini.ts";

export const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PDF_PAGES = 10;

export type Parsed = { input: DocInput; sourceText: string | null };

export async function parseFile(file: File): Promise<Parsed> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} 超過 2 MB`);
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    if (!value.trim()) throw new Error(`${file.name} 讀不到文字`);
    return { input: { kind: "text", text: value }, sourceText: value };
  }
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = new TextDecoder().decode(buf);
    return { input: { kind: "text", text }, sourceText: text };
  }
  if (name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(buf.slice());
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`${file.name} 超過 ${MAX_PDF_PAGES} 頁，線上展示版只收短文件`);
    const { text } = await extractText(pdf, { mergePages: true });
    // 幾乎沒有文字層就視為掃描檔，跳過程式核對
    const hasText = text.replace(/\s/g, "").length > 50;
    return { input: { kind: "pdf", data: buf }, sourceText: hasText ? text : null };
  }
  throw new Error(`${file.name} 格式不支援，請上傳 DOCX、PDF 或 TXT`);
}
