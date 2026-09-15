# Training OS

個人健身課表管理與訓練紀錄的 PWA。針對一套固定的推／拉／腿課表設計，
目標是在健身房裡用手機比 Excel 更快記完一組，並且直接回答三件事：
今天做什麼、上次拿多少、這次要不要加重量。

## 在 iPhone 上安裝

1. Safari 打開部署好的網址
2. 分享 → 加入主畫面
3. 從主畫面開啟，之後可離線使用

資料存在手機本機的 IndexedDB。第一次開啟時會向瀏覽器申請
persistent storage，降低 iOS 回收資料的機會，但**定期到「設定」頁匯出
JSON 備份仍然是唯一可靠的保險**。

## 開發

```bash
npm install
npm run dev      # 本機開發
npm test         # 課表資料、進展演算法、端對端流程
npm run build    # 型別檢查 + 產出 dist/
npm run preview  # 預覽產出的成品
```

重新產生 App icon（純 Node，無外部依賴）：

```bash
node scripts/generate-icons.mjs
```

## 部署

推到 `main` 會由 GitHub Actions 建置並發布到 GitHub Pages。

網址帶了 `/training-os/` 前綴（`vite.config.ts` 的 `base`）。換成自訂網域或
user site 時用 `BASE_PATH=/ npm run build`。

## 架構

四層，相依方向單向往下：

| 目錄 | 職責 | 相依 |
| --- | --- | --- |
| `src/program/` | 六堂課表、動作字典、器材級距。純資料 | 無 |
| `src/engine/` | 進展建議、暖身、推估單次最大重量、訓練量、循環、疲勞提醒 | `program/` 的型別 |
| `src/store/` | IndexedDB 存取、備份匯出匯入、查詢 | `engine/`、`program/` |
| `src/ui/` | React 畫面 | 全部 |

`engine/` 是 pure function，不碰資料庫也不碰 React，所以進展規則可以直接寫測試。

### 三種 ID

弄混會讓「上次紀錄」顯示錯誤的重量，所以分成三個：

- **`exerciseId`** — 實體動作。查歷史、畫趨勢圖用。
- **`trackId`** — 進展軌道。查「上次用多少」與算加重建議用。
- **`dayId`** — 課表中的某一堂。

槓鈴臥推有三條軌道（主力重組、降重工作組、暫停臥推），因為三者的重量各自
演進；側平舉出現在三堂課裡卻共用一條軌道，因為它們本來就該一起進步。

### 課表循環

「下一堂是什麼」不綁星期幾，做完一堂就往下移一格。「本週 x/y」與週訓練量則
用自然週（週一起算）。4 天／5 天可以隨時切換，只影響還沒做的部分。

## 資料備份

「設定」頁可以下載 JSON、複製 JSON、或從 JSON 還原。匯入會先驗證格式，
壞掉的檔案不會覆蓋現有紀錄。
