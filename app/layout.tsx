import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "規格書比對助手",
  description: "上傳公版規範與送審規格書，AI 逐條比對並輸出規格差異、缺漏、新增三張表，再由程式核對引用與歸類。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
