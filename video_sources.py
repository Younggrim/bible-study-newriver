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

# Individual videos to keep off both sites even though their channel is allowed.
# Deleting a player from the HTML is not enough on its own: the channel stays in
# the allow list, so the next sync or re-run of filter_videos.py would let it back.
# Keyed by YouTube id, with the reason, because "why was this dropped" is the
# question anyone will have later.
DROP_VIDEO_IDS = {
    "bk0fGfS9KVw": "BibleProject 'Season 7 Preview: Visual Commentary - Genesis 1' "
                   "-- a series trailer rather than teaching on the chapter",
    "s6WixiMubHo": "David Guzik 'Can Forgiveness Come Too Easily? Thoughts On the "
                   "Clancy Case - LIVE Q&A' -- current-events Q&A, no passage",
    "gEWbQn408Sk": "GotQuestions 'What is the marriage supper of the Lamb?' -- "
                   "title cites no passage (skipped in the 2026-09-29 review)",
    "4IiK3HpQUMM": "GotQuestions 'Is Donald Trump the Antichrist?' -- "
                   "current-events speculation",
    "RcnxRa4qClw": "2BeLikeChrist 'We Need Your Help!' -- a channel appeal, not teaching",
    "nm8nKMRQXgY": "The Chosen 'I Love The One' lyric video -- a music video, not teaching",
    "1_JMZNIWybs": "BibleProject 'Spirit of God' -- theme video, no passage in the title (skipped 2026-10-13; could go on the-trinity or gifts-of-the-holy-spirit)",
    "jMtE5l5YNn4": "David Guzik 'Bet Shemesh: The Ark of the Covenant Comes Home' -- Israel travel episode, no passage in the title",
    "z9BVccSFJBE": "David Guzik 'What Does The Parable of the 10 Virgins Mean? LIVE Q&A' -- live Q&A stream",
    "XB9gcC1cJGM": "Give Me an Answer 'Is Being Morally Good, Good Enough?' -- no passage",
    "xYA3RxK-p5M": "GotQuestions 'When will the Resurrection take place?' -- no passage",
    "0V-0NWObrLw": "GotQuestions 'Is the Euphrates River Drying Up a Sign of the End Times?' -- current-events speculation",
    "BvmX6D8mvB0": "GotQuestions 'Who are the Amish...' -- podcast episode",
    "BBxSYQq8eeY": "Mike Winger 'Does the Bible support me calling people names? 10 Qs' -- Q&A episode, no passage",
    "h_5xr7jrZPw": "The BEAT 'Frank Turek Answers the Charlie Kirk Conspiracy Theories' -- politics and current events",
    "0Cx1SQGZTVo": "The Chosen 'Last Watch Party Before Season 6' -- not teaching",
    "20SieZXyaa0": "The Chosen 'Season 4 Full Recap' -- not teaching",
    "uTzkFqKWEEw": "The Chosen 'My Everything' lyric video -- a music video",
    "cEpT4Yj22GA": "The Chosen 'Lady A + Boyz II Men: How Did This Song Happen?' -- behind-the-song, not teaching",
    "XcjD8A1NsV4": "GotQuestions 'A Summary of the Book of Mark' re-upload -- duplicate of COOBtFhtVZs already on mark1 (added in error 2026-10-13)",
    "Vhlo7vpzH8k": "GotQuestions 'A Summary of the Book of Luke' re-upload -- duplicate of cGBVcGPqSpI already on luke1",
    "9kJkB2ALAg0": "David Guzik 'Elah Valley: David, Goliath, & the Power of Faith' -- Israel travel episode, no passage in the title",
    "zezQ7jXxEXo": "David Guzik 'How To Lead Like Jesus' -- no passage",
    "mrEszqtYogg": "David Guzik 'Was Muhammad Prophesied In the Bible? LIVE Q&A' -- live Q&A stream, no passage",
    "dNGSFpfyfhA": "Give Me an Answer 'Do Agnostics Just Want To Have Control?' -- no passage",
    "W9rKbdgfpx0": "GotQuestions 'Is Elon Musk the Antichrist?' -- current-events speculation",
    "MUjjX5PG3N8": "GotQuestions 'Ghosts, Demons & Guardian Angels' -- no passage",
    "V1-ng3VkvKY": "GotQuestions 'Noah's Ark' -- podcast episode",
    "orCDwvy6KGw": "Mike Winger on a televised execution -- current events, no passage",
    "6S2lM461igY": "Mike Winger 'I Went To A Mosque...: 10 Qs' -- Q&A episode, no passage",
    "ZiIHadIR0qo": "The BEAT 'Heaven Is NOT What Most Christians Think' -- no passage",
    "VVqrE7azRqw": "The Chosen 'Season 6 Official Trailer' -- a trailer, not teaching",
    "7gRdqZAAwU4": "Brandon Robbins 'The Complete Guide to the Book of Acts - Day 1' -- chapters covered not stated",
    "_fP83GCQQYg": "Brandon Robbins 'The Complete Guide to the Book of Acts - Day 2' -- chapters covered not stated",
    "LTpjRBmFf8A": "Brandon Robbins 'The Complete Guide to the Book of Acts - Day 3' -- chapters covered not stated",
    "f204uLDfTPg": "2BeLikeChrist 'We Made it to Japan' -- travel update, not teaching",
    "OaSCVyt1vNM": "David Guzik 'Shiloh: The Tabernacle, Eli, and the Boy Samuel' -- Israel travel episode, no passage in the title",
    "_YkaMYubiZk": "Give Me an Answer 'Atheist Tries To Stump Us On Biblical Slavery' -- no passage",
    "wRsMdW-xMiA": "GotQuestions 'What are the 1st & 2nd resurrections?' -- no passage in the title",
    "qLDAHgaXV0g": "GotQuestions 'A Summary of the Book of John' re-upload -- john1 already has the original",
    "NqTYSG35LdA": "GotQuestions death penalty -- podcast episode",
    "ULwHwVxMZzw": "Mike Winger 'The Truth About Mormonism: 10 Qs' -- Q&A episode, no passage",
    "2zQ44zX-HGg": "Mike Winger ministry-investigation update -- current events, no passage",
    "bOTfDkLbmIg": "Mike Winger 'This is for the men' -- no passage",
    "YnHFoJr8Sog": "The BEAT 'This Bible Story Will Make You Rethink Your Next Decision' -- passage not named",
    "K3fAFvIwGpw": "The Chosen 'We're Taking You Home' -- promo, not teaching",
    "g4QGA1QFqmw": "The Chosen 'Jesus Prays in the Garden of Gethsemane' scene -- drama clip, not teaching",
    "PCT1WPvRFaE": "Wes Huff tribute to Dr. Parker -- personal, not teaching",
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
    """Remove players whose channel is not allowed, or whose id is dropped.
    DROP_VIDEO_IDS always applies; drop_ids adds to it, which is how
    filter_videos.py passes the Shorts it found. Also rewrites alias labels to
    their canonical form so the page and the filter agree.
    Returns (new_text, removed_count, relabelled_count)."""
    drop_ids = set(drop_ids) | set(DROP_VIDEO_IDS)
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
