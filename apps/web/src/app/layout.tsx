import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WGP 공감 — 웹 게임 플랫폼",
    template: "%s | WGP 공감",
  },
  description: "설치 없이 바로 즐기는 웹 게임 플랫폼. 수백 개의 WebGL 게임을 무료로 플레이하세요.",
  keywords: ["웹게임", "무료게임", "WebGL", "브라우저게임", "게임플랫폼"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002"),
  openGraph: {
    title: "WGP 공감 — 웹 게임 플랫폼",
    description: "설치 없이 바로 즐기는 웹 게임 플랫폼",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${outfit.variable} ${inter.variable}`}>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
