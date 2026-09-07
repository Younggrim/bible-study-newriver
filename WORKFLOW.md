# Workflow: bible-study and bible-study-newriver

This file is identical in both repositories. It is the contract any person or AI
assistant should follow when changing either one. If you are an assistant
picking up work here, read this before editing.

## The invariant

**New River is bible-study with a different palette, a tighter set of video
sources, and its own church's sermons. Nothing else differs.**

Every page, every tab, every study note is the same on both sites. Videos are
the one content difference, and it is deliberate: bible-study allows 13 sources,
New River allows 6. Anything else that differs is drift and should be corrected,
not preserved.

This replaced an earlier and wrong reading. New River once carried 688 videos
against upstream's 3,617, that was diagnosed as drift, and a sync was written to
mirror everything. The filtered set was in fact the intent. The sync now enforces
the filter on every run instead of erasing it.

| | bible-study | bible-study-newriver |
|---|---|---|
| role | source of truth for all content | mirror + New River additions |
| live at | bible.macdwellings.com | bible.nrc.macdwellings.com |
| palette | warm (`--accent-link: #8b3a2a`) | black (`--accent-link: #000000`) |
| New River sermon videos | never | yes, via `docs/newriver-videos.json` |

## What is allowed to differ, exhaustively

**1. Colors.** Never hardcode a theme color in HTML. Both sites resolve their
palette through CSS custom properties in `docs/site/style.css`:

| token | bible-study | New River |
|---|---|---|
| `--accent-link` | `#8b3a2a` | `#000000` |
| `--text-faint` | `#8a7e74` | `#707070` |
| `--rule-warm` | `#e0d6c8` | `#e2e2e2` |
| `--ink-deep` | `#3d2b1f` | `#000000` |
| `--border-light` | `#e8e0d6` | `#e2e2e2` |
| `--text-secondary` | `#3d342e` | `#1a1a1a` |

Write `style="color:var(--accent-link)"`, never `style="color:#8b3a2a"`. This is
what makes the mirror safe. If you reintroduce a hex literal, the sync will warn
and New River will render bible-study's color.

Deliberately still literal, do not tokenize these:

- `#c0392b`, the YouTube play-button red, identical on both sites
- the `theme-color` `<meta>` tag, because a meta tag cannot resolve `var()`
- per-topic and per-translation accent colors, the intentional splashes of color

**2. Allowed video sources.** Defined in `video_sources.py`, which lives in both
repos and is the single source of truth. `sync_from_bible_study.py` imports it
and strips disallowed players on every sync, so the two lists cannot drift.

| source | bible-study | New River |
|---|---|---|
| David Guzik | yes | yes |
| Spoken Gospel | yes | yes |
| 2BeLikeChrist | yes | yes |
| Got Questions Ministries | yes | yes |
| BibleProject | yes | yes |
| The Chosen | yes | yes |
| The Daily Devo | yes | no |
| Mike Winger | yes | no |
| THE BEAT by Allen Parr | yes | no |
| Brandon Robbins | yes | no |
| Impact Video Ministries | yes | no |
| Give Me An Answer (Knechtle) | yes | no |
| Wes Huff | yes | no |

Anything not on a list is removed. If a chapter ends up with no players, its
Videos tab is dropped rather than left as an empty pane.

`ALIASES` in that module exists because three players were captioned
inconsistently for channels that *are* allowed — two Guzik variants and one
Knechtle with an HTML-escaped ampersand. Filtering purely by label would have
deleted them. They are rewritten to the canonical label before filtering.

**No YouTube Shorts, anywhere.** `youtube.com/shorts/<id>` identifies them with
no API key: a genuine Short serves 200, a normal video 303-redirects to
`/watch`. 13 were found across 3,631 videos and removed. `check_new_videos.py`
runs the same test on every new upload and never suggests a Short, while still
recording it as seen so it is tested once and not raised again.

In both the filter and the weekly check, **only a clean 200 counts as a Short**.
Anything ambiguous is treated as a normal video, because wrongly flagging a full
teaching video would hide it from review entirely.

**3. New River sermon videos.** Only in `bible-study-newriver`, only in
`docs/newriver-videos.json`, never inline in HTML. `docs/site/script.js` renders
them at runtime keyed by page filename. These are **not** subject to the allow
list; they are the church's own. That script is identical in both repos,
and the file simply does not exist upstream, so the fetch 404s harmlessly there.

```json
{
  "acts1.html": [
    {"id": "rba41rDsEUg", "title": "Acts 1:1-11 | Ryan Brannan", "source": "New River Church"}
  ]
}
```

The overlay only renders on pages that have a `#tab-videos` element.

**3. Per-site files.** These 12 belong to New River and the sync never
overwrites them:

```
CNAME                 favicon.ico           manifest.json
newriver-videos.json  site/style.css        site/script.js
site/dove-black.png   site/dove-white.png
site/favicon-16.png   site/favicon-32.png
site/icon-192.png     site/icon-512.png
```

**4. Five branding rules** the sync re-applies to mirrored HTML, because they
cannot be expressed in CSS: page `<title>` suffix, `theme-color` meta, favicon
`<link>` tags, the Cinzel font in the Google Fonts URL, and the nav brand with
the dove logo.

## Changing content

All content changes go to **bible-study** first. Then mirror.

```bash
# 1. edit in bible-study
cd bible-study
$EDITOR docs/genesis1.html

# 1a. only if you touched a Map & Geography pane, so its map matches the prose
python3 build_mapgeo.py && python3 add_mapgeo_maps.py

git add docs/ && git commit

# 2. mirror into New River
cd ../bible-study-newriver
python3 sync_from_bible_study.py ../bible-study        # or --check first
git add docs/ .sync-state.json && git commit
```

`sync_from_bible_study.py --check` reports what would change and writes nothing.
The sync rebuilds `docs/` from upstream every run, so it is idempotent: running
it twice produces byte-identical trees.

**Never edit `bible-study-newriver/docs/*.html` directly.** The next sync
discards it. The only New River files you edit by hand are the 12 preserved
ones listed above.

## Adding videos

**General videos** (any of the 13 allowed sources) go in the chapter HTML in
**bible-study**, then reach New River through a sync. They appear on both sites.

**New River Church videos** go only in
`bible-study-newriver/docs/newriver-videos.json`. Never inline, never upstream.

