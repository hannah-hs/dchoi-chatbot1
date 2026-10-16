// 운영자: 현재 학습 데이터(상품목록 + Q&A)를 엑셀로 내려받기 / 엑셀을 올려서 교체하기
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { buildWorkbook, readWorkbook } from "@/lib/excel";
import { getProducts, getQA, saveProducts, saveQA } from "@/lib/store";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const buf = await buildWorkbook(await getProducts(), await getQA());
  const name = encodeURIComponent(`dchoi09_전집_학습데이터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    },
  });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "엑셀 파일을 선택해 주세요." }, { status: 400 });
  let parsed;
  try {
    parsed = await readWorkbook(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다. .xlsx 파일인지 확인해 주세요." }, { status: 400 });
  }
  const { products, qa } = parsed;
  if (!products?.length && !qa?.length) {
    return NextResponse.json({ error: "'상품목록' 또는 'Q&A' 시트를 찾지 못했습니다." }, { status: 400 });
  }
  if (products?.length) await saveProducts(products);
  if (qa?.length) await saveQA(qa);
  return NextResponse.json({ products: products?.length ?? 0, qa: qa?.length ?? 0 });
}
