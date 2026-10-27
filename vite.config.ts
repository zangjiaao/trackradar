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
  // Astryx 的 Context 必须全图只有一份。子路径若有的进预打包、有的走源码，
  // 客户端会退回英文文案，和 SSR 的中文 aria-label 对不上。
  optimizeDeps: {
    exclude: ["@astryxdesign/core", "@astryxdesign/theme-neutral"],
  },
  // 只跳过 SSR 预打包。客户端仍预打包 streamdown，否则 style-to-js 的 CJS 默认导出对不上。
  ssr: {
    optimizeDeps: {
      exclude: ["streamdown"],
    },
  },
});
