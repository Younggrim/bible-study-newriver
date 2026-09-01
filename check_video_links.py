#!/usr/bin/env python3
"""
Audits every YouTube video the site references and reports the ones that no
longer play. Videos get deleted, set private, or have embedding turned off, and
none of that announces itself, so without this the site slowly fills with dead
players.

Availability is checked through YouTube's oEmbed endpoint, which needs no API
key and no quota:

    200  the video plays
    404  gone, deleted or never existed
    401  exists but is private or has embedding disabled, so it will not play
         in the site's embed either

This file is identical in bible-study and bible-study-newriver. It picks up
whatever each repo actually references:

  docs/*.html               inline players, loadYT(this,'<id>')
  docs/newriver-videos.json the New River Church sermon overlay, New River only

A definitive 404 or 401 is the only thing reported as broken. Anything else,
including rate limiting and timeouts, is retried and then reported separately as
inconclusive. That asymmetry is deliberate: a false "dead" report could get a
perfectly good video deleted from the site.

Usage:
    python3 check_video_links.py [--limit N] [--workers N] [--titles]

    --limit N    check only the first N ids, for a quick smoke test
    --workers N  concurrent requests, default 8
    --titles     also list videos whose current title differs from the site's
"""
import collections
import json
import os
import re
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import automation_http as http  # noqa: E402

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(BASE_DIR, "docs")
OVERLAY = os.path.join(DOCS, "newriver-videos.json")
ISSUE_BODY_PATH = "/tmp/dead_videos_issue_body.md"

OEMBED = "https://www.youtube.com/oembed"
TIMEOUT = 20
RETRIES = 3
BACKOFF = 2.0

LOADYT = re.compile(r"loadYT\(this,'([A-Za-z0-9_-]{6,})'")
# the title sits in the facade caption, just before the channel name
FACADE_TITLE = re.compile(
    r"loadYT\(this,'([A-Za-z0-9_-]{6,})'.{0,1400}?font-weight:600;\">(.*?)<br>",
    re.S)

_print_lock = threading.Lock()


def strip_tags(s):
    import html
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def collect_references():
    """id -> {"pages": set, "titles": set}"""
    refs = collections.defaultdict(lambda: {"pages": set(), "titles": set()})
    if os.path.isdir(DOCS):
        for name in sorted(os.listdir(DOCS)):
            if not name.endswith(".html"):
                continue
            text = open(os.path.join(DOCS, name), encoding="utf-8").read()
            for vid in LOADYT.findall(text):
                refs[vid]["pages"].add(name)
            for vid, title in FACADE_TITLE.findall(text):
                t = strip_tags(title)
                if t:
                    refs[vid]["titles"].add(t)

    if os.path.isfile(OVERLAY):
        try:
            overlay = json.load(open(OVERLAY))
        except ValueError as e:
            print(f"WARN: {OVERLAY} is not valid JSON: {e}", file=sys.stderr)
            overlay = {}
        for page, vids in overlay.items():
            for v in vids:
                vid = v.get("id")
                if not vid:
                    continue
                refs[vid]["pages"].add(f"{page} (overlay)")
                if v.get("title"):
                    refs[vid]["titles"].add(v["title"].strip())
    return refs


def probe(vid):
    """Return (status, title, author). status is ok | gone | blocked | unknown.

    Only a definitive 404 or 401 counts as broken. Everything else is retried
    and then left as unknown, because a false positive here gets a working
    video deleted from the site."""
    url = (f"{OEMBED}?url=" +
           urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}", safe="") +
           "&format=json")
    last = "no attempt made"
    for attempt in range(RETRIES):
        try:
            status, data = http.get_json(url, timeout=TIMEOUT)
        except (OSError, ValueError) as e:
            last = f"{type(e).__name__}: {e}"
        else:
            if status == 200 and data:
                return "ok", data.get("title", ""), data.get("author_name", "")
            if status == 404:
                return "gone", "", ""
            if status == 401:
                return "blocked", "", ""
            # 429 and 5xx are transient, and a 200 we could not parse is
            # usually a proxy interstitial. Back off and try again.
            last = f"HTTP {status}" if status else "no response"
        if attempt < RETRIES - 1:
            time.sleep(BACKOFF * (attempt + 1))
    return "unknown", last, ""


