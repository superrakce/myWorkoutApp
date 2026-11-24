# myWorkoutApp · FORM 開發說明

myWorkoutApp 使用 Vue 3、Vite、Vue Router、Pinia 與 vue-i18n，支援繁體中文與英文。GitHub Pages 託管靜態前端。業務資料先保存於瀏覽器 IndexedDB，使用者可另外授權同步至本人 Google Drive。

## 本機開發

使用 Node.js 22。

```sh
npm ci
npm run dev
```

開啟終端顯示的網址，預設為 `http://127.0.0.1:5173/`。站點使用 hash 路由，可直接載入子頁。

```sh
npm test
npm run build
npm run preview
```

Playwright 流程測試在本機預設使用 Microsoft Edge，可透過 `PLAYWRIGHT_CHANNEL` 選擇本機瀏覽器。GitHub Actions 使用 Chromium 測試一般流程，並以 Chromium 和 WebKit 測試正式 PWA 建置。Google 授權與 Drive API 流程使用測試替身。完整執行方式見 [CI 與部署](ci-deployment.md)。

## 目前功能

| 領域 | 已上線行為 |
| --- | --- |
| 總覽與介面 | 深色主題、桌面側欄與手機底部導覽。頂部提供建立課表、記錄一餐、新增量測與開始訓練。桌面將四張熱量指標卡放在部位分布左側。 |
| 動作庫 | 30 筆雙語內建動作，支援依部位、器材、類型、難度與收藏篩選。內建及自訂動作皆可編輯及刪除。課表與歷史紀錄保留動作快照。 |
| 訓練計畫 | 新課表提供循環訓練與 Tabata，支援編排、複製、收藏及休息設定。既有逐動作課表可依原順序播放。課表顯示六軸雷達圖與預計消耗熱量。 |
| 播放與紀錄 | Tabata 一次開始、依秒數自動切換階段。支援暫停、繼續、跳過、提前結束與重載後恢復暫停。摘要可儲存訓練紀錄或不儲存並離開。紀錄頁支援手動新增、鉛筆編輯、刪除及區間雷達與四欄統計。 |
| 飲食 | 支援餐別、食物查詢、自訂食物、份量換算、營養素及複製餐點。桌面四欄餐別與四欄統計，其中碳水合計依實際份量換算。當天任一餐缺少該營養素時，以破折號顯示該項總量。 |
| 身體數據 | 單一量測日期與時間，依量測當日年齡與公式性別參數計算。BMI、除脂體重與估計靜息代謝可即時預覽，保存後用於歷史及趨勢。 |
| 資料管理 | 訪客與各 Google 帳號分開保存。支援 Google Drive 個別紀錄同步、衝突處理、JSON 備份與還原、CSV 匯出及清除本機資料。 |

詳細介面見 [UI 規格](ui.txt)。正式站的飲食以查詢及手動輸入為主。拍照估算仍在開發，使用者 ChatGPT 方案額度的授權申請已收件並待核准。追蹤狀態見 [待辦 #3](https://github.com/superrakce/myWorkoutApp/issues/3)。

## 資料與程式分工

- `src/data/` 保存雙語內建動作、示例食物與課表模板。
- `src/services/domain.js` 處理課表順序、分布、日期與熱量估算。`src/services/bodyProfile.js` 處理量測日期與年齡的關係。
- `src/repositories/database.js` 驗證匯入格式並封裝 IndexedDB 交易。`src/stores/` 協調分區、持久化與同步。
- `src/composables/usePlayer.js` 處理播放器、暫停及檢查點。`src/views/` 與 `src/components/` 組合雙語頁面及元件。

未同步的修改保存在目前工作區。本機檢查點可在同一瀏覽器恢復，播放器用 Web Locks 避免多分頁同時控制。Google 權杖暫存在本分頁的 sessionStorage 和記憶體，JSON 備份與 Drive 紀錄皆排除權杖。分區及衝突處理見 [Google Drive 設定](google-drive-setup.md) 與 [Google 工作階段](google-session.md)。

## 內容與驗收範圍

- 動作詳情中的 SVG 是自有占位圖。正式姿勢圖與循環動圖仍待製作及審查。
- 初始食品為 12 筆示例營養值。正式食藥署食品資料集與 Compendium 活動代碼仍待整理及核對。
- 課表預計消耗使用適用的體重、使用者填寫的 MET 和有效運動時間。全計時課表使用工作秒數，含計次動作的課表可填有效運動分鐘。簡化熱量收支採攝取減靜息代謝及運動淨消耗。
- PWA 可從手機瀏覽器安裝。首次連線開啟後，可離線載入核心頁面及編輯本機資料。Drive 同步在 App 開啟且連線、授權有效時執行。安裝、更新及本機資料搬移見 [PWA 開發與安裝](pwa.md)。
- 手機實機、其他目標瀏覽器、長時間計時及大量資料效能的驗收狀態見 [驗證紀錄](verification.md)。