This distinction was previously broken: 124 New River Church videos were baked
inline into New River's HTML, which the sync would have destroyed. They have
been recovered into the overlay. Keep them there.

### Use add_video.py rather than hand-editing

```bash
python3 add_video.py daniel5.html <video-id>
python3 add_video.py spiritual-disciplines.html <video-id> --section Worship
python3 add_video.py suffering.html <video-id> --check      # preview only
```

It takes the title and channel name from oEmbed instead of having them typed
in, which is what keeps captions accurate and prevents a repeat of the U+FFFD
corruption. It refuses to add a video YouTube reports as deleted or private, is
a no-op if the video is already on the page, and aborts if the edit would
unbalance the page's `<div>` tags.

It handles all three container shapes the site uses:

| shape | container | pages |
|---|---|---|
| chapter | `<div class="tab-content" id="tab-videos">` | the 1189 chapter pages |
| life study | `<div class="section-block"><h2>Video Resources</h2>` | temptation, suffering, addiction, identity-and-self-worth, and similar |
| disciplines | `<h3>Videos</h3><div class="video-grid">` | spiritual-disciplines.html, which has eight, so `--section` is required |

Run it in **bible-study**, then sync. Running it against New River works but the
next sync discards the result.

### Standing rule: the 2BeLikeChrist Daniel series

2BeLikeChrist has a per-chapter series on the site under the older title pattern
`<Book> <Chapter> Explained: 5 Minute Bible Study`, 454 videos, but **no Daniel
chapter had one**. They are now publishing Daniel under a new pattern,
`Daniel <N> - Bible Study, Explanation, and Application`, and chapters 2, 3 and
4 have been added.

As Daniel 5 through 12 appear in the weekly issue, add each to its chapter page
without waiting to be asked. Same for a Daniel 1 video if one shows up. This is
a pre-approved series; anything else from any channel still needs a human to
approve it.

## Adding articles

The **Articles** tab is the seventh tab on every chapter page, and an Articles
section block at the foot of every topical and life page. It carries outbound
links only. **Nothing is copied from any source** — each entry is a link plus a
description written in `article_sources.py`, exactly the rule the Commentary tab
has always followed.

### The four sources

| source | what it gives | how it is polled |
|---|---|---|
| gotquestions.org | The backbone. A stable per-book overview URL for all 66 books, plus the `Bible-<topic>` and `Bible-verses-about-<topic>` series | `sitemap.xml`, 10,887 English URLs, lastmod on every one |
| bibleproject.com | 76 articles, unusually often anchored to a specific chapter or passage | `en/sitemap.xml`, no lastmod, so tracked as a URL set |
| crossway.org | Freshest week to week. Publishes the ESV this site already carries | `/articles/rss/` plus 51 topic feeds, 15 items each |
| gotquestions.blog | First-person pastoral voice. **Life pages only** | `sitemap.xml`, 157 URLs |

Two things to know about those sources before changing anything.

**Crossway has no article sitemap.** Its `sitemap.xml` is 11,588 URLs of books,
authors, bibles and tracts with zero articles in it, and `?page=N` on the archive
is ignored. The per-tag feeds at `/articles/tag/<slug>/rss/` are the only way to
see more than the latest 15, which is why 52 feeds get polled. `/search/` is
`Disallow` in their robots.txt and is not touched.

**bibleproject.com answers a request with no User-Agent with HTTP 202 and an
empty body.** `automation_http.py` always sends one, so this is handled — but a
hand-rolled `curl` against it will silently return nothing.

The **gotquestions.blog** is deliberately limited to life pages and to the small
subset of its posts that are pastoral rather than cultural or denominational
commentary. It is also largely dormant: 7 pages touched in 2025 against 72 dated
2019. It contributes little and that is expected.

### Derived versus curated, and why it matters

**Derived** is the per-book gotquestions.org overview. It comes from the
`GQ_BOOK_PAGE` table, one entry per book, not from any search. That table is what
guarantees every one of the 1189 chapter pages has at least one real link, and it
does not depend on the weekly job running at all. 61 books use
`Book-of-<Name>.html`, the four Gospels use `Gospel-of-<Name>.html`, and Song of
Solomon has no prefix.

**Curated** is everything else: `CHAPTER_ARTICLES` keyed by `(book, chapter)`,
`BOOK_ARTICLES` keyed by book, and `TOPIC_ARTICLES` keyed by page filename. Every
one was checked by hand and returned 200 when it was added.

**Do not try to place articles by matching book names in titles.** It was
measured and it is unusable. One week of Crossway feeds produced "John Piper on
Gambling", "Podcast: John Owen's Advice for Killing Your Sin", "3 Marks of True
Repentance", "Podcast: Answering Tough Questions About the Holy Spirit (Joel
Beeke)" and "11 Passages to Read When You Lose Your Job" — every one of which a
book-name matcher scores as a hit. gotquestions.org adds "David Hume", "David
Livingstone", "Saul of Tarsus" and "Ahab-spirit". Author names collide with two
thirds of the New Testament. The only reliable signal is a chapter number
adjacent to the book name.

### Accepting or rejecting an article

Both are edits to `article_sources.py`, then one command.

```bash
# accept: add to CHAPTER_ARTICLES, BOOK_ARTICLES or TOPIC_ARTICLES
# reject: add to DROP_ARTICLE_URLS with the reason
python3 add_articles.py --check     # report, write nothing
python3 add_articles.py             # write
```

`DROP_ARTICLE_URLS` exists for the same reason `DROP_VIDEO_IDS` does. Deleting a
link from the HTML is not enough on its own: the source stays in the allow list,
so the next weekly poll suggests it again. Record the reason, because "why was
this left out" is the question anyone will have later.

`add_articles.py` handles both page shapes and is safe to re-run. It writes
between `<!-- articles -->` and `<!-- /articles -->` fences, so a second run
reproduces the same bytes. It refuses to write any page whose `<div>` count would
go unbalanced, and exits non-zero if any page had a problem. To undo a bad run:
`git checkout -- docs/`.

```bash
python3 add_articles.py --chapters-only   # the 1189 chapter pages
python3 add_articles.py --topics-only     # the 34 topical and life pages
```

### Two decisions worth not undoing

**The tab is anchored on Reflection, not Videos.** `add_commentaries.py` anchors
against the Videos tab, but `strip_empty_videos_tab()` deletes that tab when a
chapter has no players left — New River is already down to 1188 Videos tabs
against 1189 everywhere else. Reflection is on all 1189 and nothing removes it.
Anchoring there also produces the ordering we want, with Reflection last.

