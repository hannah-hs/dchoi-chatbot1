// 파일 보관함: 데이터를 "파일"로 읽고 씁니다.
// - Vercel(운영): 비공개 GitHub 데이터 레포에 저장 (환경변수 GITHUB_TOKEN, GITHUB_DATA_REPO)
// - 내 컴퓨터(테스트): 이 폴더의 .data/ 아래에 저장
import { promises as fs } from "node:fs";
import path from "node:path";

export interface StoredFile {
  content: Buffer;
  sha: string; // 파일 버전 표시 (GitHub 의 blob sha, 로컬은 수정 시각)
}

export class FileConflictError extends Error {}

export interface FileStore {
  kind: "github" | "local-file";
  read(file: string): Promise<StoredFile | null>;
  /** sha 가 다르면(그 사이 누가 고쳤으면) FileConflictError */
  write(file: string, content: Buffer, sha: string | null, message: string): Promise<void>;
  remove(file: string, message: string): Promise<void>;
  list(dir: string): Promise<{ name: string; sha: string }[]>;
}

// ---------------- GitHub ----------------
const GITHUB_API = "https://api.github.com";

class GitHubFileStore implements FileStore {
  kind = "github" as const;
  private etags = new Map<string, { etag: string; file: StoredFile }>();

  constructor(
    private repo: string,
    private token: string,
  ) {}

  private url(file: string) {
    return `${GITHUB_API}/repos/${this.repo}/contents/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  private async call(url: string, init: RequestInit = {}, extra: Record<string, string> = {}) {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "dchoi-chatbot",
        ...extra,
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`GitHub 접근 권한 오류 (${res.status}). GITHUB_TOKEN 과 데이터 레포 권한(Contents: Read and write)을 확인해 주세요.`);
    }
    return res;
  }

  async read(file: string): Promise<StoredFile | null> {
    const cached = this.etags.get(file);
    // 바뀌지 않았으면 304 가 오고, GitHub 사용 한도도 줄지 않습니다.
    const res = await this.call(this.url(file), {}, cached ? { "If-None-Match": cached.etag } : {});
    if (res.status === 304 && cached) return cached.file;
    if (res.status === 404) {
      this.etags.delete(file);
      return null;
    }
    if (!res.ok) throw new Error(`GitHub 읽기 실패 (${res.status}) ${file}`);
    const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
    let b64 = meta.content ?? "";
    if (meta.encoding === "none" || !b64) {
      // 1MB 가 넘는 파일은 blob 으로 따로 받아옵니다.
      const blob = await this.call(`${GITHUB_API}/repos/${this.repo}/git/blobs/${meta.sha}`);
      if (!blob.ok) throw new Error(`GitHub 읽기 실패 (${blob.status}) ${file}`);
      b64 = ((await blob.json()) as { content: string }).content;
    }
    const stored = { content: Buffer.from(b64, "base64"), sha: meta.sha };
    const etag = res.headers.get("etag");
    if (etag) this.etags.set(file, { etag, file: stored });
    return stored;
  }

  async write(file: string, content: Buffer, sha: string | null, message: string) {
    const res = await this.call(this.url(file), {
      method: "PUT",
      body: JSON.stringify({ message, content: content.toString("base64"), ...(sha ? { sha } : {}) }),
    });
    if (res.status === 409 || res.status === 422) throw new FileConflictError(file);
    if (!res.ok) throw new Error(`GitHub 저장 실패 (${res.status}) ${file}: ${await res.text()}`);
    this.etags.delete(file);
  }

  async remove(file: string, message: string) {
    const current = await this.read(file);
    if (!current) return;
    const res = await this.call(this.url(file), {
      method: "DELETE",
      body: JSON.stringify({ message, sha: current.sha }),
    });
    if (res.status === 409 || res.status === 422) throw new FileConflictError(file);
    if (!res.ok && res.status !== 404) throw new Error(`GitHub 삭제 실패 (${res.status}) ${file}`);
    this.etags.delete(file);
  }

  async list(dir: string) {
    const res = await this.call(this.url(dir));
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub 목록 읽기 실패 (${res.status}) ${dir}`);
    const items = (await res.json()) as { name: string; sha: string; type: string }[];
    return Array.isArray(items) ? items.filter((i) => i.type === "file").map(({ name, sha }) => ({ name, sha })) : [];
  }
}

