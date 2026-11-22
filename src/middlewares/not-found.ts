import type { RequestHandler } from "express";
import { NotFoundError } from "../errors/http-errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError("路徑不存在"));
};
