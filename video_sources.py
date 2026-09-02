#!/usr/bin/env python3
"""
The allowed video sources for each deployment, and the code that enforces them.

This module is imported by sync_from_bible_study.py so New River's filter runs
on every sync, and it is used standalone by filter_videos.py to clean upstream.
Keeping both in one place means the two deployments can never drift on which
sources are permitted.

Why the two lists differ: bible-study is the general study site; New River is a
church deployment that wants a tighter set plus its own sermons. That difference
is deliberate. It is also why the sync cannot be a plain mirror of docs/ — see
the filter step there.

Labels are matched against the yt-src caption on each player, which is what the
page actually shows the reader.
"""
import re

# Canonical label -> labels that mean the same channel. Three of these exist
# because the same channel was captioned inconsistently, and one because an
# ampersand got HTML-escaped on a single page. Without this, filtering by label
# would delete videos from channels that are allowed.
ALIASES = {
    "David Guzik": ["David Guzik Devotionals", "David Guzik / Enduring Word"],
    "Give Me An Answer with Stuart & Cliffe Knechtle":
        ["Give Me An Answer with Stuart &amp; Cliffe Knechtle"],
}

# bible-study: 13 sources
BIBLE_STUDY_ALLOW = {
    "David Guzik",
    "Spoken Gospel",
    "2BeLikeChrist",
    "Got Questions Ministries",
    "The Daily Devo",
    "BibleProject",
    "Mike Winger",
    "THE BEAT by Allen Parr",
    "Brandon Robbins",
    "Impact Video Ministries",
    "The Chosen",
    "Give Me An Answer with Stuart & Cliffe Knechtle",
    "Wes Huff",
}

# New River: 6 of the above, plus its own church videos which live in
# docs/newriver-videos.json and are rendered at runtime, not filtered here.
NEW_RIVER_ALLOW = {
    "David Guzik",
    "Spoken Gospel",
    "2BeLikeChrist",
    "Got Questions Ministries",
    "BibleProject",
    "The Chosen",
}

FACADE_OPEN = '<div class="yt-facade"'


def canonical(label):
    """Fold an alias onto the label the site should be using."""
    label = label.strip()
    for good, bad in ALIASES.items():
        if label == good or label in bad:
            return good
    return label


def div_end(text, open_pos):
    """Index just past the </div> that closes the <div> at open_pos."""
    depth = 0
    for m in re.finditer(r"<div\b|</div>", text[open_pos:]):
        depth += 1 if m.group(0).startswith("<div") else -1
        if depth == 0:
            return open_pos + m.end()
    raise ValueError("unbalanced <div> while scanning a player")


def players(text):
    """Yield (start, end, video_id, canonical_label) for each player."""
    for m in re.finditer(re.escape(FACADE_OPEN), text):
        start = m.start()
        try:
            end = div_end(text, start)
        except ValueError:
            continue
        block = text[start:end]
        vid = re.search(r"loadYT\(this,'([^']+)'", block)
        src = re.search(r'class="yt-src"[^>]*>([^<]*)</span>', block)
        yield start, end, (vid.group(1) if vid else None), \
            canonical(src.group(1) if src else "?")


def apply_filter(text, allow, drop_ids=()):
    """Remove players whose channel is not allowed, or whose id is in drop_ids.
    Also rewrites alias labels to their canonical form so the page and the
    filter agree. Returns (new_text, removed_count, relabelled_count)."""
    removed = relabelled = 0
    # right to left so earlier offsets stay valid
    for start, end, vid, label in sorted(players(text), reverse=True):
        if label not in allow or (vid and vid in drop_ids):
            text = text[:start] + text[end:]
            removed += 1
            continue
        block = text[start:end]
        raw = re.search(r'(class="yt-src"[^>]*>)([^<]*)(</span>)', block)
        if raw and raw.group(2).strip() != label:
            fixed = block[:raw.start(2)] + label + block[raw.end(2):]
            text = text[:start] + fixed + text[end:]
            relabelled += 1
    return text, removed, relabelled


def strip_empty_videos_tab(text):
    """If no players remain, drop the Videos tab rather than leaving an empty
    pane. Returns (new_text, True) if the tab was removed."""
    pane = re.search(
        r'\s*<div class="tab-content" id="tab-videos">.*?</div>\s*(?=<div class="tab-content"|</div>)',
        text, re.S)
    if not pane:
        return text, False
    if FACADE_OPEN in pane.group(0):
        return text, False
    text = text[:pane.start()] + "\n" + text[pane.end():]
    text = re.sub(
        r'\s*<div class="study-tab" data-tab="videos">Videos</div>', "", text, count=1)
    return text, True
