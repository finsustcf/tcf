# 公平待客暨金融友善資訊平台

這是可直接部署至 GitHub Pages 的靜態介面預覽，以公開資訊樣本呈現工作流程。

## 使用方式

1. 將這個資料夾的所有檔案（包含 vendor）放入 GitHub repository 的根目錄。
2. 在 repository 的 Settings → Pages，選擇 Deploy from a branch，指定 main 與 /(root)。
3. 開啟產生的 GitHub Pages 網址。

不需 npm install 或編譯。所有資源採相對路徑，可支援 GitHub Pages 的 repository 子路徑。

也可使用本機靜態伺服器開啟。部分瀏覽器在 file:// 下限制儲存，建議使用 HTTP。

## 目前功能

- 資訊總覽、資訊庫、主題及年度分布、同業觀測、週報工作台、來源規劃。
- 搜尋、主題及日期篩選、收藏、選入週報、人工確認、整理筆記。
- 手動新增公開資訊與來源。
- 匯出真正的 .xlsx、.docx、.pptx，保留原始公開網址、日期性質及確認狀態。
- 所有操作在目前瀏覽器的 localStorage 保存；不會上傳筆記或資料。
- 網站中的十則樣本來自公開網頁或 PDF，整理日期為 2026-10-13。摘要及參考判讀為人工整理示範，未呼叫 AI。

自動抓取、定時排程、Gemini 判讀、多使用者同步及登入功能尚未實作。

## Firebase 接續架構

- GitHub Pages：維持前端靜態部署。
- Cloud Firestore：articles（資訊）、events（事件與去重）、sources（公開來源設定）、reports（確認後的報告快照）。
- Cloud Functions for Firebase：公開來源擷取、清理、分類、摘要及資料驗證。
- 排程函式：定時增量蒐集，保留失敗紀錄與資料涵蓋範圍。
- Gemini API：由後端呼叫；金鑰存入 Cloud Secret Manager，透過 defineSecret 綁定函式。不要把 Gemini 金鑰寫入前端或 GitHub。
- 寫入 Firestore 的管理操作搭配 Authentication、Security Rules 及適當的存取控制。

先核對公開來源的使用方式。建議 API 的文章資料格式沿用 data.js 的欄位，另加入 eventId、retrievedAt、analysisVersion、reviewedAt 及 evidence。讓人工摘要與 AI 判讀有明確的 provenance。

正式的趨勢分析以去重事件數計算，並顯示抓取涵蓋範圍；此介面預覽只按樣本數統計。未標示日期的專區不納入時間分布。

Firebase 官方參考：

- https://firebase.google.com/docs/functions/config-env
- https://firebase.google.com/docs/functions/schedule-functions

## 檔案

- index.html：頁面入口。
- styles.css：響應式版面。
- data.js：公開資訊樣本、來源及分類。
- app.js：介面、操作與本機草稿。
- exports.js：瀏覽器端 Office 檔案匯出。
- vendor/：離線可用的匯出程式庫與授權文件。

## 匯出使用的程式庫

JSZip 3.10.1、docx 9.6.1、PptxGenJS 4.0.1。授權文件隨附於 vendor。Excel 採 Open XML 封裝；Word 與 PowerPoint 使用上述程式庫。所有檔案在瀏覽器內產製。

## 資料與介面說明

關注程度及分類為示範設定，並非主管機關對事件的正式判斷。報告須依業務需要核對與確認。介面沒有公司的內部文件，也未設定任何雲端金鑰。
