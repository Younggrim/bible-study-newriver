#!/usr/bin/env python3
"""
Mirrors docs/ from the bible-study repo into this one.

bible-study is the single source of truth for content: chapter text, summaries,
authorship notes, Map & Geography, commentary, reflections, and the general
video set. This repo is that content wearing New River's clothes.

Everything that makes this deployment New River rather than the main site is
either preserved verbatim or re-applied after the mirror, so running this is
safe and repeatable:

  preserved, never overwritten by upstream
    CNAME                     this site's custom domain
    favicon.ico               New River's favicon
    manifest.json             New River's PWA name, description, colors
    newriver-videos.json      New River Church sermon overlay, applied at
                              runtime by site/script.js
    site/style.css            New River's palette
    site/script.js            dove splash screen and its timing
    site/dove-*.png           brand marks
    site/favicon-*.png        favicons
    site/icon-*.png           New River PWA icons

  re-applied to every mirrored HTML file
    page <title> suffix
    theme-color <meta>, which cannot use a CSS variable
    favicon <link> tags
    the Cinzel font, used by New River's headings
    the nav brand, dove logo plus "New River"

Colors are NOT rewritten here. Both sites resolve their palette through CSS
custom properties in site/style.css, so the mirrored HTML is already
theme-neutral. If that ever stops being true this script will say so rather
than quietly shipping the wrong palette.

Usage:
    python3 sync_from_bible_study.py [path-to-local-bible-study-clone]
    python3 sync_from_bible_study.py --check    # report, change nothing

With no path argument, clones or pulls bible-study into .bible-study-src/
(gitignored) and syncs from there.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
SRC_CLONE_DIR = os.path.join(BASE_DIR, ".bible-study-src")
STATE_FILE = os.path.join(BASE_DIR, ".sync-state.json")
SOURCE_REPO = "https://github.com/younggrim/bible-study"

# Paths relative to docs/ that belong to this deployment. Upstream's copies are
# ignored; if upstream adds a file not listed here it comes through as normal.
PRESERVE = {
    "CNAME",
    "favicon.ico",
    "manifest.json",
    "newriver-videos.json",
    "site/style.css",
    "site/script.js",
    "site/dove-black.png",
    "site/dove-white.png",
    "site/favicon-16.png",
    "site/favicon-32.png",
    "site/icon-192.png",
    "site/icon-512.png",
}

# Upstream files whose content feeds New River's own theme layer. If any of
# these change upstream, the New River counterpart may need a matching edit,
# so the sync reports it instead of silently diverging.
WATCH_UPSTREAM = ["site/style.css", "site/script.js"]

THEME_COLOR = "#000000"
BRAND_SUFFIX = "New River Bible Study"
FAVICON_LINKS = (
    '\n    <link rel="icon" href="favicon.ico" sizes="any">'
    '\n    <link rel="icon" type="image/png" sizes="32x32" href="site/favicon-32.png">'
    '\n    <link rel="icon" type="image/png" sizes="16x16" href="site/favicon-16.png">'
)
NAV_BRAND = (
    '<a href="index.html" class="nav-brand">'
    '<img class="nav-brand-logo" src="site/dove-white.png" alt="">New River</a>'
)
CINZEL_FAMILY = "Cinzel:wght@400;600;700"
GOOGLE_FONTS_CSS2 = "https://fonts.googleapis.com/css2?family="

MANIFEST_LINK = '<link rel="manifest" href="manifest.json">'
UPSTREAM_NAV_BRAND = '<a href="index.html" class="nav-brand">Bible Study</a>'


class Rule:
    """One HTML rebranding step, with a name so the report can show whether it
    actually fired on the pages that needed it."""

    def __init__(self, name, fn):
        self.name = name
        self.fn = fn
        self.applied = 0

    def run(self, text):
        new, n = self.fn(text)
        self.applied += n
        return new


def _sub(pattern, repl):
    def apply(text):
        return re.subn(pattern, repl, text)
    return apply


def _plain(needle, repl):
    def apply(text):
        n = text.count(needle)
        return (text.replace(needle, repl), n) if n else (text, 0)
    return apply


def add_cinzel(text):
    """Put Cinzel first in the Google Fonts request. Inserting at ?family=
    rather than before a particular family means it works no matter which font
    upstream happens to list first, and it is a no-op if Cinzel is there."""
    count = 0

    def insert(m):
        nonlocal count
        url = m.group(0)
        if CINZEL_FAMILY.split(":")[0] in url:
            return url
        count += 1
        return url.replace(GOOGLE_FONTS_CSS2, f"{GOOGLE_FONTS_CSS2}{CINZEL_FAMILY}&family=", 1)

    text = re.sub(re.escape(GOOGLE_FONTS_CSS2) + r'[^"\']*', insert, text)
    return text, count


def build_rules():
    return [
        # "<title>Genesis 1 — Bible Study</title>" and the bare
        # "<title>Bible Study</title>" on index.html both land correctly.
        Rule("page title", _plain("Bible Study</title>", f"{BRAND_SUFFIX}</title>")),
        Rule("theme-color meta", _sub(
            r'(name="theme-color"\s+content=")#[0-9a-fA-F]{6}(")',
            rf"\g<1>{THEME_COLOR}\g<2>")),
        Rule("favicon links", _plain(MANIFEST_LINK, MANIFEST_LINK + FAVICON_LINKS)),
        Rule("Cinzel font", add_cinzel),
        Rule("nav brand", _plain(UPSTREAM_NAV_BRAND, NAV_BRAND)),
    ]


def short_hash(path):
    if not os.path.isfile(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()[:8]


def cache_bust(text, css_v, js_v):
    """Point style.css and script.js at a content hash so a theme edit always
    invalidates the browser cache without anyone remembering to bump a number."""
    text, a = re.subn(r'href="site/style\.css(?:\?v=[^"]*)?"',
                      f'href="site/style.css?v={css_v}"', text)
    text, b = re.subn(r'src="site/script\.js(?:\?v=[^"]*)?"',
                      f'src="site/script.js?v={js_v}"', text)
    return text, a + b


def get_source_docs_dir(path_arg):
    if path_arg:
        docs = os.path.join(path_arg, "docs")
        if not os.path.isdir(docs):
            sys.exit(f"No docs/ directory under {path_arg}")
        return path_arg, docs
    if os.path.isdir(SRC_CLONE_DIR):
        subprocess.run(["git", "-C", SRC_CLONE_DIR, "pull", "--ff-only"], check=True)
    else:
        subprocess.run(["git", "clone", "--depth", "1", SOURCE_REPO, SRC_CLONE_DIR],
                       check=True)
    return SRC_CLONE_DIR, os.path.join(SRC_CLONE_DIR, "docs")


def upstream_commit(repo_root):
    try:
        out = subprocess.run(["git", "-C", repo_root, "log", "-1", "--format=%H %s"],
                             capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def read_state():
    if os.path.isfile(STATE_FILE):
        try:
            return json.load(open(STATE_FILE))
        except (OSError, ValueError):
            pass
    return {}


def snapshot_preserved():
    """Read the New River files that must survive the mirror."""
    kept = {}
    for rel in PRESERVE:
        p = os.path.join(DOCS_DIR, rel)
        if os.path.isfile(p):
            kept[rel] = open(p, "rb").read()
    return kept


def restore_preserved(kept):
    for rel, blob in kept.items():
        p = os.path.join(DOCS_DIR, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(blob)


def check_theme_neutral(docs_dir):
    """The mirrored HTML should carry no upstream palette literals. Any that
    show up mean upstream hardcoded a color that used to be a CSS variable,
    which would ship bible-study's palette onto New River."""
    upstream_only = ["#8b3a2a", "#8a7e74", "#e0d6c8", "#e8e0d6", "#3d342e"]
    found = {}
    for fname in sorted(os.listdir(docs_dir)):
        if not fname.endswith(".html"):
            continue
        text = open(os.path.join(docs_dir, fname), encoding="utf-8").read()
        # theme-color is legitimately a literal and is rewritten separately
        text = re.sub(r'name="theme-color"\s+content="#[0-9a-fA-F]{6}"', "", text)
        for hexv in upstream_only:
            n = text.lower().count(hexv)
            if n:
                found.setdefault(hexv, []).append((fname, n))
    return found


