import { compareItems, extractItems } from "@/lib/gemini.ts";
import { parseFile } from "@/lib/parse.ts";
import { allow } from "@/lib/ratelimit.ts";
import type { ParsedDoc, StreamEvent } from "@/lib/types.ts";
import { verify } from "@/lib/verify.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

// 回應為 NDJSON：每行一個事件，前端據此更新進度，最後一行是報告或錯誤
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!allow(ip)) {
    return Response.json({ error: "使用次數過多，請 10 分鐘後再試" }, { status: 429 });
  }
  const form = await req.formData();
  const tFile = form.get("template");
  const sFile = form.get("submission");
  if (!(tFile instanceof File) || !(sFile instanceof File)) {
    return Response.json({ error: "請同時上傳公版與送審文件" }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(JSON.stringify(e) + "\n"));
      const started = Date.now();
      try {
        send({ type: "stage", stage: "parse", status: "start" });
        const [tp, sp] = await Promise.all([parseFile(tFile), parseFile(sFile)]);
        send({ type: "stage", stage: "parse", status: "done" });

        send({ type: "stage", stage: "extract", status: "start" });
        const [{ model: m1, ...te }, { model: m2, ...se }] = await Promise.all([
          extractItems(tp.input, "T"),
          extractItems(sp.input, "S"),
        ]);
        send({ type: "stage", stage: "extract", status: "done", detail: `公版 ${te.items.length} 條、送審 ${se.items.length} 條` });

        send({ type: "stage", stage: "compare", status: "start" });
        const { data: comparison, model: m3 } = await compareItems(te.items, se.items);
        send({
          type: "stage",
          stage: "compare",
          status: "done",
          detail: `差異 ${comparison.diffs.length}、缺漏 ${comparison.missing.length}、新增 ${comparison.added.length}`,
        });

        send({ type: "stage", stage: "verify", status: "start" });
        const template: ParsedDoc = { name: tFile.name, ...te, sourceText: tp.sourceText };
        const submission: ParsedDoc = { name: sFile.name, ...se, sourceText: sp.sourceText };
        const checks = verify(template, submission, comparison);
        send({ type: "stage", stage: "verify", status: "done" });

        // 全文只在伺服器端核對用，不回傳
        send({
          type: "result",
          report: {
            template: { ...template, sourceText: null },
            submission: { ...submission, sourceText: null },
            comparison,
            checks,
            model: [...new Set([m1, m2, m3])].join("、"),
            elapsedMs: Date.now() - started,
          },
        });
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg.length > 300 ? msg.slice(0, 300) + "…" : msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
