// 데이터 저장소
// - Vercel 에서는 Upstash Redis(무료)를 사용합니다. (환경변수 KV_REST_API_URL / KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
// - 내 컴퓨터에서 테스트할 때는 .data/db.json 파일에 저장합니다.
import { Redis } from "@upstash/redis";
import { promises as fs } from "node:fs";
import path from "node:path";
import seedProducts from "@/data/products.json";
import seedQA from "@/data/qa.json";
import { DEFAULT_RULES } from "./default-rules";
import type { ChatMessage, ChatUser, Product, QAItem, Rules } from "./types";

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export const storageMode = redis ? "redis" : "local-file";

// ---------- 내 컴퓨터용 파일 저장 ----------
interface LocalDB {
  kv: Record<string, unknown>;
  users: Record<string, ChatUser>;
  messages: Record<string, ChatMessage[]>;
}
const DB_FILE = path.join(process.cwd(), ".data", "db.json");

async function readLocal(): Promise<LocalDB> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as LocalDB;
  } catch {
    return { kv: {}, users: {}, messages: {} };
  }
}
// 여러 요청이 동시에 파일을 고치면 내용이 깨지므로, 고치는 작업은 한 줄로 세워서 하나씩 처리합니다.
let localQueue: Promise<unknown> = Promise.resolve();
function updateLocal(change: (db: LocalDB) => void): Promise<void> {
  if (process.env.VERCEL) {
    throw new Error("Vercel 에서는 Upstash Redis 연결이 필요합니다. 안내서(README)의 'Redis 연결' 단계를 확인하세요.");
  }
  const run = localQueue.then(async () => {
    const db = await readLocal();
    change(db);
    await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, DB_FILE); // 다 쓴 다음에 한 번에 바꿔치기
  });
  localQueue = run.catch(() => {});
  return run;
}

// ---------- 공통 key-value ----------
async function getKV<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  return ((await readLocal()).kv[key] as T) ?? null;
}
async function setKV<T>(key: string, value: T) {
  if (redis) {
    await redis.set(key, value);
    return;
  }
  await updateLocal((db) => {
    db.kv[key] = value;
  });
}

// ---------- 상품 / Q&A / 규칙 ----------
export async function getProducts(): Promise<Product[]> {
  return (await getKV<Product[]>("products")) ?? (seedProducts as Product[]);
}
export async function saveProducts(products: Product[]) {
  await setKV("products", products);
}

export async function getQA(): Promise<QAItem[]> {
  return (await getKV<QAItem[]>("qa")) ?? (seedQA as QAItem[]);
}
export async function saveQA(items: QAItem[]) {
  await setKV("qa", items);
}

export async function getRules(): Promise<Rules> {
  return { ...DEFAULT_RULES, ...((await getKV<Rules>("rules")) ?? {}) };
}
export async function saveRules(rules: Rules) {
  await setKV("rules", rules);
}

// ---------- 사용자 ----------
export async function getUser(id: string): Promise<ChatUser | null> {
  if (redis) return (await redis.hget<ChatUser>("users", id)) ?? null;
  return (await readLocal()).users[id] ?? null;
}

export async function findUserByEmail(email: string): Promise<ChatUser | null> {
  if (redis) {
    const id = await redis.get<string>(`user-email:${email}`);
    return id ? getUser(id) : null;
  }
  return Object.values((await readLocal()).users).find((u) => u.email === email) ?? null;
}

export async function saveUser(user: ChatUser) {
  if (redis) {
    await redis.hset("users", { [user.id]: user });
    await redis.set(`user-email:${user.email}`, user.id);
    return;
  }
  await updateLocal((db) => {
    db.users[user.id] = user;
  });
}

export async function listUsers(): Promise<ChatUser[]> {
  const users = redis
    ? Object.values((await redis.hgetall<Record<string, ChatUser>>("users")) ?? {})
    : Object.values((await readLocal()).users);
  return users.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export async function deleteUser(id: string) {
  const user = await getUser(id);
  if (redis) {
    await redis.hdel("users", id);
    await redis.del(`msgs:${id}`);
    if (user) await redis.del(`user-email:${user.email}`);
    return;
  }
  await updateLocal((db) => {
    delete db.users[id];
    delete db.messages[id];
  });
}

// ---------- 대화 기록 ----------
export async function getMessages(userId: string): Promise<ChatMessage[]> {
  if (redis) return (await redis.lrange<ChatMessage>(`msgs:${userId}`, 0, -1)) ?? [];
  return (await readLocal()).messages[userId] ?? [];
}

export async function appendMessages(userId: string, msgs: ChatMessage[]) {
  if (redis) {
    await redis.rpush(`msgs:${userId}`, ...msgs);
    return;
  }
  await updateLocal((db) => {
    db.messages[userId] = [...(db.messages[userId] ?? []), ...msgs];
  });
}