**Topical and life pages get a section block, not a tab.** Those 34 pages have no
tab strip at all; they are a stack of section blocks all visible at once. Making
them tabbed would mean redesigning 34 hand-written files, and it would put
`site/style.css` and `site/script.js` in play — the two files the sync preserves
rather than mirrors, so any change to them has to be made by hand in both repos.
The chapter tab as built needs **no CSS and no JavaScript change at all**:
`switchTab()` works off the `data-tab` / `id="tab-X"` pairing and nothing else,
and `.study-tabs` is a wrapping flexbox, so a seventh tab reflows on its own.

### Where the article tooling lives

| file | bible-study | New River | why |
|---|---|---|---|
| `article_sources.py` | yes | no | all four sources are acceptable on both sites, so unlike `video_sources.py` there is no second allow list and nothing for the sync to filter |
| `add_articles.py` | yes | no | articles are added upstream, then synced |
| `check_new_articles.py` | yes | no | there is no New River specific article source |

If a deployment ever needs a narrower set of sources, split `article_sources.py`
the way `video_sources.py` is split and filter on sync. **Do not** hand-edit
`bible-study-newriver/docs/*.html`; the next sync discards it.

## Automation

**GitHub Actions detects. A person or assistant decides.** That split is
deliberate. Fetching feeds, probing 3617 videos, and updating state is
mechanical and belongs on a runner that works whether anyone's laptop is on.
Deciding whether a new video belongs on Ephesians 4 needs context and judgment,
so the workflows only ever open an issue. **Nothing automated edits `docs/`.**

`.github/workflows/weekly-video-audit.yml` is identical in both repos and runs
Mondays at 13:00 UTC, plus on demand via workflow_dispatch. It has two
independent jobs.

**Job `new-uploads`** runs `check_new_videos.py`, which reads every state file
in `.automation/` and reports uploads not seen before. Which channels get
watched is decided entirely by those files, so one script serves both repos:

- `bible-study` watches **13 general channels**: DavidGuzikEnduringWord,
  SpokenGospel, 2BeLikeChrist, GotQuestions, TheDailyDevo, BibleProject,
  MikeWinger, TheBeatAllenParr, BrandonRobbinsMinistry, ImpactVideoMinistries,
  TheChosen, GiveMeAnAnswer, WesHuff. Approved videos go into the chapter HTML
  here and reach New River through a sync, subject to New River's tighter allow
  list.

  Four channels were dropped from polling: CrazyLoveMinistries,
  GraceFamilyBaptistChurch, LakepointeChurch and QCSocials. Their videos were
  removed from both sites and they are no longer suggested.
- `bible-study-newriver` watches **New River Church only**. Approved videos go
  into `docs/newriver-videos.json` and never go upstream.

**Job `dead-links`** runs `check_video_links.py`, which asks YouTube whether
each referenced video still plays using the oEmbed endpoint. No API key, no
quota:

| response | meaning |
|---|---|
| 200 | plays |
| 404 | deleted or never existed |
| 401 | private, or embedding disabled, so it will not play in the site's embed |

It scans `docs/*.html` for inline players and `docs/newriver-videos.json` when
present, so it covers the sermon overlay too.

**Only a definitive 404 or 401 is reported as broken.** Rate limits and
timeouts are retried and then listed separately as inconclusive. That asymmetry
matters: a false positive here would get a working video deleted from the site.

### The weekly article audit

`.github/workflows/weekly-article-audit.yml` runs Mondays at 14:00 UTC, an hour
after the video audit, plus on demand. It exists **only in bible-study**. It is a
separate file rather than a third job in the video workflow for two reasons: that
file is byte-identical in both repos and New River has no article scripts, so
adding a job would make the copies diverge; and this way the two audits are
independently dispatchable.

Its one job runs `check_new_articles.py`, which polls **55 feeds** — one sitemap
each for bibleproject.com, gotquestions.org and gotquestions.blog, plus Crossway's
main feed and 51 topic feeds. It opens an issue, commits only
`.automation/articles/`, and never edits `docs/`.

Three behaviours worth knowing:

- **A single feed failing is reported and skipped.** Only a source losing *every*
  one of its feeds leaves that source's state untouched, so a total outage can
  never mark a whole catalogue as seen.
- **Anything filtered out is still recorded as seen**, including URLs already
  linked from the site and anything in `DROP_ARTICLE_URLS`. Without that, an
  article deliberately left off the site would come back in next week's issue.
- **The report is written before the state is saved.** The other order means a
  failure in between marks articles as seen while nobody ever hears about them,
  with no way to recover the list. This order risks a duplicate report instead,
  which is noise rather than loss.

State lives in `.automation/articles/article_feed_state.json`, in a subdirectory
on purpose: `check_new_videos.py` globs `.automation/*.json` and expects every one
to describe YouTube channels, so a sibling file there would make it warn every
week. A subdirectory is invisible to that glob.

It was **seeded once**, at 920 gotquestions.org URLs, 544 Crossway, 136 blog and
76 BibleProject, so the first scheduled run reports only genuinely new material.
That is the opposite of the choice made for videos, and deliberately so. With
videos there was a short list of undecided items worth surfacing. With articles
the entire back catalogue was unreviewed, and a 1,444-item issue helps nobody —
the curated tables in `article_sources.py` *are* the deliberate first pass through
that catalogue. To re-seed after adding a source:

```bash
python3 check_new_articles.py --seed
```

### Approving new articles by number, from the issue itself

The article audit's issue is not just a report. After `check_new_articles.py`
finds new material, `suggest_placements.py` reads every title (Claude Haiku
4.5, its own `ANTHROPIC_API_KEY` repo secret, never the session bible-study is
otherwise edited from) and drafts one placement suggestion per item — a
chapter page, a topic page, or `none` when the title alone doesn't support a
confident guess. The issue is numbered and carries the `pending-placement`
label. Reply on it with `approve: 1, 3` (also accepted: `approve all`,
`approve none`, or a bare `1, 3, 5`) and `apply-approved-placements.yml`
writes the approved items and pushes straight to `main` — no PR, matching how
the checkpoint-state commits already work. Only a reply from the repo owner is
ever acted on; anything else is inert.

