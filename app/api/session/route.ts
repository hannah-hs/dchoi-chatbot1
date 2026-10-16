// 사용자 입장(이름+이메일) / 현재 사용자 확인 / 나가기
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { clearUserSession, getUserSession, setUserSession } from "@/lib/auth";
import { findUserByEmail, getMessages, getUser, saveUser } from "@/lib/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const id = await getUserSession();
  const user = id ? await getUser(id) : null;
  if (!user) return NextResponse.json({ user: null, messages: [] });
  const messages = await getMessages(user.id);
  return NextResponse.json({
    user: { name: user.name, email: user.email, blocked: user.blocked },
    messages: messages.map(({ role, content, at }) => ({ role, content, at })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string };
  const name = (body.name ?? "").trim().slice(0, 40);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });

  const now = new Date().toISOString();
  let user = await findUserByEmail(email);
  if (user) {
    user = { ...user, name, lastActiveAt: now };
  } else {
    user = { id: randomUUID(), name, email, createdAt: now, lastActiveAt: now, warnings: 0, blocked: false };
  }
  try {
    await saveUser(user);
  } catch (error) {
    console.error("saveUser failed", error);
    return NextResponse.json({ error: (error as Error).message || "저장에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  await setUserSession(user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
