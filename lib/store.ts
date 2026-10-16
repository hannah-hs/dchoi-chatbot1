// 데이터 저장 (따로 데이터베이스 없이 GitHub 비공개 데이터 레포에 파일로 저장합니다)
//
// 데이터 레포 안의 파일 구성
//   knowledge/학습데이터.xlsx   챗봇이 공부하는 엑셀 (상품목록 + Q&A 시트). 운영자가 Q&A 를 고치면 이 파일이 바뀝니다.
//                               아직 없으면 코드 레포의 data/dchoi09_전집_학습데이터.xlsx 를 사용합니다.
//   config/rules.json           챗봇 규칙
//   users/<사용자ID>.json       사용자 정보 + 대화 기록 (사용자 1명 = 파일 1개)
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_RULES } from "./default-rules";
import { buildWorkbook, readWorkbook } from "./excel";
import { FileConflictError, files, readJson, STORAGE_MISSING_MESSAGE, updateJson, withFileLock } from "./files";
import type { ChatMessage, ChatUser, Product, QAItem, Rules } from "./types";

export { STORAGE_MISSING_MESSAGE };
export const storageMode = files.kind;

export const BUNDLED_EXCEL = path.join(process.cwd(), "data", "dchoi09_전집_학습데이터.xlsx");
const KNOWLEDGE_FILE = "knowledge/학습데이터.xlsx";
const RULES_FILE = "config/rules.json";
const userFile = (id: string) => `users/${id}.json`;

interface UserRecord {
  user: ChatUser;
  messages: ChatMessage[];
}

// ---------- 엑셀 (상품목록 + Q&A) ----------
interface Knowledge {
  products: Product[];
  qa: QAItem[];
  sha: string | null; // 데이터 레포 엑셀의 버전 (없으면 null = 기본 엑셀 사용 중)
}

let knowledgeCache: { key: string; value: Knowledge } | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function parseExcel(buf: Buffer, sha: string | null): Promise<Knowledge> {
  const { products, qa } = await readWorkbook(toArrayBuffer(buf));
  return { products: products ?? [], qa: qa ?? [], sha };
}

export async function getKnowledge(): Promise<Knowledge> {
  const remote = await files.read(KNOWLEDGE_FILE);
  const key = remote ? `remote:${remote.sha}` : "bundled";
  if (knowledgeCache?.key === key) return knowledgeCache.value; // 바뀌지 않았으면 다시 읽지 않음
  const value = remote ? await parseExcel(remote.content, remote.sha) : await parseExcel(await fs.readFile(BUNDLED_EXCEL), null);
  knowledgeCache = { key, value };
  return value;
}

export async function getProducts(): Promise<Product[]> {
  return (await getKnowledge()).products;
}
export async function getQA(): Promise<QAItem[]> {
  return (await getKnowledge()).qa;
}

/** 상품목록/Q&A 를 바꿔서 데이터 레포의 엑셀을 새로 저장합니다. */
export function updateKnowledge(
  change: (k: { products: Product[]; qa: QAItem[] }) => { products: Product[]; qa: QAItem[] },
  message: string,
) {
  return withFileLock(KNOWLEDGE_FILE, async () => {
    if (files.kind === "local-file" && process.env.VERCEL) throw new Error(STORAGE_MISSING_MESSAGE);
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await getKnowledge();
      const next = change({ products: current.products, qa: current.qa });
      try {
        await files.write(KNOWLEDGE_FILE, await buildWorkbook(next.products, next.qa), current.sha, message);
        knowledgeCache = null;
        return next;
      } catch (e) {
        if (e instanceof FileConflictError && attempt < 3) {
          knowledgeCache = null;
          continue; // 그 사이 다른 사람이 고쳤으면 다시 읽고 재시도
        }
        throw e;
      }
    }
    throw new Error("엑셀 저장이 계속 겹쳐서 실패했어요. 잠시 후 다시 시도해 주세요.");
  });
}

