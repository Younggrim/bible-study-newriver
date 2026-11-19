/* Reader extras, Nov 2026. Loaded on every page by site/script.js.
   Kept identical in both repositories.

     1. Dark mode       moon button in the top bar: Auto -> Dark -> Light.
                        Stored in localStorage 'bs-theme', applied as
                        <html data-theme>. The palette itself is in style.css.
     2. Video resume    every YouTube player remembers where you stopped
                        (localStorage 'bs-yt-pos') and starts there next time,
                        with a "Resume 12:34" tag on the thumbnail.
     3. Video notes     "Notes on this video" under each video on a chapter
                        page. Saved as an ordinary note on the chapter (same
                        'bs-notes' store and notes table as the Notes tab), so
                        it syncs to every device when signed in.
     4. Offline books   "Save <Book> for offline" on chapter pages: stores every
                        chapter page of the book in the 'bs-offline' cache,
                        which sw.js keeps across updates and serves offline.
     5. Export          "Export my study" on the Notes page: notes, highlights,
                        bookmarks and memory verses on one printable page
                        (Save as PDF from the print sheet).
     6. Memory reminder a "Remind me when memory verses are due" switch with the
                        other reminders on the devotional page. Due dates are
                        copied into the 'bs-reminders' cache for sw.js, which
                        adds a notification to the daily reminder push.        */
