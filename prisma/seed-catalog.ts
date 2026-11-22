import type { PrismaClient } from "../src/models/prisma-postgres-client.js";

export interface SeedCategory {
  readonly id: string;
  readonly name: string;
}

export interface SeedProduct {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly categoryId: string;
}

const HOME = "seed-category-home";
const STATIONERY = "seed-category-stationery";
const KITCHEN = "seed-category-kitchen";
const STORAGE = "seed-category-storage";

export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { id: HOME, name: "家居" },
  { id: STATIONERY, name: "文具" },
  { id: KITCHEN, name: "廚房" },
  { id: STORAGE, name: "收納" },
];

/**
 * 資料刻意設計成能展示：分頁（24 筆、每頁 12 筆）、分類篩選（各 6 筆）、
 * 關鍵字搜尋（「木質」只出現在名稱、「棉麻」同時出現在名稱與說明、英文 LED 大小寫混用）、
 * 以及價格排序的穩定性（多筆同價）。
 */
export const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    id: "seed-product-01",
    name: "木質香氛蠟燭",
    description: "天然大豆蠟，燃燒時間約 40 小時。",
    price: 480,
    categoryId: HOME,
  },
  {
    id: "seed-product-02",
    name: "棉麻抱枕套",
    description: "柔軟透氣的棉麻布料，可拆洗。",
    price: 380,
    categoryId: HOME,
  },
  {
    id: "seed-product-03",
    name: "LED 夜燈",
    description: "USB-C 充電，亮度可調的 led 小夜燈。",
    price: 580,
    categoryId: HOME,
  },
  {
    id: "seed-product-04",
    name: "北歐風地毯",
    description: "防滑底部設計，適合客廳與臥室。",
    price: 1980,
    categoryId: HOME,
  },
  {
    id: "seed-product-05",
    name: "陶瓷花瓶",
    description: "手工上釉，每一件的紋路都略有不同。",
    price: 680,
    categoryId: HOME,
  },
  {
    id: "seed-product-06",
    name: "木質掛鉤架",
    description: "免打孔安裝，可承重 5 公斤。",
    price: 320,
    categoryId: HOME,
  },
  {
    id: "seed-product-07",
    name: "木質鋼筆",
    description: "胡桃木筆身，附墨水卡匣。",
    price: 880,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-08",
    name: "方格筆記本",
    description: "100 磅厚紙，書寫不透墨。",
    price: 180,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-09",
    name: "磁吸書籤組",
    description: "一組六入，夾在書頁上不易掉落。",
    price: 120,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-10",
    name: "日系鉛筆套組",
    description: "12 支裝，附削筆器。",
    price: 260,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-11",
    name: "皮革筆袋",
    description: "植鞣革製作，越用越有光澤。",
    price: 580,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-12",
    name: "LED 閱讀夾燈",
    description: "可夾在書本或桌邊的護眼 LED 燈。",
    price: 420,
    categoryId: STATIONERY,
  },
  {
    id: "seed-product-13",
    name: "木質砧板",
    description: "選用櫸木，雙面可用，附掛繩。",
    price: 780,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-14",
    name: "不鏽鋼保溫杯",
    description: "真空雙層，保溫保冷 12 小時。",
    price: 680,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-15",
    name: "手沖咖啡濾杯",
    description: "陶瓷材質，適合 1 至 4 人份。",
    price: 520,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-16",
    name: "棉麻隔熱手套",
    description: "雙層棉麻布料，可耐 200 度高溫。",
    price: 280,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-17",
    name: "陶瓷餐盤組",
    description: "四件組，可進烤箱與洗碗機。",
    price: 980,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-18",
    name: "玻璃密封罐",
    description: "附矽膠密封圈，適合收納乾貨。",
    price: 350,
    categoryId: KITCHEN,
  },
  {
    id: "seed-product-19",
    name: "木質收納盒",
    description: "桌面小物收納，天然橡木。",
    price: 580,
    categoryId: STORAGE,
  },
  {
    id: "seed-product-20",
    name: "棉麻收納籃",
    description: "可折疊，適合放在櫃子或地板。",
    price: 450,
    categoryId: STORAGE,
  },
  {
    id: "seed-product-21",
    name: "桌面抽屜整理盤",
    description: "可自由組合的分格設計。",
    price: 240,
    categoryId: STORAGE,
  },
  {
    id: "seed-product-22",
    name: "折疊衣物收納箱",
    description: "大容量，附透明窗方便辨識。",
    price: 680,
    categoryId: STORAGE,
  },
  {
    id: "seed-product-23",
    name: "壁掛收納袋",
    description: "多口袋設計，門後或牆面皆可使用。",
    price: 320,
    categoryId: STORAGE,
  },
  {
    id: "seed-product-24",
    name: "旅行收納包組",
    description: "三件組，採用輕量棉麻材質。",
    price: 580,
    categoryId: STORAGE,
  },
];

const FIRST_CREATED_AT_MS = Date.UTC(2026, 10, 1);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function seedImageUrl(productId: string): string {
  return `https://picsum.photos/seed/${productId}/600/600`;
}

/**
 * 以固定 id 做 upsert，重複執行不會產生重複資料（D-3）。
 * 更新時不碰 `deletedAt`，被管理員刪除的商品不會因重新 seed 而復活。
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: { ...category },
      update: { name: category.name },
    });
  }

  for (const [index, product] of SEED_PRODUCTS.entries()) {
    const fields = {
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: seedImageUrl(product.id),
      categoryId: product.categoryId,
    };
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        ...fields,
        createdAt: new Date(FIRST_CREATED_AT_MS + index * ONE_DAY_MS),
      },
      update: fields,
    });
  }
}
