// 운영자: Q&A 목록 보기 / 추가 / 수정 / 삭제
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getQA, saveQA } from "@/lib/store";
import type { QAItem } from "@/lib/types";

function clean(body: Partial<QAItem>) {
  return {
    question: (body.question ?? "").trim(),
    answer: (body.answer ?? "").trim(),
    product: (body.product ?? "").trim() || "공통",
  };
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ items: await getQA() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const data = clean(await req.json().catch(() => ({})));
  if (!data.question || !data.answer) return NextResponse.json({ error: "질문과 답변을 모두 입력해 주세요." }, { status: 400 });
  const items = await getQA();
  const item: QAItem = { id: `qa-${Date.now().toString(36)}`, ...data, updatedAt: new Date().toISOString() };
  await saveQA([item, ...items]);
  return NextResponse.json({ item });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Partial<QAItem>;
  const data = clean(body);
  if (!body.id || !data.question || !data.answer) return NextResponse.json({ error: "질문과 답변을 모두 입력해 주세요." }, { status: 400 });
  const items = await getQA();
  const idx = items.findIndex((q) => q.id === body.id);
  if (idx < 0) return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  await saveQA(items);
  return NextResponse.json({ item: items[idx] });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  const items = await getQA();
  await saveQA(items.filter((q) => q.id !== id));
  return NextResponse.json({ ok: true });
}