def main():
    argv = sys.argv[1:]

    def opt(flag, default):
        if flag in argv:
            try:
                return int(argv[argv.index(flag) + 1])
            except (IndexError, ValueError):
                sys.exit(f"{flag} needs an integer")
        return default

    limit = opt("--limit", 0)
    workers = opt("--workers", 8)
    want_titles = "--titles" in argv

    refs = collect_references()
    ids = sorted(refs)
    if limit:
        ids = ids[:limit]
    if not ids:
        print("No video references found. Nothing to audit.")
        return 0

    repo = os.path.basename(BASE_DIR)
    print(f"{repo}: auditing {len(ids)} unique video id(s) "
          f"across {len({p for r in refs.values() for p in r['pages']})} page(s), "
          f"{workers} workers")

    results = {}
    done = 0

    def work(vid):
        nonlocal done
        res = probe(vid)
        results[vid] = res
        done += 1
        if done % 250 == 0:
            with _print_lock:
                print(f"  ...{done}/{len(ids)}", flush=True)
        return res

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(work, ids))

    gone = {v: refs[v] for v in ids if results[v][0] == "gone"}
    blocked = {v: refs[v] for v in ids if results[v][0] == "blocked"}
    unknown = {v: results[v][1] for v in ids if results[v][0] == "unknown"}
    ok = [v for v in ids if results[v][0] == "ok"]

    drift = {}
    if want_titles:
        for v in ok:
            live = results[v][1].strip()
            site = refs[v]["titles"]
            if live and site and live not in site:
                drift[v] = (sorted(site)[0], live)

    print(f"\n  playable     {len(ok)}")
    print(f"  deleted      {len(gone)}")
    print(f"  private      {len(blocked)}")
    print(f"  inconclusive {len(unknown)}")
    if want_titles:
        print(f"  title drift  {len(drift)}")

    broken = len(gone) + len(blocked)
    gh_output = os.environ.get("GITHUB_OUTPUT")
    if gh_output:
        with open(gh_output, "a") as f:
            f.write(f"has_dead={'true' if broken else 'false'}\n")
            f.write(f"dead_count={broken}\n")

    if not broken and not unknown and not drift:
        print("\nEvery referenced video still plays.")
        return 0

    lines = [f"Audited **{len(ids)}** unique video ids referenced by this repo. "
             f"**{len(ok)}** still play.", ""]

    def section(title, note, items, fmt):
        lines.append(f"### {title}")
        lines.append("")
        lines.append(note)
        lines.append("")
        for vid, extra in sorted(items.items()):
            lines.append(fmt(vid, extra))
        lines.append("")

    if gone:
        section(f"Deleted or nonexistent ({len(gone)})",
                "These returned 404. They should be removed or replaced.",
                gone,
                lambda v, r: f"- `{v}` https://www.youtube.com/watch?v={v}\n"
                             f"  - on: {', '.join(sorted(r['pages']))}"
                             + (f"\n  - site title: {sorted(r['titles'])[0]}"
                                if r["titles"] else ""))
    if blocked:
        section(f"Private or embedding disabled ({len(blocked)})",
                "These returned 401. The video may still exist on YouTube but "
                "will not play in the site's embedded player.",
                blocked,
                lambda v, r: f"- `{v}` https://www.youtube.com/watch?v={v}\n"
                             f"  - on: {', '.join(sorted(r['pages']))}"
                             + (f"\n  - site title: {sorted(r['titles'])[0]}"
                                if r["titles"] else ""))
    if unknown:
        section(f"Could not be determined ({len(unknown)})",
                "Not reported as broken. These hit a timeout or rate limit "
                "after retries, so treat them as unchecked rather than dead and "
                "let the next run settle it.",
                unknown,
                lambda v, why: f"- `{v}` — {why}")
    if drift:
        section(f"Title changed on YouTube ({len(drift)})",
                "Still playable, but the uploader renamed them. Cosmetic only.",
                drift,
                lambda v, p: f"- `{v}`\n  - site: {p[0]}\n  - now:  {p[1]}")

    lines += ["---", "",
              "See `WORKFLOW.md`. Inline players are edited in **bible-study** "
              "and reach New River through a sync. New River Church sermons are "
              "edited only in `docs/newriver-videos.json`."]

    body = "\n".join(lines)
    print()
    print(body)
    with open(ISSUE_BODY_PATH, "w") as f:
        f.write(body)
    return 0


if __name__ == "__main__":
    sys.exit(main())
