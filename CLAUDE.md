# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Arena is a double-blind LLM evaluation platform for comparing model capabilities across 10 dimensions and 4 difficulty levels. It is a **pure frontend application** — a single `index.html` file with all CSS/JS inline, no build tools, no package manager, no backend.

## Commands

```bash
# Open directly in browser
open index.html

# Or serve locally
python3 -m http.server 8080

# Git workflow
git add . && git commit -m "description" && git push
```

There is no build step, no tests, no linting. Changes are made directly to the source files and refreshed in the browser.

## Architecture

### Single-file app (`index.html`)

The entire UI, state management, and rendering logic lives in one HTML file. Key components:

- **State object `S`** — global mutable state persisted to `localStorage` under key `llm_arena`
- **Render functions** — `render()` dispatches to view-specific renderers that write `innerHTML` to `#main`
- **Data constants** — `DIMS` (10 dimensions), `DIFFS` (4 difficulty tiers), `QS` (all questions)

### External data modules (loaded via `<script>` tags)

- `data/autoscore.js` — Auto-scoring engine with `REF_ANSWERS` and `rubric()` functions
- `data/longcontext.js` — Long-context test documents (3000+ words each) with `LONG_DOCS` object
- `data/scoring-rubrics.md` — Detailed scoring rubrics for LLM judges (reference only)

### Key concepts

- **Auto-score vs blind-test**: `autoScore: true` dimensions use keyword matching; subjective dimensions require human blind testing
- **Blind IDs**: Anonymous `#001`-style IDs hide model names until "揭盲" (reveal)
- **Dual-track scoring**: Entries can have both auto-score and LLM judge score
- **Thumbnail blind test**: Frontend questions display as clickable thumbnails with floating scoring panel
- **Long-context questions**: `getLongDocForQuestion()` maps questions to documents that auto-include in prompts
- **Radar chart**: 10-dimension comparison visualization. Models with 2+ dimension scores show filled area; single-dimension scores show as lines only

### CSS conventions

CSS custom properties: `--s0` to `--s4` (surfaces), `--t1` to `--t4` (text), `--ac`/`--gn`/`--am`/`--rd` (accents). Uses Geist font and RemixIcon.

## Adding a New Question

```js
// In QS array (index.html)
{dim:"dimension_id",diff:"bronze"|"silver"|"gold"|"diamond",name:"题目名",prompt:"题目prompt"}

// For auto-scored: add to REF_ANSWERS in data/autoscore.js with rubric(answer) function
// For long-context: add to LONG_DOCS in data/longcontext.js + update getLongDocForQuestion()
```

## Adding a New Dimension

1. Add to `DIMS` array in `index.html` with `id`, `name`, `icon`, `color`, `desc`, `autoScore`
2. Add questions to `QS` array
3. If auto-scored, add reference answers to `data/autoscore.js`
