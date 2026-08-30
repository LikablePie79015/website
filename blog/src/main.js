import "./style.css";
import config from "./config.json";
import { renderHome, renderPost } from "./blog.js";
import { initSearch } from "./search.js";

const app = document.getElementById("app");
const dirNames = [
  "welcome.md",
  "linear-algebra-notes.md",
  "build-blog-with-vite.md",
];
let postFiles = [];

async function loadPosts() {
  const files = [];
  for (const name of dirNames) {
    try {
      const content = await fetch(`./posts/${name}`).then((r) => r.text());
      files.push({ name, content });
    } catch {
      /* skip */
    }
  }
  postFiles = files;
  return files;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".code-copy");
  if (!btn) return;
  const code = btn.dataset.code;
  navigator.clipboard
    .writeText(code)
    .then(() => {
      btn.textContent = "已复制";
      setTimeout(() => {
        btn.textContent = "复制";
      }, 1600);
    })
    .catch(() => {
      btn.textContent = "复制失败";
      setTimeout(() => {
        btn.textContent = "复制";
      }, 1600);
    });
});

async function init() {
  const params = new URLSearchParams(window.location.search);
  const post = params.get("post");

  const files = await loadPosts();
  initSearch(() => postFiles);

  try {
    if (post) {
      const content = postFiles.find((f) => f.name === post)?.content;
      if (content) {
        renderPost(app, content, post);
      } else {
        const fetched = await fetch(`./posts/${post}`).then((r) => {
          if (!r.ok) throw new Error("Not found");
          return r.text();
        });
        renderPost(app, fetched, post);
      }
    } else {
      renderHome(app, files, config);
    }
  } catch (err) {
    app.innerHTML = `<div class="container"><h1>404</h1><p>页面不存在或文章未找到。</p><p><a href="./index.html">返回首页</a></p></div>`;
  }
}

init();
