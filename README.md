# 本地 AI 答题助手（Local AI Answer Helper）

一个 Manifest V3 浏览器扩展：读取网页题目（重点适配超星学习通 `.question-item` 结构），调用 OpenAI 兼容的 AI 接口解答，在侧边栏展示答案，并支持一键自动把答案写回题目控件；同时支持**截图搜题**（框选屏幕区域发给多模态模型）。

> 说明：本扩展是本地自用工具，题目会发送到你自己配置的 AI 接口，不经过任何第三方中转。

---

## 一、功能一览

| 功能 | 说明 |
|---|---|
| 文字搜题 | 扫描页面 `.question-item`，解析题型/题干/选项/填空/简答，调用 AI 返回答案 |
| 截图搜题 | 框选屏幕题目区域 → 裁剪 → 发给视觉模型 → 返回答案 |
| 答案展示 | 侧边栏卡片逐题展示，答案可手动修改 |
| 自动作答 | 选择题/判断题模拟点击；填空/简答用原生 value setter；UEditor 富文本注入 |
| 设置页 | 配置接口 Base URL、API Key、模型、视觉模型、System Prompt |
| 设置入口 | 侧边栏右下角「⚙ 设置」按钮，一键打开设置页 |

---

## 二、文件结构

```
local-answer-helper/
├── manifest.json     # MV3 清单
├── background.js     # 后台：调用 AI 接口、截图（绕过 CORS）
├── content.js        # 内容脚本：读题 / 写答案 / 截图搜题 / 侧边栏 UI
├── content.css       # 侧边栏样式
├── options.html      # 设置页
├── options.js        # 设置页逻辑
├── README.md         # 本文件
└── icons/            # 扩展图标（16/48/128）
```

---

## 三、安装（Edge / Chrome）

1. 打开扩展管理页：
   - Edge：`edge://extensions`
   - Chrome：`chrome://extensions`
2. 打开右上角「**开发人员模式 / 开发者模式**」。
3. 点左上角「**加载解压缩的扩展**」。
4. 在文件夹窗口顶部地址栏粘贴扩展目录，回车：
   ```
   C:\Users\wx985\Downloads\浏览器\local-answer-helper
   ```
5. 点「选择文件夹」——注意要选中 `local-answer-helper` 这一层（里面能直接看到 `manifest.json`）。
6. 工具栏出现「本地 AI 答题助手」图标即安装成功。

---

## 四、配置 AI 接口

点击工具栏扩展图标打开设置页，填写：

| 字段 | 说明 | 示例 |
|---|---|---|
| 接口 Base URL | OpenAI 兼容接口根地址，须以 `/v1` 结尾 | `https://api.deepseek.com/v1` |
| API Key | 对应服务商密钥 | `sk-...` |
| 模型名 | 文字搜题用的模型 | `deepseek-chat` / `qwen2.5:7b` |
| 视觉模型 | 截图搜题用的多模态模型，留空则沿用模型名 | `qwen-vl-max` / `gpt-4o` |
| System Prompt | 约束输出格式，一般不改 | — |

**预设**：设置页提供 DeepSeek / Ollama 本地 / OpenAI / 本地 vLLM 四个快捷填充。

> ⚠️ 截图搜题需要模型支持图片输入。DeepSeek 的 `deepseek-chat` 是纯文本模型，不支持图片；请填多模态模型（如 `qwen-vl-max`、`gpt-4o`、`glm-4v`，或本地 `llava` / `qwen2-vl`）。

---

## 五、使用

### 文字搜题
1. 打开学习通（或含 `.question-item` 的答题页）。
2. 点右侧「AI 答题」竖条展开侧边栏。
3. 点「扫描题目并 AI 解答」。
4. 核对/修改答案后，点单题「填入」或「全部填入」。

### 截图搜题
1. 点侧边栏「截图搜题」。
2. 页面显示截图，拖拽框选题目区域，松开确认（Esc 取消）。
3. AI 识别后，答案显示在侧边栏顶部的「截图搜题结果」卡片。

### 设置
- 点侧边栏底部右下角「⚙ 设置」，或点工具栏扩展图标。

---

## 六、修改后如何生效

1. `edge://extensions` → 点扩展的「刷新」（↻），或删除后重新加载。
2. 回到答题页按 **Ctrl + Shift + R** 硬刷新。
3. 设置页是独立标签页，重载扩展后需重新打开。

---

## 七、常见问题

| 问题 | 排查 |
|---|---|
| 看不到侧边栏竖条 | 确认扩展已加载；Ctrl+Shift+R 硬刷新；确认页面未被浏览器限制注入 |
| 提示「未配置 API Key」 | 打开设置页填好 Key 并保存 |
| `HTTP_401` | Key 错误或过期 |
| `HTTP_404` | Base URL 写错，DeepSeek 必须 `https://api.deepseek.com/v1` |
| 扫描不到题目 | 当前适配 `.question-item` 结构，其它平台需扩选择器 |
| 截图搜题报错 | 检查「视觉模型」是否填了支持图片的模型 |
| 填入没反应 | 该题控件结构与适配的不一致，或页面只读；看控制台报错 |

---

## 八、支持范围

- 读题/写题重点适配**超星学习通手机版随堂练习/测验**（`mobilelearn.chaoxing.com` 的 `.question-item` 结构）。
- 其它平台若使用相同 DOM 结构也可工作；不同结构需按需扩展 `parseQuestion` / `fillQuestion`。

---

## 九、安全提示

- API Key 仅保存在浏览器本地 `chrome.storage.local`，不会上传到插件以外的地方。
- 题目内容明文发送到你自己配置的接口。
- 答案由 AI 生成，仅供参考，正式提交前请自行核对。