The model is instructed the same way article_sources.py's own docstring
warns a person: prefer `none` over a guess an author name or incidental word
happens to support (`John Piper on Gambling` is not the Gospel of John), and
never invent a chapter number a title doesn't name. A wrong guess a person
rubber-stamps is worse than no guess, so `none` is a correct, expected answer
for many items, not a failure of the suggestion step.

Approved entries land in `AUTO_CHAPTER_ARTICLES` / `AUTO_TOPIC_ARTICLES`, a
small fenced block at the end of `article_sources.py` that
`apply_approved.py` owns and rewrites whole — never hand-edit inside those
fences, an approval after yours would clobber it. Move an entry up into the
hand-curated tables above whenever convenient; nothing breaks either way,
since the merge into `CHAPTER_ARTICLES` / `TOPIC_ARTICLES` runs at import
time either way. `add_articles.py` then regenerates the affected pages exactly
as it would for a hand-added entry.

**Scoped to articles only, for now.** Video placement stays a manual step
from the plain `weekly-video-audit.yml` issue, unchanged. That file is
byte-identical in both repos, and New River's own channel writes to
`docs/newriver-videos.json` rather than a chapter page — an auto-push there
would first need to know which repo it is running in, which nothing here
solves yet.

If `ANTHROPIC_API_KEY` is unset, or the suggestion call fails for any reason,
`suggest_placements.py` leaves the issue exactly as `check_new_articles.py`
wrote it — no numbering, no suggestions, no `pending-placement` label — so a
suggestion outage never blocks the week's report from being filed. It just
falls back to the fully manual flow described above.

### Running the checks by hand

```bash
python3 check_new_videos.py --check      # report, write nothing
python3 check_video_links.py --limit 40  # quick smoke test
python3 check_video_links.py --titles    # also flag titles renamed on YouTube
python3 check_new_articles.py --check    # poll all 55 article feeds, write nothing
```

`automation_http.py` is shared by all three scripts. It uses urllib normally, and
falls back to curl the moment urllib hits an SSL error. That exists for one
concrete reason: behind a TLS-inspecting corporate proxy whose CA has no
Authority Key Identifier, Python's OpenSSL refuses the connection outright
while curl is fine. Without the fallback these scripts cannot be run by hand
from such a machine at all.

Both transports decode as UTF-8 with replacement. The curl path previously used
`subprocess.run(text=True)` with no encoding, which decodes with the locale's
encoding — under a C locale that is ASCII, and every feed these scripts read
carries curly quotes and en-dashes in its titles, so a run in a C locale failed on
the first one while the urllib path handled the same body fine. Keep both
transports explicit about encoding; the module docstring promises they behave the
same way.

### One-time repair scripts

`fix_video_titles.py` repairs video captions corrupted by a bad encoding
round-trip, where an en-dash became U+FFFD. It takes the correct title from
oEmbed rather than guessing, and leaves any video it cannot resolve untouched.
It fixed 173 captions across 132 pages. Run it in **bible-study**, then sync.
Keep it around; the same corruption can recur if titles are ever pasted through
a non-UTF-8 tool.

## Map & Geography: the maps

Every Map & Geography pane that names a place we can locate opens with a small
map of that chapter's geography, and closes with a short write-up of each place:
where it is now, and the two or three sentences of context that make the verse
land. 831 of the 842 panes have one.

This replaced a bare Wikipedia link on each place name. The link answered
"where is Nineveh" by sending the reader to another site; the map answers it on
the page, with Nineveh on the Tigris opposite modern Mosul, 500 miles from
Israel, which is the fact Jonah 1 is leaning on. The Wikipedia article is still
one click away from each write-up, as a source rather than as the answer.

### Where it lives

| file | what it is |
|---|---|
| `mapgeo_places.py` | the gazetteer: 182 places, coordinates, kind, write-ups |
| `mapgeo_basemap.py` | clips and encodes Natural Earth coastlines, lakes, rivers |
| `mapgeo.template.js` | the renderer |
| `mapgeo.css` | the styling, compiled into the renderer |
| `build_mapgeo.py` | assembles the three into `docs/site/mapgeo.js` |
| `add_mapgeo_maps.py` | writes the map div and the write-ups into the panes |

`docs/site/mapgeo.js` is about 100 KB, 57 KB over the wire, and is the only
asset the maps need. It is precached by `sw.js`, so the maps work offline.

### Rebuilding, in this order

```bash
cd bible-study
python3 mapgeo_places.py       # validates the gazetteer, prints counts
python3 build_mapgeo.py        # writes docs/site/mapgeo.js
python3 add_mapgeo_maps.py     # writes the panes and stamps that file's hash
```

Both scripts are idempotent: a second run reports 0 files changed. Run
`build_mapgeo.py` first, because `add_mapgeo_maps.py` stamps
`?v=<hash of mapgeo.js>` onto the script tag and would otherwise stamp a stale
one. Then sync New River as usual.

### Why self-hosted vector data rather than a tile service

Tiles would mean an API key, somebody's usage policy, and a blank grey box the
moment a reader opens the site offline through the service worker. Natural Earth
is public domain, so 60,000 coordinates of coastline, lake and river live in the
repo instead, quantised to 1/500 of a degree and delta encoded. Modern coastlines
on a biblical map are a compromise worth naming: the Dead Sea in particular has
shrunk and split since antiquity, and the map shows it as it is now.

### Two things that will bite

**Only `mapgeo.js` may hold the coordinates.** The write-ups are baked into each
page's HTML on purpose, so a reader with no JavaScript loses the picture and
keeps all of the content. Do not move them into the asset to save bytes.

**Read a pane through `mapgeo_places.pane_source()`, never raw.** The write-ups
are full of place names and each carries a Wikipedia link, so anything that
scans a finished pane for places will find some the chapter never mentioned and
grow the list a little on every run. `find_places()` strips them for you; this is
only a trap if you write a new scanner.

### Adding a place

Add it to `PLACES` in `mapgeo_places.py` with coordinates, a `kind`, the modern
location and a note, then rebuild. `aka` holds the other spellings the panes use,
matched longest-first so "Sea of Galilee" beats "Galilee". Two things to watch:

- A demonym usually means the people or the empire, not the place. "Roman" was
  putting a pin on Italy in chapters set in Galilee, and "Greek" almost always
  means the language. `NEVER_MATCH` is the escape hatch.
