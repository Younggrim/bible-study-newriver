#!/usr/bin/env python3
"""
Checks every tracked YouTube channel's RSS feed for videos not yet seen,
and reports them for human review rather than guessing which chapter (or
whether any chapter) a new video belongs on — that judgment call stays
with a person. Updates each state file's known_video_ids so the same
video isn't reported again next run.

Reads every *.json file under .automation/ that looks like a channel
watch-state file: either the multi-channel shape
    {"channels": {name: {channel_id, rss_url, known_video_ids}, ...}}
or the single-channel shape
    {"channel_name", "channel_id", "rss_url", "known_video_ids"}

Run manually with: python3 check_new_videos.py
"""
import datetime
import json
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

AUTOMATION_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".automation")
ATOM_NS = "{http://www.w3.org/2005/Atom}"
YT_NS = "{http://www.youtube.com/xml/schemas/2015}"


def load_state_files():
    files = []
    if not os.path.isdir(AUTOMATION_DIR):
        return files
    for fname in sorted(os.listdir(AUTOMATION_DIR)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(AUTOMATION_DIR, fname)
        with open(path) as f:
            data = json.load(f)
        files.append((path, data))
    return files


def iter_channels(data):
    """Yield (label, channel_dict) for either state-file shape."""
    if "channels" in data:
        for name, info in data["channels"].items():
            yield name, info
    elif "channel_id" in data:
        yield data.get("channel_name", "channel"), data


def fetch_feed_entries(rss_url):
    req = urllib.request.Request(rss_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        xml_bytes = resp.read()
    root = ET.fromstring(xml_bytes)
    entries = []
    for entry in root.findall(f"{ATOM_NS}entry"):
        vid = entry.findtext(f"{YT_NS}videoId")
        title = entry.findtext(f"{ATOM_NS}title")
        if vid and title:
            entries.append((vid, title))
    return entries


def main():
    new_by_channel = {}
    changed_files = []

    for path, data in load_state_files():
        file_changed = False
        for label, info in iter_channels(data):
            rss_url = info.get("rss_url")
            if not rss_url:
                continue
            known = set(info.get("known_video_ids", []))
            try:
                entries = fetch_feed_entries(rss_url)
            except Exception as e:
                print(f"WARN: failed to fetch {label}: {e}", file=sys.stderr)
                continue
            new_here = [(vid, title) for vid, title in entries if vid not in known]
            if new_here:
                new_by_channel.setdefault(label, []).extend(
                    (vid, title, f"https://www.youtube.com/watch?v={vid}")
                    for vid, title in new_here
                )
                info.setdefault("known_video_ids", []).extend(vid for vid, _ in new_here)
                file_changed = True
        if file_changed:
            data["last_checked"] = datetime.date.today().isoformat()
            with open(path, "w") as f:
                json.dump(data, f, indent=2)
                f.write("\n")
            changed_files.append(path)

    gh_output = os.environ.get("GITHUB_OUTPUT")

    if not new_by_channel:
        print("No new videos found.")
        if gh_output:
            with open(gh_output, "a") as f:
                f.write("has_new=false\n")
        return

    lines = ["New videos found on tracked channels since the last check.",
             "Review each and add any that fit a chapter to that chapter's video overlay/HTML — this list doesn't do that automatically.\n"]
    for channel, videos in new_by_channel.items():
        lines.append(f"### {channel}")
        for vid, title, url in videos:
            lines.append(f"- [{title}]({url})")
        lines.append("")
    body = "\n".join(lines)
    print(body)

    with open("/tmp/new_videos_issue_body.md", "w") as f:
        f.write(body)

    if gh_output:
        with open(gh_output, "a") as f:
            f.write("has_new=true\n")


if __name__ == "__main__":
    main()