// ---------------- 내 컴퓨터 ----------------
const LOCAL_ROOT = path.join(process.cwd(), ".data");

class LocalFileStore implements FileStore {
  kind = "local-file" as const;

  async read(file: string): Promise<StoredFile | null> {
    try {
      const full = path.join(LOCAL_ROOT, file);
      const [content, stat] = await Promise.all([fs.readFile(full), fs.stat(full)]);
      return { content, sha: String(stat.mtimeMs) };
    } catch {
      return null;
    }
  }

  async write(file: string, content: Buffer, sha: string | null) {
    const full = path.join(LOCAL_ROOT, file);
    const current = await this.read(file);
    if ((current?.sha ?? null) !== sha) throw new FileConflictError(file);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, content);
    await fs.rename(tmp, full); // 다 쓴 다음 한 번에 바꿔치기 (파일이 깨지지 않게)
  }

  async remove(file: string) {
    await fs.rm(path.join(LOCAL_ROOT, file), { force: true });
  }

  async list(dir: string) {
    try {
      const names = await fs.readdir(path.join(LOCAL_ROOT, dir));
      const files = await Promise.all(
        names
          .filter((n) => !n.endsWith(".tmp"))
          .map(async (name) => ({ name, sha: String((await fs.stat(path.join(LOCAL_ROOT, dir, name))).mtimeMs) })),
      );
      return files;
    } catch {
      return [];
    }
  }
}

export const DATA_REPO = process.env.GITHUB_DATA_REPO || "hannah-hs/dchoi-chatbot1-data";

export const files: FileStore = process.env.GITHUB_TOKEN
  ? new GitHubFileStore(DATA_REPO, process.env.GITHUB_TOKEN)
  : new LocalFileStore();

export const STORAGE_MISSING_MESSAGE =
  "GitHub 데이터 저장소가 설정되지 않았습니다. Vercel 의 Environment Variables 에 GITHUB_TOKEN 을 넣고 Redeploy 해 주세요.";

/**
 * JSON 파일을 읽고 → 고치고 → 저장합니다.
 * 그 사이 다른 요청이 같은 파일을 먼저 고쳤으면, 새 내용을 다시 읽어서 한 번 더 시도합니다.
 */
const fileLocks = new Map<string, Promise<unknown>>();
export function withFileLock<T>(file: string, task: () => Promise<T>): Promise<T> {
  // 같은 서버 안에서 같은 파일을 동시에 고치지 않도록 한 줄로 세웁니다.
  const run = (fileLocks.get(file) ?? Promise.resolve()).then(task);
  fileLocks.set(file, run.catch(() => {}));
  return run;
}

export function updateJson<T>(file: string, change: (current: T | null) => T, message: string): Promise<T> {
  return withFileLock(file, () => updateJsonUnlocked(file, change, message));
}

async function updateJsonUnlocked<T>(file: string, change: (current: T | null) => T, message: string): Promise<T> {
  if (files.kind === "local-file" && process.env.VERCEL) throw new Error(STORAGE_MISSING_MESSAGE);
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await files.read(file);
    const next = change(current ? (JSON.parse(current.content.toString("utf8")) as T) : null);
    try {
      await files.write(file, Buffer.from(JSON.stringify(next, null, 2)), current?.sha ?? null, message);
      return next;
    } catch (e) {
      if (!(e instanceof FileConflictError)) throw e;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1) + Math.random() * 200));
    }
  }
  throw new Error("저장이 계속 겹쳐서 실패했어요. 잠시 후 다시 시도해 주세요.");
}

export async function readJson<T>(file: string): Promise<T | null> {
  const f = await files.read(file);
  return f ? (JSON.parse(f.content.toString("utf8")) as T) : null;
}
