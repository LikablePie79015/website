import { marked } from "marked";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import config from "./config.json" with { type: "json" };

const BASE64_RE = /^[A-Za-z0-9+/=]+$/;

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseFrontMatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "tags") {
      meta.tags = (value.match(/'[^']*'|"[^"]*"|[^,\[\]"\s]+/g) || []).map((t) =>
        t.replace(/^["']|["']$/g, "").trim()
      );
    } else {
      meta[key] = value;
    }
  }
  return { meta, body: content.slice(match[0].length) };
}

function replaceMath(content) {
  let c = content;

  c = c.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    return "%%MB%%" + btoa(unescape(encodeURIComponent(tex))) + "%%ME%%";
  });

  c = c.replace(/\$([^$]{1,200}?)\$/g, (_, tex) => {
    const t = tex.trim();
    if (t.length === 0) return _;
    return "%%MI%%" + btoa(unescape(encodeURIComponent(t))) + "%%IE%%";
  });

  return c;
}

const FENCED_RE = /```[^\n]*\n[\s\S]*?```/g;
const INLINE_CODE_RE = /(`+)([^`]*?)\1/g;

function protectCode(content) {
  const blocks = [];
  const inline = [];
  let c = content;
  c = c.replace(FENCED_RE, (m) => {
    blocks.push(m);
    return "%%CB%%" + (blocks.length - 1) + "%%CE%%";
  });
  c = c.replace(INLINE_CODE_RE, (m) => {
    inline.push(m);
    return "%%IC%%" + (inline.length - 1) + "%%IE%%";
  });
  return { c, blocks, inline };
}

function restoreCode(c, blocks, inline) {
  let r = c;
  r = r.replace(/%%IC%%(\d+)%%IE%%/g, (_, i) => inline[+i]);
  r = r.replace(/%%CB%%(\d+)%%CE%%/g, (_, i) => blocks[+i]);
  return r;
}

