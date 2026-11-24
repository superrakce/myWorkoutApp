# PWA 開發與安裝

## 安裝到手機

1. 用手機瀏覽器開啟 [myWorkoutApp 正式網站](https://superrakce.github.io/myWorkoutApp/)。
2. **Samsung Android** 使用 Chrome，點右上角「⋮」，選擇安裝選項並確認。依 Chrome 版本，選項可能在「加入主畫面」下。[Google Chrome 安裝說明](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=zh-Hant)
3. **iPhone** 使用 Safari，點「分享」→「加入主畫面」。如果有「打開為網頁 App」選項，請開啟，再點「加入」。[Apple Safari 安裝說明](https://support.apple.com/zh-tw/guide/iphone/-iphea86e5236/ios)
4. 從主畫面開啟 **FORM** 並保持連線，讓這次開啟完成應用程式快取。之後可以用飛航模式開啟 FORM 測試離線載入。

訓練計畫、飲食與身體數據先存入目前 App 的 IndexedDB。手機安裝後可能有獨立的本機資料區。要取得其他裝置或瀏覽器的既有紀錄，可在 App 內登入同一 Google 帳號並完成 Drive 同步，或匯入原裝置匯出的 JSON。離線期間可使用目前工作區已保存的資料。新視窗如需重新登入，請等網路恢復再登入。

## 建置與更新

- `vite.config.js` 使用 Vite PWA 和 Workbox 為正式建置產生 manifest 與 service worker。Manifest 的相對安裝範圍和啟動網址會隨 Pages 子路徑或本機根路徑解析。
- 快取範圍為建置產生的靜態程式、樣式、HTML、manifest 與圖示。Google OAuth、Drive 資料和本機紀錄使用既有授權及資料層。
- 新版 service worker 完成快取後，等待使用舊版的 App 視窗及分頁都關閉再接手。更新在下次開啟時套用，避免訓練中自動重載。
- Drive 同步於前景執行。播放器沿用原本的暫停及檢查點規則。

## 驗證正式建置

```sh
npx playwright install --with-deps chromium webkit
VITE_BASE_PATH=/myWorkoutApp/ npm run build
npx playwright test --config playwright.pwa.config.js
```

GitHub Actions 在上傳 Pages 部署前執行此檢查。Chromium 與 WebKit 測試覆蓋 Pages 子路徑、圖示、離線重新開啟與 IndexedDB 保存。安裝選單和主畫面啟動需在 Samsung 與 iPhone 實機驗收。
