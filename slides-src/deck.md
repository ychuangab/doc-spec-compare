---
marp: true
size: 16:9
paginate: true
title: 規格書比對助手
style: |
  section {
    background-color: #1b1c1f;
    background-image: radial-gradient(#2c2e33 1.2px, transparent 1.2px);
    background-size: 18px 18px;
    color: #e6e7ea;
    font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
    font-size: 26px;
    padding: 56px 72px;
  }
  section::after { color: #6b6e76; font-size: 16px; }
  h1 { color: #fff; font-size: 52px; margin: 0 0 12px; }
  h2 { color: #fff; font-size: 34px; margin: 0 0 26px; display: flex; align-items: center; gap: 12px; }
  h2::before { content: "✦"; color: #a8c7ff; font-size: 26px; }
  .kicker { color: #a8c7ff; font-size: 18px; letter-spacing: .12em; margin-bottom: 6px; }
  p, li { line-height: 1.6; }
  ul { padding-left: 1.1em; }
  li::marker { color: #7aa7ff; }
  strong { color: #a8c7ff; }
  a { color: #7aa7ff; }
  .muted { color: #9a9ca3; font-size: 20px; }
  .node { border: 1px solid #34363c; border-radius: 14px; overflow: hidden; background: #1e1f22; }
  .node .h { padding: 8px 14px; font-weight: 700; font-size: 20px; color: #fff; }
  .node .b { padding: 10px 14px; font-size: 18px; color: #c9cbd1; line-height: 1.5; }
  .main .h { background: #0b47a8; } .sub .h { background: #4a1f8f; } .code .h { background: #0e6b5c; }
  .flow { display: flex; align-items: stretch; gap: 14px; }
  .flow .node { flex: 1; }
  .arrow { align-self: center; color: #6b6e76; font-size: 28px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
  .shot { width: 100%; border-radius: 10px; border: 1px solid #34363c; display: block; }
  .clip { max-height: 400px; overflow: hidden; border-radius: 10px; }
  .cap { font-size: 17px; color: #9a9ca3; margin-top: 6px; }
  .big { font-size: 64px; font-weight: 800; color: #57c27a; line-height: 1; }
  .stat { border: 1px solid #34363c; border-radius: 14px; padding: 16px 18px; background: #232428; }
  .stat .l { font-size: 18px; color: #9a9ca3; margin-top: 8px; }
---

<!-- _paginate: false -->

<div class="kicker">AI AGENT・DOCUMENT REVIEW</div>

# 規格書比對助手

AI 逐條比對**公版規範**與**廠商送審規格**，輸出差異／缺漏／新增三表

<div class="muted">

Demo　doc-spec-compare.vercel.app
GitHub　github.com/ychuangab/doc-spec-compare

</div>

---

## 實務背景

- 採購審查：廠商送審規格書要逐條對照集團公版規範
- 文件動輒數十頁、掃描 PDF，同一要求散在不同章節與表格
- 人工比對耗時，**數值、單位、適用條件**最容易漏看

<div class="stat" style="margin-top:28px">
實務版在企業 AI 平台設計<strong>單一代理</strong>與<strong>四子代理</strong>兩種方案；26 頁掃描 PDF 可單次完成，規格密集章節再分段複查補回細項。
</div>

---

## 解法架構

<div class="flow">
<div class="node main"><div class="h">① 讀取</div><div class="b">DOCX 取文字<br>PDF 交模型直接讀（含掃描檔）</div></div>
<div class="arrow">→</div>
<div class="node sub"><div class="h">② 拆解代理</div><div class="b">兩份文件並行<br>逐條拆出要求<br>原文逐字保留</div></div>
<div class="arrow">→</div>
<div class="node sub"><div class="h">③ 比對代理</div><div class="b">依功能雙向比對<br>相同／差異／缺漏／新增</div></div>
<div class="arrow">→</div>
<div class="node code"><div class="h">④ 程式驗證</div><div class="b">不經模型<br>核對引用、歸類、數值</div></div>
</div>

<p class="muted" style="margin-top:30px">兩個 LLM 階段都用 JSON Schema 結構化輸出；報告中的原文直接取自第 ② 步，比對階段不重寫原文。</p>

---

## 關鍵設計

<div class="grid3">
<div class="node sub"><div class="h">依功能對照，不依條號</div><div class="b">要求搬到別章、改成表格、合併敘述都不算缺漏；單位不同標「待確認」，不判優劣。</div></div>
<div class="node sub"><div class="h">原文逐字、可回溯</div><div class="b">每條要求帶位置與原文；三表的引用來自抽取結果，差異數值以黃底標出。</div></div>
<div class="node code"><div class="h">不只相信模型</div><div class="b">程式檢查：引用確實在原文、每條剛好歸類一次、判為相同的兩條數值一致。</div></div>
</div>

---

## 操作畫面：輸入與過程

<img class="shot" src="img/graph_running.jpg">
<div class="cap">代理流程圖即進度：拆解代理執行中（主代理亮起、子代理依序完成）</div>
<img class="shot" src="img/composer.jpg" style="margin-top:14px;width:78%">
<div class="cap">附件式上傳公版與送審；「跑範例」一鍵載入虛構範例</div>

---

## 操作畫面：結果

<div class="grid2">
<div><div class="clip"><img class="shot" src="img/diff.jpg"></div><div class="cap">規格差異：數值差異標黃，單位不同標「待確認」</div></div>
<div><div class="clip"><img class="shot" src="img/verify.jpg"></div><div class="cap">程式驗證：引用、歸類完整性、相同條文數值</div></div>
</div>

---

## 驗證成效

<div class="grid2">
<div>
<div class="grid2">
<div class="stat"><div class="big">16/16</div><div class="l">範例檢查點</div></div>
<div class="stat"><div class="big">3/3</div><div class="l">陷阱未誤判</div></div>
</div>

- 預埋 8 差異、3 缺漏、2 新增＋3 陷阱
- 每次 35～50 秒
- 唯一一次 15/16：模型抓到範例裡**漏寫的「安裝」**——錯在答案，已修正範例

</div>
<div><img class="shot" src="img/score.jpg"><div class="cap">用範例跑時自動對答案</div></div>
</div>

---

## 限制與下一步

<div class="grid2">
<div class="node main"><div class="h">限制</div><div class="b">

- 線上展示版：每份 2 MB、PDF 10 頁內
- 模型仍可能誤判，定位為審查輔助
- 不下工程合格與否的結論

</div></div>
<div class="node sub"><div class="h">下一步</div><div class="b">

- 長文件自動分段複查、跨段候選合併
- 審查意見回饋，累積成公司規則庫
- 匯出審查表單，接上既有簽核流程

</div></div>
</div>
