import "./globals.css";
import type { Metadata } from "next";
import { AppFrame } from "@/components/app-frame";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "赛道雷达 TrackRadar",
  description: "用可量化证据选择更能接到订单的 AI 软件赛道。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // 浏览器扩展会改这些节点上的属性（例如沉浸式翻译的 data-immersive-translate-page-theme）。
    // suppressHydrationWarning 只忽略这一层的属性差异，不改变渲染结果。
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
