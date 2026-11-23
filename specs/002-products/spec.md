# 002 — Products：商品與分類

狀態：Implemented

依賴：`001-auth`（`authenticate`、`require-role` middleware、統一回應格式與錯誤碼）。

## 目的

讓所有人瀏覽商品列表與單品（分頁、分類篩選、關鍵字搜尋、排序），並讓管理員透過 API 新增、編輯、刪除商品。

## 需求

### 功能

1. 任何人（含未登入）可瀏覽商品列表與單一商品。
2. 列表支援分頁、分類篩選、關鍵字搜尋與排序。
3. 任何人可取得分類清單。
4. 管理員可新增、部分更新、刪除商品；一般會員與未登入者不可。
5. 刪除為軟刪除：公開 API 不再看得到，但不破壞其他資料對它的引用（購物車，見 003）。

### 商品欄位與規則

| 欄位 | 規則 |
| --- | --- |
| `name` | 必填，去頭尾空白後 1～100 字元 |
| `description` | 必填，去頭尾空白後 1～2000 字元 |
| `price` | 必填，**整數**，單位為新台幣元，1～1,000,000 |
| `imageUrl` | 必填，**僅接受 `https://`**，最長 2048；不做檔案上傳 |
| `categoryId` | 必填，須為已存在的分類 |

- 不做庫存、多圖、精選標記（見 `product.md` 非目標）。
- 請求含未定義欄位 → 400，不靜默忽略。
- `id` 為字串（cuid），由伺服器產生，客戶端不可指定。

### 分類

- `Category` 為獨立資料表，**由 seed 建立與維護**；不提供管理員增刪改 API。
- 分類名稱 UNIQUE。分類數量上限為 50（有界資料集，查詢上限同為 50，符合 D-2）。

### 列表查詢參數

