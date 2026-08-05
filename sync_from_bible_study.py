#!/usr/bin/env python3
"""
Mirrors docs/ from the bible-study repo (single source of truth for design
and content) into this repo, preserving New River's own CNAME and its
newriver-videos.json overlay — the extra videos from
youtube.com/@newriver.church that should only ever show up here, never on
the main site.

Run this any time bible-study's docs/ changes and you want New River to
pick up the update.

Usage:
    python3 sync_from_bible_study.py [path-to-local-bible-study-clone]

With no argument, clones/pulls bible-study into .bible-study-src/
(gitignored) and syncs from there.
"""
import os
import shutil
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
SRC_CLONE_DIR = os.path.join(BASE_DIR, ".bible-study-src")
SOURCE_REPO = "https://github.com/younggrim/bible-study"

# Files that belong to THIS site and must survive the mirror, not get
# overwritten by bible-study's copies.
PRESERVE = {"CNAME", "newriver-videos.json"}


def get_source_docs_dir(path_arg):
    if path_arg:
        return os.path.join(path_arg, "docs")
    if os.path.isdir(SRC_CLONE_DIR):
        subprocess.run(["git", "-C", SRC_CLONE_DIR, "pull", "--ff-only"], check=True)
    else:
        subprocess.run(
            ["git", "clone", "--depth", "1", SOURCE_REPO, SRC_CLONE_DIR], check=True
        )
    return os.path.join(SRC_CLONE_DIR, "docs")


def main():
    path_arg = sys.argv[1] if len(sys.argv) > 1 else None
    src_docs = get_source_docs_dir(path_arg)
    if not os.path.isdir(src_docs):
        print(f"Source docs/ not found at {src_docs}")
        sys.exit(1)

    preserved = {}
    for name in PRESERVE:
        p = os.path.join(DOCS_DIR, name)
        if os.path.isfile(p):
            with open(p, "rb") as f:
                preserved[name] = f.read()

    if os.path.isdir(DOCS_DIR):
        shutil.rmtree(DOCS_DIR)
    shutil.copytree(src_docs, DOCS_DIR)

    for name, content in preserved.items():
        with open(os.path.join(DOCS_DIR, name), "wb") as f:
            f.write(content)

    if "newriver-videos.json" not in preserved:
        with open(os.path.join(DOCS_DIR, "newriver-videos.json"), "w") as f:
            f.write("{}\n")
        print("No existing newriver-videos.json found — wrote a fresh empty one.")

    print(f"Synced {src_docs} -> {DOCS_DIR}")
    print("Preserved:", ", ".join(sorted(preserved)) or "(none)")


if __name__ == "__main__":
    main()
