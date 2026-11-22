const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * 整合測試會清空資料表，因此資料庫主機必須是本機，避免誤清正式資料。
 * 錯誤訊息不含連線字串，避免帳密外洩。
 */
export function assertLocalTestDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("TEST_DATABASE_URL is not set");
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL");
  }

  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error("TEST_DATABASE_URL must point to a local database host");
  }
  return databaseUrl;
}
