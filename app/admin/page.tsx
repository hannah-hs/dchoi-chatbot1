"use client";
// 운영자 페이지: 대화 기록 / Q&A 관리 / 챗봇 규칙 / 엑셀
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage, ChatUser, QAItem, Rules } from "@/lib/types";
import { Linkify } from "../linkify";

type Tab = "users" | "qa" | "rules" | "excel";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `오류 (${res.status})`);
  return data as T;
}

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "-";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    fetch("/api/admin/users").then((r) => setAuthed(r.ok));
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  return (
    <>
      <header className="topnav">
        <span className="brand">dchoi09 · 운영자</span>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn btn-ghost" href="/" target="_blank">
            챗봇 열기 ↗
          </a>
          <button className="btn btn-ghost" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>
      <main className="admin">
        <nav className="tabs">
          {(
            [
              ["users", "대화 기록"],
              ["qa", "Q&A 관리"],
              ["rules", "챗봇 규칙"],
              ["excel", "엑셀 파일"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "users" && <UsersTab />}
        {tab === "qa" && <QATab />}
        {tab === "rules" && <RulesTab />}
        {tab === "excel" && <ExcelTab />}
      </main>
    </>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <>
      <header className="topnav">
        <span className="brand">dchoi09 · 운영자</span>
      </header>
      <div className="login-wrap">
        <form className="block block-lilac login-card" onSubmit={submit}>
          <p className="eyebrow">Admin</p>
          <h1 className="headline">운영자 로그인</h1>
          <input
            className="input"
            type="password"
            placeholder="운영자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary">로그인</button>
        </form>
      </div>
    </>
  );
}

// ---------------- 대화 기록 ----------------
function UsersTab() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [storageMode, setStorageMode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ user: ChatUser; messages: ChatMessage[] } | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const d = await api<{ users: ChatUser[]; storageMode: string }>("/api/admin/users");
    setUsers(d.users);
    setStorageMode(d.storageMode);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    api<{ user: ChatUser; messages: ChatMessage[] }>(`/api/admin/users/${selected}`).then(setDetail);
  }, [selected]);

  async function act(action: string) {
    if (!selected) return;
    const d = await api<{ user: ChatUser }>(`/api/admin/users/${selected}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    setDetail((prev) => (prev ? { ...prev, user: d.user } : prev));
    load();
  }

  async function remove() {
    if (!selected || !confirm("이 사용자와 대화 기록을 모두 삭제할까요? 되돌릴 수 없습니다.")) return;
    await api(`/api/admin/users/${selected}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  const filtered = users.filter((u) => !q || u.name.includes(q) || u.email.includes(q.toLowerCase()));
  const today = new Date().toDateString();

  return (
    <>
      <div className="stat-row">
        <div className="stat">
          <span className="caption">전체 사용자</span>
          <b>{users.length}</b>
        </div>
        <div className="stat">
          <span className="caption">오늘 대화</span>
          <b>{users.filter((u) => new Date(u.lastActiveAt).toDateString() === today).length}</b>
        </div>
        <div className="stat">
          <span className="caption">경고 받은 사용자</span>
          <b>{users.filter((u) => u.warnings > 0).length}</b>
        </div>
        <div className="stat">
          <span className="caption">차단된 사용자</span>
          <b>{users.filter((u) => u.blocked).length}</b>
        </div>
      </div>
      {storageMode === "local-file" && (
        <p className="muted-note">※ 지금은 내 컴퓨터 파일(.data/db.json)에 저장 중입니다. Vercel 에서는 Upstash Redis 를 연결해야 합니다.</p>
      )}
      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <input className="input" placeholder="이름 또는 이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="panel-body">
            {filtered.length === 0 && <p className="empty">아직 대화한 사용자가 없어요.</p>}
            {filtered.map((u) => (
              <button
                key={u.id}
                className={`user-item ${selected === u.id ? "active" : ""}`}
                onClick={() => setSelected(u.id)}
              >
                <b>{u.name}</b>
                <span className="email">{u.email}</span>
                <span className="badges">
                  <span className="badge">{fmt(u.lastActiveAt)}</span>
                  {u.lastMood && <span className={`badge mood-${u.lastMood}`}>{u.lastMood}</span>}
                  {u.warnings > 0 && <span className="badge risk-경고">경고 {u.warnings}</span>}
                  {u.blocked && <span className="badge blocked">차단</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          {!detail ? (
            <p className="empty">왼쪽에서 사용자를 선택하면 대화 기록이 보여요.</p>
          ) : (
            <>
              <div className="panel-head">
                <div>
                  <b>{detail.user.name}</b> <span className="muted-note">{detail.user.email}</span>
                  <div className="badges" style={{ marginTop: 6 }}>
                    <span className="badge">가입 {fmt(detail.user.createdAt)}</span>
                    <span className="badge">메시지 {detail.messages.length}</span>
                    {detail.user.blocked && <span className="badge blocked">차단: {detail.user.blockedReason}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {detail.user.blocked ? (
                    <button className="btn btn-secondary btn-small" onClick={() => act("unblock")}>
                      차단 해제
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-small" onClick={() => act("block")}>
                      차단하기
                    </button>
                  )}
                  <button className="btn btn-secondary btn-small" onClick={() => act("resetWarnings")}>
                    경고 초기화
                  </button>
                  <button className="btn btn-danger btn-small" onClick={remove}>
                    삭제
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="convo">
                  {detail.messages.length === 0 && <p className="empty">대화 기록이 없어요.</p>}
                  {detail.messages.map((m, i) => (
                    <div key={i} className={`bubble-row ${m.role}`}>
                      <div>
                        <div className={`bubble ${m.role}`}>
                          {m.role === "assistant" ? <Linkify text={m.content} /> : m.content}
                        </div>
                        <div className="meta" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                          <span className="caption">{fmt(m.at)}</span>
                          {m.mood && <span className={`badge mood-${m.mood}`}>{m.mood}</span>}
                          {m.risk && m.risk !== "정상" && (
                            <span className={`badge risk-${m.risk}`} title={m.riskReason}>
                              {m.risk}
                              {m.riskReason ? `: ${m.riskReason}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

// ---------------- Q&A 관리 ----------------
const PAGE = 40;

function QATab() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [q, setQ] = useState("");
  const [product, setProduct] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<QAItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setItems((await api<{ items: QAItem[] }>("/api/admin/qa")).items);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const products = useMemo(() => Array.from(new Set(items.map((i) => i.product))).sort((a, b) => a.localeCompare(b, "ko")), [items]);
  const filtered = items.filter(
    (i) =>
      (!product || i.product === product) &&
      (!q || i.question.includes(q) || i.answer.includes(q) || i.product.includes(q)),
  );

  async function save(item: Partial<QAItem>) {
    setError("");
    try {
      if (item.id) await api("/api/admin/qa", { method: "PUT", body: JSON.stringify(item) });
      else await api("/api/admin/qa", { method: "POST", body: JSON.stringify(item) });
      setEditing(null);
      setAdding(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 Q&A 를 삭제할까요?")) return;
    await api(`/api/admin/qa?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="qa-toolbar">
        <input className="input" placeholder="질문·답변 검색" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        <select className="select" value={product} onChange={(e) => { setProduct(e.target.value); setLimit(PAGE); }}>
          <option value="">전체 상품 ({items.length})</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>
          + 새 Q&A
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {adding && <QAForm initial={{ product: product || "공통" }} onSave={save} onCancel={() => setAdding(false)} />}
      <p className="muted-note">
        {filtered.length}개 · 여기서 바꾼 내용은 다음 대화부터 바로 챗봇 답변에 반영돼요.
      </p>
      <div className="qa-list">
        {filtered.slice(0, limit).map((item) =>
          editing?.id === item.id ? (
            <QAForm key={item.id} initial={item} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div key={item.id} className="qa-card">
              <div className="row">
                <span className="badges">
                  <span className="badge">{item.product}</span>
                  <span className="badge">{fmt(item.updatedAt)}</span>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary btn-small" onClick={() => { setEditing(item); setAdding(false); }}>
                    수정
                  </button>
                  <button className="btn btn-danger btn-small" onClick={() => remove(item.id)}>
                    삭제
                  </button>
                </span>
              </div>
              <div className="q">Q. {item.question}</div>
              <div className="a">
                <Linkify text={item.answer} />
              </div>
            </div>
          ),
        )}
      </div>
      {filtered.length > limit && (
        <button className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
          더 보기 ({filtered.length - limit}개 남음)
        </button>
      )}
    </>
  );
}

function QAForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Partial<QAItem>;
  onSave: (item: Partial<QAItem>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<QAItem>>(initial);
  return (
    <div className="qa-card block-lime">
      <div className="form-grid">
        <label className="field">
          관련 상품 (공통 질문이면 &quot;공통&quot;)
          <input className="input" value={form.product ?? ""} onChange={(e) => setForm({ ...form, product: e.target.value })} />
        </label>
        <label className="field">
          질문
          <input className="input" value={form.question ?? ""} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </label>
        <label className="field">
          답변
          <textarea className="textarea" rows={5} value={form.answer ?? ""} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-small" onClick={() => onSave(form)}>
            저장
          </button>
          <button className="btn btn-secondary btn-small" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- 챗봇 규칙 ----------------
const RULE_CARDS: { key: keyof Omit<Rules, "warningLimit">; title: string; desc: string; color: string }[] = [
  { key: "response", title: "응대 규칙", desc: "말투, 답변 길이, 안내 방법", color: "block-lime" },
  { key: "mood", title: "사용자 기분 파악 규칙", desc: "기분 판단 기준과 기분별 응대 방법", color: "block-cream" },
  { key: "abnormal", title: "이상 사용자 판별 및 경고 규칙", desc: "주의·경고로 판단할 행동과 경고 문구", color: "block-mint" },
  { key: "block", title: "차단 규칙", desc: "즉시 차단할 행동과 차단 안내 문구", color: "block-lilac" },
];

function RulesTab() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [defaults, setDefaults] = useState<Rules | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api<{ rules: Rules; defaults: Rules }>("/api/admin/rules").then((d) => {
      setRules(d.rules);
      setDefaults(d.defaults);
    });
  }, []);

  if (!rules) return null;

  async function save() {
    const d = await api<{ rules: Rules }>("/api/admin/rules", { method: "PUT", body: JSON.stringify(rules) });
    setRules(d.rules);
    setSaved(`저장했어요 (${new Date().toLocaleTimeString("ko-KR")})`);
  }

  return (
    <>
      <div className="qa-toolbar">
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          경고가
          <input
            className="input"
            type="number"
            min={1}
            max={20}
            style={{ width: 90 }}
            value={rules.warningLimit}
            onChange={(e) => setRules({ ...rules, warningLimit: Number(e.target.value) })}
          />
          번 쌓이면 자동 차단
        </label>
        <span style={{ flex: 1 }} />
        {saved && <span className="muted-note">{saved}</span>}
        <button className="btn btn-primary" onClick={save}>
          규칙 저장
        </button>
      </div>
      <div className="rules-grid">
        {RULE_CARDS.map((c) => (
          <section key={c.key} className={`rule-card ${c.color}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <h3 className="headline" style={{ fontSize: 20 }}>
                  {c.title}
                </h3>
                <span className="muted-note">{c.desc}</span>
              </div>
              {defaults && (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => confirm("처음 값으로 되돌릴까요? (저장을 눌러야 적용돼요)") && setRules({ ...rules, [c.key]: defaults[c.key] })}
                >
                  처음 값으로
                </button>
              )}
            </div>
            <textarea className="textarea" value={rules[c.key]} onChange={(e) => setRules({ ...rules, [c.key]: e.target.value })} />
          </section>
        ))}
      </div>
    </>
  );
}

// ---------------- 엑셀 ----------------
function ExcelTab() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file || !confirm("업로드한 엑셀 내용으로 상품목록/Q&A 를 교체할까요?")) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api<{ products: number; qa: number }>("/api/admin/excel", { method: "POST", body: fd });
      setMsg(`완료: 상품 ${d.products}개, Q&A ${d.qa}개를 반영했어요.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rules-grid">
      <section className="rule-card block-lime">
        <p className="eyebrow">Download</p>
        <h3 className="headline">학습 데이터 내려받기</h3>
        <p>챗봇이 지금 사용 중인 &quot;상품목록&quot;과 &quot;Q&A&quot; 시트가 담긴 엑셀 파일입니다.</p>
        <a className="btn btn-primary" href="/api/admin/excel">
          엑셀 다운로드
        </a>
      </section>
      <section className="rule-card block-cream">
        <p className="eyebrow">Upload</p>
        <h3 className="headline">엑셀로 한꺼번에 바꾸기</h3>
        <p>
          내려받은 엑셀을 수정해서 올리면 그대로 반영돼요. 시트 이름(상품목록, Q&amp;A)과 첫 줄 제목은 바꾸지 마세요. 한쪽
          시트만 있으면 그 시트만 바뀝니다.
        </p>
        <input className="input" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn btn-primary" disabled={!file || busy} onClick={upload}>
          {busy ? "올리는 중..." : "업로드해서 반영"}
        </button>
        {msg && <p>{msg}</p>}
      </section>
    </div>
  );
}
