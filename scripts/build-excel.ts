// data/products.json 을 바탕으로 Q&A 목록을 만들고, 엑셀 파일(상품목록 + Q&A)을 생성합니다.
// 실행: npm run excel
import { readFile, writeFile } from "node:fs/promises";
import { buildWorkbook } from "../lib/excel";
import type { Product, QAItem } from "../lib/types";

export const EXCEL_PATH = "data/dchoi09_전집_학습데이터.xlsx";

// 상품 상세페이지 하단 안내문 등에서 가져온 공통 질문
const COMMON_QA: [string, string][] = [
  [
    "픽업으로 주문하려면 어떻게 하나요?",
    "상품 옵션에서 '수령 방법'을 Pick-up 으로 선택하시면 됩니다. 픽업 옵션 선택 시 주문 전에 지역별 재고 확인이 꼭 필요해요. 재고는 사이트의 '지역별 픽업 장소 및 재고' 페이지나 카카오 채널 문의로 확인하실 수 있습니다.",
  ],
  [
    "배송 가격과 픽업 가격이 왜 다른가요?",
    "dchoi09 전집은 수령 방법에 따라 가격이 다릅니다. 직접 픽업하시면 배송비가 들지 않아 배송(Shipping) 가격보다 저렴한 픽업(Pick-up) 가격으로 구매하실 수 있어요.",
  ],
  [
    "배송 상품과 픽업 상품을 같이 결제해도 되나요?",
    "수령 방법이 같은 상품끼리만 결제해 주세요. 예를 들어 픽업할 상품만 따로 선택해서 결제하시면 됩니다.",
  ],
  [
    "카드 결제를 취소하면 수수료가 있나요?",
    "카드 결제 후 결제를 취소하시면 3% 카드 수수료가 고객님 부담으로 발생합니다.",
  ],
  [
    "Zelle 로 결제하면 할인이 있나요?",
    "네, Zelle 로 결제하시면 추가 3% 할인을 받으실 수 있어요. 결제 시 안내되는 Zelle 할인 코드를 확인해 주세요.",
  ],
  [
    "책이 누락되었거나 파손되어 왔어요.",
    "불편을 드려 죄송합니다. 제품 누락 및 불량/파손은 제품 수령 후 14일 이내에 A/S 신청을 해 주셔야 처리 가능합니다. 채널톡 1:1 문의나 카카오 채널로 사진과 함께 접수해 주세요.",
  ],
  [
    "주문 후에 따로 해야 할 일이 있나요?",
    "Local 배송 또는 Pickup 으로 주문하신 경우, 주문 완료 후 꼭 지역방(카카오 커뮤니티)에 입장해 주세요. 또한 상품 상세 페이지의 주의사항을 확인 후 주문해 주세요.",
  ],
  [
    "문의는 어디로 하면 되나요?",
    "사이트의 채널톡 1:1 문의 또는 카카오 채널로 문의하실 수 있어요. 이메일은 david@dchoiglobal.com 입니다.",
  ],
  [
    "세이펜이 뭔가요?",
    "세이펜은 책에 갖다 대면 소리로 읽어 주는 음성 펜이에요. 상품 정보에 '세이펜 가능'이라고 표시된 전집은 세이펜으로 읽어 줄 수 있습니다. (세이펜 기기는 별도 구매가 필요할 수 있어요.)",
  ],
  [
    "아이 나이에 맞는 전집은 어떻게 고르나요?",
    "사이트에서 전집을 0-1세, 1-2세, 2-3세, 3-4세, 5세 이상으로 나누어 두었어요. 아이 나이와 관심사(자연관찰, 창작, 수학, 생활습관 등)를 알려주시면 맞는 전집을 추천해 드릴게요.",
  ],
];

function productQA(p: Product): [string, string][] {
  const out: [string, string][] = [];
  const link = `\n상세페이지: ${p.url}`;
  if (p.ageLabel || p.ageCategories.length) {
    out.push([
      `${p.title} 몇 살 아이에게 맞나요?`,
      `${p.title}은(는) ${p.ageLabel ? `${p.ageLabel} 대상` : "연령 정보가 따로 표기되어 있지 않은"} 전집이에요.${
        p.ageCategories.length ? ` 사이트에서는 '${p.ageCategories.join(", ")}' 카테고리에 있어요.` : ""
      }${link}`,
    ]);
  }
  if (p.composition) {
    out.push([`${p.title} 구성이 어떻게 되나요?`, `${p.title}(${p.publisher})의 구성은 ${p.composition} 입니다.${link}`]);
  }
  if (p.priceShipping) {
    out.push([
      `${p.title} 가격이 얼마인가요?`,
      `${p.title}은(는) 배송(Shipping) $${p.priceShipping}${p.pricePickup ? `, 픽업(Pick-up) $${p.pricePickup}` : ""} 입니다.${
        p.available ? "" : " 현재는 품절/판매중지 상태예요."
      }${link}`,
    ]);
  }
  if (p.saypen) {
    out.push([`${p.title} 세이펜 되나요?`, `${p.title}의 세이펜 지원 여부: ${p.saypen}${link}`]);
  }
  if (p.reviewCount > 0) {
    out.push([
      `${p.title} 후기는 어떤가요?`,
      `${p.title}은(는) 리뷰 ${p.reviewCount}개, 평균 ★${p.rating} 이에요.${
        p.reviewHighlights ? `\n대표 후기:\n${p.reviewHighlights}` : ""
      }${link}`,
    ]);
  }
  return out;
}

async function main() {
  const products = JSON.parse(await readFile("data/products.json", "utf8")) as Product[];
  const now = new Date().toISOString();
  let n = 0;
  const id = () => `qa-${String(++n).padStart(4, "0")}`;
  const qa: QAItem[] = [
    ...COMMON_QA.map(([question, answer]) => ({ id: id(), product: "공통", question, answer, updatedAt: now })),
    ...products.flatMap((p) =>
      productQA(p).map(([question, answer]) => ({ id: id(), product: p.title, question, answer, updatedAt: now })),
    ),
  ];
  await writeFile("data/qa.json", JSON.stringify(qa, null, 2));
  await writeFile(EXCEL_PATH, await buildWorkbook(products, qa));
  console.log(`완료: ${EXCEL_PATH} (상품 ${products.length}개, Q&A ${qa.length}개)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
