// 운영자: 사용자 목록
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { listUsers, storageMode } from "@/lib/store";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ users: await listUsers(), storageMode });
}
