// 사용자 입장(이름+이메일) / 현재 사용자 확인 / 나가기
import { NextResponse } from "next/server";
import { clearUserSession, getUserSession, setUserSession } from "@/lib/auth";
import { getUserWithMessages, upsertUser } from "@/lib/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const id = await getUserSession();
  const rec = id ? await getUserWithMessages(id).catch(() => null) : null;
  if (!rec) return NextResponse.json({ user: null, messages: [] });
  return NextResponse.json({
    user: { name: rec.user.name, email: rec.user.email, blocked: rec.user.blocked },
    messages: rec.messages.map(({ role, content, at }) => ({ role, content, at })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string };
  const name = (body.name ?? "").trim().slice(0, 40);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });

  try {
    const user = await upsertUser(name, email);
    await setUserSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("upsertUser failed", error);
    return NextResponse.json({ error: (error as Error).message || "저장에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function DELETE() {
  await clearUserSession();
  return NextResponse.json({ ok: true });
}
