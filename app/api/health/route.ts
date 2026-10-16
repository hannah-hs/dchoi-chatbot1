// 설정 점검용: 브라우저에서 /api/health 를 열면 필요한 설정이 됐는지 보여줍니다. (비밀 값 자체는 보여주지 않아요)
import { NextResponse } from "next/server";
import { storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  const ok = (v?: string) => (v ? "✅ 설정됨" : "❌ 없음");
  return NextResponse.json({
    "ANTHROPIC_API_KEY (Claude 키)": ok(process.env.ANTHROPIC_API_KEY),
    "ADMIN_PASSWORD (운영자 비밀번호)": ok(process.env.ADMIN_PASSWORD),
    "SESSION_SECRET (쿠키 암호)": ok(process.env.SESSION_SECRET),
    "저장소": storageMode === "redis" ? "✅ Upstash Redis 연결됨" : process.env.VERCEL ? "❌ Redis 미연결 (Storage 에서 Upstash 연결 필요)" : "내 컴퓨터 파일 (.data/db.json)",
    "Redis 관련 환경변수 이름": Object.keys(process.env).filter((k) => /KV_|REDIS|UPSTASH/.test(k)),
  });
}
