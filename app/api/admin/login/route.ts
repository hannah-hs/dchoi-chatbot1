// 운영자 로그인 / 로그아웃
import { NextResponse } from "next/server";
import { checkAdminPassword, clearAdminSession, setAdminSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }
  await setAdminSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
