# Workflow: bible-study and bible-study-newriver

This file is identical in both repositories. It is the contract any person or AI
assistant should follow when changing either one. If you are an assistant
picking up work here, read this before editing.

## The invariant

**New River is bible-study with a different palette and its own church's
sermon videos. Nothing else differs.**

Every page, every tab, every study note, every general video is the same on both
sites. If you find any other difference, it is drift and should be corrected,
not preserved.

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

**2. New River sermon videos.** Only in `bible-study-newriver`, only in
`docs/newriver-videos.json`, never inline in HTML. `docs/site/script.js` renders
them at runtime keyed by page filename. That script is identical in both repos,
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

**General videos** (any of the 17 tracked channels) go in the chapter HTML in
**bible-study**, then reach New River through a sync. They appear on both sites.

**New River Church videos** go only in
`bible-study-newriver/docs/newriver-videos.json`. Never inline, never upstream.

This distinction was previously broken: 124 New River Church videos were baked
inline into New River's HTML, which the sync would have destroyed. They have
been recovered into the overlay. Keep them there.

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

- `bible-study` watches **17 general channels**: BibleProject,
  ImpactVideoMinistries, BrandonRobbinsMinistry, QCSocials, SpokenGospel,
  MikeWinger, GiveMeAnAnswer, WesHuff, DavidGuzikEnduringWord,
  TheBeatAllenParr, GotQuestions, TheChosen, TheDailyDevo, CrazyLoveMinistries,
  GraceFamilyBaptistChurch, LakepointeChurch, 2BeLikeChrist. Approved videos go
  into the chapter HTML here and reach New River through a sync, so they appear
  on both sites.
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

## Deploys

Both repos deploy to GitHub Pages via `static.yml`, triggered only by a push to
`main`. Pushing any other branch is safe and will not touch a live site.

Merge order matters: **bible-study first, then bible-study-newriver.** New
River's mirrored HTML expects upstream's CSS variables to already exist.