- Say so in the note when a site is disputed rather than letting the pin imply
  precision. Sodom, Emmaus, Ai, Gilgal, Derbe and Tarshish are the existing
  cases.

## Verifying the invariant

Run these after any change to confirm the two repos differ only where allowed.

**Run them from the folder that contains both clones, not from inside a repo.** The
paths below are relative, `bible-study/docs` and `bible-study-newriver/docs`, so
running them from a repo root fails on a missing directory rather than reporting
anything useful. This file lives inside `bible-study`, which makes that the easy
mistake to make.

```bash
# Every diff hunk against upstream should be explained by a branding rule or by the
# video allow list.
#
# Expect: 1 unexplained, matthew28.html, and nothing else. Read the next paragraph
# before treating that 1 as a fault.
#
# 'yt-facade' and 'loadYT' are in the list because New River allows fewer video
# sources than upstream, so the sync drops players this repo may not show. Without
# those two keys the check reports 267 unexplained hunks that are all dropped
# players, which is the filter working, not a fault. That is what it reported for a
# long time while this file claimed 0.
python3 - <<'PY'
import os, difflib
bs, nr = "bible-study/docs", "bible-study-newriver/docs"
BRAND = ('New River Bible Study','theme-color','favicon','Cinzel',
         'dove-white.png','nav-brand','style.css?v=','script.js?v=',
         'yt-facade','loadYT')
bad = 0
for n in sorted(f for f in os.listdir(bs) if f.endswith('.html')):
    a = open(f"{bs}/{n}", encoding='utf-8').read().replace('><','>\n<').splitlines()
    b = open(f"{nr}/{n}", encoding='utf-8').read().replace('><','>\n<').splitlines()
    for tag,i1,i2,j1,j2 in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        if not any(k in "\n".join(a[i1:i2]+b[j1:j2]) for k in BRAND):
            bad += 1
            print("UNEXPLAINED:", n)
print("unexplained hunks:", bad)
PY
```

The one remaining hunk is `matthew28.html`, and it is a second-order effect of the
same filter. All three of that chapter's players come from sources New River does not
allow, so the pane emptied and the sync removed the **tab and pane as well** — the
`1 empty Videos tabs tidied` line in the sync report. It is the only page in either
repo where that has happened. Compare the two numbers rather than expecting a
constant: unexplained hunks should equal the sync's tidied-tab count, and any page
named here that is *not* in that count is a real fault worth chasing.

Allowing video hunks through the check above means it can no longer catch a player
going missing by accident, so pair it with this. The allow list can only ever make
New River show **fewer** players than upstream, never more and never a different set,
so a player present here and absent upstream is a real fault.

```bash
# The video divergence must run one way only.
# Expect: dropped matches the sync report's "players removed", extra 0.
python3 - <<'PY'
import os, re
bs, nr = "bible-study/docs", "bible-study-newriver/docs"
ID = re.compile(r"loadYT\(this,'([\w-]{6,})'\)")
dropped, extra = 0, {}
for n in sorted(f for f in os.listdir(bs) if f.endswith('.html')):
    A = set(ID.findall(open(f"{bs}/{n}", encoding='utf-8').read()))
    B = set(ID.findall(open(f"{nr}/{n}", encoding='utf-8').read()))
    dropped += len(A - B)
    if B - A:
        extra[n] = sorted(B - A)
print("players upstream has that New River drops:", dropped)
print("pages where New River has EXTRA players:", len(extra))
for n, v in extra.items():
    print("  EXTRA:", n, v)
PY
```

```bash
# No upstream palette literal should survive in New River's HTML. Expect 0 each.
cd bible-study-newriver/docs
for h in 8b3a2a 8a7e74 e0d6c8 e8e0d6 3d342e; do
  printf "#%s %s\n" "$h" "$(grep -oh "#$h" *.html | wc -l)"
done

# Every var() reference must be defined, or it silently inherits. Expect none.
cd ../..
python3 - <<'PY'
import os, re
for repo in ("bible-study", "bible-study-newriver"):
    css = open(f"{repo}/docs/site/style.css", encoding='utf-8').read()
    defined = set(re.findall(r'(--[a-z0-9-]+)\s*:', css))
    used = set()
    for n in os.listdir(f"{repo}/docs"):
        if n.endswith('.html'):
            used |= set(re.findall(r'var\(\s*(--[a-z0-9-]+)',
                                   open(f"{repo}/docs/{n}", encoding='utf-8').read()))
    print(repo, "undefined:", sorted(used - defined) or "none")
PY
```

```bash
# The sync must be idempotent. The two hashes must match.
cd bible-study-newriver
python3 sync_from_bible_study.py ../bible-study >/dev/null
find docs -type f | sort | xargs shasum | shasum
python3 sync_from_bible_study.py ../bible-study >/dev/null
find docs -type f | sort | xargs shasum | shasum
```

Tab coverage, in the order the tabs appear on the page. Current expected values:

| tab | bible-study | New River |
|---|---|---|
| summary | 1189 | 1189 |
| authorship | 1189 | 1189 |
| mapgeo | 842 | 842 |
| commentary | 1189 | 1189 |
| videos | 1189 | **1188** |
| articles | 1189 | 1189 |
| reflection | 1189 | 1189 |

Two entries in that table need explaining.

**Commentary was documented as 972 for a while.** That was the count before
`add_commentaries.py` filled in the 217 chapters that had no Commentary tab at all
— the Psalms and the twelve Minor Prophets. 972 + 217 = 1189. The old figure was
stale, not a regression.

**New River is legitimately one Videos tab short.** `strip_empty_videos_tab()`
removes the tab on any chapter left with no players after New River's tighter
allow list is applied. This is exactly why the Articles tab anchors on Reflection
instead: Videos is not guaranteed to exist.

```bash
# No caption should contain the Unicode replacement character. Expect 0.
grep -l $'\ufffd' docs/*.html | wc -l
```

```bash
# Articles: structure is sound and identical in both repos.
# Expect 1223 pages, and 0 for every problem count.
cd ..
python3 - <<'PY'
import os, re
for repo in ("bible-study", "bible-study-newriver"):
    d = f"{repo}/docs"
    n_div = n_pair = n_fence = pages = 0
    for n in sorted(os.listdir(d)):
        if not n.endswith('.html'):
            continue
        t = open(f"{d}/{n}", encoding='utf-8').read()
        if '<!-- articles -->' not in t:
            continue
        pages += 1
        if len(re.findall(r'<div\b', t)) != len(re.findall(r'</div>', t)):
            n_div += 1
        if set(re.findall(r'data-tab="([a-z]+)"', t)) != \
           set(re.findall(r'id="tab-([a-z]+)"', t)):
            n_pair += 1
        if t.count('<!-- articles -->') != 1 or t.count('<!-- /articles -->') != 1:
            n_fence += 1
    print(f"{repo}: pages={pages} div={n_div} tab/pane={n_pair} fence={n_fence}")
PY
```

