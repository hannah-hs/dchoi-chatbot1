# dchoi09 전집 상담 챗봇

dchoi09.com 의 **전집 카테고리 157개 상품**(상세페이지 정보 포함)을 학습한 상담 챗봇입니다.
Claude **Sonnet 5.5** (`claude-sonnet-5-5`) 모델로 동작합니다.

| 주소 | 누가 쓰나요 | 하는 일 |
|---|---|---|
| `/` | 고객 | 이름 + 이메일을 남기고 챗봇과 대화 |
| `/admin` | 운영자 | 사용자별 대화 기록 보기, Q&A 보기·추가·수정·삭제, 챗봇 규칙 4가지 수정, 엑셀 내려받기/올리기 |

---

## 🧸 내가 할 일 (순서대로 따라 하세요)

> GitHub 연결과 코드 올리기는 이미 끝났어요.
> - 코드 레포 (공개): https://github.com/hannah-hs/dchoi-chatbot1
> - 데이터 레포 (**비공개**): https://github.com/hannah-hs/dchoi-chatbot1-data ← 대화 기록·규칙·학습 엑셀이 여기에 저장돼요
>
> 따로 데이터베이스는 쓰지 않아요. 이제 **API 키 만들기 → GitHub 토큰 만들기 → Vercel 연결** 세 가지만 하면 됩니다.

### 1단계. Anthropic API 키 만들기 (5분)

1. https://platform.claude.com 에 접속해서 로그인합니다.
2. 왼쪽 메뉴에서 **Settings → Billing** 에 들어가 결제 카드를 등록하고 크레딧을 충전합니다. (처음엔 $10~20 이면 충분해요)
3. 왼쪽 메뉴 **API Keys** → **Create Key** 버튼 → 이름에 `dchoi-chatbot` 입력 → **Create**.
4. `sk-ant-...` 로 시작하는 긴 글자가 나오면 **복사해서 메모장에 잠깐 붙여둡니다.** (이 화면을 닫으면 다시 볼 수 없어요!)
5. (선택) 내 컴퓨터에서도 테스트하고 싶다면, 이 폴더의 `.env.local` 파일을 열어 `ANTHROPIC_API_KEY=` 뒤에 붙여넣고, `ADMIN_PASSWORD=` 뒤에 원하는 비밀번호를 적습니다.
   - `.env.local` 은 GitHub 에 올라가지 않는 비밀 파일이에요.

### 2단계. GitHub 토큰 만들기 (5분)

챗봇이 비공개 데이터 레포에 대화 기록을 저장할 수 있게 해주는 "열쇠"예요. 이 열쇠는 **데이터 레포 하나만** 열 수 있게 만들어요.

1. GitHub 오른쪽 위 프로필 사진 → **Settings** → 왼쪽 맨 아래 **Developer settings**.
2. **Personal access tokens → Fine-grained tokens** → **Generate new token**.
3. 아래처럼 입력합니다.
   - Token name: `dchoi-chatbot`
   - Expiration: **No expiration** (또는 1년 — 만료되면 챗봇 저장이 멈추니 날짜를 꼭 기억하세요)
   - Repository access: **Only select repositories** → **dchoi-chatbot1-data** 하나만 선택
   - Permissions → Repository permissions → **Contents** 를 **Read and write** 로 변경 (Metadata 는 자동으로 Read-only)
4. 맨 아래 **Generate token** → `github_pat_...` 로 시작하는 글자를 **복사해서 메모장에 잠깐 붙여둡니다.** (다시 볼 수 없어요!)

### 3단계. Vercel 에 연결하기 (10분)

Vercel 은 GitHub 에 있는 코드를 가져가서 인터넷 주소(웹사이트)로 만들어 주는 곳이에요.

1. https://vercel.com 접속 → **Sign Up** → **Continue with GitHub** 를 눌러 GitHub 계정(hannah-hs)으로 가입합니다.
2. 대시보드에서 **Add New… → Project** 를 누릅니다.
3. 목록에서 **dchoi-chatbot1** 옆의 **Import** 버튼을 누릅니다.
   - 목록에 안 보이면 **Adjust GitHub App Permissions** 를 눌러 이 레포를 허용해 주세요.
