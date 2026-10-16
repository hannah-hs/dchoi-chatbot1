// 엑셀 파일 만들기 / 읽기 (상품목록 시트 + Q&A 시트)
import ExcelJS from "exceljs";
import type { Product, QAItem } from "./types";

const PRODUCT_COLUMNS: { header: string; key: keyof Product; width: number }[] = [
  { header: "상품ID", key: "id", width: 16 },
  { header: "상품명", key: "title", width: 36 },
  { header: "출판사", key: "publisher", width: 14 },
  { header: "연령", key: "ageLabel", width: 12 },
  { header: "연령 카테고리", key: "ageCategories", width: 22 },
  { header: "구성", key: "composition", width: 40 },
  { header: "세이펜", key: "saypen", width: 10 },
  { header: "배송가(USD)", key: "priceShipping", width: 12 },
  { header: "픽업가(USD)", key: "pricePickup", width: 12 },
  { header: "판매중", key: "available", width: 8 },
  { header: "SKU", key: "sku", width: 16 },
  { header: "태그", key: "tags", width: 30 },
  { header: "리뷰 수", key: "reviewCount", width: 8 },
  { header: "평균 평점", key: "rating", width: 8 },
  { header: "대표 리뷰", key: "reviewHighlights", width: 60 },
  { header: "상세 설명", key: "description", width: 60 },
  { header: "상세페이지 URL", key: "url", width: 50 },
  { header: "대표 이미지", key: "image", width: 50 },
];

const QA_COLUMNS: { header: string; key: keyof QAItem; width: number }[] = [
  { header: "ID", key: "id", width: 12 },
  { header: "관련 상품", key: "product", width: 30 },
  { header: "질문", key: "question", width: 50 },
  { header: "답변", key: "answer", width: 80 },
  { header: "수정일", key: "updatedAt", width: 22 },
];

function styleHeader(ws: ExcelJS.Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export async function buildWorkbook(products: Product[], qa: QAItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "dchoi chatbot";

  const ps = wb.addWorksheet("상품목록");
  ps.columns = PRODUCT_COLUMNS;
  for (const p of products) {
    ps.addRow({
      ...p,
      ageCategories: p.ageCategories.join(", "),
      tags: p.tags.join(", "),
      available: p.available ? "Y" : "N",
    });
  }
  styleHeader(ps);

  const qs = wb.addWorksheet("Q&A");
  qs.columns = QA_COLUMNS;
  for (const q of qa) qs.addRow(q);
  styleHeader(qs);
  qs.getColumn("answer").alignment = { wrapText: true, vertical: "top" };
  qs.getColumn("question").alignment = { wrapText: true, vertical: "top" };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

function readSheet(ws: ExcelJS.Worksheet | undefined, columns: { header: string; key: string }[]) {
  if (!ws) return null;
  const headerRow = ws.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const found = columns.find((c) => c.header === cellText(cell.value).trim());
    if (found) colIndex[found.key] = col;
  });
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj: Record<string, string> = {};
    for (const [key, col] of Object.entries(colIndex)) obj[key] = cellText(row.getCell(col).value).trim();
    if (Object.values(obj).some(Boolean)) rows.push(obj);
  });
  return rows;
}

export async function readWorkbook(data: ArrayBuffer): Promise<{ products: Product[] | null; qa: QAItem[] | null }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const now = new Date().toISOString();

  const productRows = readSheet(wb.getWorksheet("상품목록"), PRODUCT_COLUMNS);
  const products =
    productRows?.map((r, i) => ({
      id: r.id || `row-${i + 2}`,
      title: r.title ?? "",
      url: r.url ?? "",
      publisher: r.publisher ?? "",
      ageLabel: r.ageLabel ?? "",
      ageCategories: (r.ageCategories ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      composition: r.composition ?? "",
      saypen: r.saypen ?? "",
      priceShipping: r.priceShipping ?? "",
      pricePickup: r.pricePickup ?? "",
      available: (r.available ?? "Y").toUpperCase() !== "N",
      sku: r.sku ?? "",
      tags: (r.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      image: r.image ?? "",
      description: r.description ?? "",
      reviewCount: Number(r.reviewCount) || 0,
      rating: Number(r.rating) || 0,
      reviewHighlights: r.reviewHighlights ?? "",
    })).filter((p) => p.title) ?? null;

  const qaRows = readSheet(wb.getWorksheet("Q&A"), QA_COLUMNS);
  const qa =
    qaRows
      ?.map((r, i) => ({
        id: r.id || `qa-${Date.now().toString(36)}-${i}`,
        product: r.product || "공통",
        question: r.question ?? "",
        answer: r.answer ?? "",
        updatedAt: r.updatedAt || now,
      }))
      .filter((q) => q.question && q.answer) ?? null;

  return { products, qa };
}
