# Constitution — 電商後端專案

不可違反的規則。每份 `specs/NNN-feature/spec.md` 必須通過本文件的 **Constitution Check**。
違反任一條 MUST／MUST NOT 的 spec 不得進入實作；需例外時，先修訂本文件（見「修訂流程」）。

規則編號（如 `A-2`）供 spec 與 PR 引用。

## 技術基線

- 技術選型、套件、環境變數、指令與部署設定見 `specs/tech.md`。
- 基線：Node.js + Express、PostgreSQL、Prisma；認證使用 JWT；密碼 MUST 雜湊儲存。

## A. 架構（Architecture）

- **A-1** 分層固定為 `routes → controllers → services → models`，依賴只能由上往下。
- **A-2** routes 只負責路徑、middleware 與 controller 綁定，不含邏輯。
- **A-3** controllers 只做 HTTP 轉換：取出已驗證的輸入、呼叫 service、組回應。不含業務規則。
- **A-4** services 放業務邏輯，以純函式為主；I/O（DB、外部呼叫）透過注入的 model／repository 介面進行。
- **A-5** 只有 models 層（Prisma 存取）可以接觸資料庫。
- **A-6** 輸入驗證在 route 層以 schema（如 zod）完成，controller 收到的必為已驗證資料。
- **A-7** 所有錯誤統一交給集中式 error middleware，使用具型別的錯誤類別（含 HTTP status 與錯誤碼）。
- **A-8** 所有 API 回應採統一格式（成功／失敗皆固定結構），錯誤碼需可讓前端區分邊界情況。
- **A-9** 變更資料庫結構只能透過 Prisma migration，不得手改正式環境。
- **A-10** 公開介面（API 路徑、回應欄位）只做新增式變更；移除前先標記 deprecated。

## S. 安全（Security）

- **S-1** 密碼 MUST 雜湊儲存；不得出現在日誌或任何回應。
- **S-2** 機密（JWT secret、DB 連線字串）只能來自環境變數；`.env` 不進版控，提供 `.env.example`。
- **S-3** 角色 MUST 由伺服器決定。任何 API 不得接受客戶端傳入的 `role`、`isAdmin` 等欄位（忽略或回 400），包含註冊與更新個人資料。
- **S-4** 管理員專屬 API MUST 經過「驗證 JWT」與「檢查管理員角色」兩層 middleware。
- **S-5** 購物車與使用者資料操作 MUST 以 JWT 內的使用者身分為準，不得信任請求中的 userId。
- **S-6** 未登入回 401，權限不足回 403，資源不存在回 404。
- **S-7** CORS 只允許環境變數設定的前端網域。
- **S-8** 對外錯誤回應不得洩漏堆疊或內部細節。

## D. 資料（Data）

- **D-1** 資料表 MUST 有主鍵、必要的 NOT NULL、UNIQUE（如 email）、外鍵與型別約束；驗證不只在應用層。
- **D-2** 所有列表查詢 MUST 分頁，且設定 `limit` 上限；不得回傳未限制數量的集合。
- **D-3** 寫入操作 MUST 可安全重複執行（冪等或明確拒絕重複），多步驟寫入使用 transaction。唯一例外：「建立新資源」的 `POST`（例如 `POST /api/products`）沒有自然的唯一鍵，重送會建立多筆；此類端點 MUST 在 spec 與 OpenAPI 明確標註「不具冪等性」，且不得被其他流程自動重試。
- **D-4** 專案 MUST 提供 seed script，建立足以展示分頁、分類、搜尋的商品資料，以及測試用一般會員與管理員。

## T. 測試（Testing）

- **T-1** services 的業務邏輯 MUST 有單元測試，且不需真實 DB 即可執行。
- **T-2** 每支 API MUST 有 supertest 整合測試，涵蓋：成功路徑、驗證失敗、未登入、權限不足。
- **T-3** 購物車與商品 API MUST 測試邊界情況：重複加入、商品不存在、數量為 0／負數／非整數／超限、越權存取他人購物車。
- **T-4** 修 bug 時先補一個重現的失敗測試。
- **T-5** 測試 MUST 在 CI 或合併前全數通過；不得以跳過（skip）或註解掩蓋失敗。

## X. 禁用模式（Banned）

- **X-1** controller（或 route）直接操作資料庫或 Prisma client。
- **X-2** 接受客戶端指定 `role` / `isAdmin` 等權限欄位。
- **X-3** 空 `catch`、吞錯誤、或只 `console.log` 後繼續。catch 必須重新拋出或轉成具型別錯誤，並記錄結構化日誌（含錯誤特徵、堆疊、correlation ID）。
- **X-4** 在程式碼、測試資料、日誌或版本紀錄中硬寫機密。
- **X-5** 未分頁、無上限的列表查詢。
- **X-6** 就地修改（mutate）傳入的參數或共享狀態；資料轉換以複製或 map／filter／reduce 完成。
- **X-7** 未處理的 Promise rejection、在 async 流程中遺漏 `await`。

## 文件與交付

- **P-1** 每個對外 API MUST 記錄於手寫的 `openapi.yaml`（OpenAPI 3），作為前後端契約的單一來源，與實作同步更新；契約變更先於實作。
- **P-1a** MUST 以 `swagger-ui-express` 在 `/api-docs` 提供互動式文件（含 JWT 驗證設定與請求／回應／錯誤範例）；README 註明 Postman 可匯入 `openapi.yaml`。
- **P-2** README MUST 含：主題、技術、啟動方式、環境變數、測試帳號、管理員產生方式。
- **P-3** Commit 與 PR 標題遵守 Conventional Commits，描述變更內容與原因，不敘述產出過程。

## Spec 流程

- 每個功能一個資料夾：`specs/NNN-feature/spec.md`。
- 每份 spec MUST 包含：需求、API 契約、資料模型、驗收條件、**Constitution Check**。
- Constitution Check 範本（逐條勾選，不適用請註明原因）：

```md
## Constitution Check
- [ ] A 架構：分層與依賴方向符合 A-1～A-10
- [ ] S 安全：權限、角色、機密處理符合 S-1～S-8
- [ ] D 資料：約束、分頁上限、冪等符合 D-1～D-4
- [ ] T 測試：已列出單元與整合測試案例，含邊界情況 T-1～T-5
- [ ] X 禁用：未使用 X-1～X-7 任一模式
- 例外與理由：（無則填「無」）
```

## 修訂流程

- 修改本文件需獨立 commit（`docs(constitution): ...`），說明修改原因與影響的規則編號。
- 已通過的 spec 若受修訂影響，需在同一個 PR 重新做 Constitution Check。
- 規則編號不重用；刪除規則時保留編號並標記 `(removed)`。