| 參數 | 規則 | 預設 |
| --- | --- | --- |
| `page` | 1～1,000,000 的整數（上限避免極大的 OFFSET） | `1` |
| `limit` | 1～50 的整數 | `12` |
| `category` | 分類 id；不存在的分類回空列表，不回 404 | 不篩選 |
| `q` | 去頭尾空白後 1～50 字元；對 `name` 與 `description` 做**不分大小寫的包含**比對；`%`、`_`、`\` 視為一般字元（Prisma 的 `contains` 不會跳脫 LIKE 萬用字元，因此由 `models/like-pattern.ts` 自行跳脫） | 不搜尋 |
| `sort` | `newest`、`price_asc`、`price_desc` | `newest` |

- 不合法的參數（0、負數、非整數、超過上限、未知的 `sort`、空的 `q`、未知的查詢參數）→ 400，不靜默修正。前端沒有關鍵字時請**省略** `q`。
- 排序一律附帶 `id` 作為次要排序，確保分頁結果穩定、不重複不遺漏。
- `page` 超過最後一頁 → 200，`items` 為空陣列。

## API 契約

沿用 `001-auth` 定義的統一回應格式。

| 方法 | 路徑 | 驗證 | 說明 | 成功 |
| --- | --- | --- | --- | --- |
| GET | `/api/products` | 無 | 商品列表 | 200 |
| GET | `/api/products/:id` | 無 | 單一商品 | 200 |
| POST | `/api/products` | 管理員 | 新增商品 | 201 |
| PATCH | `/api/products/:id` | 管理員 | 部分更新 | 200 |
| DELETE | `/api/products/:id` | 管理員 | 軟刪除 | 204 |
| GET | `/api/categories` | 無 | 分類清單 | 200 |

### 請求與回應

- `GET /api/products` → `data: { items: Product[], meta: { page, limit, total, totalPages } }`
- `GET /api/products/:id` → `data: { product }`
- `POST /api/products`：body `{ name, description, price, imageUrl, categoryId }` → `data: { product }`
- `PATCH /api/products/:id`：body 為上述欄位的任意子集，**至少一個欄位** → `data: { product }`
- `DELETE /api/products/:id` → 無內容
- `GET /api/categories` → `data: { items: Category[] }`，依名稱排序
- `Product`：`id`、`name`、`description`、`price`、`imageUrl`、`category: { id, name }`、`createdAt`、`updatedAt`。**不含** `deletedAt`。
- `Category`：`id`、`name`。

### 錯誤碼

沿用 `VALIDATION_ERROR`、`UNAUTHORIZED`、`FORBIDDEN`，**新增**：

| HTTP | code | 情境 |
| --- | --- | --- |
| 404 | `NOT_FOUND` | 商品不存在、已刪除，或 id 格式不符 |

| 情境 | 回應 |
| --- | --- |
| 寫入 API 未帶或帶無效 token | 401 `UNAUTHORIZED` |
| 寫入 API 由一般會員呼叫 | 403 `FORBIDDEN` |
| `categoryId` 不存在 | 400 `VALIDATION_ERROR`，`details` 指出 `categoryId` |
| 更新或刪除已刪除的商品 | 404 `NOT_FOUND`（重複刪除也是 404） |

## 資料模型

`Category`
- `id`（主鍵）、`name`（UNIQUE、NOT NULL）

`Product`
- `id`（主鍵）、`name`、`description`、`price`（整數，NOT NULL）、`imageUrl`（NOT NULL）
- `categoryId`（外鍵 → `Category`，NOT NULL）
- `createdAt`、`updatedAt`、`deletedAt`（可為空）
- 資料庫約束：`price > 0`（CHECK）。
- 索引：`categoryId`、`deletedAt`、`createdAt`。

軟刪除規則：所有公開與管理員查詢一律只取 `deletedAt` 為空的資料；此條件集中在 `product.model` 的單一查詢函式內，避免漏加。

## Seed

- 至少 **4 個分類**（例如：家居、文具、廚房、收納）與 **至少 24 筆商品**，足以展示分頁（預設每頁 12）、分類篩選與搜尋。
- 商品使用固定 id，以 upsert 寫入，重複執行不會產生重複資料（D-3）。
- 圖片使用公開的 `https` 網址。
- 資料中包含可供搜尋測試的關鍵字（例如多筆商品名稱含同一詞、部分只在 `description` 出現）。

## 對前端的影響

- 列表請求使用 `page`、`limit`、`category`、`q`、`sort`；沒有關鍵字時省略 `q`。
- 以 `meta.totalPages` 繪製分頁；超出範圍的頁數會得到空陣列。
- 查無結果是 200 加空陣列，不是 404。
- `imageUrl` 皆為 `https`，可直接用於 `<img>`。
- 單品 404 `NOT_FOUND` 時顯示「商品不存在或已下架」。
- 分類清單來自 `GET /api/categories`，不要寫死。
- 契約變更時依 `AGENTS.md` 流程，於前端 Repo 開對應 issue。

## 驗收條件

- [ ] 未登入可取得列表與單品；回應不含 `deletedAt`。
- [ ] 預設分頁為 `page=1`、`limit=12`；`meta.total` 與 `totalPages` 正確。
- [ ] `limit=51`、`limit=0`、`page=0`、`page=1.5`、`sort=foo`、`q=` 空值、未知查詢參數皆回 400。
- [ ] `page` 超過最後一頁回 200 與空 `items`。
- [ ] `category` 篩選只回該分類商品；不存在的分類回空列表。
- [ ] `q` 不分大小寫，能比對 `name` 與 `description`；`q=%` 只比對字面的 `%`，不會回傳全部商品。
- [ ] 三種排序皆正確；相同價格時順序穩定，逐頁取完無重複、無遺漏。
- [ ] 單品不存在、已刪除、id 格式不符皆回 404 `NOT_FOUND`。
- [ ] 新增商品：未登入 401、一般會員 403、管理員 201。
- [ ] 新增：缺欄位、`price` 為小數／0／負數／超過上限、`imageUrl` 為 `http://`、`categoryId` 不存在、含未定義欄位，皆回 400。
- [ ] 更新：只送部分欄位可成功；空 body 回 400；更新後 `updatedAt` 變動；已刪除商品回 404。
- [ ] 刪除：204；之後列表與單品皆看不到；重複刪除回 404。
- [ ] 刪除商品後，資料庫列仍存在（軟刪除），不影響引用它的資料。
- [ ] `GET /api/categories` 回傳依名稱排序的分類。
- [ ] seed 重複執行，分類與商品數量不變。

