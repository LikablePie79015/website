import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function copyPosts() {
  return {
    name: "blog:copy-posts",
    closeBundle() {
      const src = join(process.cwd(), "posts");
      const dest = join(process.cwd(), "dist", "posts");
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    },
  };
}

export default {
  base: "./",
  plugins: [copyPosts()],
  build: {
    outDir: "dist",
  },
  server: {
    port: 3000,
  },
};
