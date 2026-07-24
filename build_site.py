#!/usr/bin/env python3
"""
Bible Study Site Builder
========================
Reads .txt study notes and translation files, generates HTML pages
in the new design format. Run this after any content update.

Usage: python build_site.py
"""

import os
import re
import html

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "docs")

# Book data
OT_BOOKS = [
    ("01", "Genesis", 50), ("02", "Exodus", 40), ("03", "Leviticus", 27),
    ("04", "Numbers", 36), ("05", "Deuteronomy", 34), ("06", "Joshua", 24),
    ("07", "Judges", 21), ("08", "Ruth", 4), ("09", "1 Samuel", 31),
    ("10", "2 Samuel", 24), ("11", "1 Kings", 22), ("12", "2 Kings", 25),
    ("13", "1 Chronicles", 29), ("14", "2 Chronicles", 36), ("15", "Ezra", 10),
    ("16", "Nehemiah", 13), ("17", "Esther", 10), ("18", "Job", 42),
    ("19", "Psalms", 150), ("20", "Proverbs", 31), ("21", "Ecclesiastes", 12),
    ("22", "Song of Solomon", 8), ("23", "Isaiah", 66), ("24", "Jeremiah", 52),
    ("25", "Lamentations", 5), ("26", "Ezekiel", 48), ("27", "Daniel", 12),
    ("28", "Hosea", 14), ("29", "Joel", 3), ("30", "Amos", 9),
    ("31", "Obadiah", 1), ("32", "Jonah", 4), ("33", "Micah", 7),
    ("34", "Nahum", 3), ("35", "Habakkuk", 3), ("36", "Zephaniah", 3),
    ("37", "Haggai", 2), ("38", "Zechariah", 14), ("39", "Malachi", 4),
]

NT_BOOKS = [
    ("01", "Matthew", 28), ("02", "Mark", 16), ("03", "Luke", 24),
    ("04", "John", 21), ("05", "Acts", 28), ("06", "Romans", 16),
    ("07", "1 Corinthians", 16), ("08", "2 Corinthians", 13),
    ("09", "Galatians", 6), ("10", "Ephesians", 6), ("11", "Philippians", 4),
    ("12", "Colossians", 4), ("13", "1 Thessalonians", 5),
    ("14", "2 Thessalonians", 3), ("15", "1 Timothy", 6),
    ("16", "2 Timothy", 4), ("17", "Titus", 3), ("18", "Philemon", 1),
    ("19", "Hebrews", 13), ("20", "James", 5), ("21", "1 Peter", 5),
    ("22", "2 Peter", 3), ("23", "1 John", 5), ("24", "2 John", 1),
    ("25", "3 John", 1), ("26", "Jude", 1), ("27", "Revelation", 22),
]

def book_slug(name):
    """Convert book name to URL slug: '1 Corinthians' -> '1corinthians'"""
    return name.lower().replace(" ", "")