```bash
# Articles: every URL the site links to still resolves. Expect 0 non-200.
cd bible-study
python3 - <<'PY'
import concurrent.futures as cf, subprocess, sys
sys.path.insert(0, '.')
import article_sources as a
UA = "Mozilla/5.0 (compatible; bible-study-automation)"
def probe(u):
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-L", "--max-time", "30",
                        "-A", UA, "-w", "%{http_code}", u],
                       capture_output=True, text=True)
    return u, r.stdout.strip()
urls = a.all_urls()
bad = []
with cf.ThreadPoolExecutor(max_workers=8) as ex:
    for u, code in ex.map(probe, urls):
        if code != "200":
            bad.append((code, u))
print(f"probed {len(urls)} article urls, non-200: {len(bad)}")
for c, u in bad:
    print("  ", c, u)
PY
```

```bash
# add_articles.py must be a no-op on a clean tree. Expect "changed 0" twice.
python3 add_articles.py --check
```

```bash
# Maps: both rebuilds are no-ops, and every pin the prose promises exists.
# Expect "0 files changed" and no PROBLEM lines from either.
cd bible-study
python3 build_mapgeo.py --check
python3 add_mapgeo_maps.py --check
```

```bash
# Every place a pane pins must still be in the shipped asset, or the map draws
# fewer pins than the write-ups list. Expect 0 missing.
cd bible-study
python3 - <<'PY'
import json, os, re
js = open("docs/site/mapgeo.js", encoding='utf-8').read()
have = set(json.loads(re.search(r'var PLACES = (\{.*?\});', js).group(1)))
missing = set()
for n in sorted(os.listdir("docs")):
    if not n.endswith(".html"):
        continue
    for m in re.finditer(r'<div class="geo-map" data-places="([^"]*)"',
                         open(f"docs/{n}", encoding='utf-8').read()):
        missing |= {k for k in m.group(1).split(",") if k and k not in have}
print("pinned but not shipped:", sorted(missing) or "none")
PY
```

The renderer itself is checked by driving all 831 real place lists through it in
a browser, which is worth doing after any change to `mapgeo.template.js`. Serve
`docs/` and load a page that appends one `.geo-map` per list, calls
`MapGeo.refresh()` once, then reports any pin drawn outside the frame, any label
whose `getBBox()` leaves it, and anything on `window.onerror`. The last run:
831 rendered, 2262 pins after clustering, 0 off-frame, 0 overflowing, 0 errors.

### Baseline as of the last full audit

- 3617 unique videos referenced, **all 3617 playable**, 0 deleted, 0 private
- 0 captions containing U+FFFD
- 1 unexplained diff hunk between the repos, `matthew28.html`, whose Videos tab New
  River drops because the allow list empties that pane. This entry read 0 for a long
  time and was wrong twice over: the check lacked `yt-facade` and `loadYT` in its
  `BRAND` list, so it was really reporting 267, all dropped players. See the note on
  that check above
- 358 players dropped by New River's allow list, 0 pages carrying a player upstream
  does not have, 1 empty Videos tab tidied
- New River sermon overlay: 127 videos across 60 chapters
- Maps on 831 of the 842 Map & Geography panes, 2811 pins from 162 places
- Authorship & Background: **1189 of 1189 clean, 66 of 66 books, 0 defects**, and
  0 panes carrying an `auth-sublist`, 0 sections ending on a colon, 0 duplicate
  labels, 0 verse gaps, 0 sections out of order
- All 1228 HTML files balance `<div>` against `</div>`. Inside the authorship pane
  the correct delta is exactly **+1**, one unmatched closer, because the captured
  region includes the pane's own closing tag; all 1189 sit at +1
- The 21 Psalms fold scripts plus both repair scripts are idempotent: re-running the
  whole set leaves `docs/` hash-identical and the git tree clean
- Tab coverage is in the table under "Verifying the invariant" rather than repeated
  here, because two copies of a number is how the rest of this file went stale

A full audit takes about a minute.

Two figures in this file are known to drift as work lands, and both have been wrong
before. The authorship status and the deferred `Key Themes:` count are both derived
from how much has been folded, so **re-measure rather than quoting them**; each has a
snippet beside it for that purpose.

## Authorship & Background: the target format

Every chapter's Authorship & Background pane must end up in this shape. Jonah 1-4
is the reference implementation; read `jonah1.html` beside `ruth1.html` before
starting a new book.

**Status: 1189 of 1189 chapters done. 0 remaining, all 66 books complete.**
Psalms was the last book, folded in one pass from 21 scripts, and `leviticus27` was
the last pane outside it still carrying a sublist. `python3 audit_authorship.py`
reports `CLEAN 1189 of 1189`, and `--defects` reports 0 pages not clean.
The format is finished. What remains is the two cleanups recorded further down,
the `Author:` / `Key themes` audit and the emphatic capitals, plus whatever a fresh
reading turns up. Neither is a folding job.

### Field order, exactly

```
Author:              book level. Identical on every chapter of a book.
Classification:      genre only, one line. "Prophetic Narrative", "Wisdom
                     Poetry", "Historical Narrative", "Epistle".
Key Themes:          its own field. Never appended to Classification.
Historical Context:  chapter level. What this chapter is doing and the
                     historical or cultural background needed to read it.
<verse-range sections>   one per movement of the chapter, in verse order.
```

Only `Historical Context:` and the verse-range sections carry chapter-specific
content. `Author:` is book level and repeats. Everything else is structural and
must match across all 1189 chapters.

### Markup, exactly

```html
                    <div class="auth-item"><span class="auth-label">Classification:</span> Prophetic Narrative</div>
```

One `auth-item` div per field. The label goes in `auth-label`, the body follows
the closing `</span>` after a single space. No `<ul>`, no `auth-sublist`, no
bulleted `Structure:` outline — those are what the fold replaces.

### Verse-range sections

