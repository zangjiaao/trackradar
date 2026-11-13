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
});
