/* Highlights, bookmarks and "pick up where you left off".

   On a chapter page:
     - tap a verse (any translation) to select it; tap more to add to the
       selection; the sheet that opens highlights them in one of four colours,
       bookmarks them, or clears them. Marks belong to the verse, not the
       translation, so a verse highlighted in the ESV stays highlighted in
       the KJV.
     - the verse at the top of the screen is remembered as you read, so the
       next visit can jump straight back to it.
     - a link ending #v20 opens the chapter at verse 20.
   On the home page: a "Continue reading" card, with bookmarks and highlights.

   Everything works with no account: it is kept in localStorage. Signed in
   (site/account.js), it is also kept in the verse_marks and reading_position
   tables and follows the person to every device. Nothing here loads the
   Supabase library for a visitor who has never signed in.

   Kept identical in both repositories, and deliberately does not touch
   site/script.js or site/style.css, the two files the New River sync
   preserves rather than mirrors.                                           */
(function () {
    'use strict';

    var BOOKS = [['genesis',50],['exodus',40],['leviticus',27],['numbers',36],['deuteronomy',34],['joshua',24],['judges',21],['ruth',4],['1samuel',31],['2samuel',24],['1kings',22],['2kings',25],['1chronicles',29],['2chronicles',36],['ezra',10],['nehemiah',13],['esther',10],['job',42],['psalms',150],['proverbs',31],['ecclesiastes',12],['songofsolomon',8],['isaiah',66],['jeremiah',52],['lamentations',5],['ezekiel',48],['daniel',12],['hosea',14],['joel',3],['amos',9],['obadiah',1],['jonah',4],['micah',7],['nahum',3],['habakkuk',3],['zephaniah',3],['haggai',2],['zechariah',14],['malachi',4],['matthew',28],['mark',16],['luke',24],['john',21],['acts',28],['romans',16],['1corinthians',16],['2corinthians',13],['galatians',6],['ephesians',6],['philippians',4],['colossians',4],['1thessalonians',5],['2thessalonians',3],['1timothy',6],['2timothy',4],['titus',3],['philemon',1],['hebrews',13],['james',5],['1peter',5],['2peter',3],['1john',5],['2john',1],['3john',1],['jude',1],['revelation',22]];
    var BOOK_ORDER = {};
    BOOKS.forEach(function (b, i) { BOOK_ORDER[b[0]] = i; });

    var COLORS = ['yellow', 'green', 'blue', 'pink'];
    var K_MARKS = 'bs-marks', K_POS = 'bs-position', K_CURSOR = 'bs-marks-cursor', K_OWNER = 'bs-study-owner';

    /* ---------- small helpers ---------- */

    function load(key, fallback) {
        try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
    }
    function save(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }
    function bookLabel(slug) {
        return slug.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon')
            .replace(/\b(?!of\b)[a-z]/g, function (m) { return m.toUpperCase(); });
    }
    function parsePage(name) {
        var m = /^(\d?[a-z]+?)(\d+)$/.exec(name || '');
        if (!m || !(m[1] in BOOK_ORDER)) return null;
        var ch = parseInt(m[2], 10);
        if (ch < 1 || ch > BOOKS[BOOK_ORDER[m[1]]][1]) return null;
        return { book: m[1], chapter: ch };
    }
    function keyOf(book, chapter, verse) { return book + '|' + chapter + '|' + verse; }
    function splitKey(k) { var p = k.split('|'); return { book: p[0], chapter: +p[1], verse: +p[2] }; }
    function refText(book, chapter, verses) {
        var s = bookLabel(book) + ' ' + chapter;
        if (!verses || !verses.length) return s;
        verses = verses.slice().sort(function (a, b) { return a - b; });
        var parts = [], start = verses[0], prev = verses[0];
        for (var i = 1; i <= verses.length; i++) {
            if (verses[i] === prev + 1) { prev = verses[i]; continue; }
            parts.push(start === prev ? String(start) : start + '–' + prev);
            start = prev = verses[i];
        }
        return s + ':' + parts.join(', ');
    }
    function el(tag, attrs, children) {
        var n = document.createElement(tag), k;
        for (k in attrs || {}) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'class') n.className = attrs[k];
            else n.setAttribute(k, attrs[k]);
        }
        (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return n;
    }
    function ago(ms) {
        var m = Math.round((Date.now() - ms) / 60000);
        if (m < 2) return 'just now';
        if (m < 60) return m + ' minutes ago';
        var h = Math.round(m / 60);
        if (h < 24) return h === 1 ? 'an hour ago' : h + ' hours ago';
        var d = Math.round(h / 24);
        return d === 1 ? 'yesterday' : d + ' days ago';
    }

    /* ---------- styles ---------- */

    var STYLE = ''
        + '[data-v]{cursor:pointer;scroll-margin-top:130px;border-radius:3px;transition:background-color .15s}'
        + '.hl-yellow{background:rgba(255,214,10,.42)}.hl-green{background:rgba(110,200,120,.38)}'
        + '.hl-blue{background:rgba(100,170,240,.36)}.hl-pink{background:rgba(240,120,170,.34)}'
        + '[data-v].vsel{box-shadow:inset 0 -2px 0 var(--accent-link);background-color:rgba(0,0,0,.06)}'
        + '.hl-yellow.vsel{background:rgba(255,214,10,.42)}.hl-green.vsel{background:rgba(110,200,120,.38)}'
        + '.hl-blue.vsel{background:rgba(100,170,240,.36)}.hl-pink.vsel{background:rgba(240,120,170,.34)}'
        + '[data-v].vflash{animation:bsflash 2.2s ease-out}'
        + '@keyframes bsflash{0%,30%{background-color:rgba(255,214,10,.6)}100%{background-color:transparent}}'
        + '.bs-bm{display:inline-block;color:var(--accent-link);font-size:.7em;margin-right:4px;vertical-align:.15em}'
        + '.bs-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9000;display:flex;justify-content:center;pointer-events:none}'
        + 'body.pwa-standalone .bs-sheet{bottom:calc(64px + env(safe-area-inset-bottom,0px))}'
        + '.bs-sheet-in{pointer-events:auto;background:#fff;color:var(--ink-deep);width:100%;max-width:520px;border:1px solid var(--border-light);border-bottom:0;border-radius:14px 14px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.14);padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));font-family:"Inter",-apple-system,sans-serif}'
        + 'body.pwa-standalone .bs-sheet-in{padding-bottom:14px}'
        + '.bs-sheet-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}'
        + '.bs-sheet-ref{font-weight:700;font-size:.95rem}'
        + '.bs-x{background:none;border:0;font-size:1.5rem;line-height:1;color:var(--text-faint);cursor:pointer;padding:2px 6px}'
        + '.bs-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
        + '.bs-dot{width:36px;height:36px;border-radius:50%;border:2px solid transparent;cursor:pointer}'
        + '.bs-dot.on{border-color:var(--ink-deep)}'
        + '.bs-dot.yellow{background:#ffd60a}.bs-dot.green{background:#6ec878}.bs-dot.blue{background:#64aaf0}.bs-dot.pink{background:#f078aa}'
        + '.bs-act{font-family:inherit;font-size:.85rem;font-weight:600;padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-tint);color:var(--ink-deep);cursor:pointer}'
        + '.bs-act i{color:var(--accent-link);margin-right:5px}'
        + '.bs-note{font-size:.78rem;color:var(--text-faint);margin:10px 0 0}'
        + '.bs-link{background:none;border:0;padding:0;font:inherit;color:var(--accent-link);text-decoration:underline;cursor:pointer}'
        + '.bs-dot:focus-visible,.bs-act:focus-visible,.bs-x:focus-visible,.bs-link:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
        + '.bs-home{max-width:640px;margin:28px auto 0;padding:0 16px}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-home{margin:0 0 22px;padding:0;text-align:left}'
        + '.bs-card{background:#fff;border:1px solid var(--border-light);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.06);padding:20px 20px 16px;font-family:"Inter",-apple-system,sans-serif;color:var(--ink-deep)}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-card{box-shadow:none;background:var(--bg-tint-2)}'
        + '.bs-eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);margin:0 0 6px}'
        + '.bs-resume{display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;color:inherit}'
        + '.bs-resume strong{display:block;font-family:"Poppins","Inter",sans-serif;font-size:1.2rem}'
        + '.bs-resume small{color:var(--text-faint);font-size:.8rem}'
        + '.bs-go{flex-shrink:0;background:var(--accent-link);color:#fff;border-radius:8px;padding:10px 14px;font-weight:600;font-size:.9rem}'
        + '.bs-tabs{display:flex;gap:16px;margin:16px 0 8px;border-top:1px solid var(--rule-soft);padding-top:12px}'
        + '.bs-tab{background:none;border:0;padding:4px 0;font:inherit;font-size:.85rem;font-weight:600;color:var(--text-faint);cursor:pointer;border-bottom:2px solid transparent}'
        + '.bs-tab[aria-selected="true"]{color:var(--ink-deep);border-bottom-color:var(--accent-link)}'
        + '.bs-list{list-style:none;margin:0;padding:0}'
        + '.bs-list li{border-bottom:1px solid var(--rule-soft)}.bs-list li:last-child{border-bottom:0}'
        + '.bs-list a{display:flex;align-items:center;gap:10px;padding:9px 2px;color:var(--ink-deep);text-decoration:none;font-size:.92rem}'
        + '.bs-list .sw{width:12px;height:12px;border-radius:50%;flex-shrink:0}'
        + '.bs-list .sw.yellow{background:#ffd60a}.bs-list .sw.green{background:#6ec878}.bs-list .sw.blue{background:#64aaf0}.bs-list .sw.pink{background:#f078aa}'
        + '.bs-empty{font-size:.85rem;color:var(--text-faint);margin:6px 0}';

    function injectStyle() {
        if (!document.getElementById('bs-study-style')) document.head.appendChild(el('style', { id: 'bs-study-style', text: STYLE }));
    }

    /* ---------- local state ---------- */

    // marks: { "luke|6|20": { c: "yellow"|null, b: true|false, t: ms, dirty: true } }
    var marks = load(K_MARKS, {});
    if (typeof marks !== 'object' || Array.isArray(marks)) marks = {};
    // position: { page: "luke6", verse: 20|null, t: ms, dirty: true }
    var position = load(K_POS, null);

    function storeMarks() { save(K_MARKS, marks); }
    function isLive(m) { return m && (m.c || m.b); }

    function setMark(key, change) {
        var m = marks[key] || { c: null, b: false };
        if ('c' in change) m.c = change.c;
        if ('b' in change) m.b = change.b;
        m.t = Date.now(); m.dirty = true;
        marks[key] = m;
    }

    /* ---------- account sync ---------- */

    var account = window.BibleAccount || null, user = null, syncTimer = null, syncing = null, again = false, posTimer = null;

    function scheduleSync(delay) {
        if (!user) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncNow, delay == null ? 1500 : delay);
    }

    function syncNow() {
        if (!user || !account) return Promise.resolve();
        if (syncing) { again = true; return syncing; }
        var uid = user.id;
        syncing = account.ready().then(function (sb) {
            // 1. push marks changed on this device
            var started = Date.now();
            var keys = Object.keys(marks).filter(function (k) { return marks[k].dirty; });
            var rows = keys.map(function (k) {
                var p = splitKey(k), m = marks[k];
                return { user_id: uid, book: p.book, chapter: p.chapter, verse: p.verse, color: m.c || null, bookmarked: !!m.b };
            });
            var push = Promise.resolve();
            for (var i = 0; i < rows.length; i += 500) {
                (function (batch, batchKeys) {
                    push = push.then(function () {
                        return sb.from('verse_marks').upsert(batch, { onConflict: 'user_id,book,chapter,verse' }).then(function (res) {
                            if (res.error) throw res.error;
                            batchKeys.forEach(function (k) {
                                // only if not changed again while the request was out
                                if (marks[k] && marks[k].dirty && marks[k].t <= started) delete marks[k].dirty;
                            });
                        });
                    });
                })(rows.slice(i, i + 500), keys.slice(i, i + 500));
            }

            // 2. pull everything changed on the account since the last pull
            var cursor = load(K_CURSOR, null);
            if (!cursor || cursor.uid !== uid) cursor = { uid: uid, at: null };
            function pullPage() {
                var q = sb.from('verse_marks').select('book,chapter,verse,color,bookmarked,updated_at').order('updated_at', { ascending: true }).limit(1000);
                if (cursor.at) q = q.gt('updated_at', cursor.at);
                return q.then(function (res) {
                    if (res.error) throw res.error;
                    (res.data || []).forEach(function (r) {
                        var k = keyOf(r.book, r.chapter, r.verse);
                        if (marks[k] && marks[k].dirty) return;   // a newer local change wins; it is pushed next time
                        if (r.color || r.bookmarked) marks[k] = { c: r.color || null, b: !!r.bookmarked, t: Date.parse(r.updated_at) || Date.now() };
                        else delete marks[k];
                        cursor.at = r.updated_at;
                    });
                    if ((res.data || []).length === 1000) return pullPage();
                });
            }

            // 3. reading position: newest wins
            function syncPosition() {
                return sb.from('reading_position').select('page,verse,updated_at').maybeSingle().then(function (res) {
                    if (res.error) throw res.error;
                    var remote = res.data, remoteT = remote ? Date.parse(remote.updated_at) : 0;
                    if (position && position.dirty && position.t >= remoteT - 5000) {
                        var sentT = position.t;
                        return sb.from('reading_position').upsert({ user_id: uid, page: position.page, verse: position.verse || null }, { onConflict: 'user_id' })
                            .then(function (up) { if (up.error) throw up.error; if (position && position.t === sentT) { delete position.dirty; save(K_POS, position); } });
                    }
                    if (remote && (!position || remoteT > position.t)) {
                        position = { page: remote.page, verse: remote.verse, t: remoteT };
                        save(K_POS, position);
                    }
                });
            }

            return push.then(pullPage).then(function () {
                save(K_CURSOR, cursor);
                storeMarks();
                return syncPosition();
            });
        }).catch(function () { /* offline or unreachable: everything stays on this device and is retried */ })
          .then(function () {
            syncing = null;
            save(K_OWNER, uid);
            if (user && user.id === uid) { paintMarks(); renderHome(); }
            if (again) { again = false; scheduleSync(0); }
        });
        return syncing;
    }

    function onAccount(u) {
        var owner = load(K_OWNER, null);
        if (!u) {
            // Signed out on this device: what was saved to the account stays there and leaves this device,
            // the same as memory verses. Never-synced marks made while signed out are kept.
            if (owner) {
                Object.keys(marks).forEach(function (k) { if (!marks[k].dirty) delete marks[k]; });
                storeMarks();
                if (position && !position.dirty) { position = null; save(K_POS, null); }
                save(K_CURSOR, null); save(K_OWNER, null);
                paintMarks(); renderHome();
            }
            user = null;
            return;
        }
        if (owner && owner !== u.id) {
            // A different person signed in: start from their account, not the last person's marks.
            marks = {}; storeMarks(); position = null; save(K_POS, null); save(K_CURSOR, null);
        }
        user = u;
        syncNow();
    }

    /* ---------- chapter page: verse targets ---------- */

    var here = parsePage((location.pathname.split('/').pop() || '').replace(/\.html$/, ''));

    // Plain translations: <p class="verse"><span class="verse-num">20</span>...</p>
    function tagPlain(block) {
        block.querySelectorAll('p.verse').forEach(function (p) {
            if (p.hasAttribute('data-v')) return;
            var n = p.querySelector('.verse-num');
            var v = n ? parseInt(n.textContent, 10) : NaN;
            if (v > 0) p.setAttribute('data-v', v);
        });
    }

    // ESV (Crossway HTML): verses run inside shared paragraphs, poetry lines
    // and spans, each starting at <b class="verse-num|chapter-num" id="vBBCCCVVV-n">.
    // Every text node is wrapped in a span tagged with the verse it falls in.
    function tagESV(block) {
        if (block.getAttribute('data-bs-tagged') || !block.querySelector('b[id^="v"]')) return false;
        var walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        var current = 0, texts = [], node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === 1) {
                var m = node.tagName === 'B' && /^v\d{2}\d{3}(\d{3})/.exec(node.id || '');
                if (m) current = parseInt(m[1], 10);
                if (/^(H[1-6])$/.test(node.tagName)) current = 0;   // section headings are not verse text
            } else if (current && /\S/.test(node.nodeValue)) {
                texts.push([node, current]);
            }
        }
        texts.forEach(function (t) {
            var span = document.createElement('span');
            span.setAttribute('data-v', t[1]);
            t[0].parentNode.insertBefore(span, t[0]);
            span.appendChild(t[0]);
        });
        block.setAttribute('data-bs-tagged', '1');
        return true;
    }

    function activeBlock() { return document.querySelector('.translation-block.active'); }

    function paintMarks() {
        if (!here) return;
        document.querySelectorAll('.scripture-container [data-v]').forEach(function (n) {
            var m = marks[keyOf(here.book, here.chapter, n.getAttribute('data-v'))];
            COLORS.forEach(function (c) { n.classList.toggle('hl-' + c, !!(m && m.c === c)); });
        });
        // A small ribbon before each bookmarked verse's number, in every translation.
        document.querySelectorAll('.scripture-container .bs-bm').forEach(function (b) { b.remove(); });
        Object.keys(marks).forEach(function (k) {
            var p = splitKey(k);
            if (!marks[k].b || p.book !== here.book || p.chapter !== here.chapter) return;
            document.querySelectorAll('.scripture-container .translation-block').forEach(function (block) {
                var first = block.querySelector('[data-v="' + p.verse + '"]');
                if (first) first.insertBefore(el('i', { class: 'fas fa-bookmark bs-bm', 'aria-label': 'Bookmarked' }), first.firstChild);
            });
        });
    }

    /* ---------- chapter page: selection sheet ---------- */

    var selected = [], sheet = null;

    function markSelection() {
        document.querySelectorAll('.scripture-container .vsel').forEach(function (n) { n.classList.remove('vsel'); });
        selected.forEach(function (v) {
            document.querySelectorAll('.scripture-container [data-v="' + v + '"]').forEach(function (n) { n.classList.add('vsel'); });
        });
    }

    function closeSheet() {
        selected = []; markSelection();
        if (sheet) { sheet.remove(); sheet = null; }
    }

    function applyToSelection(change) {
        selected.forEach(function (v) { setMark(keyOf(here.book, here.chapter, v), change); });
        storeMarks(); paintMarks(); scheduleSync();
    }

    function renderSheet() {
        if (!selected.length) { closeSheet(); return; }
        injectStyle();
        var keys = selected.map(function (v) { return keyOf(here.book, here.chapter, v); });
        var shared = marks[keys[0]] && marks[keys[0]].c;
        keys.forEach(function (k) { if ((marks[k] && marks[k].c) !== shared) shared = undefined; });
        var allBookmarked = keys.every(function (k) { return marks[k] && marks[k].b; });
        var anyMark = keys.some(function (k) { return isLive(marks[k]); });

        var dots = COLORS.map(function (c) {
            var b = el('button', { type: 'button', class: 'bs-dot ' + c + (shared === c ? ' on' : ''), 'aria-label': 'Highlight ' + c, 'aria-pressed': shared === c ? 'true' : 'false' });
            b.addEventListener('click', function () { applyToSelection({ c: shared === c ? null : c }); closeSheet(); });
            return b;
        });
        var bm = el('button', { type: 'button', class: 'bs-act' }, [el('i', { class: allBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark', 'aria-hidden': 'true' }), allBookmarked ? 'Bookmarked' : 'Bookmark']);
        bm.addEventListener('click', function () { applyToSelection({ b: !allBookmarked }); closeSheet(); });
        var clear = anyMark ? el('button', { type: 'button', class: 'bs-act' }, [el('i', { class: 'fas fa-eraser', 'aria-hidden': 'true' }), 'Clear']) : null;
        if (clear) clear.addEventListener('click', function () { applyToSelection({ c: null, b: false }); closeSheet(); });
        var x = el('button', { type: 'button', class: 'bs-x', 'aria-label': 'Close' }, ['×']);
        x.addEventListener('click', closeSheet);

        var note = null;
        if (account && !user && !account.hasSession()) {
            var signin = el('button', { type: 'button', class: 'bs-link', text: 'Sign in' });
            signin.addEventListener('click', function () {
                account.openSignIn({ reason: 'Your highlights, bookmarks and reading place are saved to your account, so they follow you to any device.' });
            });
            note = el('p', { class: 'bs-note' }, ['Saved on this device. ', signin, ' to keep them on every device.']);
        }

        var inner = el('div', { class: 'bs-sheet-in', role: 'dialog', 'aria-label': 'Highlight ' + refText(here.book, here.chapter, selected) }, [
            el('div', { class: 'bs-sheet-top' }, [el('span', { class: 'bs-sheet-ref', text: refText(here.book, here.chapter, selected) }), x]),
            el('div', { class: 'bs-row' }, dots.concat([bm, clear])),
            note
        ]);
        if (!sheet) { sheet = el('div', { class: 'bs-sheet' }); document.body.appendChild(sheet); }
        sheet.replaceChildren(inner);
    }

    function onScriptureClick(e) {
        var t = e.target.closest && e.target.closest('[data-v]');
        if (!t || !t.closest('.scripture-container')) return;
        var sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed && String(sel).trim()) return;   // selecting text to copy, not tapping
        if (e.target.closest('a')) return;
        var v = parseInt(t.getAttribute('data-v'), 10);
        var i = selected.indexOf(v);
        if (i >= 0) selected.splice(i, 1); else selected.push(v);
        markSelection(); renderSheet();
    }

    /* ---------- chapter page: remembering the place ---------- */

    function topVerse() {
        var block = activeBlock();
        if (!block) return null;
        var nav = document.querySelector('.top-nav');
        var line = (nav ? nav.getBoundingClientRect().bottom : 56) + 12;
        var nodes = block.querySelectorAll('[data-v]');
        if (!nodes.length) return null;
        // Scripture not reached yet, or scrolled past entirely (reading the study tabs): keep the last verse seen.
        if (nodes[0].getBoundingClientRect().top > window.innerHeight * 0.6) return 1;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].getBoundingClientRect().bottom > line) return parseInt(nodes[i].getAttribute('data-v'), 10);
        }
        return null;
    }

    var lastSeen = null;
    function rememberPlace() {
        var v = topVerse();
        if (v) lastSeen = v;
        var page = here.book + here.chapter;
        var verse = lastSeen && lastSeen > 1 ? lastSeen : null;
        if (position && position.page === page && position.verse === verse) return;
        position = { page: page, verse: verse, t: Date.now(), dirty: true };
        save(K_POS, position);
        clearTimeout(posTimer);
        posTimer = setTimeout(function () { scheduleSync(0); }, 4000);
    }

    function goToHashVerse() {
        var m = /^#v(\d{1,3})$/.exec(location.hash || '');
        if (!m) return true;
        var block = activeBlock(), target = block && block.querySelector('[data-v="' + m[1] + '"]');
        if (!target) return false;
        target.scrollIntoView({ block: 'start' });
        block.querySelectorAll('[data-v="' + m[1] + '"]').forEach(function (n) { n.classList.add('vflash'); });
        lastSeen = parseInt(m[1], 10);
        return true;
    }

    function initChapter() {
        injectStyle();
        var container = document.querySelector('.scripture-container');
        if (!container) return;

        var jumped = false, observer = null;
        function retag() {
            // Painting changes the DOM, so stop watching while doing it or it would trigger itself.
            if (observer) observer.disconnect();
            container.querySelectorAll('.translation-block').forEach(function (b) {
                if (b.getAttribute('data-translation') === 'ESV') tagESV(b); else tagPlain(b);
            });
            paintMarks(); markSelection();
            if (!jumped) jumped = goToHashVerse();
            if (observer) container.querySelectorAll('.translation-block[data-translation="ESV"]').forEach(function (b) {
                observer.observe(b, { childList: true });
            });
        }
        // The ESV arrives later from the proxy and replaces its block's contents.
        observer = new MutationObserver(retag);
        retag();
        setTimeout(function () { jumped = true; }, 8000);   // never jump once the reader has had time to start scrolling

        container.addEventListener('click', onScriptureClick);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet) closeSheet(); });

        var scrollTimer = null;
        window.addEventListener('scroll', function () {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(rememberPlace, 400);
        }, { passive: true });
        // Opening a chapter at all counts as being there.
        setTimeout(rememberPlace, 1500);
        window.addEventListener('pagehide', function () { rememberPlace(); });
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { rememberPlace(); scheduleSync(0); } });
    }

    /* ---------- home page card ---------- */

    var homeTab = 'bookmarks', homeEl = null;

    function savedList(kind) {
        var list = Object.keys(marks).filter(function (k) { return kind === 'bookmarks' ? marks[k].b : marks[k].c; })
            .map(function (k) { var p = splitKey(k); p.m = marks[k]; return p; });
        list.sort(function (a, b) { return (b.m.t || 0) - (a.m.t || 0); });
        return list;
    }

    function renderHome() {
        var isHome = /^(|index(\.html)?)$/.test(location.pathname.split('/').pop() || '');
        if (!isHome) return;
        var bms = savedList('bookmarks'), hls = savedList('highlights');
        var pos = position && parsePage(position.page) ? position : null;
        if (!pos && !bms.length && !hls.length) { if (homeEl) { homeEl.remove(); homeEl = null; } return; }
        injectStyle();

        var parts = [];
        if (pos) {
            var p = parsePage(pos.page);
            parts.push(el('p', { class: 'bs-eyebrow', text: 'Pick up where you left off' }));
            parts.push(el('a', { class: 'bs-resume', href: pos.page + '.html' + (pos.verse ? '#v' + pos.verse : '') }, [
                el('span', {}, [el('strong', { text: refText(p.book, p.chapter, pos.verse ? [pos.verse] : null) }), el('small', { text: 'Last read ' + ago(pos.t) })]),
                el('span', { class: 'bs-go' }, ['Continue ', el('i', { class: 'fas fa-arrow-right', 'aria-hidden': 'true' })])
            ]));
        }
        if (bms.length || hls.length) {
            if (!bms.length) homeTab = 'highlights';
            var tabs = [['bookmarks', 'Bookmarks (' + bms.length + ')'], ['highlights', 'Highlights (' + hls.length + ')']].map(function (t) {
                var b = el('button', { type: 'button', class: 'bs-tab', role: 'tab', 'aria-selected': homeTab === t[0] ? 'true' : 'false', text: t[1] });
                b.addEventListener('click', function () { homeTab = t[0]; renderHome(); });
                return b;
            });
            parts.push(el('div', { class: 'bs-tabs', role: 'tablist' }, tabs));
            var items = homeTab === 'bookmarks' ? bms : hls;
            if (!items.length) parts.push(el('p', { class: 'bs-empty', text: homeTab === 'bookmarks' ? 'Tap any verse in a chapter to bookmark it.' : 'Tap any verse in a chapter to highlight it.' }));
            var ul = el('ul', { class: 'bs-list' }, items.slice(0, 12).map(function (i) {
                return el('li', {}, [el('a', { href: i.book + i.chapter + '.html#v' + i.verse }, [
                    homeTab === 'bookmarks' ? el('i', { class: 'fas fa-bookmark', 'aria-hidden': 'true', style: 'color:var(--accent-link);width:12px' }) : el('span', { class: 'sw ' + i.m.c, 'aria-hidden': 'true' }),
                    refText(i.book, i.chapter, [i.verse])
                ])]);
            }));
            parts.push(ul);
            if (items.length > 12) parts.push(el('p', { class: 'bs-empty', text: '…and ' + (items.length - 12) + ' more, newest shown first.' }));
        }
        if (account && !user && !account.hasSession()) {
            var signin = el('button', { type: 'button', class: 'bs-link', text: 'Sign in' });
            signin.addEventListener('click', function () { account.openSignIn({ reason: 'Your reading place, highlights and bookmarks are saved to your account, so they follow you to any device.' }); });
            parts.push(el('p', { class: 'bs-note' }, ['Saved on this device. ', signin, ' to keep your place on every device.']));
        }

        var card = el('section', { class: 'bs-card', 'aria-label': 'Your reading' }, parts);
        if (!homeEl) {
            homeEl = el('div', { class: 'bs-home' });
            var standalone = document.body.classList.contains('pwa-standalone');
            var pwaNav = document.querySelector('.pwa-bible-nav');
            var hero = document.querySelector('.hero-section');
            if (standalone && pwaNav) pwaNav.insertBefore(homeEl, pwaNav.firstChild);
            else if (hero) hero.parentNode.insertBefore(homeEl, hero.nextSibling);
            else return;
        }
        homeEl.replaceChildren(card);
    }

    /* ---------- start ---------- */

    function start() {
        if (here) initChapter();
        renderHome();
        if (account) {
            account.onChange(onAccount);
            window.addEventListener('online', function () { if (user) scheduleSync(0); else if (account.hasSession()) account.ready().catch(function () {}); });
        }
        // Another tab on this device changed something.
        window.addEventListener('storage', function (e) {
            if (e.key === K_MARKS) { marks = load(K_MARKS, {}); paintMarks(); renderHome(); }
            if (e.key === K_POS) { position = load(K_POS, null); renderHome(); }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
