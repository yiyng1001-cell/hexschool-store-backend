# Structure — 專案結構與命名

按**層**分資料夾（對應題目的 MVC 要求）。依賴方向與分層職責見 `specs/constitution.md` A-1～A-5，此處不重述。

## 目錄樹

```
.
├── AGENTS.md
├── openapi.yaml            # API 契約單一來源（P-1）
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js             # D-4
├── specs/
│   ├── constitution.md
│   ├── product.md
│   ├── structure.md
│   └── NNN-feature/spec.md
├── src/
│   ├── app.js              # 組裝 Express app（不啟動 server，方便 supertest）
│   ├── server.js           # 啟動 server
│   ├── config/             # 讀取並驗證環境變數
│   ├── routes/             # *.routes.js
│   ├── controllers/        # *.controller.js
│   ├── services/           # *.service.js
│   ├── models/             # *.model.js（唯一接觸 Prisma 的地方）
│   ├── schemas/            # *.schema.js（zod 驗證）
│   ├── middlewares/        # auth、role、validate、error-handler
│   └── errors/             # 具型別錯誤類別
└── tests/
    ├── unit/               # 對應 services
    └── integration/        # 對應 API（supertest）
```

## 各層放什麼

| 資料夾 | 放什麼 | 不放什麼 |
| --- | --- | --- |
| `routes/` | 路徑、middleware 串接、controller 綁定 | 任何邏輯 |
| `controllers/` | 取出已驗證輸入、呼叫 service、組回應 | 業務規則、資料庫存取 |
| `services/` | 業務邏輯，以純函式為主 | HTTP 物件（req/res）、Prisma |
| `models/` | Prisma 查詢與資料存取 | 業務規則 |
| `schemas/` | zod schema（body、query、params） | 業務規則 |
| `middlewares/` | 驗證 JWT、檢查角色、套用 schema、集中錯誤處理 | 業務邏輯 |
| `errors/` | 錯誤類別（含 HTTP status 與錯誤碼） | 回應組裝 |
| `config/` | 環境變數讀取與驗證，啟動時失敗即停止 | 其他設定散落處 |

## 命名規則

- 檔名：`kebab-case` 加層級後綴，如 `cart.controller.js`、`product.service.js`、`user.model.js`、`auth.schema.js`。
- 一個檔案對應一個資源（`user`、`product`、`cart`），單數名詞。
- URL 路徑：複數名詞、`kebab-case`，如 `/api/products`、`/api/cart/items`。
- 錯誤類別：`PascalCase` 加 `Error`，如 `NotFoundError`、`ValidationError`。
- 資料庫：Prisma model 用單數 `PascalCase`，資料表以 `@@map` 對應 `snake_case` 複數。
- 測試檔：與被測檔同名，後綴 `.test.js`，如 `cart.service.test.js`。
- 一般命名原則（意圖明確、不用 `data`／`info` 等泛稱）見全域規則，此處不重述。

## 模組邊界

- 跨層呼叫只能依 A-1 的方向；`models/` 不得 import `services/`。
- 一個 service 需要其他資源時，呼叫對方的 service，不直接 import 對方的 model。
- 共用工具只放 `src/errors`、`src/config`、`src/middlewares`，不建立無邊界的 `utils/`。
- `src/app.js` 不得呼叫 `listen`，只有 `src/server.js` 啟動服務。

## 測試對應

- `tests/unit/`：services，不需真實 DB（T-1）。
- `tests/integration/`：每支 API 一個檔案，涵蓋 T-2、T-3。
- 測試資料由測試自行建立或使用 seed，不依賴手動資料。

## Spec 與結構對應

- `specs/NNN-feature/spec.md` 的「資料模型」對應 `prisma/schema.prisma`。
- 「API 契約」對應 `openapi.yaml`、`routes/`、`schemas/`。
- 「驗收條件」對應 `tests/`。
- 每份 spec 須列出預計新增或修改的檔案路徑。
