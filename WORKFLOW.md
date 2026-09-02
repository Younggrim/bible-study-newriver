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

### Running the checks by hand

```bash
python3 check_new_videos.py --check      # report, write nothing
python3 check_video_links.py --limit 40  # quick smoke test
python3 check_video_links.py --titles    # also flag titles renamed on YouTube
```

`automation_http.py` is shared by both scripts. It uses urllib normally, and
falls back to curl the moment urllib hits an SSL error. That exists for one
concrete reason: behind a TLS-inspecting corporate proxy whose CA has no
Authority Key Identifier, Python's OpenSSL refuses the connection outright
while curl is fine. Without the fallback these scripts cannot be run by hand
from such a machine at all.

### One-time repair scripts

`fix_video_titles.py` repairs video captions corrupted by a bad encoding
round-trip, where an en-dash became U+FFFD. It takes the correct title from
oEmbed rather than guessing, and leaves any video it cannot resolve untouched.
It fixed 173 captions across 132 pages. Run it in **bible-study**, then sync.
Keep it around; the same corruption can recur if titles are ever pasted through
a non-UTF-8 tool.

## Verifying the invariant

Run these after any change to confirm the two repos differ only where allowed.

```bash
# Every diff hunk against upstream should be explained by a branding rule.
# Expect: 0 unexplained.
python3 - <<'PY'
import os, difflib
bs, nr = "bible-study/docs", "bible-study-newriver/docs"
BRAND = ('New River Bible Study','theme-color','favicon','Cinzel',
         'dove-white.png','nav-brand','style.css?v=','script.js?v=')
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

Tab coverage should be identical across both repos. Current expected values:

| tab | chapters |
|---|---|
| summary | 1189 |
| authorship | 1189 |
| mapgeo | 842 |
| commentary | 972 |
| videos | 1189 |
| reflection | 1189 |

```bash
# No caption should contain the Unicode replacement character. Expect 0.
grep -l $'\ufffd' docs/*.html | wc -l
```

### Baseline as of the last full audit

- 3617 unique videos referenced, **all 3617 playable**, 0 deleted, 0 private
- 0 captions containing U+FFFD
- 0 unexplained diff hunks between the repos
- New River sermon overlay: 127 videos across 60 chapters

A full audit takes about a minute.

## Authorship & Background: the target format

Every chapter's Authorship & Background pane must end up in this shape. Jonah 1-4
is the reference implementation; read `jonah1.html` beside `ruth1.html` before
starting a new book.

**Status: 559 of 1189 chapters done. 630 remaining.**

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

Target totals, matching what Ruth and Jonah landed at:

| chapter length | sections | pane total |
|---|---|---|
| short, under 20 verses | 4-5 | 3,000-4,000 chars |
| typical, 20-40 verses | 5-7 | 4,000-5,500 chars |
| long, over 40 verses | 6-8 | 5,000-6,500 chars |

### Prose style

**No emphatic capitals.** Some existing paragraphs shout — "a NARRATIVE about
the prophet", "he wants them DESTROYED", "always DOWNWARD". 413 chapters carry
1,115 such words. Write sentence case and normalize them when folding a book.

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
