// 운영자: Q&A 목록 보기 / 추가 / 수정 / 삭제 (데이터 레포의 엑셀 "Q&A" 시트가 바뀝니다)
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getQA, updateKnowledge } from "@/lib/store";
import type { QAItem } from "@/lib/types";

function clean(body: Partial<QAItem>) {
  return {
    question: (body.question ?? "").trim(),
    answer: (body.answer ?? "").trim(),
    product: (body.product ?? "").trim() || "공통",
  };
}

const fail = (e: unknown, status = 500) => NextResponse.json({ error: (e as Error).message }, { status });

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
  const item: QAItem = { id: `qa-${Date.now().toString(36)}`, ...data, updatedAt: new Date().toISOString() };
  try {
    await updateKnowledge((k) => ({ ...k, qa: [item, ...k.qa] }), `Q&A 추가: ${item.question.slice(0, 40)}`);
    return NextResponse.json({ item });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as Partial<QAItem>;
  const data = clean(body);
  if (!body.id || !data.question || !data.answer) return NextResponse.json({ error: "질문과 답변을 모두 입력해 주세요." }, { status: 400 });
  let item: QAItem | undefined;
  try {
    await updateKnowledge((k) => {
      const qa = k.qa.map((q) => (q.id === body.id ? (item = { ...q, ...data, updatedAt: new Date().toISOString() }) : q));
      if (!item) throw new Error("항목을 찾을 수 없습니다.");
      return { ...k, qa };
    }, `Q&A 수정: ${data.question.slice(0, 40)}`);
    return NextResponse.json({ item });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id");
  try {
    await updateKnowledge((k) => ({ ...k, qa: k.qa.filter((q) => q.id !== id) }), `Q&A 삭제: ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