export async function getKnowledgeExcel(): Promise<Buffer> {
  const remote = await files.read(KNOWLEDGE_FILE);
  return remote ? remote.content : fs.readFile(BUNDLED_EXCEL);
}

// ---------- 규칙 ----------
export async function getRules(): Promise<Rules> {
  return { ...DEFAULT_RULES, ...((await readJson<Rules>(RULES_FILE)) ?? {}) };
}
export async function saveRules(rules: Rules) {
  await updateJson<Rules>(RULES_FILE, () => rules, "챗봇 규칙 수정");
}

// ---------- 사용자 + 대화 기록 ----------
/** 같은 이메일은 항상 같은 ID (파일 이름) 가 됩니다. */
export function userIdFromEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);
}

const recordCache = new Map<string, { sha: string; record: UserRecord }>();

async function readUserRecord(id: string): Promise<UserRecord | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  return readJson<UserRecord>(userFile(id));
}

export async function getUser(id: string): Promise<ChatUser | null> {
  return (await readUserRecord(id))?.user ?? null;
}

export async function getUserWithMessages(id: string): Promise<UserRecord | null> {
  return readUserRecord(id);
}

export async function getMessages(id: string): Promise<ChatMessage[]> {
  return (await readUserRecord(id))?.messages ?? [];
}

/** 입장: 처음이면 만들고, 이미 있으면 이름과 최근 접속 시각만 바꿉니다. */
export async function upsertUser(name: string, email: string): Promise<ChatUser> {
  const id = userIdFromEmail(email);
  const now = new Date().toISOString();
  const rec = await updateJson<UserRecord>(
    userFile(id),
    (cur) =>
      cur
        ? { ...cur, user: { ...cur.user, name, lastActiveAt: now } }
        : { user: { id, name, email, createdAt: now, lastActiveAt: now, warnings: 0, blocked: false }, messages: [] },
    `입장: ${name}`,
  );
  return rec.user;
}

/** 대화 저장 + 사용자 상태 변경을 한 번에 (파일 1개라 한 번만 저장) */
export async function saveChatTurn(id: string, msgs: ChatMessage[], changeUser: (u: ChatUser) => ChatUser) {
  return updateJson<UserRecord>(
    userFile(id),
    (cur) => {
      if (!cur) throw new Error("사용자를 찾을 수 없습니다.");
      return { user: changeUser(cur.user), messages: [...cur.messages, ...msgs] };
    },
    `대화 기록`,
  );
}

export async function updateUser(id: string, change: (u: ChatUser) => ChatUser, message: string) {
  return (
    await updateJson<UserRecord>(
      userFile(id),
      (cur) => {
        if (!cur) throw new Error("사용자를 찾을 수 없습니다.");
        return { ...cur, user: change(cur.user) };
      },
      message,
    )
  ).user;
}

export async function deleteUser(id: string) {
  await files.remove(userFile(id), "사용자 삭제");
  recordCache.delete(id);
}

export async function listUsers(): Promise<ChatUser[]> {
  const entries = (await files.list("users")).filter((f) => f.name.endsWith(".json"));
  const users: ChatUser[] = [];
  // 파일 버전(sha)이 그대로면 이전에 읽은 내용을 다시 씁니다. 바뀐 파일만 8개씩 나눠 읽어요.
  for (let i = 0; i < entries.length; i += 8) {
    const chunk = await Promise.all(
      entries.slice(i, i + 8).map(async ({ name, sha }) => {
        const id = name.replace(/\.json$/, "");
        const cached = recordCache.get(id);
        if (cached?.sha === sha) return cached.record.user;
        const rec = await readUserRecord(id);
        if (rec) recordCache.set(id, { sha, record: rec });
        return rec?.user ?? null;
      }),
    );
    users.push(...chunk.filter((u): u is ChatUser => Boolean(u)));
  }
  return users.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}
