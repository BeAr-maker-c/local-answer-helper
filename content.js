// content.js — 内容脚本：读取题目、调用 AI、展示答案、一键写入答案
(function () {
  if (window.__lafInjected) return;
  window.__lafInjected = true;

  // ===================== 工具函数 =====================
  function visible(el) {
    if (!el) return false;
    if (el.closest && el.closest("[hidden]")) return false;
    try {
      const cs = el.ownerDocument.defaultView.getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden";
    } catch (e) {
      return true;
    }
  }

  function textOf(el) {
    if (!el) return "";
    const c = el.cloneNode(true);
    c.querySelectorAll("script, style, .person-answer").forEach((n) => n.remove());
    c.querySelectorAll("img").forEach((n) => n.replaceWith(n.getAttribute("alt") || "[图]"));
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  }

  // 用原生 setter 改值 + 派发事件，绕过 React/Vue 受控组件
  function setNativeValue(el, value) {
    if (!el) return;
    const win = el.ownerDocument.defaultView || window;
    const proto = el instanceof win.HTMLTextAreaElement
      ? win.HTMLTextAreaElement.prototype
      : win.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new win.Event("input", { bubbles: true }));
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
    el.dispatchEvent(new win.Event("blur", { bubbles: true }));
  }

  // 从 AI 返回文本中提取第一个 JSON 对象
  function extractJSON(str) {
    if (!str) return null;
    // 先尝试直接 parse
    try { return JSON.parse(str); } catch (e) {}
    // 去掉 markdown 代码块
    let s = str.replace(/```json/gi, "").replace(/```/g, "");
    // 提取第一个 { ... } 平衡块
    const start = s.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  // 同源 iframe 的 document 列表
  function accessibleFrames() {
    const docs = [document];
    try {
      document.querySelectorAll("iframe").forEach((f) => {
        try {
          const d = f.contentDocument;
          if (d) docs.push(d);
        } catch (e) {}
      });
    } catch (e) {}
    return docs;
  }

  // ===================== 题目扫描 =====================
  // 每个 question: { doc, root, index, type, text, options:[{letter,text,li}], blanks:[], textarea }
  function parseQuestion(doc, root, index) {
    const q = { doc, root, index, type: "unknown", text: "", options: [], blanks: [], textarea: null };

    q.text = textOf(root.querySelector(".question-name .html-content-box") || root.querySelector(".html-content-box") || root);

    const typeEl = root.querySelector(".question-name .grey-text") || root.querySelector(".grey-text");
    const typeStr = textOf(typeEl).replace(/[\[\]【】\s]/g, "");
    q.type = typeStr;

    // 选择题 / 判断题选项
    root.querySelectorAll(".option-list > li").forEach((li) => {
      const letter = textOf(li.querySelector(".option-letter")) || "";
      const optText = textOf(li);
      q.options.push({ letter, text: optText, li });
    });

    // 填空题输入框
    q.blanks = [...root.querySelectorAll(".option-fill-list > li > input.ofl-ipt, .option-fill-list input")];

    // 简答题 textarea
    q.textarea = root.querySelector(".short-answer-textarea > textarea") || root.querySelector("textarea");

    return q;
  }

  function collectQuestions() {
    const questions = [];
    for (const doc of accessibleFrames()) {
      let roots = [...doc.querySelectorAll(".question-item")].filter(visible);
      if (roots.length) {
        roots.forEach((root, i) => questions.push(parseQuestion(doc, root, questions.length)));
      }
    }
    return questions;
  }

  // ===================== 答案写入 =====================
  function isChoice(q) {
    return q.type.includes("单选") || q.type.includes("多选") || q.type.includes("判断") || q.options.length > 0;
  }

  function letterToIndex(q, letter) {
    if (!letter) return -1;
    const up = String(letter).toUpperCase();
    for (let i = 0; i < q.options.length; i++) {
      if (q.options[i].letter === up) return i;
    }
    // 判断题：把 "正确/对/错误/错" 映射到选项文本
    if (q.type.includes("判断")) {
      const isTrue = /正确|对|√|true|T/i.test(String(letter));
      const isFalse = /错误|错|×|false|F/i.test(String(letter));
      for (let i = 0; i < q.options.length; i++) {
        const t = q.options[i].text;
        if (isTrue && /正确|对|√|true/i.test(t)) return i;
        if (isFalse && /错误|错|×|false/i.test(t)) return i;
      }
    }
    return -1;
  }

  function fillChoice(q, answer) {
    const letters = String(answer || "").toUpperCase().replace(/[^A-Z]/g, "").split("");
    const indexes = letters.map((l) => letterToIndex(q, l)).filter((i) => i >= 0);
    if (!indexes.length) return false;
    let done = false;
    q.options.forEach((opt, i) => {
      const shouldActive = indexes.includes(i);
      if (shouldActive && !opt.li.classList.contains("active")) {
        opt.li.click();
        done = true;
      } else if (!shouldActive && opt.li.classList.contains("active") && q.type.includes("多选")) {
        opt.li.click();
        done = true;
      }
    });
    return done;
  }

  function fillBlank(q, answer) {
    if (!q.blanks.length) return false;
    let parts = String(answer || "").split(/[；;，,、|]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1 && q.blanks.length > 1) {
      // 无分隔时，逐字填充到各空
      const chars = Array.from(parts[0]);
      if (chars.length === q.blanks.length) parts = chars;
    }
    q.blanks.forEach((input, i) => {
      if (parts[i] != null) setNativeValue(input, parts[i]);
    });
    return true;
  }

  function fillShortAnswer(q, answer) {
    if (!q.textarea) return false;
    if (q.textarea.disabled || q.textarea.readOnly) return false;
    setNativeValue(q.textarea, String(answer || ""));
    return true;
  }

  function fillUEditor(content) {
    try {
      const UE = window.UE;
      const instances = UE && (UE.instances || {});
      const names = Object.keys(instances || {});
      if (names.length) {
        names.forEach((name) => {
          try {
            const ed = UE.getEditor(name);
            if (ed && ed.setContent) {
              ed.setContent("<p>" + String(content || "") + "</p>");
            }
          } catch (e) {}
        });
        return true;
      }
    } catch (e) {}
    return false;
  }

  function fillQuestion(q, answer) {
    if (isChoice(q)) return fillChoice(q, answer);
    if (q.type.includes("填空")) return fillBlank(q, answer);
    if (q.blanks.length) return fillBlank(q, answer);
    if (q.textarea) return fillShortAnswer(q, answer);
    return false;
  }

  // ===================== AI 调用 =====================
  function buildPrompt(questions) {
    const lines = ["下面是 " + questions.length + " 道题目。请解答，并只输出一个 JSON 对象："];
    lines.push('{"answers":[{"index":0,"answer":"A"},{"index":1,"answer":"答案文本"}]}');
    lines.push("");
    lines.push("规则：选择题/判断题 answer 填选项字母（多选连写如 AB）或判断题答案（正确/错误）；填空题多空用中文分号；分隔；简答题填完整答案。不要输出 JSON 以外的内容。");
    lines.push("");
    questions.forEach((q, i) => {
      lines.push("[" + i + "] 题型：" + (q.type || "未知"));
      lines.push("题干：" + q.text);
      if (q.options.length) {
        lines.push("选项：" + q.options.map((o) => (o.letter ? o.letter + ". " : "") + o.text).join("  "));
      }
      if (q.blanks.length) {
        lines.push("（共 " + q.blanks.length + " 个空）");
      }
      lines.push("");
    });
    return lines.join("\n");
  }

  async function callAI(prompt) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "SOLVE", payload: { prompt } }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (resp && resp.ok) return resolve(resp.content);
        reject(new Error(resp?.error || "UNKNOWN"));
      });
    });
  }

  // ===================== 侧边栏 UI =====================
  let state = { questions: [], answers: {} };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function buildPanel() {
    const host = document.createElement("div");
    host.id = "laf-root";

    const toggle = el("div", "laf-toggle", "AI 答题");
    const panel = el("div", "laf-panel");

    const header = el("div", "laf-header");
    const logo = el("div", "laf-logo", "AI");
    const titleWrap = el("div", "laf-titlewrap");
    titleWrap.appendChild(el("div", "laf-title", "答题助手"));
    titleWrap.appendChild(el("div", "laf-subtitle", "本地 AI · 自动作答"));
    header.appendChild(logo);
    header.appendChild(titleWrap);
    const close = el("button", "laf-close", "×");
    header.appendChild(close);

    const actions = el("div", "laf-actions");
    const scanBtn = el("button", "laf-btn laf-primary", "扫描题目并 AI 解答");
    const fillAllBtn = el("button", "laf-btn", "全部填入");
    const clearBtn = el("button", "laf-btn laf-ghost", "清空");
    actions.appendChild(scanBtn);
    actions.appendChild(fillAllBtn);
    actions.appendChild(clearBtn);

    const status = el("div", "laf-status", "");
    const list = el("div", "laf-list");

    panel.appendChild(header);
    panel.appendChild(actions);
    panel.appendChild(status);
    panel.appendChild(list);

    host.appendChild(toggle);
    host.appendChild(panel);
    document.documentElement.appendChild(host);

    toggle.addEventListener("click", () => {
      panel.classList.toggle("laf-open");
      toggle.style.display = panel.classList.contains("laf-open") ? "none" : "block";
    });
    close.addEventListener("click", () => {
      panel.classList.remove("laf-open");
      toggle.style.display = "block";
    });

    function setStatus(msg, isErr) {
      status.textContent = msg;
      status.className = "laf-status" + (isErr ? " laf-err" : "");
    }

    scanBtn.addEventListener("click", async () => {
      scanBtn.disabled = true;
      setStatus("正在扫描题目…");
      try {
        state.questions = collectQuestions();
        if (!state.questions.length) {
          setStatus("未发现题目（支持学习通 .question-item 页面）", true);
          return;
        }
        setStatus("发现 " + state.questions.length + " 题，正在调用 AI…");
        const raw = await callAI(buildPrompt(state.questions));
        const parsed = extractJSON(raw);
        state.answers = {};
        if (parsed && Array.isArray(parsed.answers)) {
          parsed.answers.forEach((a) => {
            if (a && typeof a.index === "number") state.answers[a.index] = a.answer;
          });
        }
        renderList(setStatus);
        setStatus("解答完成，共 " + Object.keys(state.answers).length + " 题");
      } catch (e) {
        const m = e.message || String(e);
        if (m === "NO_API_KEY") {
          setStatus("未配置 API Key，请打开扩展设置页配置", true);
          chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
        } else {
          setStatus("AI 调用失败：" + m, true);
        }
      } finally {
        scanBtn.disabled = false;
      }
    });

    fillAllBtn.addEventListener("click", () => {
      let done = 0;
      state.questions.forEach((q, i) => {
        const a = state.answers[i];
        if (a == null) return;
        if (fillQuestion(q, a)) done++;
      });
      setStatus("已填入 " + done + " 题");
    });

    clearBtn.addEventListener("click", () => {
      state = { questions: [], answers: {} };
      list.innerHTML = "";
      setStatus("");
    });

    return { setStatus, renderList };
  }

  function renderList(setStatus) {
    const list = document.querySelector("#laf-root .laf-list");
    list.innerHTML = "";
    state.questions.forEach((q, i) => {
      const item = el("div", "laf-q");
      const head = el("div", "laf-q-head");
      const badge = el("span", "laf-q-badge", String(i + 1));
      const title = el("div", "laf-q-title");
      title.textContent = (q.type || "题目") + "：" + (q.text || "").slice(0, 80);
      head.appendChild(badge);
      head.appendChild(title);
      item.appendChild(head);

      if (q.options.length) {
        const opts = el("div", "laf-q-opts", q.options.map((o) => (o.letter ? o.letter + ". " : "") + o.text).join("  ").slice(0, 120));
        item.appendChild(opts);
      }

      const row = el("div", "laf-q-row");
      const input = el("input", "laf-q-answer");
      input.placeholder = "答案";
      input.value = state.answers[i] != null ? state.answers[i] : "";
      input.addEventListener("input", () => (state.answers[i] = input.value));
      const btn = el("button", "laf-btn laf-mini", "填入");
      btn.addEventListener("click", () => {
        const ok = fillQuestion(q, input.value);
        if (ok) setStatus("第 " + (i + 1) + " 题已填入");
        else setStatus("第 " + (i + 1) + " 题填入失败（无匹配输入控件）", true);
      });
      row.appendChild(input);
      row.appendChild(btn);
      item.appendChild(row);
      list.appendChild(item);
    });
  }

  function init() {
    if (window.top !== window) return; // 侧边栏只注入主框架
    const { renderList } = buildPanel();
    // 每 3 秒自动重扫，保持题目列表更新（不自动调 AI）
    setInterval(() => {
      const qs = collectQuestions();
      if (qs.length !== state.questions.length) {
        state.questions = qs;
        state.answers = {};
        renderList(() => {});
      }
    }, 3000);
  }

  init();
})();