The heading names the movement and its verses, then a colon:

```
The Call: Go to Nineveh (vv.1-2):
Deliverance: Thou Hast Brought Up My Life (v.6b):
```

Each body is one paragraph of continuous prose, roughly 500-900 characters.
Not a summary of what happens — the reader has the text on the same page. It
should carry what the reader would otherwise miss: historical or cultural
background, the force of a Hebrew or Greek word, a cross-reference that explains
the passage, a structural pattern in the chapter, or an honest note where the
text is ambiguous.

Where a chapter already has a bulleted `Structure:` outline, **use it as the
skeleton**. It already names each movement and its verse range; carry the
headings over unchanged and replace the bullets with exposition. That is how
Jonah was done.

### Counting what is done: the label must END with the range

A section heading looks like `Seventy Weeks (vv.24-27):` — the range is the last
thing before the colon. Do **not** count a pane as folded merely because some label
contains a range. Three pages were miscounted for exactly that reason, because they
carried a sentence fragment as a label:

```
Daniel's prayer (vv.4-19) is entirely about GOD:
The boiling pot parable (vv.3-14) echoes Ezekiel 11:
The comparison to Sodom (v.6) is devastating:
```

The loose test reported 647 done and 48 complete books. The strict test reported 644
and 47 — Lamentations was being called complete while `lamentations4` had never been
folded. Use this:

```python
TAIL = re.compile(r'\(vv?\.[\d]+[a-z]?(?:[-,:\s]+[\d]+[a-z]?)*\)\s*:\s*$')
done = any(TAIL.search(l if l.endswith(':') else l + ':') for l in labels)
```

Two related traps, both real: the `Mark 13:` / `This passage (4:` class, where a
label was cut at the colon of a verse reference, and the Luke 5/6/10 class, where
substantive topical labels cover only part of a chapter. **Always measure coverage
against the actual verse count.** Luke 1 was carrying four verses of eighty.

### Deferred: the Author / Key themes audit

Not to be done piecemeal. `Author:` currently has three shapes across the 1189 pages:

| shape | pages |
|---|---|
| pointer, e.g. `Paul (see Chapter 1 notes...)` | 498 |
| full paragraph ending `Key themes: ...` | 386 |
| full paragraph, no themes | 305 |

The 386 embedded theme strings are **book-level** and there are only **13 distinct
ones** — one is repeated 150 times, on every Psalm. A separate `Key Themes:` field
is chapter-level, and **204** pages already carry both scopes.

Agreed plan, now that the folding is finished: `Author:` holds authorship only,
everywhere; chapter-level `Key Themes:` on every page. That gives one uniform shape —
Author, Classification, Key Themes, Historical Context, sections. Two pieces of work,
in this order so no page is ever left without themes:

1. write chapter-level `Key Themes:` for the **661** pages that have only the
   embedded book-level ones
2. strip `Key themes:` and everything after it from `Author:` on the 386

**Step 1 is five times the size this document used to claim, and that is the most
important thing to know before starting it.** The figure read 122 for a long time.
122 was correct when written, at 559 folded pages, and it grew with every book folded
afterwards, because a page only entered the count once it was folded. Measured against
all 1189 it is **661**. Only 528 pages carry a chapter-level `Key Themes:` at all.

Re-measure before planning the work rather than trusting the number above, which is
the mistake this paragraph exists to prevent:

```python
# Pages with no chapter-level Key Themes:. Expect 661 until step 1 starts.
import glob, html as H, re
import audit_authorship as A
LABEL = re.compile(r'<span class="auth-label">(.*?)</span>', re.S)
n = 0
for p in glob.glob("docs/*.html"):
    raw = open(p, encoding="utf-8").read()
    m = A.PANE.search(raw)
    if not m or 'id="tab-summary"' not in raw:
        continue
    if "Key Themes:" not in [H.unescape(x).strip() for x in LABEL.findall(m.group(2))]:
        n += 1
print("pages lacking chapter Key Themes:", n)
```

All 150 Psalms pages already carry a chapter-level `Key Themes:`, so folding Psalms
did not add to the 661. The bulk of it is elsewhere.

### Sublists: check before you drop one

**0 panes now carry a `<ul class="auth-sublist">`.** That was 455 when this section
was written and 148 immediately before Psalms was folded. Keep reading anyway: the
rule below is what to apply to any sublist that arrives with new content, and the two
cases at the end are the ones that cost real work to find.

Most sublists were verse-range outlines, and replacing them with sections lost
nothing. **13 were not**, and a fold that captures only `auth-item` divs will
silently delete them:

```
genesis1   isaiah53   proverbs25   proverbs26   revelation6
songofsolomon1 2 3 4 5 6 7 8
```

Rule: a sublist may be dropped only when **every** `<li>` carries a verse range.
If any item does not, the list is content rather than an outline — carry its
substance into the prose, or keep it. Genesis 1's list stated the forming/filling
pattern of the six days, which is the organising insight of the chapter and not an
outline of it; it was folded into the day sections rather than deleted.

That test is necessary but **not sufficient**. Joshua 12's sublist has a verse
range on all six items, so the rule above would clear it for deletion, yet it is a
regional breakdown of the 31-king ledger that the two sections never restate —
Jericho and Ai, the southern coalition, the central region, the northern coalition.
Deleting it would have lost every place name in the chapter. Before dropping a
list, check that the sections actually say the same thing. If they do not, the list
is content whatever its items look like, and its substance goes into the prose.

`leviticus27` was the last surviving sublist in either repo and a third failure mode
again, worth knowing because it defeated every automated check for months. Its
`vv.1-8` section body ended on a colon —

```
... Since the person cannot literally be sacrificed, a monetary equivalent
is established:
```

— and the eight shekel figures lived in the list, with a **headless** `auth-item`
continuing the same discussion after it. All eight items carried a verse range, so
the rule above cleared them; the sections covered every verse, so the coverage check
passed; the label was well formed, so `label_fault` passed. Nothing could see that
the prose was a sentence cut in half. The tell is a section body whose last character
is a colon, which is cheap to look for:

```python
# A section that ends on a colon is handing off to something. Expect 0.
for label, body in ITEM_PAIR.findall(pane):
    if H.unescape(re.sub(r"<.*?>", "", body)).strip().endswith(":"):
        print(page, "section hands off:", H.unescape(label).strip())
```

