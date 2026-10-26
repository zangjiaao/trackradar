import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  // 只跳过 SSR 预打包。客户端仍预打包，否则 style-to-js 的 CJS 默认导出对不上。
  ssr: {
    optimizeDeps: {
      exclude: ["streamdown"],
    },
  },
});
