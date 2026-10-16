// 로그인 쿠키 관리 (사용자 / 운영자)
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const USER_COOKIE = "dchoi_user";
const ADMIN_COOKIE = "dchoi_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("SESSION_SECRET 환경변수가 필요합니다.");
  return s;
}

function sign(value: string): string {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

function verify(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(sign(value));
  const b = Buffer.from(signed);
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

export async function setUserSession(userId: string) {
  (await cookies()).set(USER_COOKIE, sign(userId), cookieOpts);
}
export async function getUserSession(): Promise<string | null> {
  return verify((await cookies()).get(USER_COOKIE)?.value);
}
export async function clearUserSession() {
  (await cookies()).delete(USER_COOKIE);
}

export function checkAdminPassword(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function setAdminSession() {
  (await cookies()).set(ADMIN_COOKIE, sign("admin"), { ...cookieOpts, maxAge: 60 * 60 * 12 });
}
export async function isAdmin(): Promise<boolean> {
  return verify((await cookies()).get(ADMIN_COOKIE)?.value) === "admin";
}
export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}
