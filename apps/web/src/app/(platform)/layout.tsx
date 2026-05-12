import { PlatformSidebar } from "@/components/platform/PlatformSidebar";
import { PlatformHeader } from "@/components/platform/PlatformHeader";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 상단 고정 헤더 */}
      <PlatformHeader />

      {/* 헤더 아래 본문 */}
      <div style={{ display: "flex", paddingTop: "var(--header-height)" }}>
        <PlatformSidebar />
        <main
          id="platform-main"
          style={{
            flex: 1,
            marginLeft: "var(--sidebar-width)",
            padding: "1.25rem 1.5rem",
            minHeight: "calc(100vh - var(--header-height))",
            transition: "margin-left 0.2s ease",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
