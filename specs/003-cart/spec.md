# 003 — Cart：購物車

狀態：Draft

依賴：`001-auth`（`authenticate`、統一回應格式與錯誤碼）、`002-products`（`Product`、軟刪除、`NOT_FOUND`）。

## 目的

讓登入的會員查看購物車、設定商品數量（含加入）、移除商品。購物車資料存在後端，前端每次操作後以回應覆蓋本地狀態，確保與後端一致。

## 需求

### 功能

1. 登入的會員可查看自己的購物車。
2. 可將商品加入購物車，或調整其數量。
3. 可移除購物車中的項目。
4. 每個會員隱含一個購物車；只能操作自己的購物車。
5. 購物車中的商品被管理員刪除（軟刪除）後，項目仍保留並標示為不可購買，使用者可自行移除。

### 設計重點

- **以「設定數量」取代「累加」**：`PUT` 把數量設成指定值，沒有該項目就新增。重複送出相同請求結果相同，符合 D-3。前端的「加入」＝目前數量 + 1（前端本來就持有最新的購物車）。
- **無購物車 id、無 userId**：身分一律取自 token（S-5），網址與 body 都不含 `userId`，從結構上無法越權。
- **所有登入者皆可使用**：管理員也能擁有購物車。
- **價格不做快照**：一律使用商品目前價格（本期沒有訂單）。
- 本期不提供「清空購物車」。

### 數量與容量規則

| 項目 | 規則 |
| --- | --- |
| `quantity` | 整數，1～99。0、負數、小數、超過 99、非數字 → 400。要移除請用 `DELETE` |
| 品項上限 | 最多 **50 種**商品。新增第 51 種 → 400 `VALIDATION_ERROR`，`details` 說明購物車已滿 |
| 已存在的項目 | 達品項上限時仍可修改其數量 |

- 請求含未定義欄位 → 400。

## API 契約

沿用統一回應格式。以下全部需要 access token。

| 方法 | 路徑 | 說明 | 成功 |
| --- | --- | --- | --- |
| GET | `/api/cart` | 查看購物車 | 200 |
| PUT | `/api/cart/items/{productId}` | 設定數量（沒有則新增） | 200 |
| DELETE | `/api/cart/items/{productId}` | 移除項目 | 200 |

### 請求與回應

- `GET /api/cart` → `data: { cart }`
- `PUT /api/cart/items/{productId}`：body `{ quantity }` → `data: { cart }`。新增與更新皆回 200（重複送出結果相同）。
- `DELETE /api/cart/items/{productId}` → `data: { cart }`（移除後的完整購物車）。

`cart`：

```json
{
  "items": [
    {
      "product": { "id": "...", "name": "...", "price": 580, "imageUrl": "https://...", "category": { "id": "...", "name": "..." } },
      "quantity": 2,
      "subtotal": 1160,
      "available": true
    }
  ],
  "itemCount": 1,
  "totalQuantity": 2,
  "totalPrice": 1160
}
```

- `items` 依加入時間排序（`createdAt`，再以 `id` 為次要排序）。
- `subtotal`＝商品目前價格 × `quantity`。
- `available`：商品未被刪除為 `true`。`false` 的項目仍回傳商品資料（供畫面顯示），但**不計入** `totalQuantity` 與 `totalPrice`。
- `itemCount`：項目數（含不可購買者）。
- 購物車為空時 `items` 為 `[]`，三個統計值為 0。

### 錯誤碼

沿用既有錯誤碼，無新增。

| 情境 | 回應 |
| --- | --- |
| 未帶、無效或過期的 token | 401 `UNAUTHORIZED` |
| `quantity` 不合法或缺少、含未定義欄位 | 400 `VALIDATION_ERROR` |
| 購物車已滿（新增第 51 種） | 400 `VALIDATION_ERROR` |
| `PUT` 的商品不存在、已刪除或 id 格式不符 | 404 `NOT_FOUND` |
| `DELETE` 的項目不在購物車中（含重複移除） | 404 `NOT_FOUND` |

## 資料模型

`CartItem`
- `id`（主鍵）
- `userId`（外鍵 → `User`，NOT NULL，使用者刪除時連帶刪除）
- `productId`（外鍵 → `Product`，NOT NULL，不連帶刪除；商品只做軟刪除）
- `quantity`（整數，NOT NULL，CHECK 1～99）
- `createdAt`、`updatedAt`
- UNIQUE(`userId`, `productId`)；索引：`userId`

資料庫的 UNIQUE 約束從底層保證同一會員同一商品只有一筆，不依賴應用層檢查。

查詢購物車時，`cart.model` 需**連同已軟刪除的商品一併取出**（這是對 002 的「查詢一律排除已刪除商品」的明確例外，只限購物車讀取，並由 `available` 欄位標示）。

## 對前端的影響

- 進入網站、登入後與每次操作後，以回應的 `cart` 覆蓋本地購物車狀態。
- 「加入購物車」：以本地購物車目前數量 + 1 呼叫 `PUT`；沒有該項目就用 1。成功後顯示明確回饋（toast 等）。
- 未登入點擊加入：前端導向登入，不呼叫 API；若呼叫則得到 401。
- 前端應在 `quantity` 達 99 時停用「增加」，並處理 400 的錯誤訊息。
- `available: false` 的項目要以不同樣式顯示，提供「移除」，且不可調整數量（`PUT` 會得到 404）。
- 兩個分頁同時操作時，採「最後寫入為準」，每次回應都會把狀態校正回後端資料。
- 契約變更時依 `AGENTS.md` 流程，於前端 Repo 開對應 issue。

