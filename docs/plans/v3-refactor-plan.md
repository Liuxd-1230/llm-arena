# LLM Arena v3 — 实现计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 将 LLM Arena 从单HTML文件重构为多文件架构，全面更新题目系统，应用古希腊+现代简约UI主题。

**Architecture:** 多文件纯JS（ES modules），无bundler，`python3 -m http.server` 运行。

**Phases:**
1. 拆文件（不动UI，确保功能不丢）
2. 题目系统全面更新（40道核心题+12道前端题）
3. 古希腊UI主题（双主题：大理石+磨砂玻璃）
4. 动态评分Profile（4套前端评分标准）

---

## Phase 1: 文件拆分

### Task 1.1: 创建目录结构
```
llm-eval-platform/
├── index.html
├── css/
│   ├── variables.css
│   ├── base.css
│   ├── components.css
│   ├── layout.css
│   ├── views.css
│   ├── blind.css
│   └── themes.css
├── js/
│   ├── app.js
│   ├── state.js
│   ├── utils.js
│   ├── router.js
│   ├── views/
│   │   ├── welcome.js
│   │   ├── dim.js
│   │   ├── compare.js
│   │   ├── radar.js
│   │   ├── entries.js
│   │   └── prompt.js
│   ├── components/
│   │   ├── sidebar.js
│   │   ├── blind.js
│   │   ├── thumb.js
│   │   ├── preview.js
│   │   ├── import-modal.js
│   │   └── toast.js
│   └── data/
│       ├── questions.js
│       ├── autoscore.js
│       └── longcontext.js
└── CLAUDE.md
```

### Task 1.2: 提取CSS到独立文件
- variables.css: CSS变量定义
- base.css: 重置、字体、通用样式
- components.css: 按钮、卡片、输入框、表格
- layout.css: 侧边栏、网格、导航栏、响应式
- views.css: 特定视图样式（对比表、雷达图等）
- blind.css: 盲测+缩略图+预览+评分面板
- themes.css: 浅色/深色主题变量覆盖

### Task 1.3: 提取JS到ES modules
- state.js: S对象 + save/load
- utils.js: escHtml, escSrcdoc, shuffle, copyText等
- router.js: showView, selectDim, render分发
- views/*.js: 每个视图的render函数
- components/*.js: 交互组件（盲测、弹窗等）
- data/*.js: 题目数据、自动评分、长文档

### Task 1.4: index.html 变成壳
- 只保留HTML结构（nav、sidebar容器、main容器、overlay）
- 用 `<script type="module" src="js/app.js">` 加载

---

## Phase 2: 题目系统更新

### Task 2.1: 10维度核心题（40道）
按 用户提供的完整题库方案执行。

### Task 2.2: 前端专项题（12道）
青铜3 + 白银3 + 黄金3 + 钻石3，按用户方案。

### Task 2.3: 自动评分引擎更新
- 更新 REF_ANSWERS 适配新题目
- 更新 rubric 函数

### Task 2.4: 长文本钻石题材料
- 准备5份投资文档（产品/财务/技术/竞品/政策）
- 内置矛盾点

---

## Phase 3: 古希腊UI主题

### Task 3.1: 双主题CSS变量系统
- 浅色：暖白大理石 + 金色浮雕
- 深色：深灰磨砂玻璃 + 冷蓝发光

### Task 3.2: 字体系统
- 标题：Playfair Display（衬线，古典感）
- 正文：Geist（现代无衬线）
- 代码：Geist Mono

### Task 3.3: 装饰元素
- 希腊回纹(meander)边框
- 柱式分隔线
- 浮雕效果（inset shadow）
- 大理石纹理（CSS渐变模拟）

### Task 3.4: 动效系统
- 弹性过渡（spring easing）
- 滚动淡入（IntersectionObserver）
- 主题切换过渡

---

## Phase 4: 动态评分Profile

### Task 4.1: 评分Profile数据结构
```js
const RUBRIC_PROFILES = {
  ui_general: { ... },
  ui_design_system: { ... },
  ui_dashboard_interactive: { ... },
  ui_creative: { ... }
};
```

### Task 4.2: 前端题绑定Profile
每道前端题加 `rubric_profile` 字段。

### Task 4.3: 预览评分面板动态生成
根据 profile 动态生成评分维度和权重。
