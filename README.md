# 刘问山 — 好问题生成器

刘看山是知乎的北极狐——它看山，看世界。**刘问山是刘看山的提问版本。** 它不问答案，只问问题本身有没有问对。

logo 是北极熊，北极狐的极地远亲——体型更大、气场更强，对应刘问山的使命：把模糊的问题拆解清楚，重拳出击。

> 这个时代不缺答案，缺少好问题。

## 定位

**刘问山不是 AI 回答器，而是 AI 好问题生成器。**

大多数 AI 产品都在帮用户更快得到答案，但在知乎这样的社区里，真正稀缺的不是答案速度，而是问题质量。很多问题不是没有答案，而是问题本身问得不清楚：概念模糊、范围太大、预设立场、二元对立、缺少时间尺度，最终导致讨论低效甚至情绪化。

刘问山不会急着回答你。它会先判断：**这个问题是否问清楚了。**

## 功能

- 输入原始问题，生成完整问题诊断
- 展示模糊点与隐藏前提
- 生成 5 个重构后的知乎问题版本（事实判断型、经验分享型、反常识型、深度讨论型、职业策略型）
- 五项维度评分：清晰度、可回答性、讨论潜力、知乎适配度、认知增量
- 可选"知乎语境增强"，结合知乎搜索与全网搜索注入社区语境
- 直答测试：先看看原问题直接回答会得到什么
- 支持复制单条结果与复制全部
- 无 API Key 或接口失败时自动使用演示数据
- **完整的移动端适配**，手机浏览器也可正常使用

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`

## 构建部署

```bash
npm run build
```

构建产物在 `dist/`。纯静态部署时接口不可用会自动使用演示数据；要真实调用 AI 和知乎接口，需配置环境变量并将 `server/` 部署为同源后端。

生产部署参考 `deploy/` 目录下的 Nginx + PM2 配置。

## 环境变量

复制 `.env.example` 为 `.env`，填写：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro

ZHIHU_API_KEY=
ZHIHU_DATA_BASE_URL=https://developer.zhihu.com
```

可选圈子发布：

```env
ZHIHU_APP_KEY=
ZHIHU_APP_SECRET=
ZHIHU_COMMUNITY_BASE_URL=https://openapi.zhihu.com
ZHIHU_RING_ID=2029619126742656657
```

## 技术栈

- Vue 3 + TypeScript 6
- Vite 8
- Node.js 后端（API 中间件，同源部署）
- DeepSeek API / 知乎开放平台 API

## 项目结构

```
├── src/              前端源码
├── server/           后端 API（wenshanApi + 生产服务器）
├── deploy/           Nginx + PM2 部署配置
├── public/           静态资源
├── dist/             构建产物
└── index.html        入口 HTML
```
