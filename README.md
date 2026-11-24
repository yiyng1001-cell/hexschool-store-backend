# 生活選物店 — 後端 API

「生活選物店」電商平台的後端 API，商品以家居、文具、廚房、收納為主。提供會員、商品、購物車三大功能，供前端 `hexschool-store-frontend` 串接。

這是 2026 企業專題班的單人專題（前後端分離，各自獨立部署）。

## 線上網址

| 項目 | 網址 |
| --- | --- |
| API Base URL | [https://hexschool-store-backend.onrender.com](https://hexschool-store-backend.onrender.com)（根路徑沒有頁面，所有 API 在 `/api/...` 底下；請從 [API 文件](https://hexschool-store-backend.onrender.com/api-docs) 開始） |
| 互動式 API 文件（Swagger UI） | [https://hexschool-store-backend.onrender.com/api-docs](https://hexschool-store-backend.onrender.com/api-docs) |
| OpenAPI 文件（JSON，可匯入 Postman） | [https://hexschool-store-backend.onrender.com/openapi.json](https://hexschool-store-backend.onrender.com/openapi.json) |
| 前端網站 | [https://hexschool-store-web.onrender.com](https://hexschool-store-web.onrender.com) |

> **關於首次連線：** 本專案部署在免費主機上，閒置一段時間後會休眠。若第一次請求等待較久（可能約 1 分鐘），是主機正在喚醒，請稍候再試，之後就會恢復正常速度。

## 測試帳號

| 角色 | email | 密碼 |
| --- | --- | --- |
| 管理員 | `admin@example.com` | 為避免公開 Repo 洩漏，不寫在此處，請見繳交信件 |
| 一般會員 | `member@example.com` | `Member12345` |

- 這些是公開的示範帳號，只用於審核與展示。
- 也可以自行註冊新的一般會員。

### 管理員帳號如何產生

- 系統**不提供**任何讓使用者自行成為管理員的方式：註冊與登入 API 若帶有 `role`、`isAdmin` 等欄位會直接回 `400`，角色一律由伺服器決定，新註冊的帳號固定為一般會員。
- 管理員只能由 **seed 指令**建立：`npm run db:seed` 會讀取環境變數 `ADMIN_EMAIL` 與 `ADMIN_PASSWORD`，以 email 為鍵新增或更新管理員帳號（重複執行不會產生重複帳號）。

## 功能

| 模組 | 說明 |
| --- | --- |
| 會員 | email + 密碼註冊與登入；密碼以 bcrypt 雜湊儲存；登入後取得 JWT；區分一般會員與管理員 |
| 商品 | 所有人可瀏覽列表與單品；列表支援分頁、分類篩選、關鍵字搜尋與排序；管理員可新增、編輯、刪除（僅 API） |
| 購物車 | 登入會員可設定數量（含加入）、移除、查看；只能操作自己的購物車 |

### API 一覽

所有成功回應為 `{ "success": true, "data": ... }`，失敗為 `{ "success": false, "error": { "code", "message", "details?" } }`。完整的參數、範例與錯誤碼請見 [`/api-docs`](https://hexschool-store-backend.onrender.com/api-docs) 或根目錄的 [`openapi.yaml`](openapi.yaml)。

| 方法 | 路徑 | 驗證 | 說明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 無 | 註冊並取得 token |
| POST | `/api/auth/login` | 無 | 登入 |
| GET | `/api/auth/me` | 登入 | 取得目前登入者資料 |
| GET | `/api/products` | 無 | 商品列表（`page`、`limit`、`category`、`q`、`sort`） |
| GET | `/api/products/{id}` | 無 | 單一商品 |
| POST | `/api/products` | 管理員 | 新增商品 |
| PATCH | `/api/products/{id}` | 管理員 | 部分更新商品 |
| DELETE | `/api/products/{id}` | 管理員 | 刪除商品（軟刪除） |
| GET | `/api/categories` | 無 | 分類清單 |
| GET | `/api/cart` | 登入 | 查看購物車 |
| PUT | `/api/cart/items/{productId}` | 登入 | 設定數量（沒有則加入） |
| DELETE | `/api/cart/items/{productId}` | 登入 | 移除項目 |
| GET | `/health` | 無 | 健康檢查 |

### 如何驗證

登入或註冊後會取得 `accessToken`（有效期 7 天）。需要登入的 API 請帶上標頭：

```
Authorization: Bearer <accessToken>
```

過期、缺少或無效的 token 一律回 `401`；已登入但權限不足（例如一般會員呼叫管理員 API）回 `403`。

### 使用 Postman 或 Swagger UI 測試

- **Swagger UI：** 開啟 [`/api-docs`](https://hexschool-store-backend.onrender.com/api-docs)，按右上角 **Authorize** 貼上 `accessToken`，即可直接按 **Try it out**。
- **Postman：** Import → Link → 貼上 `https://hexschool-store-backend.onrender.com/openapi.json`。

### 幾個重要的行為

- **購物車是「設定數量」而不是「累加」：** `PUT` 把數量設成指定值，重複送出結果相同（冪等）。前端的「加入購物車」＝目前數量 + 1。每次成功後以回應的完整購物車覆蓋本地狀態，即可與後端保持同步。
- **數量限制：** 單項數量 1～99；購物車最多 50 種商品。
- **刪除商品為軟刪除：** 公開 API 看不到已刪除的商品，但購物車裡已加入的項目會保留並標示 `available: false`，不計入總計，使用者可自行移除。
- **搜尋：** 對商品名稱與說明做不分大小寫的比對；`%`、`_` 會被當成一般字元。
- **密碼限制：** 至少 8 字元，需含英文字母與數字，最多 72 bytes（中文每字 3 bytes，約 24 個中文字）。

## 技術

| 類別 | 使用 |
| --- | --- |
| 語言 / 執行環境 | TypeScript、Node.js 24（22 系列需 22.13 以上） |
| 框架 | Express 5 |
| 資料庫 / ORM | PostgreSQL、Prisma 7 |
| 驗證 | JWT（HS256）、bcryptjs、zod |
| 文件 | OpenAPI 3、Swagger UI |
| 測試 | Vitest、supertest |
| 部署 | Render（API）、Neon（PostgreSQL） |

架構為 MVC 分層：`routes → controllers → services → models`，只有 `models` 層會碰資料庫。詳見 [`specs/`](specs/)。

## 本機啟動

需要：Node.js 24（見 `.nvmrc`；使用 22 系列時需 22.13 以上）、Docker（用來啟動本機 PostgreSQL）。

```bash
# 1. 安裝套件（會一併產生 Prisma client）
npm install

# 2. 建立環境變數檔，並把 JWT_ACCESS_SECRET 換成隨機值
cp .env.example .env
openssl rand -hex 32        # 把輸出貼到 .env 的 JWT_ACCESS_SECRET

# 3. 啟動本機資料庫（會建立開發與測試兩個資料庫）
npm run db:up

# 4. 套用資料表並建立測試資料（管理員、示範會員、4 個分類、24 筆商品）
npm run db:deploy
npm run db:seed

# 5. 啟動開發伺服器
npm run dev
```

啟動後開啟 <http://localhost:3000/api-docs> 即可看到互動式文件。

## 環境變數

複製 `.env.example` 為 `.env`。**機密不得提交到版本控制。**

| 名稱 | 必填 | 說明 |
| --- | --- | --- |
| `NODE_ENV` | 否 | `development`（預設）、`test`、`production` |
| `PORT` | 否 | 服務埠號，預設 `3000`；部署平台會自動注入 |
| `DATABASE_URL` | 是 | 執行期資料庫連線網址 |
| `DIRECT_URL` | 否 | migration 用的直連網址；未設定時使用 `DATABASE_URL` |
| `JWT_ACCESS_SECRET` | 是 | JWT 簽章密鑰，至少 32 字元；`production` 不接受以 `change-me` 開頭的值 |
| `ACCESS_TOKEN_TTL` | 否 | token 有效期，格式為數字加 `s`／`m`／`h`／`d`，預設 `7d` |
| `CORS_ORIGIN` | `production` 必填 | 允許的前端網址，可用逗號分隔多個 |
| `PUBLIC_BASE_URL` | 否 | 對外的 API 網址。設定後，`/api-docs` 與 `/openapi.json` 會使用它；部署時請設定 |
| `LOG_LEVEL` | 否 | 日誌等級，預設 `info` |
| `ADMIN_EMAIL`、`ADMIN_PASSWORD` | seed 時必填 | 管理員帳號；密碼需符合註冊的密碼規則 |
| `TEST_DATABASE_URL` | 跑測試時必填 | 整合測試專用資料庫，主機必須是本機 |

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發模式（自動重啟） |
| `npm run build` / `npm start` | 編譯 / 啟動正式服務 |
| `npm test` | 執行全部測試（需先 `npm run db:up`） |
| `npm run test:unit` / `npm run test:integration` | 只跑單元 / 整合測試 |
| `npm run typecheck` / `npm run lint` / `npm run format:check` | 型別檢查 / 程式碼檢查 / 格式檢查 |
| `npm run db:up` / `npm run db:down` | 啟動 / 停止本機資料庫 |
| `npm run db:deploy` | 套用 migration |
| `npm run db:migrate` | 開發時建立新的 migration |
| `npm run db:seed` | 建立或更新測試資料（可重複執行） |
| `npm run db:reset` | 重置本機資料庫（僅限本機） |

## 部署（Render + Neon）

1. **資料庫：** 在 [Neon](https://neon.com) 建立專案，複製**直連**連線網址（不是帶 `-pooler` 的網址）。
2. **API：** 在 [Render](https://render.com) 建立 **Web Service** 並連結本 Repo：

   | 設定 | 值 |
   | --- | --- |
   | Build Command | `npm ci --include=dev && npm run build && npm run db:deploy` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

3. **環境變數**（Render 後台設定）：`NODE_VERSION=24`、`NODE_ENV=production`、`DATABASE_URL`、`DIRECT_URL`（兩者皆填 Neon 直連網址）、`JWT_ACCESS_SECRET`、`CORS_ORIGIN`（前端網址）、`PUBLIC_BASE_URL`（這個 API 的網址）。
4. **建立測試資料（只需一次）：** 在本機執行（Render 免費方案沒有 shell）：

   ```bash
   DATABASE_URL='<Neon 直連網址>' ADMIN_EMAIL='admin@example.com' ADMIN_PASSWORD='<管理員密碼>' npm run db:seed
   ```

5. 開啟 `https://<API 網址>/health` 與 `/api-docs` 確認服務正常。

## 專案文件

| 文件 | 內容 |
| --- | --- |
| [`specs/product.md`](specs/product.md) | 產品定位、使用者、目標與非目標 |
| [`specs/constitution.md`](specs/constitution.md) | 不可違反的規則（架構、安全、資料、測試、禁用模式） |
| [`specs/tech.md`](specs/tech.md) | 技術選型、環境變數、指令與部署 |
| [`specs/structure.md`](specs/structure.md) | 目錄結構與命名 |
| [`specs/001-auth`](specs/001-auth/spec.md)、[`002-products`](specs/002-products/spec.md)、[`003-cart`](specs/003-cart/spec.md) | 各功能規格 |
| [`openapi.yaml`](openapi.yaml) | API 契約（單一來源） |