def read_file_safe(path):
    """Read a file, return empty string if not found."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


def parse_verses(text):
    """Parse translation text file into list of (number, text) tuples."""
    verses = []
    for line in text.strip().split("\n"):
        m = re.match(r"^(\d+)\.\s+(.+)$", line)
        if m:
            verses.append((m.group(1), m.group(2)))
    return verses


def parse_study_notes(text):
    """Parse study notes into sections dict."""
    sections = {}
    current_section = None
    current_lines = []

    for line in text.split("\n"):
        # Section headers are ALL CAPS followed by dashes
        if re.match(r"^[A-Z][A-Z &\-]+$", line.strip()) and len(line.strip()) > 3:
            if current_section:
                sections[current_section] = "\n".join(current_lines).strip()
            current_section = line.strip()
            current_lines = []
        elif line.strip().startswith("----"):
            continue
        elif current_section:
            current_lines.append(line)

    if current_section:
        sections[current_section] = "\n".join(current_lines).strip()

    return sections


def escape(text):
    """HTML escape."""
    return html.escape(text)

def render_verses_html(verses):
    """Render verses as HTML paragraphs."""
    lines = []
    for num, text in verses:
        lines.append(f'            <p class="verse"><span class="verse-num">{num}</span>{escape(text)}</p>')
    return "\n".join(lines)


def render_section_as_list(text):
    """Render a text section as HTML list items."""
    # First try splitting on lines that start with v.X pattern (cross-references)
    # This handles cases where entries aren't separated by blank lines
    lines = text.strip().split("\n")
    items = []
    current = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                items.append(" ".join(current))
                current = []
        elif re.match(r'^v\.?\d', stripped) and current:
            # New verse reference starts - save previous and start new
            items.append(" ".join(current))
            current = [stripped]
        else:
            current.append(stripped)
    if current:
        items.append(" ".join(current))

    html_items = []
    for item in items:
        if item:
            # Convert URLs to links first (show clean domain name)
            item = re.sub(r'(https?://)([^/\s]+)(/\S*)', r'<a href="\1\2\3" target="_blank">\2</a>', item)
            # Bold commentary source names (like "Enduring Word (David Guzik):")
            item = re.sub(r'^([A-Z][^:]+:)\s*', r'<strong>\1</strong> ', item)
            # Format cross-reference pattern: v.X — Reference — "quote"
            item = re.sub(r'^(v\.?\d+\S*)\s*[—–-]\s*', r'<strong>\1</strong> → ', item)
            # Bold standalone scripture references at start
            item = re.sub(r'^(\d?\s?[A-Z][a-z]+ \d+[:\d\-,]*)\s*[—–-]\s*', r'<strong>\1</strong> — ', item)
            # Bold translation abbreviations (KJV, ESV, ASV, NET, WEB)
            item = re.sub(r'\b(KJV|ESV|ASV|NET|WEB):', r'<strong>\1:</strong>', item)
            # Convert / between translations to arrow
            item = re.sub(r'\s*/\s*(?=(KJV|ESV|ASV|NET|WEB|<strong>))', r' → ', item)
            html_items.append(f"                    <li>{item}</li>")
    return "\n".join(html_items)



def render_video_cards(text, chapter_num=None):
    """Render video resources as styled cards, filtering by chapter range when applicable."""
    cards = []
    entries = re.split(r'\n(?=\S)', text.strip())
    for entry in entries:
        if not entry.strip():
            continue
        lines = entry.strip().split("\n")
        title = lines[0].rstrip(":")
        url = ""
        desc_lines = []
        candidate_urls = []  # list of (url, range_start, range_end) tuples

        for line in lines[1:]:
            line = line.strip()
            url_match = re.match(r'(https?://\S+)', line)
            if url_match:
                found_url = url_match.group(1)
                # Check if there's a chapter range indicator like (Chapters 1-11)
                range_match = re.search(r'\(Chapters?\s*(\d+)\s*[-–]\s*(\d+)\)', line)
                if range_match:
                    range_start = int(range_match.group(1))
                    range_end = int(range_match.group(2))
                    candidate_urls.append((found_url, range_start, range_end))
                else:
                    candidate_urls.append((found_url, None, None))
            elif line and not line.startswith("http"):
                desc_lines.append(line)

        # If we have chapter-range URLs, pick the one matching the current chapter
        if candidate_urls and chapter_num is not None:
            # Filter to matching range, or fall back to non-ranged URLs
            matching = [(u, s, e) for u, s, e in candidate_urls
                       if s is not None and s <= chapter_num <= e]
            non_ranged = [(u, s, e) for u, s, e in candidate_urls if s is None]

            if matching:
                url = matching[0][0]
            elif non_ranged:
                url = non_ranged[0][0]
            else:
                # No matching range for this chapter — skip this video entry
                continue
        elif candidate_urls:
            url = candidate_urls[0][0]

        desc = " ".join(desc_lines)
        if title:
            link = f'<a href="{url}" target="_blank">{escape(title)}</a>' if url else escape(title)
            cards.append(f'''                <div class="video-card">
                    <div class="video-card-icon"><i class="fab fa-youtube"></i></div>
                    <div class="video-card-info">
                        <h4>{link}</h4>
                        <p>{escape(desc)}</p>
                    </div>
                </div>''')
    return "\n".join(cards)


# Wikipedia links for common biblical locations
LOCATION_WIKI_LINKS = {
    "jerusalem": "https://en.wikipedia.org/wiki/Jerusalem",
    "bethlehem": "https://en.wikipedia.org/wiki/Bethlehem",
    "nazareth": "https://en.wikipedia.org/wiki/Nazareth",
    "capernaum": "https://en.wikipedia.org/wiki/Capernaum",
    "sea of galilee": "https://en.wikipedia.org/wiki/Sea_of_Galilee",
    "galilee": "https://en.wikipedia.org/wiki/Galilee",
    "jordan river": "https://en.wikipedia.org/wiki/Jordan_River",
    "jordan": "https://en.wikipedia.org/wiki/Jordan_River",
    "egypt": "https://en.wikipedia.org/wiki/Ancient_Egypt",
    "nile": "https://en.wikipedia.org/wiki/Nile",
    "nile river": "https://en.wikipedia.org/wiki/Nile",
    "sinai": "https://en.wikipedia.org/wiki/Mount_Sinai",
    "mount sinai": "https://en.wikipedia.org/wiki/Mount_Sinai",
    "horeb": "https://en.wikipedia.org/wiki/Mount_Sinai",
    "mount horeb": "https://en.wikipedia.org/wiki/Mount_Sinai",
    "babylon": "https://en.wikipedia.org/wiki/Babylon",
    "assyria": "https://en.wikipedia.org/wiki/Assyria",
    "persia": "https://en.wikipedia.org/wiki/Achaemenid_Empire",
    "rome": "https://en.wikipedia.org/wiki/Ancient_Rome",
    "ephesus": "https://en.wikipedia.org/wiki/Ephesus",
    "corinth": "https://en.wikipedia.org/wiki/Ancient_Corinth",
    "antioch": "https://en.wikipedia.org/wiki/Antioch",
    "damascus": "https://en.wikipedia.org/wiki/Damascus",
    "samaria": "https://en.wikipedia.org/wiki/Samaria",
    "jericho": "https://en.wikipedia.org/wiki/Jericho",
    "bethany": "https://en.wikipedia.org/wiki/Bethany_(biblical_village)",
    "mount of olives": "https://en.wikipedia.org/wiki/Mount_of_Olives",
    "mount olives": "https://en.wikipedia.org/wiki/Mount_of_Olives",
    "gethsemane": "https://en.wikipedia.org/wiki/Gethsemane",
    "golgotha": "https://en.wikipedia.org/wiki/Calvary",
    "calvary": "https://en.wikipedia.org/wiki/Calvary",
    "dead sea": "https://en.wikipedia.org/wiki/Dead_Sea",
    "red sea": "https://en.wikipedia.org/wiki/Red_Sea",
    "mount hermon": "https://en.wikipedia.org/wiki/Mount_Hermon",
    "tyre": "https://en.wikipedia.org/wiki/Tyre,_Lebanon",
    "sidon": "https://en.wikipedia.org/wiki/Sidon",
    "caesarea philippi": "https://en.wikipedia.org/wiki/Caesarea_Philippi",
    "caesarea": "https://en.wikipedia.org/wiki/Caesarea_Maritima",
    "decapolis": "https://en.wikipedia.org/wiki/Decapolis",
    "phoenicia": "https://en.wikipedia.org/wiki/Phoenicia",
    "kidron valley": "https://en.wikipedia.org/wiki/Kidron_Valley",
    "temple mount": "https://en.wikipedia.org/wiki/Temple_Mount",
    "hebron": "https://en.wikipedia.org/wiki/Hebron",
    "beersheba": "https://en.wikipedia.org/wiki/Beersheba",
    "shechem": "https://en.wikipedia.org/wiki/Shechem",
    "bethel": "https://en.wikipedia.org/wiki/Bethel",
    "shiloh": "https://en.wikipedia.org/wiki/Shiloh_(biblical_city)",
    "ur": "https://en.wikipedia.org/wiki/Ur",
    "haran": "https://en.wikipedia.org/wiki/Harran",
    "canaan": "https://en.wikipedia.org/wiki/Canaan",
    "philistia": "https://en.wikipedia.org/wiki/Philistia",
    "moab": "https://en.wikipedia.org/wiki/Moab",
    "edom": "https://en.wikipedia.org/wiki/Edom",
    "ammon": "https://en.wikipedia.org/wiki/Ammon",
    "nineveh": "https://en.wikipedia.org/wiki/Nineveh",
    "tarshish": "https://en.wikipedia.org/wiki/Tarshish",
    "patmos": "https://en.wikipedia.org/wiki/Patmos",
    "thessalonica": "https://en.wikipedia.org/wiki/Thessaloniki",
    "philippi": "https://en.wikipedia.org/wiki/Philippi",
    "galatia": "https://en.wikipedia.org/wiki/Galatia",
    "colossae": "https://en.wikipedia.org/wiki/Colossae",
    "crete": "https://en.wikipedia.org/wiki/Crete",
    "malta": "https://en.wikipedia.org/wiki/Malta",
    "athens": "https://en.wikipedia.org/wiki/Athens",
    "mount carmel": "https://en.wikipedia.org/wiki/Mount_Carmel",
    "mount zion": "https://en.wikipedia.org/wiki/Mount_Zion",
    "petra": "https://en.wikipedia.org/wiki/Petra",
    "tigris": "https://en.wikipedia.org/wiki/Tigris",
    "euphrates": "https://en.wikipedia.org/wiki/Euphrates",
    "mediterranean": "https://en.wikipedia.org/wiki/Mediterranean_Sea",
    "perea": "https://en.wikipedia.org/wiki/Perea",
    "idumea": "https://en.wikipedia.org/wiki/Idumea",
    "wilderness of judea": "https://en.wikipedia.org/wiki/Judean_Desert",
    "judean wilderness": "https://en.wikipedia.org/wiki/Judean_Desert",
    "mount tabor": "https://en.wikipedia.org/wiki/Mount_Tabor",
    "dan": "https://en.wikipedia.org/wiki/Tel_Dan",
    "megiddo": "https://en.wikipedia.org/wiki/Megiddo",
    "armageddon": "https://en.wikipedia.org/wiki/Tel_Megiddo",
    "carchemish": "https://en.wikipedia.org/wiki/Carchemish",
    "thebes": "https://en.wikipedia.org/wiki/Thebes,_Egypt",
    "memphis": "https://en.wikipedia.org/wiki/Memphis,_Egypt",
    "heshbon": "https://en.wikipedia.org/wiki/Heshbon",
    "gilead": "https://en.wikipedia.org/wiki/Gilead",
    "bashan": "https://en.wikipedia.org/wiki/Bashan",
    "lebanon": "https://en.wikipedia.org/wiki/Lebanon",
    "mount nebo": "https://en.wikipedia.org/wiki/Mount_Nebo",
    "midian": "https://en.wikipedia.org/wiki/Midian",
    "gaza": "https://en.wikipedia.org/wiki/Gaza_City",
    "tekoa": "https://en.wikipedia.org/wiki/Tekoa,_Gush_Etzion",
}


def render_authorship(text):
    """Render authorship & historical background with bold colored labels and nested lists."""
    lines = text.strip().split("\n")
    html_parts = []
    current_paragraph = []
    in_sublist = False
    sublist_items = []

    def flush_paragraph():
        """Process accumulated paragraph lines into HTML."""
        if not current_paragraph:
            return
        joined = " ".join(current_paragraph)
        current_paragraph.clear()

        # Check if paragraph has a label like "Author:", "Title:", "Purpose:", etc.
        label_match = re.match(r'^([A-Za-z][^:]{2,50}):\s*(.+)', joined)
        if label_match:
            label = label_match.group(1).strip()
            content = label_match.group(2).strip()
            html_parts.append(
                f'                    <div class="auth-item">'
                f'<span class="auth-label">{escape(label)}:</span> '
                f'{escape(content)}</div>'
            )
        else:
            html_parts.append(f'                    <div class="auth-item">{escape(joined)}</div>')

    def flush_sublist():
        """Process accumulated sublist items into HTML."""
        if not sublist_items:
            return
        html_parts.append('                    <ul class="auth-sublist">')
        for item in sublist_items:
            html_parts.append(f'                        <li>{escape(item)}</li>')
        html_parts.append('                    </ul>')
        sublist_items.clear()

    for line in lines:
        stripped = line.strip()

        if not stripped:
            # Blank line — flush current paragraph
            if in_sublist:
                flush_sublist()
                in_sublist = False
            else:
                flush_paragraph()
            continue

        # Check if line is a sub-list item (starts with - or •)
        if stripped.startswith('-') or stripped.startswith('•'):
            # Flush any pending paragraph first
            if current_paragraph:
                flush_paragraph()
            in_sublist = True
            sublist_items.append(stripped.lstrip('-•').strip())
            continue

        # Check if line is indented continuation of a sub-list item
        if in_sublist and (line.startswith('  ') or line.startswith('\t')):
            # Append to last sublist item
            if sublist_items:
                sublist_items[-1] += ' ' + stripped
            continue

        # Regular line — if we were in a sublist, flush it
        if in_sublist:
            flush_sublist()
            in_sublist = False

        current_paragraph.append(stripped)

    # Flush remaining content
    if in_sublist:
        flush_sublist()
    if current_paragraph:
        flush_paragraph()

    if html_parts:
        return "\n".join(html_parts)
    return "<p>No authorship information available for this chapter.</p>"


def render_map_geography(text):
    """Render map & geography notes as a list with Wikipedia links for locations."""
    lines = text.strip().split("\n")
    items = []
    current = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                items.append(" ".join(current))
                current = []
        elif stripped.startswith("-") or stripped.startswith("•"):
            if current:
                items.append(" ".join(current))
            current = [stripped.lstrip("-•").strip()]
        else:
            current.append(stripped)
    if current:
        items.append(" ".join(current))

    html_items = []
    for item in items:
        if not item:
            continue
        escaped_item = escape(item)
        # Try to link known locations - case insensitive matching with word boundaries
        for location, wiki_url in sorted(LOCATION_WIKI_LINKS.items(), key=lambda x: -len(x[0])):
            # Skip very short location names (3 chars or less) to avoid false matches
            if len(location) <= 3:
                continue
            # Use word boundary matching on the escaped text
            pattern = re.compile(r'\b' + re.escape(escape(location)) + r'\b', re.IGNORECASE)
            match = pattern.search(escaped_item)
            if match:
                matched_text = match.group(0)
                # Don't link if already inside an <a> tag
                before = escaped_item[:match.start()]
                if '<a ' in before and before.count('<a ') > before.count('</a>'):
                    continue
                escaped_item = escaped_item[:match.start()] + \
                    f'<a href="{wiki_url}" target="_blank" style="color:#8b3a2a;text-decoration:none;border-bottom:1px dotted #8b3a2a;">{matched_text}</a>' + \
                    escaped_item[match.end():]
        html_items.append(f"                    <li>{escaped_item}</li>")

    if html_items:
        return "<ul>\n" + "\n".join(html_items) + "\n                </ul>"
    return "<p>No geography notes available for this chapter.</p>"



def build_left_sidebar(testament, book_name, chapter_num, total_chapters):
    """Build the left sidebar HTML with book list and chapter grid."""
    ot_items = []
    nt_items = []

    for num, name, chapters in OT_BOOKS:
        active = " active" if testament == "Old Testament" and name == book_name else ""
        ot_items.append(f'            <a class="sidebar-item{active}" href="{book_slug(name)}1.html"><i class="fas fa-book"></i> {name}</a>')
        if active:
            # Show chapter grid for active book
            grid = '            <div class="chapter-grid">\n'
            for c in range(1, total_chapters + 1):
                c_active = " active" if c == chapter_num else ""
                grid += f'                <a class="chapter-btn{c_active}" href="{book_slug(name)}{c}.html">{c}</a>\n'
            grid += '            </div>'
            ot_items.append(grid)

    for num, name, chapters in NT_BOOKS:
        active = " active" if testament == "New Testament" and name == book_name else ""
        nt_items.append(f'            <a class="sidebar-item{active}" href="{book_slug(name)}1.html"><i class="fas fa-book"></i> {name}</a>')
        if active:
            grid = '            <div class="chapter-grid">\n'
            for c in range(1, total_chapters + 1):
                c_active = " active" if c == chapter_num else ""
                grid += f'                <a class="chapter-btn{c_active}" href="{book_slug(name)}{c}.html">{c}</a>\n'
            grid += '            </div>'
            nt_items.append(grid)

    return f'''    <aside class="left-sidebar">
        <div class="sidebar-section">
            <a class="sidebar-item sidebar-home" href="index.html"><i class="fas fa-home"></i> Home</a>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-title">Old Testament</div>
{chr(10).join(ot_items)}
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-title">New Testament</div>
{chr(10).join(nt_items)}
        </div>
    </aside>'''

RIGHT_PANEL = ''

def build_page(testament, book_num, book_name, chapter_num, total_chapters):
    """Build a complete HTML page for one chapter."""
    folder = f"{book_num} - {book_name}"
    chapter_dir = os.path.join(BASE_DIR, testament, folder, f"Chapter {chapter_num}")

    # Read all translations
    translations = ["ESV", "KJV", "ASV", "NET", "WEB"]
    all_verses = {}
    for trans in translations:
        text = read_file_safe(os.path.join(chapter_dir, f"Chapter {chapter_num} - {trans}.txt"))
        all_verses[trans] = parse_verses(text)

    # Build verse HTML for each translation
    verses_html_blocks = {}
    for trans in translations:
        if all_verses[trans]:
            verses_html_blocks[trans] = render_verses_html(all_verses[trans])
        else:
            verses_html_blocks[trans] = '<p class="verse" style="color:var(--text-muted);font-style:italic;">This translation is not yet available for this chapter.</p>'

    # Read study notes
    notes_text = read_file_safe(os.path.join(chapter_dir, f"Chapter {chapter_num} - Study Notes.txt"))
    sections = parse_study_notes(notes_text)

    # Build verse HTML
    verses_html = ""
    for trans in translations:
        active = " active" if trans == "ESV" else ""
        if trans == "ESV":
            # ESV is loaded dynamically via API — render a placeholder with the passage reference
            # Single-chapter books (Obadiah, Philemon, 2/3 John, Jude): the ESV API reads
            # "Book 1" as verse 1, not chapter 1, so the book name alone must be used to
            # get the full chapter.
            esv_passage = book_name if total_chapters == 1 else f"{book_name} {chapter_num}"
            verses_html += f'        <div class="translation-block{active}" data-translation="ESV" data-passage="{esv_passage}">\n            <p class="verse esv-loading" style="color:var(--text-muted);font-style:italic;">Loading ESV text...</p>\n        </div>\n'
        else:
            verses_html += f'        <div class="translation-block{active}" data-translation="{trans}">\n{verses_html_blocks[trans]}\n        </div>\n'

    # Build study note tabs
    summary = sections.get("CHAPTER SUMMARY", "")
    authorship = sections.get("AUTHORSHIP & HISTORICAL BACKGROUND", "")
    map_geo = sections.get("MAP & GEOGRAPHY NOTES", "")
    commentary = sections.get("COMMENTARY REFERENCES", "")
    videos = sections.get("VIDEO RESOURCES", "")
    all_reflection = sections.get("REFLECTION", "")

    # Build tabs (only show tabs that have content)
    tabs_html = ""
    tab_headers = []

    if summary:
        tab_headers.append(('summary', 'Summary'))
    if authorship:
        tab_headers.append(('authorship', 'Authorship & Background'))
    if map_geo:
        tab_headers.append(('mapgeo', 'Map & Geography'))
    if commentary:
        tab_headers.append(('commentary', 'Commentary'))
    if videos:
        tab_headers.append(('videos', 'Videos'))
    if all_reflection:
        tab_headers.append(('reflection', 'Reflection'))

    # Tab header bar
    tab_bar = ""
    for i, (tid, label) in enumerate(tab_headers):
        active = " active" if i == 0 else ""
        tab_bar += f'                <div class="study-tab{active}" data-tab="{tid}">{label}</div>\n'

    # Tab content panels
    tab_panels = ""
    for i, (tid, label) in enumerate(tab_headers):
        active = " active" if i == 0 else ""
        if tid == "summary":
            content = f"<p>{escape(summary)}</p>"
        elif tid == "authorship":
            content = render_authorship(authorship)
        elif tid == "mapgeo":
            content = render_map_geography(map_geo)
        elif tid == "commentary":
            content = f"<ul>\n{render_section_as_list(commentary)}\n                </ul>"
        elif tid == "videos":
            content = render_video_cards(videos, chapter_num)
        elif tid == "reflection":
            content = f"<ul>\n{render_section_as_list(all_reflection)}\n                </ul>"
        else:
            content = ""

        tab_panels += f'''            <div class="tab-content{active}" id="tab-{tid}">
                <h3>{label}</h3>
                {content}
            </div>\n'''

    left_sidebar = build_left_sidebar(testament, book_name, chapter_num, total_chapters)

    return build_html_page(book_name, chapter_num, total_chapters, verses_html, tab_bar, tab_panels, left_sidebar)

def build_html_page(book_name, chapter_num, total_chapters, verses_html, tab_bar, tab_panels, left_sidebar):
    """Assemble the full HTML page."""
    nav_html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>''' + f'{book_name} {chapter_num}' + ''' — Bible Study</title>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Inter:wght@400;500;600;700&family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="site/style.css?v=10">
</head>
<body>
    <nav class="top-nav">
        <button class="hamburger" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
        <a href="index.html" class="nav-home-btn" title="Home"><i class="fas fa-home"></i></a>
        <a href="index.html" class="nav-brand">Bible Study</a>
        <div class="nav-center">
            <select class="nav-book-select" id="bookSelect" onchange="updateChapters()">
                <optgroup label="Old Testament">'''

    for _, name, chapters in OT_BOOKS:
        selected = ' selected' if name == book_name else ''
        nav_html += f'\n                    <option value="{book_slug(name)}" data-chapters="{chapters}"{selected}>{name}</option>'

    nav_html += '''
                </optgroup>
                <optgroup label="New Testament">'''

    for _, name, chapters in NT_BOOKS:
        selected = ' selected' if name == book_name else ''
        nav_html += f'\n                    <option value="{book_slug(name)}" data-chapters="{chapters}"{selected}>{name}</option>'

    nav_html += f'''
                </optgroup>
            </select>
            <select class="nav-chapter-select" id="chapterSelect">'''

    for c in range(1, total_chapters + 1):
        selected = ' selected' if c == chapter_num else ''
        nav_html += f'\n                <option value="{c}"{selected}>Ch {c}</option>'

    nav_html += '''
            </select>
            <button onclick="goToChapter()" style="padding:6px 12px;background:#8b3a2a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:600;">Go</button>
            <select class="nav-translation" onchange="switchTranslation(this.value)">
                <option value="ESV">ESV</option>
                <option value="KJV">KJV</option>
                <option value="ASV">ASV</option>
                <option value="NET">NET</option>
                <option value="WEB">WEB</option>
            </select>
        </div>
    </nav>

    <div class="sidebar-overlay" onclick="toggleSidebar()"></div>

''' + left_sidebar + f'''

    <main class="main-content">
        <div class="book-header">
            <h1>{book_name} — Chapter {chapter_num}</h1>
        </div>

        <div class="scripture-container">
{verses_html}
        </div>

        <div class="study-section">
            <div class="study-tabs">
{tab_bar}            </div>
{tab_panels}        </div>
    </main>

    <footer style="text-align:center;padding:20px 16px;font-size:0.7rem;color:#8a7e74;line-height:1.8;border-top:1px solid #e0d6c8;margin-top:32px;">
        <p>Scripture quotations marked (ESV) are from the ESV Bible (The Holy Bible, English Standard Version), copyright 2001 by Crossway. Used via API per Crossway Conditions of Use.</p>
        <p>Scripture quoted by permission. Quotations designated (NET) are from the NET Bible&reg; copyright &copy;1996, 2019 by Biblical Studies Press, L.L.C. <a href="http://netbible.com" style="color:#8a7e74;">netbible.com</a> All rights reserved.</p>
        <p>KJV, ASV, and WEB texts are in the public domain.</p>
    </footer>

    <script src="site/script.js?v=13"></script>
</body>
</html>'''

    return nav_html

def build_index():
    """Build the homepage."""
    # Color palette for book cards - cycles through warm, scholarly colors
    ot_colors = [
        "#8b3a2a", "#2c6b4f", "#4a5a8a", "#7a5c2e", "#5c3d6e",
        "#2a6b6b", "#8b6914", "#6b4c3b", "#3d6b3d", "#6b2a4a",
        "#4a7a6b", "#7a3d5c", "#2c5a7a", "#6b6b2a", "#5c2a2a",
        "#3d5c6b", "#6b5c3d", "#4a3d7a", "#7a6b4a", "#2a4a6b",
        "#6b3d2a", "#3d7a5c", "#5c4a7a", "#7a4a3d", "#2a6b5c",
        "#4a6b3d", "#7a2a5c", "#3d6b7a", "#6b4a2a", "#5c7a3d",
        "#2a5c6b", "#7a5c2a", "#4a2a6b", "#6b7a4a", "#3d2a7a",
        "#5c6b4a", "#7a3d2a", "#2a7a5c", "#6b2a3d",
    ]
    nt_colors = [
        "#8b3a2a", "#2c6b4f", "#4a5a8a", "#7a5c2e", "#5c3d6e",
        "#2a6b6b", "#8b6914", "#6b4c3b", "#3d6b3d", "#6b2a4a",
        "#4a7a6b", "#7a3d5c", "#2c5a7a", "#6b6b2a", "#5c2a2a",
        "#3d5c6b", "#6b5c3d", "#4a3d7a", "#7a6b4a", "#2a4a6b",
        "#6b3d2a", "#3d7a5c", "#5c4a7a", "#7a4a3d", "#2a6b5c",
        "#4a6b3d", "#7a2a5c",
    ]

    ot_cards = ""
    for i, (_, name, _) in enumerate(OT_BOOKS):
        ot_cards += f'                        <a class="book-link" href="{book_slug(name)}1.html">{name}</a>\n'

    nt_cards = ""
    for i, (_, name, _) in enumerate(NT_BOOKS):
        nt_cards += f'                        <a class="book-link nt-link" href="{book_slug(name)}1.html">{name}</a>\n'

    from homepage_template import HOMEPAGE_TEMPLATE
    return HOMEPAGE_TEMPLATE.format(ot_cards=ot_cards, nt_cards=nt_cards)


def main():
    """Build the entire site."""
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "site"), exist_ok=True)

    # Copy shared assets
    import shutil
    shutil.copy2(os.path.join(BASE_DIR, "site", "style.css"), os.path.join(OUTPUT_DIR, "site", "style.css"))
    shutil.copy2(os.path.join(BASE_DIR, "site", "script.js"), os.path.join(OUTPUT_DIR, "site", "script.js"))

    # Build index page
    index_html = build_index()
    with open(os.path.join(OUTPUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html)
    print("Built: index.html")

    # Build all OT chapters
    count = 0
    for num, name, chapters in OT_BOOKS:
        for ch in range(1, chapters + 1):
            page_html = build_page("Old Testament", num, name, ch, chapters)
            filename = f"{book_slug(name)}{ch}.html"
            with open(os.path.join(OUTPUT_DIR, filename), "w", encoding="utf-8") as f:
                f.write(page_html)
            count += 1

    # Build all NT chapters
    for num, name, chapters in NT_BOOKS:
        for ch in range(1, chapters + 1):
            page_html = build_page("New Testament", num, name, ch, chapters)
            filename = f"{book_slug(name)}{ch}.html"
            with open(os.path.join(OUTPUT_DIR, filename), "w", encoding="utf-8") as f:
                f.write(page_html)
            count += 1

    print(f"\nDone! Built {count} chapter pages + index.html")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"\nTo preview: open {OUTPUT_DIR}/index.html")
    print("To deploy: copy contents of docs/ to your GitHub Pages root, or configure GitHub Pages to serve from docs/")


if __name__ == "__main__":
    main()
