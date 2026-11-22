# Tech — 技術選型、限制與指令

規則見 `specs/constitution.md`，目錄結構見 `specs/structure.md`。本文件記錄「用什麼、怎麼跑、怎麼部署」。

> **狀態**：選型已定；套件版本與指令尚未在實際專案中驗證。初始化專案後，須以實際的 `package.json` 核對並更新本文件。

## 技術選型

| 類別 | 選擇 | 備註 |
| --- | --- | --- |
| 執行環境 | Node.js LTS | 版本以 `.nvmrc` 與 `package.json` 的 `engines` 為準 |
| 語言與模組 | TypeScript（`strict`，ESM，`"type": "module"`） | 原始碼為 `.ts`；以 `tsc` 編譯到 `dist/`，開發時以 `tsx` 直接執行 |
| 型別輔助 | `@types/*`、Prisma 產生的型別、`z.infer` | 請求型別由 zod schema 推導，不手寫第二份 |
| Web 框架 | Express | |
| 資料庫 | PostgreSQL | 正式環境使用 Neon；本機使用 Docker |
| ORM | Prisma 7（固定 `7.10.1`）＋ `@prisma/adapter-pg` | migration 與 seed 皆由 Prisma 管理（A-9）。Prisma 7 的資料庫網址設在 `prisma.config.ts`，執行期須提供 driver adapter；client 產生於 `src/generated/prisma`（不進版控） |
| 驗證（輸入） | zod | route 層驗證（A-6） |
| 密碼雜湊 | `bcryptjs`（cost 12） | 純 JavaScript 實作，免原生編譯，部署與搬遷較不易出錯 |
| JWT | `jsonwebtoken` | 只發 access token（見 `001-auth`） |
| 安全標頭、CORS | `helmet`、`cors` | |
| 日誌 | `pino`、`pino-http` | 結構化 JSON 日誌 |
| API 文件 | `swagger-ui-express`、`yaml` | 讀取根目錄 `openapi.yaml`，掛在 `/api-docs` |
| 測試 | Vitest、supertest | |
| 風格 | ESLint、Prettier | |

套件版本：初始化時安裝當下的穩定版，由 `package-lock.json` 鎖定並進版控；不手動猜版本號。

## 限制

- 機密只能來自環境變數；`.env` 不進版控，提供 `.env.example`（S-2）。
- `package-lock.json` 必須進版控，部署使用 `npm ci`。
- `tsconfig` 啟用 `strict`；`npm run typecheck` 與 `npm run lint` 必須通過才可合併。
- 不使用 `any` 與 `@ts-ignore` 繞過型別；確有必要時須在該行以一句註解說明原因。
- `dist/` 不進版控。
- 原始碼中的相對 import 一律寫 `.js` 副檔名（`module: NodeNext` 的要求，例如 `from "./app.js"`），實際檔案仍是 `.ts`。
- 環境變數 schema（`src/config/env.ts`）隨各 spec 逐步新增變數；每個變數只在實際用到時才加入，避免測試被不相關的變數卡住。
- 不使用 Render 專屬的程式碼或 API；平台差異只存在於部署設定（見「可攜性」）。
- 不依賴本機檔案系統儲存資料。

## 環境變數

只列名稱與用途，不放值。皆於 `src/config` 啟動時驗證，缺少即停止。

| 名稱 | 用途 |
| --- | --- |
| `NODE_ENV` | `development`、`test`、`production` |
| `PORT` | 服務埠號；部署平台會注入 |
| `DATABASE_URL` | 執行期連線（Neon 使用**連線池**網址） |
| `DIRECT_URL` | migration 專用的**直連**網址（Prisma `directUrl`） |
| `TEST_DATABASE_URL` | 整合測試專用資料庫（僅限本機） |
| `JWT_ACCESS_SECRET` | JWT 簽章密鑰 |
| `ACCESS_TOKEN_TTL` | access token 有效期，預設 `7d` |
| `ADMIN_EMAIL`、`ADMIN_PASSWORD` | seed 建立管理員用；密碼須符合註冊的密碼規則 |
| `CORS_ORIGIN` | 允許的前端網域，可用逗號分隔多個 |
| `LOG_LEVEL` | 日誌等級，預設 `info` |
| `PUBLIC_BASE_URL` | 對外的 API 網址（選填，含 `https://`）。設定後 `/api-docs` 與 `/openapi.json` 的 `servers` 會使用它，Postman 匯入才會指向正確的伺服器；未設定時使用目前的網域。**部署時請設定** |

## 共用的營運規則

本節補充 `001`～`003` 未涵蓋的橫切行為。

### 錯誤處理

沿用統一回應格式。`ErrorCode` 新增（新增式變更，A-10）：

| HTTP | code | 情境 |
| --- | --- | --- |
| 413 | `PAYLOAD_TOO_LARGE` | 請求內容超過上限 |
| 500 | `INTERNAL_ERROR` | 未預期的錯誤；訊息為固定的通用文字，不洩漏內部資訊（S-8） |

- 路徑不存在 → 404 `NOT_FOUND`。
- 請求 body 不是合法 JSON → 400 `VALIDATION_ERROR`。
- JSON body 上限 100 KB。
- 所有錯誤只經由集中的 error middleware 產生回應（A-7）。

### 日誌

- 每個請求產生 request id，回傳於回應標頭 `X-Request-Id`，並出現在該請求的所有日誌中（correlation ID）。
- 日誌欄位至少含：`requestId`、`method`、`path`、`status`、`durationMs`。
- 5xx 另記錄錯誤類型與堆疊；4xx 記錄 `errorCode`。
- **不得**記錄：密碼、`Authorization` 標頭、token、請求 body 的敏感欄位（X-3、X-4）。

