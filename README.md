# 本地 AI 答题助手

一个 Manifest V3 浏览器扩展：读取网页题目（重点适配超星学习通），调用 OpenAI 兼容 AI 接口解答，在侧边栏展示答案，并支持一键自动把答案写回题目控件。

## 功能

- **读题**：自动扫描页面中的 `.question-item`（学习通手机版随堂练习/测验结构），解析题型、题干、选项、填空数、简答框。
- **AI 解答**：把题目序列化为结构化 prompt，发送给可配置的 OpenAI 兼容 `/chat/completions` 接口，解析返回的 JSON。
- **UI 展示**：右侧悬浮侧边栏展示每道题与 AI 答案，答案可手动修改。
- **自动作答**：一键把答案写回题目 DOM——选择题/判断题模拟点击选项、填空/简答用「原生 value setter + input/change/blur 事件」绕过前端框架受控组件。

## 文件结构

```
local-answer-helper/
├── manifest.json   # MV3 清单
├── background.js   # 后台：调用 AI 接口（绕过页面 CORS）、消息路由
├── content.js      # 内容脚本：读题 / 写答案 / 侧边栏 UI
├── content.css     # 侧边栏样式
├── options.html    # 设置页（配置接口）
├── options.js
└── icons/          # 扩展图标
```

## 安装（Edge / Chrome）

1. 打开 `edge://extensions`（Chrome 为 `chrome://extensions`）。
2. 右上角打开「开发人员模式 / 开发者模式」。
3. 点「加载解压缩的扩展」，选择本项目目录 `local-answer-helper`。
4. 工具栏出现「本地 AI 答题助手」图标即成功。

## 配置

点击扩展图标打开设置页，填入：

| 字段 | 说明 | 示例 |
|---|---|---|
| Base URL | OpenAI 兼容接口根地址 | `https://api.deepseek.com/v1` |
| API Key | 对应服务的密钥 | `sk-...` |
| 模型名 | 模型 id | `deepseek-chat` / `qwen2.5:7b` |
| System Prompt | 约束输出格式，一般不改 | — |

内置快捷预设：DeepSeek、Ollama 本地（`http://127.0.0.1:11434/v1`）、OpenAI、自定义本地 vLLM。

> 说明：本机 DeepSeek Harness（DSH）底层即 DeepSeek 模型，且其本地 Web/API 走私有 `/api/*` 协议（带认证），不是标准 OpenAI 兼容端点；因此默认直接用 DeepSeek API。若你有任何 OpenAI 兼容的本地服务（Ollama/vLLM 等），填其 Base URL 即可，效果等同于「本机 AI 解答」。

## 使用

1. 打开学习通（或任何含 `.question-item` 的答题页）。
2. 页面右侧出现「AI 答题」竖条，点击展开侧边栏。
3. 点「扫描题目并 AI 解答」——自动读题 → 调 AI → 展示答案。
4. 逐题核对/修改答案后，点单题「填入」或「全部填入」。

## 写答案原理

- 选择题 / 判断题：遍历 `.option-list > li`，答案字母命中后对该 `li` 执行 `.click()`。
- 填空题：`.option-fill-list > li > input.ofl-ipt`，用 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v)` 改值并派发 `input/change/blur`。
- 简答题：`.short-answer-textarea > textarea`，同样用原生 setter + 事件。
- 富文本（UEditor）：提供 `fillUEditor()` 钩子（`window.UE.getEditor(name).setContent()`）。

## 支持范围与限制

- 当前读题/写题重点适配**超星学习通手机版随堂练习/测验**（`mobilelearn.chaoxing.com` 的 `.question-item` 结构）。
- 其它平台若使用相同 `.question-item` 结构也可工作；不同 DOM 结构需按需扩展 `parseQuestion` / `fillQuestion`。
- AI 答案仅供参考，实际提交前请自行核对。
