// 사용자 메시지를 받아 Claude 답변을 돌려줍니다. 기분/경고/차단 판단도 여기서 저장합니다.
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { askClaude, MissingApiKeyError } from "@/lib/claude";
import { appendMessages, getMessages, getProducts, getQA, getRules, getUser, saveUser } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

const BLOCKED_REPLY = "원활한 상담을 위해 대화가 제한되었습니다. 필요하시면 카카오 채널로 문의해 주세요.";

export async function POST(req: Request) {
  const id = await getUserSession();
  const user = id ? await getUser(id) : null;
  if (!user) return NextResponse.json({ error: "먼저 이름과 이메일을 입력해 주세요." }, { status: 401 });
  if (user.blocked) return NextResponse.json({ reply: BLOCKED_REPLY, blocked: true });

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const text = (body.message ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "메시지를 입력해 주세요." }, { status: 400 });

  const [history, products, qa, rules] = await Promise.all([getMessages(user.id), getProducts(), getQA(), getRules()]);

  let result;
  try {
    result = await askClaude({ products, qa, rules, userName: user.name, history, userMessage: text });
  } catch (error) {
    console.error("Claude API error", error);
    const msg =
      error instanceof MissingApiKeyError || error instanceof Anthropic.AuthenticationError
        ? "챗봇 API 키가 설정되지 않았거나 올바르지 않습니다. 운영자에게 알려주세요."
        : error instanceof Anthropic.RateLimitError
          ? "지금 문의가 많아요. 잠시 후 다시 시도해 주세요."
          : "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const now = new Date().toISOString();
  const updated = { ...user, lastActiveAt: now, lastMood: result.mood };
  if (result.risk === "경고") updated.warnings += 1;
  if (result.risk === "차단" || updated.warnings >= rules.warningLimit) {
    updated.blocked = true;
    updated.blockedReason = result.riskReason || `경고 ${updated.warnings}회 누적`;
  }
  const reply = updated.blocked ? BLOCKED_REPLY : result.reply;

  const msgs: ChatMessage[] = [
    { role: "user", content: text, at: now, mood: result.mood, risk: result.risk, riskReason: result.riskReason },
    { role: "assistant", content: reply, at: new Date().toISOString() },
  ];
  try {
    await Promise.all([appendMessages(user.id, msgs), saveUser(updated)]);
  } catch (error) {
    console.error("save chat failed", error);
  }

  return NextResponse.json({ reply, blocked: updated.blocked });
}