(function () {
    'use strict';

    function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
    function el(tag, attrs, kids) {
        var n = document.createElement(tag), k;
        for (k in attrs || {}) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'class') n.className = attrs[k];
            else if (k === 'style') n.style.cssText = attrs[k];
            else n.setAttribute(k, attrs[k]);
        }
        (kids || []).forEach(function (c) { if (c != null) n.append(c); });
        return n;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function clock(s) {
        s = Math.max(0, Math.floor(s || 0));
        var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
        return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
    }
    var PAGE_FILE = location.pathname.split('/').pop() || 'index.html';
    var CH = /^([1-3]?[a-z]+?)(\d+)\.html$/.exec(PAGE_FILE);
    function bookName(slug) {
        if (window.BibleI18n && window.BibleI18n.bookName) return window.BibleI18n.bookName(slug);
        var o = document.querySelector('#bookSelect option[value="' + slug + '"]');
        if (o) return o.textContent;
        return slug.replace(/^(\d)/, '$1 ').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    }

    var css = ''
        + '.bx-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 18px}'
        + '.bx-btn{font:600 .8rem Inter,-apple-system,sans-serif;color:var(--accent-link);background:var(--bg-card);border:1px solid var(--border-medium);border-radius:8px;padding:7px 12px;cursor:pointer}'
        + '.bx-btn:hover{background:var(--bg-secondary)}'
        + '.bx-btn.primary{background:var(--accent-link);color:#fff;border-color:var(--accent-link)}'
        + '.bx-muted{font-size:.78rem;color:var(--text-faint)}'
        + '.bx-resume{position:absolute;top:8px;left:8px;z-index:2;background:rgba(0,0,0,.75);color:#fff;font:600 .7rem Inter,sans-serif;padding:4px 8px;border-radius:6px;pointer-events:none}'
        + '.bx-vnote{margin:6px 0 16px}'
        + '.bx-vnote textarea{width:100%;min-height:110px;font:inherit;font-size:.92rem;line-height:1.6;color:var(--text-primary);background:var(--bg-card);border:1px solid var(--border-medium);border-radius:8px;padding:10px;margin:6px 0}'
        + '.bx-card{background:var(--bg-card);border:1px solid var(--border-light);border-radius:12px;padding:14px 16px;margin:18px 0}'
        + '.bx-card h4{font:700 .95rem Poppins,Inter,sans-serif;color:var(--ink-deep);margin:0 0 4px}'
        + '.bx-bar{height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden;margin:8px 0}'
        + '.bx-bar i{display:block;height:100%;width:0;background:var(--accent-link);transition:width .2s}';
    document.head.appendChild(el('style', { text: css }));

    /* ---------------- 1. Dark mode ---------------- */
    var THEME_KEY = 'bs-theme';
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function themePref() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; } }
    function isDark() { var p = themePref(); return p === 'dark' || (p === 'auto' && !!(mq && mq.matches)); }
    function applyTheme() {
        var p = themePref(), root = document.documentElement;
        if (p === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', p);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            if (!meta.getAttribute('data-light')) meta.setAttribute('data-light', meta.getAttribute('content'));
            meta.setAttribute('content', isDark() ? '#16120e' : meta.getAttribute('data-light'));
        }
        recolorScripture();
        var b = document.querySelector('.nav-theme-btn');
        if (b) {
            var label = { auto: 'Theme: Auto (follows your phone)', dark: 'Theme: Dark', light: 'Theme: Light' }[p];
            b.innerHTML = ICONS[p];
            b.title = label; b.setAttribute('aria-label', label);
        }
    }
    // The translation tint on chapter text is set inline by script.js; at night
    // use lighter versions of the same hues so the text stays readable.
    var DARK_TINTS = { ESV: '#e3a184', BSB: '#7cc4cb', KJV: '#a9b6e3', ASV: '#d9b77f', NET: '#c4a3d6', WEB: '#8fcfaa' };
    function recolorScripture() {
        var c = document.querySelector('.scripture-container');
        if (!c) return;
        var active = document.querySelector('.translation-block.active');
        var code = active ? active.getAttribute('data-translation') : null;
        if (isDark()) c.style.color = DARK_TINTS[code] || 'var(--ink-deep)';
        else if (window.TRANSLATION_COLORS || typeof TRANSLATION_COLORS !== 'undefined') {
            var map = window.TRANSLATION_COLORS || TRANSLATION_COLORS; // eslint-disable-line no-undef
            c.style.color = map[code] || '#3d2b1f';
        }
    }
    if (typeof window.switchTranslation === 'function') {
        var origSwitch = window.switchTranslation;
        window.switchTranslation = function (t) { var r = origSwitch.apply(this, arguments); recolorScripture(); return r; };
    }
    var SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    var ICONS = {
        auto: SVG + '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
        dark: SVG + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
        light: SVG + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    };
    (function themeButton() {
        var nav = document.querySelector('.top-nav');
        if (!nav || nav.querySelector('.nav-theme-btn')) return;
        var b = el('button', { class: 'nav-theme-btn', type: 'button' });
        b.addEventListener('click', function () {
            var next = { auto: 'dark', dark: 'light', light: 'auto' }[themePref()];
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
            applyTheme();
        });
        nav.appendChild(b);
    })();
    if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
    applyTheme();

    /* ---------------- 2. Video resume ---------------- */
    var POS_KEY = 'bs-yt-pos';
    function positions() { return load(POS_KEY, {}); }
    function savePos(id, t, d) {
        var all = positions();
        if (d && t > d - 20) delete all[id];          // finished: start from the top next time
        else if (t > 15) all[id] = { t: Math.floor(t), d: Math.floor(d || 0), at: Date.now() };
        else return;
        var ids = Object.keys(all);
        if (ids.length > 300) ids.sort(function (a, b) { return all[a].at - all[b].at; }).slice(0, ids.length - 300).forEach(function (k) { delete all[k]; });
        save(POS_KEY, all);
    }
    var players = {};   // iframe id -> { video, t, d }
    window.loadYT = function (box, id) {
        var label = (box.getAttribute('aria-label') || '').replace(/^Play video: /, '') || 'YouTube video';
        var p = positions()[id], start = p ? p.t : 0;
        var fid = 'yt-' + id + '-' + Math.random().toString(36).slice(2, 7);
        box.style.position = 'relative';
        box.removeAttribute('role'); box.removeAttribute('tabindex'); box.removeAttribute('aria-label');
        box.innerHTML = '<iframe id="' + fid + '" src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&enablejsapi=1'
            + (start ? '&start=' + start : '') + '&origin=' + encodeURIComponent(location.origin) + '" title="' + esc(label)
            + '" style="width:100%;height:100%;position:absolute;top:0;left:0;border:none;" allow="autoplay;encrypted-media;picture-in-picture" allowfullscreen></iframe>';
        players[fid] = { video: id, t: start, d: 0 };
        var f = document.getElementById(fid);
        var hello = function () {
            try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: fid, channel: 'widget' }), '*'); } catch (e) {}
        };
        f.addEventListener('load', function () { hello(); setTimeout(hello, 1000); setTimeout(hello, 3000); });
    };
    window.addEventListener('message', function (e) {
        if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
        var data; try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
        if (!data || !data.info) return;
        var fid = data.id, rec = fid && players[fid];
        if (!rec) {   // some player builds omit the id: match on the sending window
            for (var k in players) { var fr = document.getElementById(k); if (fr && fr.contentWindow === e.source) { rec = players[k]; break; } }
        }
        if (!rec) return;
        if (typeof data.info.duration === 'number' && data.info.duration) rec.d = data.info.duration;
        if (typeof data.info.currentTime === 'number') {
            rec.t = data.info.currentTime;
            if (!rec.last || Math.abs(rec.t - rec.last) >= 5 || data.info.playerState === 2 || data.info.playerState === 0) {
                rec.last = rec.t; savePos(rec.video, rec.t, rec.d);
            }
        }
    });
    function flushPositions() { for (var k in players) savePos(players[k].video, players[k].t, players[k].d); }
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushPositions(); });
    window.addEventListener('pagehide', flushPositions);
    function facadeId(box) { var m = /loadYT\(this,\s*'([^']+)'\)/.exec(box.getAttribute('onclick') || ''); return m ? m[1] : null; }
    function resumeTags(root) {
        var all = positions();
        (root || document).querySelectorAll('.yt-facade').forEach(function (box) {
            if (box.querySelector('iframe') || box.querySelector('.bx-resume')) return;
            var id = facadeId(box), p = id && all[id];
            if (p) box.appendChild(el('span', { class: 'bx-resume', text: 'Resume ' + clock(p.t) }));
        });
    }

    /* ---------------- 3. Notes on a video ---------------- */
    var NOTES = 'bs-notes';
    var account = window.BibleAccount || null, user = null;
    if (account && account.onChange) account.onChange(function (u) { user = u || null; });
    function newId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function pushNote(n) {
        if (!user || !account) return Promise.resolve(false);
        var uid = user.id, sent = n.t;
        return account.ready().then(function (sb) {
            return sb.from('notes').upsert({
                user_id: uid, id: n.id, ref: n.ref, title: (n.title || '').slice(0, 200), body: (n.body || '').slice(0, 20000),
                created_at: new Date(n.created).toISOString(), deleted_at: null
            }, { onConflict: 'user_id,id' });
        }).then(function (res) {
            if (res && res.error) throw res.error;
            var all = load(NOTES, {});
            if (all[n.id] && all[n.id].t === sent) { delete all[n.id].dirty; save(NOTES, all); }
            return true;
        }).catch(function () { return false; });
    }
    function videoTitle(box) {
        var p = box.querySelector('p');
        return p && p.firstChild ? p.firstChild.textContent.replace(/\s+/g, ' ').trim() : 'Video';
    }
    function noteButtons() {
        if (!CH) return;
        var tab = document.getElementById('tab-videos');
        if (!tab) return;
        tab.querySelectorAll('.yt-facade').forEach(function (box) {
            var id = facadeId(box), title = videoTitle(box);
            if (!id) return;
            // script.js re-sorts the videos after load, so keep each note box
            // glued to its own video rather than to wherever it was inserted.
            var have = tab.querySelector('.bx-vnote[data-vid="' + id + '"]');
            if (have) { if (box.nextElementSibling !== have) box.after(have); return; }
            var wrap = el('div', { class: 'bx-vnote', 'data-vid': id });
            var open = el('button', { class: 'bx-btn', type: 'button', text: '📝 Notes on this video' });
            wrap.appendChild(open);
            open.addEventListener('click', function () {
                open.remove();
                var ta = el('textarea', { placeholder: 'What stood out? Tap "Add time" to mark the moment.', 'aria-label': 'Notes on ' + title });
                var status = el('span', { class: 'bx-muted' });
                var stamp = el('button', { class: 'bx-btn', type: 'button', text: '⏱ Add time' });
                var saveB = el('button', { class: 'bx-btn primary', type: 'button', text: 'Save note' });
                stamp.addEventListener('click', function () {
                    var t = 0;
                    for (var k in players) if (players[k].video === id) t = players[k].t;
                    if (!t) { var p = positions()[id]; t = p ? p.t : 0; }
                    var s = ta.selectionStart || ta.value.length;
                    var ins = (s && ta.value[s - 1] !== '\n' ? '\n' : '') + '[' + clock(t) + '] ';
                    ta.value = ta.value.slice(0, s) + ins + ta.value.slice(s);
                    ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length;
                });
                saveB.addEventListener('click', function () {
                    var body = ta.value.trim();
                    if (!body) { status.textContent = 'Write something first.'; return; }
                    var now = Date.now();
                    var n = { id: newId(), ref: CH[1] + CH[2], title: 'Video: ' + title, body: body, created: now, t: now, dirty: true };
                    var all = load(NOTES, {}); all[n.id] = n;
                    if (!save(NOTES, all)) { status.textContent = 'Could not save: this device is out of space.'; return; }
                    ta.value = '';
                    status.textContent = user ? 'Saving…' : 'Saved on this device (sign in to sync)';
                    pushNote(n).then(function (ok) { if (user) status.textContent = ok ? 'Saved to your notes' : 'Saved on this device'; });
                });
                wrap.append(ta, el('div', { class: 'bx-row', style: 'margin:0' }, [stamp, saveB, status]));
                ta.focus();
            });
            box.after(wrap);
        });
    }

    /* ---------------- 4. Save a book for offline ---------------- */
    var OFFLINE = 'bs-offline';
    function offlineCard() {
        if (!CH || !('caches' in window) || document.querySelector('.bx-offline')) return;
        var opt = document.querySelector('#bookSelect option[value="' + CH[1] + '"]');
        var total = opt ? parseInt(opt.getAttribute('data-chapters'), 10) : 0;
        var bar = document.querySelector('.study-tabs');
        if (!total || !bar) return;
        var name = bookName(CH[1]);
        var btn = el('button', { class: 'bx-btn', type: 'button', text: '⬇ Save ' + name + ' for offline' });
        var note = el('span', { class: 'bx-muted' });
        var prog = el('div', { class: 'bx-bar', style: 'display:none' }, [el('i')]);
        var card = el('div', { class: 'bx-card bx-offline' }, [
            el('h4', { text: 'Read without a signal' }),
            el('div', { class: 'bx-muted', text: 'Stores all ' + total + ' chapters of ' + name + ' on this device. KJV, BSB, ASV, NET and WEB work offline; ESV only for chapters you have already opened.' }),
            prog, el('div', { class: 'bx-row', style: 'margin:8px 0 0' }, [btn, note])]);
        var pages = []; for (var i = 1; i <= total; i++) pages.push(CH[1] + i + '.html');
        caches.open(OFFLINE).then(function (c) { return Promise.all(pages.map(function (p) { return c.match(p); })); })
            .then(function (hits) {
                var have = hits.filter(Boolean).length;
                if (have === total) { btn.textContent = '✓ ' + name + ' saved for offline'; note.textContent = 'Tap to refresh it'; }
                else if (have) note.textContent = have + ' of ' + total + ' chapters saved';
            }).catch(function () {});
        btn.addEventListener('click', function () {
            if (btn.disabled) return;
            btn.disabled = true; prog.style.display = 'block'; note.textContent = '';
            var fill = prog.firstChild, done = 0, failed = 0, assets = {};
            caches.open(OFFLINE).then(function (cache) {
                var queue = pages.slice();
                function grabAssets(html) {
                    var re = /(?:src|href)="((?:site|bible)\/[^"?#]+\.(?:js|css|png|jpg|webp|json))(?:\?[^"]*)?"/g, m;
                    while ((m = re.exec(html))) assets[m[1]] = 1;
                }
                function worker() {
                    var p = queue.shift();
                    if (!p) return Promise.resolve();
                    return fetch(p, { cache: 'reload' }).then(function (r) {
                        if (!r.ok) throw new Error(r.status);
                        return r.clone().text().then(function (t) { grabAssets(t); return cache.put(p, r); });
                    }).catch(function () { failed++; }).then(function () {
                        done++; fill.style.width = Math.round(done / total * 100) + '%';
                        btn.textContent = 'Saving… ' + done + ' / ' + total;
                        return worker();
                    });
                }
                return Promise.all([worker(), worker(), worker(), worker()]).then(function () {
                    return Promise.all(Object.keys(assets).map(function (a) {
                        return fetch(a).then(function (r) { if (r.ok) return cache.put(a, r); }).catch(function () {});
                    }));
                });
            }).then(function () {
                btn.disabled = false;
                btn.textContent = failed ? 'Try again' : '✓ ' + name + ' saved for offline';
                note.textContent = failed ? failed + ' chapter(s) did not download' : 'Saved ' + total + ' chapters';
            }).catch(function () { btn.disabled = false; btn.textContent = 'Try again'; note.textContent = 'Could not save on this device'; });
        });
        var tabs = document.querySelectorAll('.tab-content'), last = tabs[tabs.length - 1];
        if (last && last.parentNode) last.parentNode.insertBefore(card, last.nextSibling); else bar.parentNode.appendChild(card);
    }

    /* ---------------- 5. Export my study ---------------- */
    function exportStudy() {
        var notes = load(NOTES, {}), marks = load('bs-marks', {}), mem = load('memory-verses-v1', {});
        var nl = Object.keys(notes).map(function (k) { return notes[k]; }).filter(function (n) { return n && !n.deleted && (n.body || '').trim(); })
            .sort(function (a, b) { return (a.created || a.t) - (b.created || b.t); });
        function refOf(r) {
            var m = /^([1-3]?[a-z]+?)(\d+)(?::(.+))?$/.exec(r || '');
            return m ? bookName(m[1]) + ' ' + m[2] + (m[3] ? ':' + m[3] : '') : (r || 'General');
        }
        var hl = [], bm = [];
        Object.keys(marks).forEach(function (k) {
            var p = k.split('|'), m = marks[k];
            if (!m || p.length < 3) return;
            var label = bookName(p[0]) + ' ' + p[1] + ':' + p[2];
            if (m.c) hl.push({ label: label, c: m.c, b: p[0], ch: +p[1], v: +p[2] });
            if (m.b) bm.push({ label: label, b: p[0], ch: +p[1], v: +p[2] });
        });
        var order = {}; document.querySelectorAll('#bookSelect option').forEach(function (o, i) { order[o.value] = i; });
        var byRef = function (a, b) { return ((order[a.b] || 0) - (order[b.b] || 0)) || (a.ch - b.ch) || (a.v - b.v); };
        hl.sort(byRef); bm.sort(byRef);
        var mv = (mem.verses || []).filter(function (v) { return v && !v.deleted; });
        var when = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Bible Study — ' + esc(when) + '</title>'
            + '<style>body{font:15px/1.6 Georgia,serif;color:#222;max-width:720px;margin:24px auto;padding:0 18px}h1{font:700 1.5rem Helvetica,Arial,sans-serif;margin:0}h2{font:700 1.1rem Helvetica,Arial,sans-serif;border-bottom:2px solid #8b3a2a;padding-bottom:4px;margin:28px 0 10px;color:#8b3a2a}'
            + '.n{margin:0 0 16px;page-break-inside:avoid}.r{font:600 .85rem Helvetica,Arial,sans-serif;color:#555}.t{font-weight:700}.b{white-space:pre-wrap}.m{color:#777;font:.8rem Helvetica,Arial,sans-serif}'
            + 'ul{padding-left:20px}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}.p{position:fixed;top:12px;right:12px;font:600 14px Helvetica,sans-serif;padding:8px 14px;border-radius:8px;border:0;background:#8b3a2a;color:#fff}@media print{.p{display:none}}</style></head><body>'
            + '<button class="p" onclick="print()">Save as PDF</button>'
            + '<h1>My Bible Study</h1><div class="m">Exported ' + esc(when) + ' · ' + nl.length + ' notes · ' + hl.length + ' highlights · ' + bm.length + ' bookmarks · ' + mv.length + ' memory verses</div>';
        h += '<h2>Notes</h2>' + (nl.length ? nl.map(function (n) {
            return '<div class="n"><div class="r">' + esc(refOf(n.ref)) + ' · ' + esc(new Date(n.created || n.t).toLocaleDateString()) + '</div>'
                + (n.title ? '<div class="t">' + esc(n.title) + '</div>' : '') + '<div class="b">' + esc(n.body) + '</div></div>';
        }).join('') : '<p class="m">No notes yet.</p>');
        var COL = { yellow: '#ffd60a', green: '#6ec878', blue: '#64aaf0', pink: '#f078aa' };
        h += '<h2>Highlights</h2>' + (hl.length ? '<ul>' + hl.map(function (x) { return '<li><span class="dot" style="background:' + (COL[x.c] || '#ccc') + '"></span>' + esc(x.label) + '</li>'; }).join('') + '</ul>' : '<p class="m">No highlights yet.</p>');
        h += '<h2>Bookmarks</h2>' + (bm.length ? '<ul>' + bm.map(function (x) { return '<li>' + esc(x.label) + '</li>'; }).join('') + '</ul>' : '<p class="m">No bookmarks yet.</p>');
        h += '<h2>Memory verses</h2>' + (mv.length ? mv.map(function (v) {
            return '<div class="n"><div class="t">' + esc(v.ref) + ' <span class="m">(' + esc(v.translation || 'ESV') + (v.stage === 'review' ? ', reviewing' : ', learning') + ')</span></div><div class="b">' + esc(v.text) + '</div></div>';
        }).join('') : '<p class="m">No memory verses yet.</p>');
        h += '</body></html>';
        var url = URL.createObjectURL(new Blob([h], { type: 'text/html' }));
        var w = window.open(url, '_blank');
        if (!w) location.href = url;
    }
    function exportButton() {
        if (PAGE_FILE !== 'notes.html' || document.querySelector('.bx-export')) return;
        var host = document.querySelector('main') || document.querySelector('.main-content') || document.body;
        var b = el('button', { class: 'bx-btn', type: 'button', text: '⬇ Export my study (PDF)' });
        b.addEventListener('click', exportStudy);
        var row = el('div', { class: 'bx-row bx-export' }, [b, el('span', { class: 'bx-muted', text: 'Notes, highlights, bookmarks and memory verses on one page' })]);
        var h1 = host.querySelector('h1, h2');
        if (h1 && h1.parentNode) h1.parentNode.insertBefore(row, h1.nextSibling); else host.prepend(row);
    }
    window.BibleExport = exportStudy;

    /* ---------------- 6. Memory-verse reminder ---------------- */
    var MEM_KEY = 'bs-memory-alerts';
    function memoryOn() { try { return localStorage.getItem(MEM_KEY) === 'on'; } catch (e) { return false; } }
    function shareDueDates() {
        if (!('caches' in window)) return;
        var mem = load('memory-verses-v1', {});
        var list = (mem.verses || []).filter(function (v) { return v && !v.deleted && v.stage === 'review' && v.due; })
            .map(function (v) { return { ref: v.ref, due: v.due }; });
        caches.open('bs-reminders').then(function (c) {
            return c.put('/__memory-due', new Response(JSON.stringify({ on: memoryOn(), verses: list }), { headers: { 'Content-Type': 'application/json' } }));
        }).catch(function () {});
    }
    function memoryToggle() {
        var plan = document.getElementById('devoPlanOpt');
        if (!plan || document.getElementById('devoMemoryOpt')) return;
        var box = el('input', { type: 'checkbox', id: 'devoMemoryToggle' });
        box.checked = memoryOn();
        var lab = el('label', { class: 'devo-streak-opt', id: 'devoMemoryOpt', style: plan.style.cssText }, [box, ' Remind me when memory verses are due for review']);
        plan.after(lab);
        box.addEventListener('change', function () {
            try { localStorage.setItem(MEM_KEY, box.checked ? 'on' : 'off'); } catch (e) {}
            shareDueDates();
        });
        // follow the plan option's visibility (it only shows once reminders are on)
        new MutationObserver(function () { lab.style.display = plan.style.display; }).observe(plan, { attributes: true, attributeFilter: ['style'] });
    }

    /* ---------------- wire up ---------------- */
    function chapterBits() { resumeTags(); noteButtons(); }
    chapterBits(); offlineCard(); exportButton(); memoryToggle(); shareDueDates();
    // videos (including New River's sermon overlay) can arrive after load
    var vids = document.getElementById('tab-videos');
    if (vids) new MutationObserver(function () { chapterBits(); }).observe(vids, { childList: true, subtree: true });
    if (typeof window.onChapterChange === 'function') window.onChapterChange(function () { chapterBits(); });
})();
