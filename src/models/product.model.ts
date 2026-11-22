import { Prisma } from "../generated/prisma/client.js";
import { escapeLikePattern } from "./like-pattern.js";
import type { PrismaClient } from "./prisma-postgres-client.js";

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly imageUrl: string;
  readonly category: { readonly id: string; readonly name: string };
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProductListCriteria {
  readonly categoryId: string | undefined;
  readonly keyword: string | undefined;
  readonly sort: ProductSort;
  readonly skip: number;
  readonly take: number;
}

export interface ProductPage {
  readonly items: readonly ProductRecord[];
  readonly total: number;
}

export interface ProductFields {
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly imageUrl: string;
  readonly categoryId: string;
}

export type ProductWriteResult =
  | { readonly ok: true; readonly product: ProductRecord }
  | { readonly ok: false; readonly reason: "CATEGORY_NOT_FOUND" | "PRODUCT_NOT_FOUND" };

export interface ProductRepository {
  list(criteria: ProductListCriteria): Promise<ProductPage>;
  findById(id: string): Promise<ProductRecord | null>;
  create(fields: ProductFields): Promise<ProductWriteResult>;
  update(id: string, fields: Partial<ProductFields>): Promise<ProductWriteResult>;
  softDelete(id: string, deletedAt: Date): Promise<boolean>;
}

const RECORD_NOT_FOUND = "P2025";
const FOREIGN_KEY_VIOLATION = "P2003";

/**
 * 軟刪除的條件集中在這裡，所有公開與管理員查詢都必須經過它，避免漏加。
 */
const NOT_DELETED = { deletedAt: null } satisfies Prisma.ProductWhereInput;

const WITH_CATEGORY = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

function toRecord(row: {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
}): ProductRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageUrl: row.imageUrl,
    category: { id: row.category.id, name: row.category.name },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildWhere(criteria: ProductListCriteria): Prisma.ProductWhereInput {
  const keywordFilter =
    criteria.keyword === undefined
      ? []
      : [
          {
            OR: [
              { name: { contains: escapeLikePattern(criteria.keyword), mode: "insensitive" } },
              {
                description: { contains: escapeLikePattern(criteria.keyword), mode: "insensitive" },
              },
            ],
          } satisfies Prisma.ProductWhereInput,
        ];
  const categoryFilter =
    criteria.categoryId === undefined ? [] : [{ categoryId: criteria.categoryId }];
  return { AND: [NOT_DELETED, ...categoryFilter, ...keywordFilter] };
}

/**
 * 一律附帶 `id` 作為次要排序，確保分頁結果穩定、不重複不遺漏。
 */
function buildOrderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

function prismaErrorCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

function toWriteFailure(error: unknown): ProductWriteResult {
  const code = prismaErrorCode(error);
  if (code === FOREIGN_KEY_VIOLATION) return { ok: false, reason: "CATEGORY_NOT_FOUND" };
  if (code === RECORD_NOT_FOUND) return { ok: false, reason: "PRODUCT_NOT_FOUND" };
  throw error;
}

export function createPrismaProductRepository(prisma: PrismaClient): ProductRepository {
  return {
    async list(criteria) {
      const where = buildWhere(criteria);
      const [total, rows] = await prisma.$transaction([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          orderBy: buildOrderBy(criteria.sort),
          skip: criteria.skip,
          take: criteria.take,
          include: WITH_CATEGORY,
        }),
      ]);
      return { total, items: rows.map(toRecord) };
    },

    async findById(id) {
      const row = await prisma.product.findFirst({
        where: { id, ...NOT_DELETED },
        include: WITH_CATEGORY,
      });
      return row === null ? null : toRecord(row);
    },

    async create(fields) {
      try {
        const row = await prisma.product.create({ data: { ...fields }, include: WITH_CATEGORY });
        return { ok: true, product: toRecord(row) };
      } catch (error) {
        return toWriteFailure(error);
      }
    },

    async update(id, fields) {
      try {
        const row = await prisma.product.update({
          where: { id, ...NOT_DELETED },
          data: { ...fields },
          include: WITH_CATEGORY,
        });
        return { ok: true, product: toRecord(row) };
      } catch (error) {
        return toWriteFailure(error);
      }
    },

    async softDelete(id, deletedAt) {
      const { count } = await prisma.product.updateMany({
        where: { id, ...NOT_DELETED },
        data: { deletedAt },
      });
      return count > 0;
    },
  };
}
