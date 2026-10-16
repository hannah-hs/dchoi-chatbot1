import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  // 챗봇이 읽는 기본 엑셀 파일을 서버에 함께 올립니다.
  outputFileTracingIncludes: { "/**": ["./data/*.xlsx"] },
};

export default nextConfig;
