// background.js — 服务后台：调用 OpenAI 兼容 AI 接口（支持多模态图片）+ 截图

const DEFAULTS = {
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "deepseek-chat",
  visionModel: "", // 截图搜题使用的视觉模型；留空则沿用 model
  systemPrompt:
    "你是答题助手。请只输出一个 JSON 对象，不要输出任何其它文字、解释或代码块标记。",
};

async function getSettings() {
  const got = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...got };
}

async function callAI(payload) {
  const s = await getSettings();
  if (!s.apiKey) {
    throw new Error("NO_API_KEY");
  }
  const url = s.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const useVision = !!payload.imageDataUrl;
  const model = useVision && s.visionModel ? s.visionModel : s.model;

  let userContent;
  if (useVision) {
    userContent = [
      { type: "text", text: payload.prompt },
      { type: "image_url", image_url: { url: payload.imageDataUrl } },
    ];
  } else {
    userContent = payload.prompt;
  }

  const messages = [
    { role: "system", content: s.systemPrompt },
    { role: "user", content: userContent },
  ];

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + s.apiKey,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      stream: false,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error("HTTP_" + resp.status + (text ? ": " + text.slice(0, 300) : ""));
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("EMPTY_RESPONSE");
  }
  return content;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "GET_SETTINGS": {
          sendResponse({ ok: true, settings: await getSettings() });
          return;
        }
        case "SAVE_SETTINGS": {
          await chrome.storage.local.set(msg.settings || {});
          sendResponse({ ok: true });
          return;
        }
        case "SOLVE": {
          const raw = await callAI(msg.payload);
          sendResponse({ ok: true, content: raw });
          return;
        }
        case "CAPTURE_TAB": {
          // 截取当前可见标签页（不含浏览器 UI），返回 dataURL
          const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" });
          sendResponse({ ok: true, dataUrl });
          return;
        }
        case "OPEN_OPTIONS": {
          chrome.runtime.openOptionsPage();
          sendResponse({ ok: true });
          return;
        }
        default: {
          sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
          return;
        }
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  // 异步 sendResponse 需要返回 true
  return true;
});
