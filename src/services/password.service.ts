import { compare, hash } from "bcryptjs";

export const DEFAULT_BCRYPT_COST = 12;

/**
 * 固定的 cost 12 假雜湊，供「找不到使用者」時做一次等價的比對，
 * 讓回應時間不洩漏 email 是否存在。它不對應任何真實密碼。
 */
const DECOY_BCRYPT_HASH = "$2b$12$izhVoW9iG7kphEtg9QMmyejhYV9HeodJU/7eM/4/gCYPClBvNn.t.";

export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
  verifyAgainstDecoy(plainPassword: string): Promise<void>;
}

export function createBcryptPasswordHasher(cost: number = DEFAULT_BCRYPT_COST): PasswordHasher {
  if (!Number.isInteger(cost) || cost < 4 || cost > 31) {
    throw new RangeError("bcrypt cost must be an integer between 4 and 31");
  }

  return {
    hash: (plainPassword) => hash(plainPassword, cost),
    verify: (plainPassword, passwordHash) => compare(plainPassword, passwordHash),
    async verifyAgainstDecoy(plainPassword) {
      await compare(plainPassword, DECOY_BCRYPT_HASH);
    },
  };
}
