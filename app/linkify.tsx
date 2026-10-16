// 답변 안의 https:// 주소를 눌러서 열 수 있는 링크로 바꿔줍니다.
import { Fragment } from "react";

const URL_RE = /(https?:\/\/[^\s)]+)/g;

function shortLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("dchoi09.com") && u.pathname.startsWith("/products/")) return "상세페이지 보기 ↗";
    return decodeURI(u.hostname + u.pathname).slice(0, 48);
  } catch {
    return url;
  }
}

export function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {shortLabel(part)}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