4. 설정 화면에서 **Environment Variables** 를 펼치고, 아래 4개를 하나씩 추가합니다. (Key 칸에 이름, Value 칸에 값)
   - 이미 배포했다면: 프로젝트 → **Settings → Environment Variables** 에서 추가한 뒤 **Redeploy** 하세요.

   | Key (이름) | Value (값) |
   |---|---|
   | `ANTHROPIC_API_KEY` | 1단계에서 복사한 `sk-ant-...` 키 |
   | `ADMIN_PASSWORD` | 운영자 페이지 비밀번호 (내가 정하기, 8자 이상 추천) |
   | `SESSION_SECRET` | 아무 긴 글자 (예: 고양이이름+생일+아무숫자 30자 이상) |
   | `GITHUB_TOKEN` | 2단계에서 복사한 `github_pat_...` 토큰 |

5. **Deploy** 버튼을 누르고 1~2분 기다리면 축하 화면이 나옵니다. 🎉

### 4단계. 확인하기

1. 프로젝트 화면의 **Visit** 버튼(또는 `https://dchoi-chatbot1-xxxx.vercel.app` 주소)을 엽니다.
2. 이름과 이메일을 넣고 "돌 아기에게 좋은 전집 추천해 주세요" 를 눌러 답이 오는지 봅니다.
3. 주소 끝에 `/admin` 을 붙여 들어가고, 2단계에서 정한 `ADMIN_PASSWORD` 로 로그인합니다.
   - **대화 기록** 탭에 방금 대화가 보이면 성공!
   - 데이터 레포(dchoi-chatbot1-data)의 `users/` 폴더에 파일이 생기면 저장도 성공이에요.
   - 운영자 화면에 "내 컴퓨터 파일에 저장 중" 이라는 안내가 보이면 `GITHUB_TOKEN` 이 빠진 거예요.

### 🔧 안 될 때 점검하기

사이트 주소 끝에 `/api/health` 를 붙여서 열어 보세요. (예: `https://내주소.vercel.app/api/health`)
필요한 설정마다 ✅ / ❌ 가 표시돼요. ❌ 인 항목을 위 단계에서 다시 설정한 뒤 **Redeploy** 하면 됩니다.

전체 기능 자동 점검(챗봇 답변·기억·규칙 반영·Q&A 반영·경고/차단·운영자 기록·엑셀, 32개 항목)도 할 수 있어요.
Claude 에게 "배포된 사이트 전체 테스트 해줘" 라고 하면 아래 명령을 대신 실행해 줘요. (1회 약 $0.5~1)

```bash
BASE_URL=https://내주소.vercel.app ADMIN_PASSWORD=운영자비밀번호 npm run test:e2e
```

### 앞으로 코드가 바뀌면?

GitHub 의 `main` 에 새 코드가 올라가면 **Vercel 이 자동으로 다시 배포**해요. 따로 할 일이 없어요.
(Claude 에게 "고쳐서 GitHub 에 올려줘" 라고 하면 됩니다.)

---

## 📚 챗봇이 아는 내용 (학습 데이터)

- 챗봇은 **GitHub 에 올라간 엑셀 파일**을 읽어서 답해요.
  - 처음에는 코드 레포의 `data/dchoi09_전집_학습데이터.xlsx` 를 읽고,
  - 운영자가 Q&A 를 고치거나 엑셀을 올리면 데이터 레포의 `knowledge/학습데이터.xlsx` 가 만들어져서 그때부터는 그 파일을 읽어요.
- 엑셀 파일 구성 (시트 2개)
  - **상품목록**: 상품명, 출판사, 연령, 연령 카테고리, 구성, 세이펜, 배송가/픽업가, 판매 여부, 태그, 리뷰 수·평점·대표 리뷰, 상세 설명, 상세페이지 주소
  - **Q&A**: 공통 질문 10개 + 상품별 질문(연령·구성·가격·세이펜·후기) — 총 552개
- 챗봇은 대화할 때마다 **현재 상품목록 + Q&A + 규칙** 을 함께 보고 답합니다.
- 운영자 페이지에서 Q&A·규칙을 바꾸면 **다음 메시지부터 바로** 반영돼요.
- 운영자 페이지 **엑셀 파일** 탭에서 지금 내용을 엑셀로 내려받고, 고친 엑셀을 다시 올려 한꺼번에 바꿀 수 있어요.

### 사이트 상품이 바뀌었을 때 (새로 수집하기)

