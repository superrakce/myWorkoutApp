# GitHub CI、Pages 與雲端開發

## 執行流程

`.github/workflows/ci-pages.yml` 於每次 push、pull request 或手動執行時啟動：

1. 在 GitHub 提供的 Ubuntu 執行環境安裝 Node.js 22。
2. 以 `npm ci` 安裝鎖定套件。
3. 執行單元及本機保存測試。
4. 安裝 Playwright Chromium 與系統相依套件，執行瀏覽器流程測試。
5. 以 `/myWorkoutApp/` 為資產根路徑建置，使用 Chromium 與 WebKit 驗證 PWA 路徑和離線重新載入。
6. 保存測試報告與截圖，保留 14 天。
7. 僅當 `main` 全部成功時，部署經驗證的 `dist` 至 GitHub Pages。

PR 及其他分支執行檢查，不會部署正式網站。部署工作才有 Pages 與 OIDC 寫入權限，不需要個人 Token 或自行設定部署密鑰。相同分支的新執行會取消舊執行，避免舊版覆蓋新版。

## Pages 設定

儲存庫： https://github.com/superrakce/myWorkoutApp

Pages： https://superrakce.github.io/myWorkoutApp/

在儲存庫 Settings → Pages，Source 應選擇 GitHub Actions。部署記錄與結果可在 Actions 的 **Test, build and deploy Pages** 查看。

本機 `npm run build` 預設根路徑 `/`；CI 透過 `VITE_BASE_PATH=/myWorkoutApp/` 覆寫。App 使用 hash 路由，重新整理子頁不需要伺服器重寫設定。

## 雲端 Codex 接續

使用雲端 Codex 對話接續專案，可在任務開始後關閉本機電腦；運算、測試與部署由雲端服務執行。送出新指令與取得程式更新仍需要網路。

專案設定以 `.nvmrc`、`package-lock.json` 與本文件為準。雲端環境準備指令：

```sh
npm ci
npx playwright install --with-deps chromium webkit
```

在 Linux 雲端手動執行瀏覽器測試時使用 `CI=true VITE_GOOGLE_CLIENT_ID=ci-test.apps.googleusercontent.com npm run test:e2e`，以使用 Chromium 並確保測試不誤接既有開發伺服器。雲端環境需允許安裝套件及 Playwright 瀏覽器的網路存取。

正式 PWA 建置會產生 manifest 與 service worker。首次載入和取得更新需要網路；個人訓練與飲食資料保存在使用者自己的瀏覽器，部署僅發布靜態程式。安裝方法與測試指令見 [PWA 開發與安裝](pwa.md)。

## 文件與素材

- `document/rfq.txt`：完整需求。
- `document/ui.txt`：現行介面規格。
- `document/development.md`：現行功能、執行方式及內容界線。
- `document/verification.md`：自動測試及人工驗收紀錄。
- `document/asset-register.json`：原創占位圖的素材紀錄。
- `document/references/`：研究來源及原始規格。
- `test-results/`：當次測試產出的畫面，由 CI 以 artifact 保存，不提交至 Git。
