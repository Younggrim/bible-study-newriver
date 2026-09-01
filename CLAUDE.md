See [WORKFLOW.md](WORKFLOW.md) for how these two repositories relate and what may differ between them. Read it before editing.

Short version: bible-study is the source of truth for all content. bible-study-newriver mirrors it via `sync_from_bible_study.py` and differs only in palette and New River Church sermon videos. Never hardcode a theme color in HTML; use the CSS custom properties. Never edit `bible-study-newriver/docs/*.html` by hand.
