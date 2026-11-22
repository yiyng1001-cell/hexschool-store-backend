import type {
  CreateUserResult,
  NewUser,
  UserRecord,
  UserRepository,
} from "../../src/models/user.model.js";

export interface FakeUserRepository extends UserRepository {
  readonly records: () => readonly UserRecord[];
  readonly seed: (record: UserRecord) => void;
}

/**
 * 記憶體版的 UserRepository，讓 service 單元測試不需要資料庫。
 */
export function createFakeUserRepository(): FakeUserRepository {
  const byId = new Map<string, UserRecord>();
  let nextId = 1;

  const findByEmail = async (email: string): Promise<UserRecord | null> =>
    [...byId.values()].find((record) => record.email === email) ?? null;

  return {
    records: () => [...byId.values()],
    seed: (record) => {
      byId.set(record.id, record);
    },
    findByEmail,
    findById: async (id) => byId.get(id) ?? null,
    async create(newUser: NewUser): Promise<CreateUserResult> {
      if ((await findByEmail(newUser.email)) !== null) {
        return { ok: false, reason: "EMAIL_TAKEN" };
      }
      const user: UserRecord = {
        id: `user-${nextId++}`,
        ...newUser,
        role: "USER",
        createdAt: new Date("2026-11-22T00:00:00.000Z"),
      };
      byId.set(user.id, user);
      return { ok: true, user };
    },
  };
}
