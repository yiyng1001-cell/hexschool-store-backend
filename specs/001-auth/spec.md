# 001 — Auth：會員註冊、登入與權限

狀態：Draft

## 目的

讓使用者註冊與登入，以 JWT 驗證身分，並區分「一般會員」與「管理員」。這是購物車與商品管理 API 的前提。

## 需求

### 功能

1. 使用者可用 email + 密碼註冊，成功後直接取得 token。
2. 使用者可登入並取得 access token。
3. 已登入使用者可查詢自己的資料。
4. 角色分為 `USER`、`ADMIN`。註冊一律為 `USER`；任何 API 都不能讓使用者變更自己的角色。
5. 管理員帳號由 seed script 建立，帳密來自環境變數。

### Token 設計

- 只發 **access token**，不實作 refresh token 與伺服器端撤銷（見 `product.md` 非目標）。
- 形式：JWT，payload 含 `sub`（使用者 id）、`role`、`exp`。
- 有效期：7 天（`ACCESS_TOKEN_TTL`）。
- 傳遞：`Authorization: Bearer <token>`。
- 失效：僅靠到期。過期或無效一律回 401 `UNAUTHORIZED`，前端導向登入頁。
- 登出：前端清除本地 token，後端不提供登出 API。已發出的 token 在到期前仍有效，這是本設計接受的取捨。
- 權限檢查（S-4）以 token 內的 `role` 為準；角色變更需等 token 過期或重新登入才生效。

### 密碼與輸入規則

- `email`：合法格式，最長 254，存入前轉小寫並去頭尾空白，UNIQUE。
- `password`：8～72 字元，需含英文與數字（72 為 bcrypt 上限）。
- `name`：1～50 字元，去頭尾空白。
- 雜湊：bcrypt，cost 12。
- 請求含未定義欄位（尤其 `role`、`isAdmin`）→ 400，不靜默忽略（S-3、X-2）。

## API 契約

統一回應格式（A-8，本 spec 首次定義，後續沿用）：

