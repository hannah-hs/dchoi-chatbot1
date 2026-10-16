// 운영자: 사용자 한 명의 대화 기록 보기 / 차단·해제·경고 초기화 / 삭제
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteUser, getMessages, getUser, saveUser } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const user = await getUser(id);
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ user, messages: await getMessages(id) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const user = await getUser(id);
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action === "unblock") Object.assign(user, { blocked: false, blockedReason: undefined, warnings: 0 });
  else if (action === "block") Object.assign(user, { blocked: true, blockedReason: "운영자가 직접 차단" });
  else if (action === "resetWarnings") user.warnings = 0;
  else return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 });
  await saveUser(user);
  return NextResponse.json({ user });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
