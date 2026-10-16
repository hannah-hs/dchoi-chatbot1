// 운영자: 챗봇 규칙 보기 / 수정 / 처음 값으로 되돌리기
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { DEFAULT_RULES } from "@/lib/default-rules";
import { getRules, saveRules } from "@/lib/store";
import type { Rules } from "@/lib/types";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ rules: await getRules(), defaults: DEFAULT_RULES });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Partial<Rules>;
  const current = await getRules();
  const rules: Rules = {
    response: typeof body.response === "string" ? body.response : current.response,
    mood: typeof body.mood === "string" ? body.mood : current.mood,
    abnormal: typeof body.abnormal === "string" ? body.abnormal : current.abnormal,
    block: typeof body.block === "string" ? body.block : current.block,
    warningLimit: Math.max(1, Math.min(20, Number(body.warningLimit) || current.warningLimit)),
  };
  await saveRules(rules);
  return NextResponse.json({ rules });
}