```json
{ "success": true, "data": {} }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| 方法 | 路徑 | 驗證 | 說明 | 成功 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | 無 | 註冊並登入 | 201 |
| POST | `/api/auth/login` | 無 | 登入 | 200 |
| GET | `/api/auth/me` | access token | 取得自己的資料 | 200 |

### 請求與回應

- `POST /register`：body `{ email, password, name }` → `data: { user, accessToken }`
- `POST /login`：body `{ email, password }` → `data: { user, accessToken }`
- `GET /me`：→ `data: { user }`；token 有效但使用者已不存在時回 401 `UNAUTHORIZED`。
- `user` 欄位：`id`、`email`、`name`、`role`、`createdAt`。**不含**密碼或其雜湊。

### 錯誤碼

| HTTP | code | 情境 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 欄位缺漏、格式錯誤、含未定義欄位（含 `role`） |
| 401 | `INVALID_CREDENTIALS` | 登入的 email 或密碼錯誤（不區分是哪一個） |
| 401 | `UNAUTHORIZED` | 缺少、格式錯誤、竄改、過期的 access token，或使用者已不存在 |
| 403 | `FORBIDDEN` | 已登入但權限不足（供管理員 middleware 使用） |
| 409 | `EMAIL_ALREADY_EXISTS` | 註冊的 email 已被使用 |

## 資料模型

`User`
- `id`（主鍵）、`email`（UNIQUE、NOT NULL）、`passwordHash`（NOT NULL）、`name`（NOT NULL）
- `role`（enum `USER`｜`ADMIN`，NOT NULL，預設 `USER`）
- `createdAt`、`updatedAt`

## 環境變數

`DATABASE_URL`、`JWT_ACCESS_SECRET`、`ACCESS_TOKEN_TTL`（預設 `7d`）、`ADMIN_EMAIL`、`ADMIN_PASSWORD`、`CORS_ORIGIN`。皆由 `src/config` 啟動時驗證，缺少即停止。

## 管理員帳號

- `prisma/seed.js` 依 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 以 upsert 建立管理員（重複執行不會重複建立，D-3）。
- 測試用一般會員同樣由 seed 建立，帳密在 README 公布。
- 提交時於 README 說明此產生方式。

## 對前端的影響

- 前端保存 `accessToken`，請求帶 `Authorization: Bearer`。
- 重新整理頁面後，以保存的 token 呼叫 `/me` 還原登入狀態。
- 任何請求收到 401 `UNAUTHORIZED`：清除本地 token 並導向登入頁。
- 登出：清除本地 token，不呼叫後端。
- 契約變更時依 `AGENTS.md` 流程，於前端 Repo 開對應 issue。

## 驗收條件

- [ ] 註冊成功回 201，帶 token，資料庫只存雜湊。
- [ ] 重複 email（含大小寫不同）註冊回 409。
- [ ] 註冊或任何 API 帶 `role` 欄位回 400，且使用者角色不變。
- [ ] 密碼不符規則回 400，`details` 指出欄位。
- [ ] 登入 email 錯誤與密碼錯誤回應完全相同（401 `INVALID_CREDENTIALS`）。
- [ ] 過期、竄改或缺少的 token 皆回 401 `UNAUTHORIZED`。
- [ ] `GET /me` 帶有效 token 回自己的資料且不含密碼；使用者已不存在回 401。
- [ ] 同一個 seed 重複執行，管理員仍只有一筆。
- [ ] 回應與日誌中不出現密碼或雜湊。

## 預計新增或修改的檔案

- `prisma/schema.prisma`、`prisma/seed.js`
- `src/config/env.js`
- `src/routes/auth.routes.js`、`src/controllers/auth.controller.js`
- `src/services/auth.service.js`、`src/services/token.service.js`
- `src/models/user.model.js`
- `src/schemas/auth.schema.js`
- `src/middlewares/authenticate.js`、`src/middlewares/require-role.js`、`src/middlewares/validate.js`、`src/middlewares/error-handler.js`
- `src/errors/`（`ValidationError`、`UnauthorizedError`、`ForbiddenError`、`ConflictError`）
- `openapi.yaml`（auth 路徑與共用 schema）
- `tests/unit/auth.service.test.js`、`tests/unit/token.service.test.js`
- `tests/integration/auth.test.js`

## 測試案例

單元（services，不需 DB）：
- 密碼雜湊與比對；access token 簽發與驗證（正常、過期、竄改）。

整合（supertest）：
- 上述驗收條件逐條對應一個案例，另含：未知欄位、email 正規化、管理員 middleware 對 `USER` 回 403。

## Constitution Check

- [x] **A 架構**：分層符合 A-1～A-5；輸入以 zod schema 在 route 層驗證（A-6）；錯誤走集中 middleware（A-7）；統一回應格式（A-8）；資料表以 Prisma migration 建立（A-9）；API 只新增（A-10）。
- [x] **S 安全**：密碼雜湊（S-1）；機密來自環境變數（S-2）；角色由伺服器決定、拒絕 `role` 欄位（S-3）；管理員 middleware 驗證 JWT 並檢查角色（S-4）；以 token 內身分為準（S-5）；401／403／404 語意固定（S-6）；CORS 來源來自環境變數（S-7）；錯誤不洩漏內部資訊（S-8）。
- [x] **D 資料**：UNIQUE、NOT NULL、enum（D-1）；本 spec 無列表查詢（D-2 不適用）；seed upsert 冪等；註冊以 UNIQUE 約束擋下重複（D-3）；seed 含管理員與測試會員（D-4）。
- [x] **T 測試**：services 單元測試（T-1）；每支 API 整合測試含成功、驗證失敗、未登入、權限不足（T-2）；購物車邊界情況（T-3）不適用本 spec。
- [x] **X 禁用**：無 controller 直接存取 DB、無客戶端指定角色、無空 catch、無硬寫機密、無未分頁列表、無就地修改、無未處理 rejection。
- [x] **P 文件**：`openapi.yaml` 更新、`/api-docs` 可試打；README 說明管理員產生方式與測試帳號。
- 例外與理由：無。

## 已知取捨與待決事項

- token 外洩時無法撤銷，有效期內皆可使用；因此有效期限制為 7 天。
- 登出僅在前端生效。
- 若日後需要撤銷或縮短有效期，可新增 refresh token（additive，不破壞現有契約），另開 spec。
- 是否需要登入失敗次數限制（rate limiting）：本期未列入。
