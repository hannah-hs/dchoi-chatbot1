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
async function writeLocal(db: LocalDB) {
  if (process.env.VERCEL) {
    throw new Error("Vercel 에서는 Upstash Redis 연결이 필요합니다. 안내서(README)의 'Redis 연결' 단계를 확인하세요.");
  }
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
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
  const db = await readLocal();
  db.kv[key] = value;
  await writeLocal(db);
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
  const db = await readLocal();
  db.users[user.id] = user;
  await writeLocal(db);
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
  const db = await readLocal();
  delete db.users[id];
  delete db.messages[id];
  await writeLocal(db);
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
  const db = await readLocal();
  db.messages[userId] = [...(db.messages[userId] ?? []), ...msgs];
  await writeLocal(db);
}
