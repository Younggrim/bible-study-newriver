#!/usr/bin/env python3
"""
Checks every tracked YouTube channel's RSS feed for uploads not seen before and
reports them for human review. It deliberately does not guess which chapter a
video belongs on, or whether it belongs anywhere. That judgment stays with a
person or an assistant working from the issue this opens.

This file is identical in bible-study and bible-study-newriver. Which channels
get checked is decided entirely by the state files in .automation/, so the same
code serves both:

  bible-study                17 general channels, approved videos go into the
                             chapter HTML here and reach New River via a sync
  bible-study-newriver       New River Church only, approved videos go into
                             docs/newriver-videos.json and never go upstream

State files are read from .automation/*.json. Two shapes are accepted:

  canonical, per-channel ids
    {"channels": {"<name>": {"channel_id", "rss_url", "known_video_ids": []}},
     "last_checked": "YYYY-MM-DD"}

  legacy, list of channels sharing one id pool
    {"channels": [{"name", "channel_id", "rss_url"}],
     "known_video_ids": [], "last_checked": "YYYY-MM-DD"}

  legacy, single channel
    {"channel_name", "channel_id", "rss_url", "known_video_ids": []}

Any legacy file is rewritten in the canonical shape on first run, so the shapes
converge without losing which videos were already seen.

Usage:
    python3 check_new_videos.py [--check]

--check reports findings but writes nothing, neither state nor issue body.
"""
import datetime
import json
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import automation_http as http  # noqa: E402

AUTOMATION_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".automation")
ISSUE_BODY_PATH = "/tmp/new_videos_issue_body.md"
ATOM_NS = "{http://www.w3.org/2005/Atom}"
YT_NS = "{http://www.youtube.com/xml/schemas/2015}"
TIMEOUT = 25


def load_state_files():
    if not os.path.isdir(AUTOMATION_DIR):
        return []
    out = []
    for fname in sorted(os.listdir(AUTOMATION_DIR)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(AUTOMATION_DIR, fname)
        try:
            with open(path) as f:
                out.append((path, json.load(f)))
        except (OSError, ValueError) as e:
            print(f"WARN: skipping unreadable {fname}: {e}", file=sys.stderr)
    return out


def normalise(data):
    """Return (channels, was_legacy) where channels is
    {name: {channel_id, rss_url, known_video_ids}}.

    A legacy list-shaped file has one shared id pool with no per-channel
    attribution. Seeding every channel from that pool is the safe direction: it
    can only suppress a repeat report, never invent a new one.
    """
    raw = data.get("channels")
    shared = list(data.get("known_video_ids") or [])

    if isinstance(raw, dict):
        legacy = False
        channels = {}
        for name, info in raw.items():
            info = dict(info)
            if "known_video_ids" not in info:
                info["known_video_ids"] = list(shared)
                legacy = True
            channels[name] = info
        return channels, legacy

    if isinstance(raw, list):
        channels = {}
        for entry in raw:
            name = entry.get("name") or entry.get("channel_name") or "channel"
            channels[name] = {
                "channel_id": entry.get("channel_id"),
                "rss_url": entry.get("rss_url"),
                "known_video_ids": list(entry.get("known_video_ids") or shared),
            }
        return channels, True

    if "channel_id" in data:
        name = data.get("channel_name", "channel")
        return {name: {
            "channel_id": data.get("channel_id"),
            "rss_url": data.get("rss_url"),
            "known_video_ids": shared,
        }}, True

    return {}, False


def rss_url_for(info):
    if info.get("rss_url"):
        return info["rss_url"]
    if info.get("channel_id"):
        return ("https://www.youtube.com/feeds/videos.xml"
                f"?channel_id={info['channel_id']}")
    return None


def fetch_feed(url):
    status, body = http.get(url, timeout=TIMEOUT)
    if status != 200:
        raise OSError(f"HTTP {status} from feed")
    root = ET.fromstring(body)
    entries = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        vid = entry.findtext(f"{YT_NS}videoId")
        title = entry.findtext(f"{ATOM_NS}title")
        published = entry.findtext(f"{ATOM_NS}published") or ""
        if vid and title:
            entries.append((vid, title, published[:10]))
    return entries


def main():
    check = "--check" in sys.argv
    state_files = load_state_files()
    if not state_files:
        print(f"No state files under {AUTOMATION_DIR}. Nothing to check.")
        return 0

    found = {}
    failures = []
    rewrites = []

    for path, data in state_files:
        channels, legacy = normalise(data)
        if not channels:
            print(f"WARN: {os.path.basename(path)} has no channels", file=sys.stderr)
            continue

        changed = legacy
        for name, info in channels.items():
            url = rss_url_for(info)
            if not url:
                failures.append(f"{name}: no rss_url or channel_id")
                continue
            try:
                entries = fetch_feed(url)
            except (ET.ParseError, OSError, ValueError) as e:
                failures.append(f"{name}: {type(e).__name__}: {e}")
                continue

            known = set(info.get("known_video_ids") or [])
            fresh = [(v, t, d) for v, t, d in entries if v not in known]
            if fresh:
                found.setdefault(name, []).extend(fresh)
                info["known_video_ids"] = sorted(known | {v for v, _, _ in fresh})
                changed = True

        if changed and not check:
            payload = {"channels": channels,
                       "last_checked": datetime.date.today().isoformat()}
            with open(path, "w") as f:
                json.dump(payload, f, indent=2)
                f.write("\n")
            rewrites.append(os.path.basename(path)
                            + (" (migrated to canonical shape)" if legacy else ""))

    total = sum(len(v) for v in found.values())
    gh_output = os.environ.get("GITHUB_OUTPUT")

    for f in failures:
        print(f"WARN: failed to check {f}", file=sys.stderr)

    if not total:
        print(f"No new videos. Checked {sum(len(normalise(d)[0]) for _, d in state_files)} "
              f"channel(s) across {len(state_files)} state file(s).")
        if failures:
            print(f"{len(failures)} channel(s) could not be reached, see warnings above.")
        if gh_output and not check:
            with open(gh_output, "a") as f:
                f.write("has_new=false\n")
        # A feed failing is worth surfacing but is not a reason to fail the run.
        return 0

    lines = [
        f"Found **{total}** upload(s) on tracked channels that this repo has not "
        "seen before.",
        "",
        "Nothing has been added to the site. Each of these needs a human or "
        "assistant to decide whether it fits a specific chapter, and which one. "
        "See `WORKFLOW.md` for where an approved video goes.",
        "",
    ]
    for channel, vids in sorted(found.items()):
        lines.append(f"### {channel}")
        for vid, title, date in vids:
            when = f" — {date}" if date else ""
            lines.append(f"- [{title}](https://www.youtube.com/watch?v={vid}) "
                         f"`{vid}`{when}")
        lines.append("")
    if failures:
        lines += ["### Channels that could not be checked", ""]
        lines += [f"- {f}" for f in failures] + [""]
    if rewrites:
        lines += ["---", "", "State files updated: " + ", ".join(rewrites), ""]

    body = "\n".join(lines)
    print(body)

    if not check:
        with open(ISSUE_BODY_PATH, "w") as f:
            f.write(body)
        if gh_output:
            with open(gh_output, "a") as f:
                f.write("has_new=true\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
