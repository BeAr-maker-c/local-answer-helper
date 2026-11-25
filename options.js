// options.js — 设置页逻辑

const DEFAULTS = {
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
  visionModel: "",
  systemPrompt:
    "你是答题助手。请只输出一个 JSON 对象，不要输出任何其它文字、解释或代码块标记。",
};

const $ = (id) => document.getElementById(id);

async function load() {
  const got = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const s = { ...DEFAULTS, ...got };
  $("baseUrl").value = s.baseUrl;
  $("apiKey").value = s.apiKey;
  $("model").value = s.model;
  $("visionModel").value = s.visionModel;
  $("systemPrompt").value = s.systemPrompt;
}

async function save() {
  const settings = {
    baseUrl: $("baseUrl").value.trim(),
    apiKey: $("apiKey").value.trim(),
    model: $("model").value.trim(),
    visionModel: $("visionModel").value.trim(),
    systemPrompt: $("systemPrompt").value.trim(),
  };
  await chrome.storage.local.set(settings);
  $("status").textContent = "已保存 ✓";
  setTimeout(() => ($("status").textContent = ""), 1500);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  document.querySelectorAll(".presets button").forEach((b) => {
    b.addEventListener("click", () => {
      $("baseUrl").value = b.dataset.base;
    });
  });
});
