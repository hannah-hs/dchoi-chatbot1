// 앱 전체에서 함께 쓰는 데이터 모양(타입) 정의

export interface Product {
  id: string;
  title: string;
  url: string;
  publisher: string; // 출판사 (Shopify vendor)
  ageLabel: string; // 상세페이지의 "연령" 값 (예: 0-3세)
  ageCategories: string[]; // 사이트 연령 카테고리 (예: 전집 0-1세)
  composition: string; // 구성
  saypen: string; // 세이펜 지원 여부
  priceShipping: string; // 배송 가격 (USD)
  pricePickup: string; // 픽업 가격 (USD)
  available: boolean; // 판매 가능 여부
  sku: string;
  tags: string[];
  image: string;
  description: string; // 상세 설명 중 텍스트로 된 부분
  reviewCount: number;
  rating: number;
  reviewHighlights: string; // 대표 리뷰 몇 개 (작성자 이름 제외)
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  product: string; // 관련 상품명 (공통 질문이면 "공통")
  updatedAt: string;
}

export interface Rules {
  response: string; // 응대 규칙
  mood: string; // 사용자 기분 파악 규칙
  abnormal: string; // 이상 사용자 판별 및 경고 규칙
  block: string; // 차단 규칙
  warningLimit: number; // 경고가 이 횟수에 도달하면 자동 차단
}

export type Mood = "긍정" | "보통" | "불만" | "화남" | "불안";
export type Risk = "정상" | "주의" | "경고" | "차단";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
  mood?: Mood;
  risk?: Risk;
  riskReason?: string;
}

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  warnings: number;
  blocked: boolean;
  blockedReason?: string;
  lastMood?: Mood;
}