Repairing it also turned up two false statements in the surrounding prose, which is
the general lesson: a pane nobody has re-read since it was generated may be wrong as
well as malformed. It called thirty shekels "the price of a male between 5-20", which
v.5 sets at twenty, and "the least valuable category of adult", which it is not, since
v.7 sets a male over sixty at fifteen and a female over sixty at ten.

```python
items = re.findall(r'<li>(.*?)</li>', pane, re.S)
plain = [i for i in items if not re.search(r'\(vv?\.\s*\d', i)]
if plain:
    raise SystemExit(f'{page}: {len(plain)} non-outline sublist items')
```

Two other pane elements are easy to lose. A **headless** `auth-item` with no
`auth-label` may be a heading for the sublist below it, in which case it goes with
the list — or it may be a standalone note worth keeping, as with Acts 1's "Began
both to do and teach" and Romans 12's "Therefore". Distinguish by whether a
sublist follows. And a `Structure:` field holding prose rather than bullets is
still an outline the sections supersede, so drop it, but say so in the commit.

Target totals, matching what Ruth and Jonah landed at:

| chapter length | sections | pane total |
|---|---|---|
| short, under 20 verses | 4-5 | 3,000-4,000 chars |
| typical, 20-40 verses | 5-7 | 4,000-5,500 chars |
| long, over 40 verses | 6-8 | 5,000-6,500 chars |

Where the finished 1189 actually landed, for calibration:

| pane total | pages |
|---|---|
| under 3,000 | 284 |
| 3,000-4,000 | 365 |
| 4,000-5,500 | 442 |
| 5,500-6,500 | 68 |
| over 6,500 | 30 |

The 284 under 3,000 are not failures. Sections are deliberately shorter for the
poetry and the miscellanies than for narrative, and most of that bucket is Psalms,
Proverbs and the shorter epistles. A six-verse psalm does not support a Mark-chapter
exposition, and padding one to hit a character count produces worse prose than
leaving it short. Treat the table above as the shape narrative chapters should reach,
not a quota to enforce across the book.

### Prose style

**No emphatic capitals.** Some existing paragraphs shout — "a NARRATIVE about
the prophet", "he wants them DESTROYED", "always DOWNWARD". Write sentence case,
and normalize any you meet.

What is left is **179 pages carrying 282 distinct shouted words**, down from 413
pages and 1,115 words, the rest having been fixed as each book was folded. The
survivors are all in `Author:` and `Historical Context:` bodies, which the folds
preserved verbatim by design rather than rewriting. Commonest are `KING`, `FINAL`,
`PRIEST`, `FOREVER`, `REJECTED`, `WHERE`, `INTERNAL`, `RESTORATION`.

This is the second of the two deferred cleanups. It needs a pass over the allow list
before any transformation, because `CAPS_OK` in `audit_authorship.py` is what
separates a shout from a legitimate capital, and the list has grown as books landed —
`III` and `IV` went in for the Book III and Book IV doxology labels in Psalms.
**Never transform in bulk.** Lowercasing by rule will destroy divine names, Roman
numerals and abbreviations. Extend `CAPS_OK`, then fix the remainder by reading them.

Never lowercase: `LORD`, `GOD` where the source has it for the divine name,
`YHWH`, translation abbreviations (`ESV`, `KJV`, `ASV`, `NET`, `WEB`, `BSB`),
`NT`, `OT`, `BC`, `AD`, and Roman numerals.

### Two things that will bite

**Div balance.** The authorship pane's captured region runs up to the next
`tab-content` div, so it **includes the pane's own closing `</div>`**. A
replacement that rebuilds the body must put that tag back. Always count
`<div` against `</div>` and refuse to write when they disagree — this caught a
real bug on the first Jonah run.

**Counting sections.** A verse label can carry a letter suffix, as in
`(vv.5-6a)` and `(v.6b)`. This regex undercounts:

```
\(vv?\.[\d:,\s-]+\)          WRONG - reads Jonah 2 as 5 sections, not 7
\(vv?\.[\d]+[a-z]?(?:[-,:\s]+[\d]+[a-z]?)*\)     correct
```

### Finding what is left

```bash
python3 - <<'PY'
import os, re
VR = re.compile(r'\(vv?\.[\d]+[a-z]?(?:[-,:\s]+[\d]+[a-z]?)*\)')
todo = {}
for n in sorted(os.listdir('docs')):
    if not re.match(r'^[a-z0-9]+\d+\.html$', n) or n == '404.html':
        continue
    t = open(f'docs/{n}', encoding='utf-8').read()
    m = re.search(r'id="tab-authorship">(.*?)(?=<div class="tab-content")', t, re.S)
    if not m:
        continue
    labels = re.findall(r'class="auth-label">([^<]+)</span>', m.group(1))
    if not any(VR.search(l) for l in labels):
        book = re.match(r'^([a-z0-9]+?)\d+', n).group(1)
        todo.setdefault(book, []).append(n)
for b, v in sorted(todo.items(), key=lambda x: -len(x[1])):
    print(f"{b:16} {len(v):>3}")
print("total:", sum(len(v) for v in todo.values()))
PY
```

### Books with nothing yet

Psalms 150, Isaiah 66, Jeremiah 52, Ezekiel 46, 2 Chronicles 36, Proverbs 31,
1 Chronicles 29, Ezra 10, Nehemiah 13, Esther 10, Ecclesiastes 12, Song of
Solomon 8, and all twelve Minor Prophets except Jonah.

Partly done: Matthew 14 of 28, Exodus 13 of 40, Joshua 13 of 24, John 12 of 21.

Do a book at a time and stop for review before starting the next. **Psalms
last** — 150 chapters of poetry needs different treatment from narrative, and
the pattern should be settled on prose books first.

### The 27 book-opening pages: leave them

These lack a literal `Historical Context:` label and that is correct. They are
book introductions carrying the same substance under more specific headings:
1 Corinthians 1 has `Corinth:`, Galatians 1 has `The Crisis:`, Revelation 1 has
`Setting:`, Titus 1 has `Crete:`. Adding a generic field beside a specific one
makes the page worse. They still need verse-range sections like any other
chapter.

## Deploys

Both repos deploy to GitHub Pages via `static.yml`, triggered only by a push to
`main`. Pushing any other branch is safe and will not touch a live site.

Merge order matters: **bible-study first, then bible-study-newriver.** New
River's mirrored HTML expects upstream's CSS variables to already exist.
