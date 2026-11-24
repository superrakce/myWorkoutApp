# 開發驗證紀錄

## 2026-11-24 · 訓練紀錄與飲食四欄

提交 `5f269ba` 已通過 GitHub Actions 的 72 項單元與保存測試、25 項 Playwright Chromium 瀏覽器測試、正式建置及 GitHub Pages 部署。[Actions 執行紀錄](https://github.com/superrakce/myWorkoutApp/actions/runs/45340177923)

## 測試範圍

- 訓練計畫、Tabata 自動切換、暫停檢查點、重載後繼續、儲存及不儲存的摘要流程。
- 訓練紀錄的鉛筆編輯、有效組數彙總、統計四欄桌面配置及雙欄手機配置。備份還原後仍保留訓練與動作快照。
- 飲食桌面四欄、餐別、克數換算與碳水合計。合成案例以每 100 g 50 g 碳水、實際 80 g 驗證結果為 40 g。缺值與沒有餐點的日期分別驗證。
- 身體量測的五項必填與星號、即時唯讀估算、歷史量測、體重趨勢、重載保存及中英文。
- 總覽快捷入口、深色對話框、緊湊卡片及 360、390、768、1440 px 核心頁寬度。
- Google 授權以測試替身驗證帳號隔離、重載、離線、登出、換帳號、權杖過期、同步衝突和備份。

測試畫面由 Playwright 產生於 `test-results/screenshots/`，報告和畫面由 Actions 保留 14 天，可從執行紀錄的 `test-report` artifact 下載。

## PWA 建置檢查

`tests/pwa/` 使用正式 Pages 子路徑進行測試。Android Chromium 檢查安裝資格，兩種瀏覽器引擎皆檢查 manifest、Apple 主畫面圖示，以及斷網後重開飲食頁、新增餐點、重新載入並讀回。

## 待人工驗收

真實 Google OAuth、跨裝置 Drive 同步、Firefox、iPhone Safari 與 Samsung Android Chrome 的實機安裝、各裝置的音訊和螢幕喚醒，以及長時間計時與大量資料效能仍待人工驗收。正式餐點拍照辨識取決於 OpenAI 授權及真實服務驗證。