Claude 에게 "전집 상품 다시 수집해서 엑셀 새로 만들어줘" 라고 하면 아래 명령을 대신 실행해 줘요.

```bash
npm run scrape
```

```bash
npm run excel
```

> ⚠️ 이미 운영자가 Q&A 를 고쳤다면 데이터 레포의 엑셀이 우선이에요. 새로 수집한 엑셀을 반영하려면 운영자 페이지 **엑셀 파일 → 업로드** 를 사용하세요.

### 데이터 레포(비공개)에 저장되는 파일

| 파일 | 내용 |
|---|---|
| `knowledge/학습데이터.xlsx` | 챗봇이 쓰는 학습 엑셀 (운영자가 고친 Q&A 포함) |
| `config/rules.json` | 챗봇 규칙 4가지 + 자동 차단 경고 횟수 |
| `users/<번호>.json` | 사용자 1명 = 파일 1개 (이름, 이메일, 경고·차단 상태, 대화 전체) |

- 저장할 때마다 GitHub 에 "대화 기록", "Q&A 수정" 같은 커밋이 남아서, 언제 무엇이 바뀌었는지 볼 수 있어요.
- 고객 개인정보(이름·이메일·대화)가 있으니 **데이터 레포는 꼭 비공개(Private)로 유지**하세요.

---

## 🛡️ 챗봇 규칙 (운영자 페이지 → 챗봇 규칙)

| 규칙 | 하는 일 |
|---|---|
| 응대 규칙 | 말투, 답변 길이, 가격 안내 방식, 모르는 내용은 1:1 문의로 안내 |
| 사용자 기분 파악 규칙 | 메시지마다 기분을 긍정/보통/불만/화남/불안 중 하나로 판단 → 운영자 화면에 표시 |
| 이상 사용자 판별 및 경고 규칙 | 메시지마다 정상/주의/경고 판단, 경고 시 답변에 경고 문구 포함 |
| 차단 규칙 | 즉시 차단할 행동. 차단되면 더 이상 대화할 수 없음 |

- 경고가 **N번**(기본 3번) 쌓이면 자동 차단됩니다. N 은 규칙 화면에서 바꿀 수 있어요.
- 차단된 사용자는 운영자 화면 **대화 기록 → 차단 해제** 로 풀 수 있어요.

---

## 💰 비용 안내 (대략)

- Sonnet 5.5 요금: 입력 100만 토큰당 $2, 출력 100만 토큰당 $10
- 상품 정보가 꽤 커서(약 10만 토큰) 메시지 1개당 **약 $0.03 ~ $0.05** 정도 예상돼요.
  - 같은 내용을 5분 안에 다시 쓰면 "캐시" 덕분에 입력 비용이 1/10 로 줄어요.
  - 5분 넘게 대화가 없다가 다시 시작하면 첫 메시지는 $0.3~0.4 정도 들 수 있어요.
- platform.claude.com → **Usage** 에서 실제 사용량을 볼 수 있고, **Limits** 에서 월 사용 한도를 정해둘 수 있어요.

---

## 🧑‍💻 개발자용 메모

- Next.js 16 (App Router) + TypeScript, `@anthropic-ai/sdk`, `exceljs`, `zod` — 별도 데이터베이스 없음
- `lib/claude.ts` — Claude 호출 (구조화된 출력으로 답변 + 기분 + 위험도 함께 받음, 상품 정보는 프롬프트 캐시, 안전 필터 거절 시 서버 측 fallback)
- `lib/files.ts` — 파일 보관함 (`GITHUB_TOKEN` 이 있으면 GitHub 데이터 레포 Contents API, 없으면 `.data/`). 동시 저장은 sha 비교 후 다시 시도
- `lib/store.ts` — 엑셀/규칙/사용자/대화 읽기·쓰기 (데이터 레포 주소는 `GITHUB_DATA_REPO`, 기본값 `hannah-hs/dchoi-chatbot1-data`)
- `scripts/e2e.ts` — 전체 기능 자동 점검 (`npm run test:e2e`)
- `lib/default-rules.ts` — 규칙 처음 값
- `scripts/scrape.ts` — dchoi09.com 수집 (Shopify 공개 JSON + 상세페이지)
- 내 컴퓨터에서 실행: `npm install` → `npm run dev` → http://localhost:3000 (Node.js 20 이상 필요)
