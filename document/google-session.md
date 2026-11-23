# Google 重新整理工作階段

原因：原版帳號及權杖只在記憶體，App 啟動固定讀取 guest 工作區，重新整理後必須再次登入。

修正：
- sessionStorage 記住本分頁的帳號選擇，以及有期限的 access token、到期時間、授權範圍與公開 Client ID。
- App 先開啟原帳號的 IndexedDB 工作區；同步處於恢復中，先向 Google userinfo 驗證身分。驗證成功才可使用 Drive。
- 權杖過期、撤銷或帳號不符只中止雲端連線，保留本機帳號與資料，顯示需要重新授權。
- 網路失敗保留本機工作區及未過期的工作階段，連線恢復時重試。登入恢復期間不開始同步。
- 主動登出清除 sessionStorage 選擇與權杖。不將此狀態放進業務備份或 Drive。
- 此為同一分頁的重新整理恢復，不是永久登入；短效權杖到期仍需操作重新連線。

官方依據：https://developers.google.com/identity/oauth2/web/guides/use-token-model
https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model