def main():
    args = [a for a in sys.argv[1:] if a != "--check"]
    check = "--check" in sys.argv
    path_arg = args[0] if args else None

    src_root, src_docs = get_source_docs_dir(path_arg)
    if not os.path.isdir(src_docs):
        sys.exit(f"Source docs/ not found at {src_docs}")

    state = read_state()
    commit = upstream_commit(src_root)

    # Warn before doing anything if upstream's own theme files moved, since that
    # is the one case where New River may need a hand-merge.
    warnings = []
    new_fingerprints = {}
    for rel in WATCH_UPSTREAM:
        h = short_hash(os.path.join(src_docs, rel))
        new_fingerprints[rel] = h
        was = (state.get("upstream_fingerprints") or {}).get(rel)
        if was and h and was != h:
            warnings.append(
                f"upstream {rel} changed since the last sync ({was} -> {h}); "
                f"review whether New River's copy needs the same edit")

    neutral_problems = check_theme_neutral(src_docs)

    if check:
        html = len([f for f in os.listdir(src_docs) if f.endswith(".html")])
        print(f"upstream: {commit}")
        print(f"would mirror {html} HTML files from {src_docs}")
        print(f"would preserve {len(snapshot_preserved())} New River files")
        for w in warnings:
            print(f"WARNING: {w}")
        if neutral_problems:
            print("WARNING: upstream HTML contains palette literals that should "
                  "be CSS variables:")
            for hexv, hits in neutral_problems.items():
                total = sum(n for _, n in hits)
                print(f"    {hexv}  {total} occurrences in {len(hits)} files "
                      f"(e.g. {hits[0][0]})")
        return

    kept = snapshot_preserved()
    missing = sorted(PRESERVE - set(kept))

    if os.path.isdir(DOCS_DIR):
        shutil.rmtree(DOCS_DIR)
    shutil.copytree(src_docs, DOCS_DIR)
    restore_preserved(kept)

    if "newriver-videos.json" not in kept:
        with open(os.path.join(DOCS_DIR, "newriver-videos.json"), "w") as f:
            f.write("{}\n")

    css_v = short_hash(os.path.join(DOCS_DIR, "site", "style.css"))
    js_v = short_hash(os.path.join(DOCS_DIR, "site", "script.js"))

    rules = build_rules()
    busted = 0
    touched = 0
    for fname in sorted(os.listdir(DOCS_DIR)):
        if not fname.endswith(".html"):
            continue
        path = os.path.join(DOCS_DIR, fname)
        original = open(path, encoding="utf-8").read()
        text = original
        for rule in rules:
            text = rule.run(text)
        text, n = cache_bust(text, css_v, js_v)
        busted += n
        if text != original:
            touched += 1
            open(path, "w", encoding="utf-8").write(text)

    overlay = json.load(open(os.path.join(DOCS_DIR, "newriver-videos.json")))
    sermons = sum(len(v) for v in overlay.values())

    json.dump({
        "upstream_commit": commit,
        "upstream_fingerprints": new_fingerprints,
        "style_css_v": css_v,
        "script_js_v": js_v,
    }, open(STATE_FILE, "w"), indent=2)
    open(STATE_FILE, "a").write("\n")

    print(f"Synced {src_docs} -> {DOCS_DIR}")
    print(f"  upstream        {commit}")
    print(f"  rebranded       {touched} HTML files")
    for rule in rules:
        print(f"    {rule.name:20} {rule.applied}")
    print(f"  cache-bust      {busted} refs (css v={css_v}, js v={js_v})")
    print(f"  preserved       {len(kept)} New River files")
    print(f"  sermon overlay  {sermons} videos across {len(overlay)} chapters")
    if missing:
        print(f"  NOTE: expected New River files were absent: {', '.join(missing)}")
    for w in warnings:
        print(f"  WARNING: {w}")
    if neutral_problems:
        print("  WARNING: upstream shipped palette literals in HTML; New River "
              "may render bible-study's colors in places:")
        for hexv, hits in neutral_problems.items():
            total = sum(n for _, n in hits)
            print(f"      {hexv}  {total} occurrences in {len(hits)} files "
                  f"(e.g. {hits[0][0]})")


if __name__ == "__main__":
    main()