### 其他

- `GET /api-docs`：Swagger UI 互動式文件；`GET /openapi.json`：同一份文件的 JSON，供 Postman 匯入。皆不需驗證，內容來自根目錄的 `openapi.yaml`（P-1、P-1a）。
- `GET /health`：不需驗證，回 200 `{ "status": "ok" }`；只檢查服務存活，不查資料庫。供部署平台的健康檢查使用。
- 部署於反向代理之後，設定 `trust proxy`。
- 以 `helmet` 設定安全標頭；CORS 只允許 `CORS_ORIGIN`（S-7）。

## 指令（規劃，初始化後須驗證）

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 本機開發（`tsx watch src/server.ts`，自動重啟） |
| `npm run build` | 編譯 TypeScript 到 `dist/` |
| `npm start` | 啟動正式服務（`node dist/server.js`），須先 build |
| `npm run typecheck` | 型別檢查（`tsc --noEmit`） |
| `npm run lint` / `npm run format` | 檢查與格式化 |
| `npm test` | 全部測試 |
| `npm run test:unit` | 單元測試 |
| `npm run test:integration` | 整合測試 |
| `npm run db:up` / `npm run db:down` | 啟動／停止本機 PostgreSQL（`docker compose`） |
| `npm run db:generate` | 產生 Prisma client（`npm install` 的 `postinstall` 也會執行） |
| `npm run db:migrate` | 本機建立並套用 migration（`prisma migrate dev`） |
| `npm run db:deploy` | 套用既有 migration（`prisma migrate deploy`，部署用） |
| `npm run db:reset` | 重置本機資料庫（`prisma migrate reset`，僅限本機） |
| `npm run db:seed` | 執行 seed（`prisma db seed`，可重複執行，D-3）；管理員帳密讀取 `ADMIN_EMAIL`、`ADMIN_PASSWORD` |

## 本機開發

- `npm run db:up` 以 `docker compose` 啟動本機 PostgreSQL 17，會建立 `store_dev` 與 `store_test` 兩個資料庫，只綁定 `127.0.0.1:5432`。
- `docker-compose.yml` 內的帳密是本機專用的可丟棄值，不得用於任何正式環境。
- 複製 `.env.example` 為 `.env`；本機預設值可直接使用。
- `prisma.config.ts` 的 migration 使用 `DIRECT_URL`（未設定時退回 `DATABASE_URL`）；執行期 client 使用 `DATABASE_URL`。
- Prisma 的 `latest` 標籤目前指向候選版（`8.0.0-rc`），因此 `prisma` 與 `@prisma/client` 以精確版本固定在穩定的 `7.10.1`，升級前須確認兩者版本一致。

## 測試

- 單元測試不需資料庫（T-1）。
- 整合測試使用 `TEST_DATABASE_URL`，每個測試檔案開始前清空資料表。
- 為避免誤清正式資料，整合測試啟動時檢查 `TEST_DATABASE_URL` 的主機必須是本機，否則直接中止。
- 測試帳號與商品由測試自行建立，不依賴手動資料。

## 部署

| 項目 | 設定 |
| --- | --- |
| 平台 | Render（Web Service） |
| 資料庫 | Neon（PostgreSQL） |
| 方案 | **預設使用免費方案**（Render 與 Neon 皆免費）；見下方「免費方案的風險與對策」 |
| Build | `npm ci && npx prisma generate && npm run build` |
| 部署前步驟 | `npm run db:deploy` |
| Start | `npm start` |
| 健康檢查 | `/health` |
| 環境變數 | 於 Render 後台設定，不進版控 |
| 初次 seed | 部署後手動執行一次 `npm run db:seed` |

- 審核期間（**2026/11/13～12/04**）須保持可連線，不在期間內更換網址或平台。
### 免費方案的風險與對策

- Render 免費 Web Service 閒置 15 分鐘會休眠，喚醒約需一分鐘；審核者的第一個請求可能等很久，甚至被誤判為無法連線（題目規定無法連線視同未完成）。
- Neon 免費方案閒置約 5 分鐘會自動暫停（無法關閉），閒置後第一個請求稍慢但不會失敗。
- 對策：
  1. 以外部排程服務定時（約每 10 分鐘）請求 `GET /health`，避免 Web Service 休眠。依 Render 文件，休眠是以「15 分鐘沒有任何傳入流量」判定；實際效果與免費額度（例如每月實例時數）**須在部署時對照 Render 目前的條款確認**。
  2. README 明確註明：「首次請求可能需要等待約 1 分鐘（免費主機喚醒中）」。
  3. 提交前一天實際從外部網路完整測一次流程（註冊、登入、瀏覽、購物車）。
  4. 如果對策無效，升級為 Render 付費最低方案即可，不需修改程式碼；這是後台設定的切換。
- `GET /health` 不查資料庫，所以定時請求不會讓 Neon 保持喚醒；這是可接受的。

## 可攜性（日後可能遷移）

12/04 之後可能遷移到 AWS，因此現在遵守：

- 所有設定只來自環境變數；只讀 `PORT` 啟動。
- 資料庫只使用標準 PostgreSQL 功能；`DATABASE_URL`／`DIRECT_URL` 可直接換成其他供應商。
- migration 與 seed 是獨立步驟，不綁在啟動流程裡。
- 日後可新增 `Dockerfile` 作為跨平台部署方式（additive，不是目前必要）。