## 預計新增或修改的檔案

- `prisma/schema.prisma`（`Category`、`Product`）、`prisma/migrations/*_create_catalog`（含 `price > 0` 的 CHECK）、`prisma/seed.ts`（擴充）、`prisma/seed-catalog.ts`
- `src/routes/product.routes.ts`、`src/routes/category.routes.ts`
- `src/controllers/product.controller.ts`、`src/controllers/category.controller.ts`
- `src/services/product.service.ts`、`src/services/category.service.ts`
- `src/services/pagination.ts`（分頁視窗與 meta 計算，純函式）、`src/models/like-pattern.ts`（LIKE 跳脫，純函式）
- `src/models/product.model.ts`、`src/models/category.model.ts`
- `src/schemas/product.schema.ts`
- `src/middlewares/validate.ts`（新增 `validateQuery`、`requireValidResourceId`）
- `openapi.yaml`（products、categories 路徑；`Product`、`Category`、`ProductListMeta` schema；`NotFound` 回應；`ErrorCode` 新增 `NOT_FOUND`）
- `tests/unit/product.service.test.ts`、`tests/unit/product.schema.test.ts`、`tests/unit/pagination.test.ts`、`tests/unit/like-pattern.test.ts`
- `tests/integration/products.test.ts`、`tests/integration/categories.test.ts`、`tests/integration/seed-catalog.test.ts`

## 測試案例

單元（不需 DB）：
- 查詢正規化：預設值、邊界值（`limit` 1／50／51、`page` 0）、`q` 去空白、未知 `sort`。
- 分頁計算：`skip`、`take`、`totalPages`（`total` 為 0、剛好整除、不整除）。
- 更新時至少一個欄位的判斷。

整合（supertest）：上述驗收條件逐條對應一個案例，另含管理員 middleware 對三種身分（未登入、一般會員、管理員）的結果。

## Constitution Check

- [x] **A 架構**：分層符合 A-1～A-5；查詢與 body 以 zod 在 route 層驗證（A-6）；錯誤走集中 middleware（A-7）；沿用統一回應格式（A-8）；資料表以 Prisma migration 建立（A-9）；API 只新增，`ErrorCode` 新增 `NOT_FOUND` 為新增式變更（A-10）。
- [x] **S 安全**：寫入 API 經 `authenticate` 與 `require-role('ADMIN')`（S-4）；401／403／404 語意固定（S-6）；錯誤不洩漏內部資訊（S-8）；客戶端不可指定 `id`、不可寫入 `deletedAt`。
- [x] **D 資料**：NOT NULL、UNIQUE、外鍵、`price` CHECK（D-1）；商品列表分頁且 `limit` 上限 50，分類為有界資料集且查詢上限 50（D-2）；seed 以固定 id upsert、PATCH 與 DELETE 可安全重複（重複刪除明確回 404）、`POST /api/products` 依 D-3 例外不具冪等性並已於 OpenAPI 標註（D-3）；seed 含 4 個分類與至少 24 筆商品（D-4）。
- [x] **T 測試**：查詢與分頁邏輯為純函式，有單元測試（T-1）；每支 API 整合測試含成功、驗證失敗、未登入、權限不足（T-2）；購物車邊界情況（T-3）不適用本 spec，於 003 處理。
- [x] **X 禁用**：無 controller 直接存取 DB、無客戶端指定角色或 `deletedAt`、無空 catch、無硬寫機密、無未分頁查詢、無就地修改、無未處理 rejection。
- [x] **P 文件**：`openapi.yaml` 同步更新；README 補上 seed 說明。
- 例外與理由：無。

## 已知取捨與待決事項

- 關鍵字搜尋使用資料庫的包含比對，不使用全文索引；在數十到數百筆商品的規模下足夠。
- 無「管理員查看已刪除商品」的 API；若需要，另開 spec。
- 分類不可由 API 管理，新增分類需透過 seed 或 migration。
- 軟刪除的商品之後如何在購物車中呈現，於 `003-cart` 定義。
