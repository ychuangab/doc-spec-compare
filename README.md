# 規格書比對助手（doc-spec-compare）

上傳「公版規範」與「廠商送審規格書」，AI 逐條比對，輸出三張表：**規格差異、送審缺漏、送審新增**。
模型的輸出再由程式核對引用原文與歸類完整性，不直接相信模型。

線上展示：https://doc-spec-compare.vercel.app （可直接按「用範例文件比對」）

> 原型來自實際工作：審查廠商送審規格與集團公版的差異，原本在企業內部平台以代理提示詞執行。
> 這個公開版用虛構的「空壓機系統」規範重新實作，不含任何公司文件或資料。

## 流程

```
公版 DOCX/PDF ─┐                         ┌─ 表一 規格差異
               ├─ ① 讀取 ─ ② 拆解要求 ─ ③ 逐條比對 ─┼─ 表二 送審缺漏
送審 DOCX/PDF ─┘   (兩份並行，原文逐字)   (依功能對照) ├─ 表三 送審新增
                                                    └─ ④ 程式驗證
```

1. **讀取**：DOCX 用 mammoth 取文字；PDF 直接交給 Gemini 讀（掃描檔也可），另用 unpdf 取文字層供驗證。
2. **拆解要求**：兩份文件各自拆成逐條要求，`text` 必須逐字複製原文，表格列寫成「列名｜值」。
3. **逐條比對**：模型只看兩份清單（以 T1、S1 編號），依設備、功能與條件對照，而不是依條號。
   規則沿用實務版本：公版為基準；搬到別章或改成表格不算缺漏；單位或計量定義不同標「待確認」，不判斷優劣；不下工程合格結論。
4. **程式驗證**（`lib/verify.ts`，不經模型）：
   - 引用原文：每條 `text` 都必須能在來源全文找到（忽略斷行與全半形）。
   - 歸類完整性：每條公版剛好歸到「相同／差異／缺漏」其中一處，每條送審至少被歸類一次。
   - 相同條文數值複核：被判為「相同」的兩條，數值必須一致。

兩個階段都用 Gemini 結構化輸出（JSON Schema），報告中的原文直接取自第 2 步的抽取結果，比對階段不重寫原文。

## 範例與評分

`public/samples/` 有兩份虛構文件，由 `samples-src/make_samples.py` 產生：

- 公版：`空壓機系統標準規範.docx`，7 章 24 條。
- 送審：`空壓機系統規格書.pdf`，章節順序不同、主要規格改成表格。

預埋 8 處規格差異、3 處缺漏、2 處新增，另有 3 個陷阱（要求移到別章、合併敘述、內容相同），答案在 `lib/answer_key.json`。
用範例比對時，頁面會自動對答案。目前 `gemini-3.8-flash` 在範例上為 16/16，約 30～45 秒。

## 說明簡報

8 頁 Marp 簡報：`/slides/index.html`（PDF：`/slides/deck.pdf`）。原始檔 `slides-src/deck.md`，操作畫面為正式環境截圖（`public/slides/img/`）；重建：`bash slides-src/build.sh`。

## 本機執行

```bash
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY
npm run dev                   # http://localhost:3000
npm test                      # 驗證、對答案、差異標示的單元測試

# 不開網頁，直接用範例跑完整流程並對答案
node --env-file=.env.local --experimental-strip-types scripts/run-sample.ts
```

## 目錄

```
app/page.tsx              上傳、進度、報告頁
app/api/compare/route.ts  NDJSON 串流：每個步驟回報進度，最後回傳報告
lib/prompts.ts            拆解與比對兩段提示詞
lib/gemini.ts             Gemini 呼叫與 JSON Schema
lib/parse.ts              DOCX／PDF／TXT 解析
lib/verify.ts             程式驗證
lib/highlight.ts          差異標示：標出對方沒有的數值與等級
lib/score.ts              範例對答案
lib/export.ts             匯出 Markdown／CSV
```

## 限制

- 線上展示版每份檔案 2 MB、PDF 10 頁以內，並有簡易限流。上傳的檔案只用於當次比對，不保存。
- 模型輸出仍可能有誤，報告是審查輔助，不取代人工判斷。
