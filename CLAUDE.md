See [WORKFLOW.md](WORKFLOW.md) for how these two repositories relate. Read it before editing.

Short version: bible-study is the source of truth for all content. bible-study-newriver mirrors it via `sync_from_bible_study.py`.

Since Nov 2026 this is Jeremy's personal copy and it carries bible-study's exact look: same palette, fonts, nav, splash, page titles and app name ("Bible Study"). Where WORKFLOW.md describes a black New River palette, dove logo or "New River Bible Study" branding, that is out of date. What still differs:
- the tighter video allow list and the New River Church sermon overlay (`docs/newriver-videos.json`)
- the app icons and favicon, which are bible-study's icons in black and white so the two home-screen apps can be told apart (`make_bw_icons.py`)
- the domain (bible.nrc.macdwellings.com)

Never edit `bible-study-newriver/docs/*.html` by hand.
