# myWorkoutApp · FORM

Vue 3 健身管理 App：英文／繁體中文、手機優先，包含動作篩選、課表播放、訓練紀錄、六軸雷達圖、飲食及身體數據統計。

- [GitHub Pages](https://superrakce.github.io/myWorkoutApp/)
- [測試與部署狀態](https://github.com/superrakce/myWorkoutApp/actions)
- [開發說明與第一版限制](document/development.md)
- [需求規格](document/rfq.txt)
- [Google 登入與個人 Drive 設定](document/google-drive-setup.md)
- [CI、部署與雲端接續說明](document/ci-deployment.md)

## Google 帳號與個人 Drive

保留本機模式；啟用 Google 設定後，每位使用者可登入並另行授權 Drive 同步。課表、訓練、飲食、身體量測與設定保存在本人 Google Drive appDataFolder，不建立集中式會員資料庫。登入授權只暫存在記憶體與同一分頁的 sessionStorage；重新整理先驗證 Google 帳號後恢復同步，過期則保留本機工作區並提示重新連線。

部署管理者需先完成 Google Cloud／OAuth 設定，並在 GitHub Actions 的 Repository Variables 設定公開的 `VITE_GOOGLE_CLIENT_ID`。未設定時會明確顯示登入尚未啟用，本機功能可繼續使用。不要提供 Client Secret、service account 或使用者權杖。

同步保留本機佇列、逐筆版本、刪除標記及衝突選擇。登出／清除此裝置與永久刪除 Drive 副本是不同操作。詳細流程、限制及人工 Google 授權驗收見設定文件。

## 執行與驗證

使用 Node.js 22：

```sh
npm ci
npm run dev
npm test
npm run test:e2e
npm run build
```

本機測試預設使用 Edge；GitHub CI 使用 Chromium。每次 push／PR 執行測試與建置，只有 main 全部通過後才部署 Pages。Google 模擬測試使用測試 Client ID，不接觸個人 Google 帳號或真實健康資料；正式授權需以已設定的 Google 專案驗收。

開發文件集中於 document/。套件、dist、測試輸出及登入憑證不提交至 Git。原創占位圖、示例食品資料及其他第一版界線仍如開發文件所述。

網站網址與瀏覽器帳號資料區彼此獨立；本機網址的舊資料可用 JSON 備份搬移。Drive 同步需要網路與有效授權，不等於 PWA 離線安裝。

