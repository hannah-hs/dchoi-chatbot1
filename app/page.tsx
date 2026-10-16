"use client";
// 사용자 페이지: 이름 + 이메일을 남기고 챗봇과 대화합니다.
import { useEffect, useRef, useState } from "react";
import { Linkify } from "./linkify";

interface Msg {
  role: "user" | "assistant";
  content: string;
}
interface Me {
  name: string;
  email: string;
  blocked: boolean;
}

const SUGGESTIONS = [
  "돌 아기에게 좋은 전집 추천해 주세요",
  "세이펜 되는 자연관찰 전집 있나요?",
  "픽업으로 사면 얼마나 저렴한가요?",
  "4살 아이 한글 떼기 좋은 전집은?",
];

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setMessages(d.messages ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!me) return <Join onJoined={(user) => setMe(user)} />;
  return <Chat me={me} setMe={setMe} messages={messages} setMessages={setMessages} />;
}

function TopNav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topnav">
      <a className="brand" href="https://dchoi09.com" target="_blank" rel="noopener noreferrer">
        dchoi09
      </a>
      <div>{right}</div>
    </header>
  );
}

function Join({ onJoined }: { onJoined: (u: Me) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "다시 시도해 주세요.");
    onJoined({ name: name.trim(), email: email.trim(), blocked: false });
  }

  return (
    <>
      <TopNav />
      <div className="marquee">0-1세 · 1-2세 · 2-3세 · 3-4세 · 5세 이상 — dchoi09 전집 전 상품을 알고 있어요</div>
      <main className="landing">
        <section className="block block-lime hero">
          <div>
            <p className="eyebrow">전집 상담 챗봇</p>
            <h1 className="display">우리 아이 전집, 물어보세요.</h1>
            <p className="lead">
              연령, 구성, 세이펜 지원, 배송·픽업 가격까지. dchoi09 의 모든 전집 정보를 바탕으로 바로 답해 드려요.
            </p>
          </div>
          <form className="join-card" onSubmit={submit}>
            <h2 className="headline">상담 시작하기</h2>
            <label className="field">
              이름
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" required />
            </label>
            <label className="field">
              이메일
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "잠시만요..." : "대화 시작"}
            </button>
            <p className="muted-note">같은 이메일로 다시 들어오면 이전 대화를 이어서 볼 수 있어요.</p>
          </form>
        </section>
        <section className="features">
          <div className="feature">
            <span className="caption">01 · 연령별 추천</span>
            <b>아이 나이에 맞는 전집</b>
            <span>개월 수나 관심사를 알려주시면 딱 맞게 골라 드려요.</span>
          </div>
          <div className="feature">
            <span className="caption">02 · 상세 정보</span>
            <b>구성 · 세이펜 · 리뷰</b>
            <span>몇 권인지, 세이펜이 되는지, 다른 부모님 후기까지.</span>
          </div>
          <div className="feature">
            <span className="caption">03 · 가격 안내</span>
            <b>배송가와 픽업가</b>
            <span>수령 방법별 가격과 주문 시 주의사항을 알려드려요.</span>
          </div>
        </section>
      </main>
    </>
  );
}

function Chat({
  me,
  setMe,
  messages,
  setMessages,
}: {
  me: Me;
  setMe: (u: Me | null) => void;
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(me.blocked);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || blocked) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.status === 401) return setMe(null);
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "다시 시도해 주세요." }]);
      if (data.blocked) setBlocked(true);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "인터넷 연결을 확인하고 다시 시도해 주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await fetch("/api/session", { method: "DELETE" });
    setMessages([]);
    setMe(null);
  }

  return (
    <div className="chat-shell">
      <TopNav
        right={
          <button className="btn btn-ghost" onClick={leave}>
            {me.name}님 · 나가기
          </button>
        }
      />
      <div className="chat-scroll">
        <div className="chat-inner">
          <div className="welcome">
            <p className="eyebrow">dchoi09 전집 상담</p>
            <h2 className="headline">{me.name}님, 안녕하세요! 어떤 전집을 찾고 계세요?</h2>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)} disabled={busy || blocked}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.role}`}>
              <div className={`bubble ${m.role}`}>
                {m.role === "assistant" ? <Linkify text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="bubble-row assistant">
              <div className="bubble assistant" aria-label="답변 작성 중">
                <span className="typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="composer">
        {blocked ? (
          <div className="blocked-note">상담이 제한된 상태입니다. 카카오 채널로 문의해 주세요.</div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="궁금한 점을 입력하세요 (Shift+Enter 줄바꿈)"
              rows={1}
              maxLength={2000}
            />
            <button className="btn btn-primary" disabled={busy || !input.trim()}>
              보내기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
