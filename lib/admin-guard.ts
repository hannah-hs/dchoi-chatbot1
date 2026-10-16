import { NextResponse } from "next/server";
import { isAdmin } from "./auth";

// 운영자가 아니면 401 응답을 돌려줍니다.
export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "운영자 로그인이 필요합니다." }, { status: 401 });
}
