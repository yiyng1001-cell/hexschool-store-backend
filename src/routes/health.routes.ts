import { Router } from "express";

/**
 * 只檢查服務存活，不查資料庫，讓部署平台與外部排程的請求不會喚醒資料庫。
 */
export function createHealthRouter(): Router {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  return router;
}
