// 운영자: 사용자 한 명의 대화 기록 보기 / 차단·해제·경고 초기화 / 삭제
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteUser, getUserWithMessages, updateUser } from "@/lib/store";
import type { ChatUser } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const rec = await getUserWithMessages(id);
  if (!rec) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(rec);
}

const ACTIONS: Record<string, [string, (u: ChatUser) => ChatUser]> = {
  unblock: ["차단 해제", (u) => ({ ...u, blocked: false, blockedReason: undefined, warnings: 0, unblockedAt: new Date().toISOString() })],
  block: ["운영자 차단", (u) => ({ ...u, blocked: true, blockedReason: "운영자가 직접 차단" })],
  resetWarnings: ["경고 초기화", (u) => ({ ...u, warnings: 0 })],
};

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const found = action ? ACTIONS[action] : undefined;
  if (!found) return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 });
  try {
    const user = await updateUser(id, found[1], found[0]);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
