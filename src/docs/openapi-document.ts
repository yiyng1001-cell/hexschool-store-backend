import { readFileSync } from "node:fs";
import { parse } from "yaml";

export type OpenApiDocument = Readonly<Record<string, unknown>>;

// 此檔在 `src/docs`（開發）與 `dist/docs`（編譯後）的深度相同，因此兩者都能找到根目錄的檔案。
const DEFAULT_OPENAPI_PATH = new URL("../../openapi.yaml", import.meta.url);

export class OpenApiDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenApiDocumentError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOpenApiDocument(yamlText: string): OpenApiDocument {
  const parsed: unknown = parse(yamlText);
  if (!isRecord(parsed) || typeof parsed["openapi"] !== "string" || !isRecord(parsed["paths"])) {
    throw new OpenApiDocumentError("openapi.yaml must be an OpenAPI document with `paths`");
  }
  return parsed;
}

export function loadOpenApiDocument(source: URL | string = DEFAULT_OPENAPI_PATH): OpenApiDocument {
  return parseOpenApiDocument(readFileSync(source, "utf8"));
}

/**
 * 把 `servers` 換成實際部署的網址，讓「Try it out」與 Postman 匯入都打到正確的伺服器。
 * 未提供時使用相對路徑 `/`，即目前這個網域。回傳新物件，不修改原文件。
 */
export function withServerUrl(
  document: OpenApiDocument,
  publicBaseUrl: string | undefined,
): OpenApiDocument {
  const url = publicBaseUrl ?? "/";
  return { ...document, servers: [{ url, description: "目前的伺服器" }] };
}