function addMathBack(html) {
  let result = html;

  result = result.replace(/%%MB%%([A-Za-z0-9+/=]+)%%ME%%/g, (_, b64) => {
    if (!BASE64_RE.test(b64)) return _;
    const tex = decodeURIComponent(escape(atob(b64)));
    try {
      return `<div class="math-block">${katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
      })}</div>`;
    } catch {
      return `<pre>$$ ${escapeHtml(tex)} $$</pre>`;
    }
  });

  result = result.replace(/%%MI%%([A-Za-z0-9+/=]+)%%IE%%/g, (_, b64) => {
    if (!BASE64_RE.test(b64)) return _;
    const tex = decodeURIComponent(escape(atob(b64)));
    try {
      return katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code>$${escapeHtml(tex)}$</code>`;
    }
  });

  return result;
}

function renderCode(code, lang) {
  let language = (lang || "").toLowerCase().trim();
  let body;
  if (language && hljs.getLanguage(language)) {
    try {
      body = hljs.highlight(code, { language }).value;
    } catch {
      body = escapeHtml(code);
    }
  } else {
    body = escapeHtml(code);
  }
  const langLabel = language ? escapeHtml(language) : "text";
  return `<div class="code-block">
    <div class="code-header"><span class="code-lang">${langLabel}</span><button type="button" class="code-copy" data-code="${escapeHtml(code)}">复制</button></div>
    <pre><code class="hljs language-${escapeHtml(language || "plaintext")}">${body}</code></pre>
  </div>`;
}

export function renderMarkdown(content) {
  const { meta, body } = parseFrontMatter(content);
  const { c: bodyProtected, blocks, inline } = protectCode(body);
  const withMath = replaceMath(bodyProtected);
  const restored = restoreCode(withMath, blocks, inline);

  const toc = [];
  const usedIds = new Set();

  function makeId(text) {
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9faf-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!id) id = "section";
    let base = id;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n}`;
      n++;
    }
    usedIds.add(id);
    return id;
  }

  marked.use({
    renderer: {
      heading(text, level) {
        const id = makeId(text);
        toc.push({ level, id, text: text.replace(/<[^>]+>/g, "").trim() });
        return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${level}>`;
      },
      code(code, infostring) {
        const lang = infostring ? infostring.split(/\s+/)[0] : "";
        return renderCode(code, lang);
      },
    },
  });

  let html = marked.parse(restored);
  html = addMathBack(html);
  return { meta, html, toc };
}

function renderNav(activePost = null) {
  const navLinks = (config.nav || [])
    .map(
      (item) =>
        `<a href="${item.link}" class="${activePost ? "" : "active"}">${item.label}</a>`
    )
    .join("");
  return `<nav class="nav"><div class="nav-inner"><span class="brand">${config.siteTitle}</span><div class="nav-links">${navLinks}</div></div></nav>`;
}

function renderHeader() {
  return `<header class="hero"><div class="hero-icon">${config.avatar}</div><h1>${config.siteTitle}</h1><p>${config.siteDescription}</p></header>`;
}

function renderToc(toc) {
  if (!toc || toc.length === 0) return "";
  const items = toc
    .map(
      (h) =>
        `<li class="toc-${h.level}" data-id="${h.id}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`
    )
    .join("");
  return `
    <aside class="toc" id="toc">
      <div class="toc-title">目录</div>
      <nav class="toc-nav"><ul>${items}</ul></nav>
    </aside>`;
}

export function renderHome(app, postFiles, cfg) {
  const posts = postFiles
    .map(({ name, content }) => {
      const { meta } = parseFrontMatter(content);
      return {
        name,
        title: meta.title || name,
        date: meta.date || "",
        tags: meta.tags || [],
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const cards = posts
    .map((p) => {
      const tags = (p.tags || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("");
      return `<a class="card" href="./index.html?post=${encodeURIComponent(p.name)}">
        <h2>${escapeHtml(p.title)}</h2>
        <div class="card-meta">
          <span class="date">${escapeHtml(p.date)}</span>
          <span class="tags">${tags}</span>
        </div>
      </a>`;
    })
    .join("");

  app.innerHTML = `
    ${renderNav()}
    ${renderHeader()}
    <div class="container">
      <div class="post-list">${cards}</div>
    </div>
    <footer class="footer">${cfg.author} · Powered by Markdown + KaTeX</footer>
  `;
}

export function renderPost(app, content, postName) {
  const { meta, html, toc } = renderMarkdown(content);

  const tags = (meta.tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  app.innerHTML = `
    ${renderNav(true)}
    <div class="container post-container">
      <div class="post-main">
        <article class="post">
          <header class="post-header">
            <h1>${escapeHtml(meta.title || "")}</h1>
            <div class="post-meta">
              <span class="date">${escapeHtml(meta.date || "")}</span>
              <span class="tags">${tags}</span>
            </div>
          </header>
          <div class="post-content">${html}</div>
        </article>
      </div>
      ${renderToc(toc)}
    </div>
    <footer class="footer">${config.author} · Powered by Markdown + KaTeX</footer>
  `;

  window.scrollTo(0, 0);
  initScrollSpy(toc);

  const hash = decodeURIComponent(window.location.hash.slice(1));
  const target = hash && document.getElementById(hash);
  if (target) {
    const y = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "auto" });
  }
}

function initScrollSpy(toc) {
  if (!toc || toc.length === 0) return;
  const tocEl = document.getElementById("toc");
  if (!tocEl) return;

  const items = tocEl.querySelectorAll("li");
  const headings = toc
    .map((h) => document.getElementById(h.id))
    .filter(Boolean);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            items.forEach((li) =>
              li.classList.toggle("active", li.dataset.id === id)
            );
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    headings.forEach((h) => observer.observe(h));
  }

  items.forEach((li) => {
    li.addEventListener("click", (e) => {
      const id = li.dataset.id;
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        items.forEach((el) => el.classList.toggle("active", el === li));
        const y = target.getBoundingClientRect().top + window.scrollY - 84;
        window.scrollTo({ top: y, behavior: "smooth" });
        history.replaceState(null, "", `#${id}`);
      }
    });
  });
}

export { config };
