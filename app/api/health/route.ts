// 설정 점검용: 브라우저에서 /api/health 를 열면 필요한 설정이 됐는지 보여줍니다. (비밀 값 자체는 보여주지 않아요)
import { NextResponse } from "next/server";
import { DATA_REPO, files } from "@/lib/files";

export const dynamic = "force-dynamic";

async function checkDataRepo(): Promise<string> {
  if (files.kind === "local-file") {
    return process.env.VERCEL ? "❌ GITHUB_TOKEN 없음 (Environment Variables 에 추가 필요)" : "내 컴퓨터 파일 (.data/)";
  }
  try {
    await files.list("users");
    return `✅ GitHub 데이터 레포 연결됨 (${DATA_REPO})`;
  } catch (e) {
    return `❌ ${(e as Error).message}`;
  }
}

export async function GET() {
  const ok = (v?: string) => (v ? "✅ 설정됨" : "❌ 없음");
  return NextResponse.json({
    "ANTHROPIC_API_KEY (Claude 키)": ok(process.env.ANTHROPIC_API_KEY),
    "ADMIN_PASSWORD (운영자 비밀번호)": ok(process.env.ADMIN_PASSWORD),
    "SESSION_SECRET (쿠키 암호)": ok(process.env.SESSION_SECRET),
    "저장소": await checkDataRepo(),
  });
}
