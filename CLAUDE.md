# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Arena is a double-blind LLM evaluation platform for comparing model capabilities across 10 dimensions and 4 difficulty levels. It is a **pure frontend application** — a single `index.html` file with all CSS/JS inline, no build tools, no package manager, no backend.

## Running Locally

```bash
# Open directly in browser
open index.html

# Or serve locally
python3 -m http.server 8080
```

There is no build step, no tests, no linting. Changes are made directly to the source files and refreshed in the browser.

## Architecture

### Single-file app (`index.html`)

The entire UI, state management, and rendering logic lives in one HTML file (~930 lines). It follows a simple pattern:

- **State object `S`** — global mutable state (current view, selected dimension, entries array, blind test queue). Persisted to `localStorage` under key `llm_arena`.
- **Render functions** — `render()` dispatches to view-specific renderers (`renderWelcome`, `renderDim`, `renderEntries`, `renderCompare`, `renderRadar`, `renderPromptView`). Each renderer writes `innerHTML` directly to `#main`.
- **Data constants** — `DIMS` (10 evaluation dimensions), `DIFFS` (4 difficulty tiers), `QS` (all questions with prompts) are defined as top-level JS arrays in the `<script>` block.

### External data modules (loaded via `<script>` tags)

- `data/autoscore.js` — Auto-scoring engine. Contains `REF_ANSWERS` object with reference answers and `rubric()` functions for each objective question. Exposes `autoScore(answer, questionName)` and `hasAutoScore(questionName)`.
- `data/longcontext.js` — Long-context test documents (3000+ words each). Exposes `LONG_DOCS` object keyed by doc ID (`doc_microservices`, `doc_ceo_jan`, `doc_ceo_jun`, `doc_investment`, `doc_python`), and `REF_ANSWERS_LONG` for reference answers.
- `data/scoring-rubrics.md` — Detailed scoring rubrics for use by LLM judges (not loaded by the app, used as reference documentation).

### Key concepts

- **Auto-score vs blind-test**: Dimensions with `autoScore: true` (code_algo, reasoning, knowledge, instruction, long_context) get automatic scoring via keyword/pattern matching. Subjective dimensions (code_frontend, chinese, writing, creative, safety) require human blind testing in a fullscreen overlay.
- **Blind IDs**: Each entry gets an anonymous `#001`-style blind ID. Model names are hidden during scoring and revealed via the "揭盲" (reveal) action.
- **Dual-track scoring**: Entries can have both an auto-score (`score`/`autoDetail`) and an LLM judge score (`llmScore`/`llmDetail`).
- **Long-context questions**: Questions marked in `getLongDocForQuestion()` automatically include the corresponding long document when copying the prompt.

### CSS conventions

All styles are in a `<style>` block using CSS custom properties (`--s0` through `--s4` for surface colors, `--t1` through `--t4` for text, `--ac`/`--gn`/`--am`/`--rd` for accent colors). The design system uses Geist font (Vercel) and RemixIcon for icons.

## Adding a New Question

Add an entry to the `QS` array in `index.html`:

```js
{dim:"dimension_id",diff:"bronze"|"silver"|"gold"|"diamond",name:"题目名",prompt:"题目prompt"}
```

For auto-scored questions, also add a corresponding entry in `REF_ANSWERS` in `data/autoscore.js` with a `rubric(answer)` function.

For long-context questions, add the document to `LONG_DOCS` in `data/longcontext.js` and update `getLongDocForQuestion()` mapping in `index.html`.

## Adding a New Dimension

1. Add to `DIMS` array in `index.html` with `id`, `name`, `icon` (RemixIcon class), `color`, `desc`, `autoScore` flag.
2. Add questions to `QS` array referencing the new dimension ID.
3. If auto-scored, add reference answers to `data/autoscore.js`.