## 驗收條件

- [ ] 所有購物車 API 未登入回 401。
- [ ] 新會員 `GET /api/cart` 回 200，`items` 為 `[]`，統計值為 0。
- [ ] `PUT` 新商品：200，購物車有該項目，`quantity` 正確。
- [ ] 對同一商品重複送出相同 `PUT` 兩次：結果相同，只有一筆項目、數量不變。
- [ ] 對已有項目 `PUT` 不同數量：數量被設為新值，不是累加。
- [ ] `quantity` 為 0、-1、1.5、100、`"2"`（字串）、缺少、`null` 皆回 400。
- [ ] 含未定義欄位（如 `userId`、`price`）回 400。
- [ ] 商品不存在、已刪除、id 格式不符時 `PUT` 回 404。
- [ ] 購物車已有 50 種商品時，`PUT` 新商品回 400；`PUT` 既有項目的數量仍成功。
- [ ] `DELETE` 既有項目：200，回傳的購物車不再含該項目；重複 `DELETE` 回 404。
- [ ] `DELETE` 不在購物車中的商品回 404。
- [ ] 會員 A 無法看到或修改會員 B 的購物車（兩人各自加入同一商品，互不影響）。
- [ ] 管理員刪除商品後，購物車仍回傳該項目，`available: false`，且不計入 `totalQuantity`、`totalPrice`。
- [ ] 已不可購買的項目可以 `DELETE`，`PUT` 回 404。
- [ ] `subtotal`、`totalQuantity`、`totalPrice`、`itemCount` 計算正確。
- [ ] 商品改價後，購物車顯示新價格。
- [ ] 同一會員、同一商品並發 `PUT` 時，資料庫仍只有一筆（UNIQUE 約束）。

## 預計新增或修改的檔案

- `prisma/schema.prisma`（`CartItem`）
- `src/routes/cart.routes.ts`
- `src/controllers/cart.controller.ts`
- `src/services/cart.service.ts`
- `src/services/cart-summary.service.ts`（統計計算，純函式）
- `src/models/cart-item.model.ts`
- `src/schemas/cart.schema.ts`
- `openapi.yaml`（cart 路徑、`Cart`、`CartItem` schema；可於實作時一併補，或另開 docs PR）
- `tests/unit/cart.service.test.ts`、`tests/unit/cart-summary.service.test.ts`
- `tests/integration/cart.test.ts`

## 測試案例

單元（不需 DB）：
- 統計計算：空購物車、多項目、含不可購買項目（不計入）、數量與單價邊界（99 × 1,000,000）。
- 容量規則：新增第 50／51 種、修改既有項目於已滿時。
- 數量驗證的邊界值。

整合（supertest）：上述驗收條件逐條對應一個案例（T-3 的邊界情況都在此）。

## Constitution Check

- [x] **A 架構**：分層符合 A-1～A-5；body 與 path 以 zod 在 route 層驗證（A-6）；錯誤走集中 middleware（A-7）；沿用統一回應格式（A-8）；資料表以 Prisma migration 建立（A-9）；API 只新增（A-10）。
- [x] **S 安全**：所有 API 經 `authenticate`；身分一律取自 token，請求不含 `userId`（S-5）；401／404 語意固定（S-6）；錯誤不洩漏內部資訊（S-8）。
- [x] **D 資料**：外鍵、NOT NULL、UNIQUE(`userId`, `productId`)、`quantity` CHECK（D-1）；購物車品項上限 50，查詢有界（D-2）；`PUT` 為冪等的設定語意，`DELETE` 重複時明確回 404（D-3）；本 spec 不需新增 seed（D-4，沿用 001、002 的測試帳號與商品）。
- [x] **T 測試**：統計與容量規則為純函式，有單元測試（T-1）；每支 API 整合測試含成功、驗證失敗、未登入（T-2）；重複加入、商品不存在、數量不合理、越權存取皆有案例（T-3）。權限不足不適用（無角色限制）。
- [x] **X 禁用**：無 controller 直接存取 DB、無客戶端指定 `userId`、無空 catch、無硬寫機密、無未限制的列表、無就地修改、無未處理 rejection。
- [x] **P 文件**：`openapi.yaml` 同步更新；README 補上購物車說明。
- 例外與理由：無（對 002 軟刪除查詢規則的例外已在「資料模型」明確記載，屬 002 的設計範圍內）。

## 已知取捨與待決事項

- 「最後寫入為準」：兩個分頁同時設定數量時，後到的覆蓋先到的；換來的是冪等與簡單。
- 品項上限在交易內以計數檢查；極端並發下可能短暫超過 50，影響很小，本期接受。
- 價格不做快照；若日後有訂單，需在下單時記錄當下價格，另開 spec。
- 無「清空購物車」；若前端需要，另開 spec（新增式變更）。
- 已不可購買的項目不會自動清除，需使用者移除。
