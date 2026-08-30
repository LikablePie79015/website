function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$([^$]*?)\$/g, "$1")
    .replace(/%%[A-Za-z]%%[A-Za-z0-9+/=]*%%[A-Za-z]%%/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function makeId(text, usedIds) {
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

export function buildIndex(postFiles) {
  return postFiles.map(({ name, content }) => {
    const { meta, body } = parseFrontMatter(content);
    const usedIds = new Set();
    const headings = [];
    const lines = body.split(/\r?\n/);
    let currentSection = { id: "", heading: meta.title || name, text: [] };

    const flush = () => {
      currentSection.text = stripMarkdown(currentSection.text.join("\n"));
      headings.push({ ...currentSection });
      currentSection.text = [];
    };

    for (const line of lines) {
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flush();
        const level = h[1].length;
        const text = h[2].trim();
        const id = makeId(text, usedIds);
        currentSection = { level, id, heading: text, text: [] };
      } else {
        currentSection.text.push(line);
      }
    }
    flush();

    return {
      name,
      title: meta.title || name,
      date: meta.date || "",
      tags: meta.tags || [],
      sections: headings.filter((s) => s.text),
    };
  });
}

function scoreMatch(query, heading, text) {
  const q = query.toLowerCase();
  if (heading.toLowerCase().includes(q)) return 2;
  if (text.toLowerCase().includes(q)) return 1;
  return 0;
}

export function initSearch(getPosts) {
  if (!document.querySelector("#search-overlay")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="search-overlay" id="search-overlay" hidden>
        <div class="search-box" role="dialog" aria-modal="true" aria-label="搜索">
          <input id="search-input" type="text" placeholder="搜索文章…按 Esc 关闭" autocomplete="off" spellcheck="false" />
          <div class="search-results" id="search-results"></div>
          <div class="search-footer"><span>Ctrl+K 切换 · ↑↓ 选择 · Esc 关闭</span></div>
        </div>
      </div>`
    );
  }

  const overlay = document.getElementById("search-overlay");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  let index = [];
  let current = -1;

  function rebuildIndex() {
    index = buildIndex(getPosts());
  }

  function open() {
    rebuildIndex();
    overlay.hidden = false;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => input.focus(), 0);
    render([]);
  }

  function close() {
    overlay.hidden = true;
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    input.value = "";
    current = -1;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${q})`, "ig");
    return escapeHtml(text).replace(new RegExp(`(${q})`, "ig"), "<mark>$1</mark>");
  }

  function snippet(text, query, len = 80) {
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return escapeHtml(text.slice(0, len)) + (text.length > len ? "…" : "");
    const start = Math.max(0, idx - Math.floor(len / 3));
    const slice = text.slice(start, start + len);
    return (start > 0 ? "…" : "") + highlight(slice, query) + (start + len < text.length ? "…" : "");
  }

  function render(posts) {
    if (!posts.length) {
      results.innerHTML = `<div class="search-empty">${queryPrompt()}</div>`;
      return;
    }
    current = -1;
    results.innerHTML = posts
      .map((p, i) => {
        const tagHtml = (p.tags || [])
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("");
        return `<a class="search-item" data-index="${i}" href="./index.html?post=${encodeURIComponent(p.name)}${p.id ? "#" + encodeURIComponent(p.id) : ""}">
          <div class="search-item-title">
            <span class="search-item-heading">${highlight(p.heading, input.value)}</span>
            <span class="search-item-post">${highlight(p.title, input.value)}</span>
          </div>
          ${p.snippet ? `<div class="search-item-snippet">${p.snippet}</div>` : ""}
          <div class="search-item-meta">
            <span class="date">${escapeHtml(p.date)}</span>
            ${tagHtml}
          </div>
        </a>`;
      })
      .join("");
  }

  function queryPrompt() {
    return input.value ? "未找到匹配的文章" : "输入关键词开始搜索";
  }

  function run() {
    const q = input.value.trim();
    if (!q) {
      render([]);
      return;
    }
    const found = [];
    for (const post of index) {
      if (post.title.toLowerCase().includes(q.toLowerCase())) {
        found.push({
          name: post.name,
          title: post.title,
          date: post.date,
          tags: post.tags,
          id: "",
          heading: post.title,
          snippet: "",
          _score: 3,
        });
      }
      for (const section of post.sections) {
        const score = scoreMatch(q, section.heading, section.text);
        if (score) {
          found.push({
            name: post.name,
            title: post.title,
            date: post.date,
            tags: post.tags,
            id: section.id,
            heading: section.heading,
            snippet: snippet(section.text, q),
            _score: score,
          });
        }
      }
    }
    found.sort((a, b) => b._score - a._score || a.title.localeCompare(b.title));
    render(found.slice(0, 20));
  }

  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      const active = results.querySelector(".search-item.active");
      if (active) {
        e.preventDefault();
        window.location.href = active.getAttribute("href");
      }
    } else if (e.key === "Escape") {
      close();
    }
  });

  function move(dir) {
    const items = results.querySelectorAll(".search-item");
    if (!items.length) return;
    if (current !== -1) items[current].classList.remove("active");
    current = (current + dir + items.length) % items.length;
    items[current].classList.add("active");
    items[current].scrollIntoView({ block: "nearest" });
  }

  results.addEventListener("mousemove", (e) => {
    const item = e.target.closest(".search-item");
    if (!item) return;
    if (current !== -1 && results.children[current]) results.children[current].classList.remove("active");
    current = +item.dataset.index;
    item.classList.add("active");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (overlay.hidden) open();
      else close();
    }
  });
}
