# myWorkoutApp · FORM

Vue 3 健身管理 App：英文／繁體中文、手機優先、本機資料保存，包含動作篩選、課表播放、訓練紀錄、六軸雷達圖、飲食及身體數據統計。

- [GitHub Pages](https://superrakce.github.io/myWorkoutApp/)
- [測試與部署狀態](https://github.com/superrakce/myWorkoutApp/actions)
- [開發說明與第一版限制](document/development.md)
- [需求規格](document/rfq.txt)
- [CI、部署與雲端接續說明](document/ci-deployment.md)

## 本機啟動

使用 Node.js 22：

```sh
npm ci
npm run dev
```

## 驗證

```sh
npm test
npm run test:e2e
npm run build
```

本機瀏覽器測試預設使用 Edge；CI 使用 Playwright Chromium。每次推送及 PR 會自動測試並建置，只有 `main` 通過後部署至 Pages。

所有開發文件、需求、素材紀錄及研究資料集中於 `document/`。套件快取、產出檔及瀏覽器測試輸出不提交至 Git，由 CI 重建。

動作圖目前為原創占位圖；食品使用示例營養值，正式姿勢示範、食品及 MET 資料集仍待核對。資料保存在瀏覽器 IndexedDB；本機網址與 Pages 網址的資料彼此獨立，可用 JSON 備份搬移。
