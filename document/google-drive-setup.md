# Google 登入與個人 Drive 同步設定

## Google Cloud 管理者需要準備

1. 建立或選擇 Google Cloud 專案，啟用 Google Drive API。
2. 在 Google Auth Platform 的 Branding 設定名稱、支援信箱及開發者聯絡信箱。Audience 選 External；測試階段將實際測試的 Google 帳號加入 Test users。
3. 建立 Web application 類型的 OAuth Client。
4. Authorized JavaScript origins 加入 `https://superrakce.github.io`，不包含 `/myWorkoutApp/` 路徑。本 App 使用 Google Identity Services 彈出式 token 流程，不依賴 redirect URI。
5. Data Access 使用登入基本身分的 `openid email profile`，以及 `https://www.googleapis.com/auth/drive.appdata`。登入與 Drive 權限分兩次由使用者觸發。
6. 在 GitHub 儲存庫 Settings → Secrets and variables → Actions → Variables 新增 Repository variable：`VITE_GOOGLE_CLIENT_ID`，內容為以 `.apps.googleusercontent.com` 結尾的 Web Client ID。此 ID 是公開前端設定。
7. 重新執行 GitHub Actions，新的 Pages 建置才會使用新設定。正式開放所有 Google 帳號前，完成 Google 控制台適用的發布與驗證要求；Testing 狀態僅供加入的測試帳號驗收。

不需要 Client Secret、service account、Google 密碼、API key 或使用者登入權杖。這些內容不得放入前端或 Git。

若沒有設定 Client ID，介面會明示 Google 登入尚未啟用，本機功能仍可使用；不會以測試 ID 假裝正式登入可用。

## 組件分工

- `googleIdentity.js`：載入官方 GIS、以 Google userinfo 確認帳號、分開取得基本及 Drive 授權；access token 僅在記憶體中。
- `googleDrive.js`：限 appDataFolder 與本 App 標記的檔案，處理分頁、下載、上傳、API 錯誤及永久刪除。
- `syncGraph.js`：每筆業務資料的不可變版本圖、刪除標記、冪等合併及衝突解決。
- `stores/app.js`：匿名及 Google 帳號的 IndexedDB 分區、業務資料與 outbox 原子保存。
- `stores/sync.js`：前景同步、授權失效、有限次數退避重試、換帳號中止及操作協調。
- `AccountSyncPanel`、`SyncConflictList`、`GuestImportDialog`：帳號設定、版本選擇及明確的匿名資料匯入預覽。

## 同步協定 v1

資料不以整份 JSON 最後上傳者獲勝。每筆修改建立獨立 UUID 版本檔，含 entity key、父版本、刪除標記與完整紀錄值。檔案上傳後不覆寫；重試產生的同 ID 相同內容會在邏輯層去重，不重複新增訓練或餐點。不同 ID 的新增可合併，同筆不同分支保留兩版本；使用者明確選擇後建立參照所有衝突父版本的新版本。

檔案僅帶有本 App 的 appProperties 標記，保存於每個使用者本人的 appDataFolder。下載資料先驗證版本圖及完整業務格式，再交易式套用。記錄每次確認的雲端檔案；檔案遭外部移除時保留本機內容並停止，需使用者明確選擇重新上傳。

目前協定保留完整版本歷史，尚未進行雲端歷史壓縮；大量長期修改會增加 Drive 檔案數及讀取量。超過處理上限時顯示錯誤並保留本機資料。未提供即時協作或關閉頁面後的背景同步。日後壓縮協定必須另驗證離線舊裝置與刪除標記，不能直接清除舊版本。

重新載入後需要再次 Google 登入才能開啟該帳號資料區；登出後會切回匿名資料區。已載入頁面在斷網時仍可編輯及排隊，登入與取得新授權需要網路。本功能不新增 PWA 離線安裝。

## 驗證

GitHub CI 使用測試 Client ID，攔截 Google 與 Drive 請求，驗證帳號隔離、不同裝置資料載入、離線衝突、權杖失效及不含權杖的備份。單元測試驗證版本圖、刪除、重試、損毀拒絕及存取範圍。

模擬測試不代表 Google Cloud 實際設定已完成。正式 Client ID 設好後，仍須以可控 Google 測試帳號人工確認：彈出授權、拒絕權限、換帳號、兩裝置同步、撤銷授權及 Drive App 資料刪除。不要把真實 token 或健康資料貼進 GitHub Actions。

## 官方參考

- [Google OAuth Web Client 設定](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
- [GIS token 模型](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata)

## 同裝置多分頁

本機 workspace 使用交易式 revision 檢查。舊分頁若讀到舊版本，不能覆寫另一分頁已保存的內容，會提示先匯出本頁備份，再重載並登入；不以最後寫入者勝出。不同裝置仍透過 Drive 版本圖合併。登入、登出與清除本機資料不會刪除雲端資料。

當使用者明確永久刪除雲端副本後，本機歷史仍保留；重新上傳必須再次明確確認，不能直接標示為已同步。測試涵蓋匿名匯入、撤銷授權、永久刪除、明確恢復、清除本機及損毀版本拒絕。
