/* Notes tab on chapter pages.

   Adds a "Notes" tab after Reflection: write a note on this chapter (or on a
   verse picked from the verse sheet) on lined paper, and see, edit or delete
   the notes already written on it. Notes are the same ones as the Notes page
   (localStorage 'bs-notes', same shape); signed in, each save goes straight
   to the notes table, and the chapter's notes are fetched from it, so they
   follow the reader to every device. script.js's page-wide tab listener
   handles the new tab like the others. Kept identical in both
   repositories.                                                          */
(function () {
    'use strict';

    var m = /^([1-3]?[a-z]+?)(\d+)\.html$/.exec(location.pathname.split('/').pop() || '');
    var bar = document.querySelector('.study-tabs');
    var after = document.getElementById('tab-reflection') || document.querySelector('.tab-content:last-of-type');
    if (!m || !bar || !after) return;
    var PAGE = m[1] + m[2], BOOK = m[1], CH = m[2];
    var STORE = 'bs-notes', OWNER = 'bs-notes-owner';
    var account = window.BibleAccount || null, user = null;

    function T(k, d) { return window.BibleI18n ? window.BibleI18n.t(k, d) : d; }
    function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
    function el(tag, attrs, kids) {
        var n = document.createElement(tag), k;
        for (k in attrs || {}) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'class') n.className = attrs[k];
            else n.setAttribute(k, attrs[k]);
        }
        (kids || []).forEach(function (c) { if (c != null) n.append(c); });
        return n;
    }
    function bookName() {
        if (window.BibleI18n && window.BibleI18n.bookName) return window.BibleI18n.bookName(BOOK);
        return BOOK.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon').replace(/\b(?!of\b)[a-z]/g, function (c) { return c.toUpperCase(); });
    }
    function refLabel(ref) { var v = (ref || '').split(':')[1]; return bookName() + ' ' + CH + (v ? ':' + v : ''); }
    function newId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function mine(n) { return n && !n.deleted && n.ref && n.ref.split(':')[0] === PAGE; }
    function chapterNotes() {
        var all = load(STORE, {});
        return Object.keys(all).map(function (k) { return all[k]; }).filter(mine)
            .sort(function (a, b) { return (b.created || b.t) - (a.created || a.t); });
    }

    var STYLE = ''
        + '.cn-paper{--cn-line:1.9em;width:100%;min-height:9.5em;resize:vertical;font-family:"Merriweather",serif;font-size:1rem;color:var(--ink-deep);line-height:var(--cn-line);padding:0 12px var(--cn-line);border:1px solid var(--border-light);border-radius:12px;background-color:var(--bg-card);background-image:linear-gradient(to bottom,transparent calc(var(--cn-line) - 1px),var(--rule-warm) calc(var(--cn-line) - 1px),var(--rule-warm) var(--cn-line));background-size:100% var(--cn-line);background-attachment:local;box-sizing:border-box}'
        + '.cn-paper:focus{outline:2px solid var(--accent-link);outline-offset:1px}'
        + '.cn-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 0}'
        + '.cn-btn{font-family:"Inter",sans-serif;font-size:.88rem;font-weight:600;padding:9px 14px;border-radius:8px;border:1px solid var(--accent-link);background:transparent;color:var(--accent-link);cursor:pointer}'
        + '.cn-btn.primary{background:var(--accent-link);color:#fff}'
        + '.cn-btn.quiet{border-color:var(--border-light);color:var(--text-secondary)}'
        + '.cn-status{font-family:"Inter",sans-serif;font-size:.8rem;color:var(--text-faint);margin-left:auto}'
        + '.cn-ref{display:inline-flex;align-items:center;gap:6px;font-family:"Inter",sans-serif;font-size:.8rem;font-weight:600;padding:4px 10px;border-radius:999px;background:var(--bg-tint);border:1px solid var(--border-light);color:var(--ink-deep);margin:0 0 8px}'
        + '.cn-ref button{border:0;background:none;padding:0 0 0 2px;font-size:1rem;line-height:1;color:var(--text-faint);cursor:pointer}'
        + '.cn-list{list-style:none;margin:22px 0 0;padding:0}'
        + '.cn-list>li{border-top:1px solid var(--rule-soft);padding:14px 0}'
        + '.cn-meta{display:flex;justify-content:space-between;align-items:center;gap:10px;font-family:"Inter",sans-serif;font-size:.78rem;color:var(--text-faint);margin:0 0 6px}'
        + '.cn-meta strong{color:var(--ink-deep);font-weight:600}'
        + '.cn-text{font-family:"Merriweather",serif;font-size:.95rem;line-height:1.7;color:var(--ink-deep);white-space:pre-wrap;word-wrap:break-word;margin:0}'
        + '.cn-edit{border:0;background:none;padding:0;font:inherit;font-weight:600;color:var(--accent-link);cursor:pointer}'
        + '.cn-all{display:inline-block;margin-top:14px;font-family:"Inter",sans-serif;font-size:.85rem;font-weight:600;color:var(--accent-link);text-decoration:none}'
        + '.cn-empty{font-family:"Inter",sans-serif;font-size:.85rem;color:var(--text-faint);margin:18px 0 0}';
    document.head.appendChild(el('style', { text: STYLE }));

    // The tab and its pane, after Reflection.
    var tab = null, pane = null;
    function mount() {
        tab = el('div', { class: 'study-tab', 'data-tab': 'notes', text: T('tab.notes', 'Notes') });
        bar.appendChild(tab);
        pane = el('div', { class: 'tab-content', id: 'tab-notes' });
        after.parentNode.insertBefore(pane, after.nextSibling);
    }
    mount();

    /* ---------- writing ---------- */

    // Bullets: the button starts one on the current line; Enter on a bulleted
    // line continues it, and Enter on an empty bullet ends the list.
    function bulletize(ta) {
        var s = ta.selectionStart, v = ta.value, start = v.lastIndexOf('\n', s - 1) + 1;
        var end = v.indexOf('\n', s); if (end < 0) end = v.length;
        if (v.slice(start, start + 2) === '• ' && s === end && s - start > 2) {
            ta.value = v.slice(0, s) + '\n• ' + v.slice(s); ta.selectionStart = ta.selectionEnd = s + 3;     // next bullet
        } else if (v.slice(start, start + 2) === '• ') {
            return;
        } else if (s === end && s > start) {
            ta.value = v.slice(0, s) + '\n• ' + v.slice(s); ta.selectionStart = ta.selectionEnd = s + 3;     // typing at the end of a line: bullet on a new line
        } else {
            ta.value = v.slice(0, start) + '• ' + v.slice(start); ta.selectionStart = ta.selectionEnd = s + 2;
        }
        ta.focus();
        ta.dispatchEvent(new Event('input'));
    }
    function continueBullets(ta) {
        ta.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || e.shiftKey) return;
            var s = ta.selectionStart, v = ta.value, start = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(start, s);
            if (line.indexOf('• ') !== 0) return;
            e.preventDefault();
            if (line === '• ') { ta.value = v.slice(0, start) + v.slice(s); ta.selectionStart = ta.selectionEnd = start; }
            else { ta.value = v.slice(0, s) + '\n• ' + v.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 3; }
            ta.dispatchEvent(new Event('input'));
        });
    }

    function push(n) {
        if (!user || !account) return Promise.resolve(false);
        var uid = user.id, sent = n.t;
        return account.ready().then(function (sb) {
            return sb.from('notes').upsert({
                user_id: uid, id: n.id, ref: n.ref, title: (n.title || '').slice(0, 200), body: (n.body || '').slice(0, 20000),
                created_at: new Date(n.created || n.t).toISOString(), deleted_at: n.deleted ? new Date(n.t).toISOString() : null
            }, { onConflict: 'user_id,id' });
        }).then(function (res) {
            if (res && res.error) throw res.error;
            var all = load(STORE, {});
            if (all[n.id] && all[n.id].t === sent) { delete all[n.id].dirty; save(STORE, all); }
            return true;
        }).catch(function () { return false; });   // stays dirty; the Notes page sends it later
    }

    function store(n, status) {
        var all = load(STORE, {});
        all[n.id] = n;
        if (!save(STORE, all)) { if (status) status.textContent = T('notes.full', 'Could not save: this device is out of space.'); return; }
        if (status) status.textContent = user ? T('notes.saving', 'Saving…') : T('notes.savedlocal', 'Saved on this device');
        push(n).then(function (ok) { if (status && user) status.textContent = ok ? T('notes.saved', 'Saved') : T('notes.savedlocal', 'Saved on this device'); });
    }

    var draftRef = PAGE, editing = null;

    function composer() {
        var ta = el('textarea', { class: 'cn-paper', rows: '5', 'aria-label': T('notes.add', 'Add a note'),
            placeholder: T('notes.bodyph', 'Start writing…') });
        try { ta.value = sessionStorage.getItem('bs-cn-draft:' + PAGE) || ''; } catch (e) {}
        ta.addEventListener('input', function () { try { sessionStorage.setItem('bs-cn-draft:' + PAGE, ta.value); } catch (e) {} });
        continueBullets(ta);
        var status = el('span', { class: 'cn-status', 'aria-live': 'polite' });
        var bullet = el('button', { type: 'button', class: 'cn-btn quiet', text: '• ' + T('notes.bullet', 'Bullet point') });
        bullet.addEventListener('mousedown', function (e) { e.preventDefault(); });
        bullet.addEventListener('click', function () { bulletize(ta); });
        var saveBtn = el('button', { type: 'button', class: 'cn-btn primary', text: T('notes.savebtn', 'Save note') });
        saveBtn.addEventListener('click', function () {
            var body = ta.value.replace(/\s+$/, '');
            if (!body.trim()) { ta.focus(); return; }
            var now = Date.now();
            store({ id: newId(), ref: draftRef, title: '', body: body, created: now, t: now, dirty: true }, null);
            ta.value = ''; draftRef = PAGE;
            try { sessionStorage.removeItem('bs-cn-draft:' + PAGE); } catch (e) {}
            render(T('notes.saved', 'Saved'));
        });
        var kids = [];
        if (draftRef !== PAGE) {
            var x = el('button', { type: 'button', 'aria-label': T('sheet.clear', 'Clear'), text: '×' });
            x.addEventListener('click', function () { draftRef = PAGE; render(); });
            kids.push(el('span', { class: 'cn-ref' }, [refLabel(draftRef), x]));
        }
        kids.push(ta, el('div', { class: 'cn-tools' }, [bullet, saveBtn, status]));
        return { node: el('div', {}, kids), ta: ta, status: status };
    }

    function when(n) {
        try { return new Date(n.created || n.t).toLocaleDateString(window.BibleI18n ? window.BibleI18n.lang() : undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch (e) { return ''; }
    }

    function item(n) {
        if (editing === n.id) {
            var ta = el('textarea', { class: 'cn-paper', rows: '5' });
            ta.value = n.body || '';
            continueBullets(ta);
            var keep = el('button', { type: 'button', class: 'cn-btn primary', text: T('notes.savebtn', 'Save note') });
            keep.addEventListener('click', function () {
                n.body = ta.value.replace(/\s+$/, ''); n.t = Date.now(); n.dirty = true;
                store(n, null); editing = null; render(T('notes.saved', 'Saved'));
            });
            var cancel = el('button', { type: 'button', class: 'cn-btn quiet', text: T('notes.cancel', 'Cancel') });
            cancel.addEventListener('click', function () { editing = null; render(); });
            var del = el('button', { type: 'button', class: 'cn-btn quiet', text: T('notes.delete', 'Delete note') }), armed = false;
            del.addEventListener('click', function () {
                if (!armed) { armed = true; del.textContent = T('notes.deleteconfirm', 'Tap again to delete'); return; }
                n.deleted = true; n.body = ''; n.title = ''; n.t = Date.now(); n.dirty = true;
                store(n, null); editing = null; render();
            });
            setTimeout(function () { ta.focus(); }, 0);
            return el('li', {}, [ta, el('div', { class: 'cn-tools' }, [keep, cancel, del])]);
        }
        var edit = el('button', { type: 'button', class: 'cn-edit', text: T('notes.edit', 'Edit') });
        edit.addEventListener('click', function () { editing = n.id; render(); });
        var text = (n.title ? n.title + '\n' : '') + (n.body || '');
        return el('li', {}, [
            el('div', { class: 'cn-meta' }, [el('span', {}, [el('strong', { text: refLabel(n.ref) }), ' · ' + when(n)]), edit]),
            el('p', { class: 'cn-text', text: text })
        ]);
    }

    var comp = null;
    function render(statusText) {
        var list = chapterNotes();
        // Label as a text node (i18n.js translates it in place) plus the count.
        tab.replaceChildren(T('tab.notes', 'Notes'), list.length ? el('span', { class: 'cn-count', text: ' (' + list.length + ')' }) : '');
        comp = composer();
        if (statusText) comp.status.textContent = statusText;
        var kids = [el('h3', { text: T('notes.title', 'My Notes') }), comp.node];
        if (list.length) kids.push(el('ul', { class: 'cn-list' }, list.map(item)));
        else kids.push(el('p', { class: 'cn-empty', text: T('notes.none', 'No notes on this chapter yet. What is God showing you here?') }));
        kids.push(el('a', { class: 'cn-all', href: 'notes.html' }, [T('notes.all', 'All notes') + ' →']));
        pane.replaceChildren.apply(pane, kids);
    }

    /* ---------- signed in: this chapter's notes from other devices ---------- */

    function pull() {
        var owner = load(OWNER, null);
        if (!user || !account || (owner && owner !== user.id)) return;
        account.ready().then(function (sb) {
            return sb.from('notes').select('id,ref,title,body,created_at,updated_at,deleted_at')
                .or('ref.eq.' + PAGE + ',ref.like.' + PAGE + ':*').limit(200);
        }).then(function (res) {
            if (!res || res.error || !res.data) return;
            var all = load(STORE, {}), changed = false;
            res.data.forEach(function (r) {
                var t = Date.parse(r.updated_at), local = all[r.id];
                if (local && (local.dirty || local.t >= t)) return;
                all[r.id] = { id: r.id, ref: r.ref, title: r.title || '', body: r.body || '', created: Date.parse(r.created_at), t: t, deleted: !!r.deleted_at };
                changed = true;
            });
            if (changed && save(STORE, all) && editing == null) render();
        }).catch(function () {});
    }

    /* ---------- open from elsewhere (the verse sheet's Note button) ---------- */

    function open(ref) {
        if (ref && ref.split(':')[0] === PAGE) draftRef = ref;
        editing = null;
        render();
        if (window.switchTab) window.switchTab('notes'); else tab.click();
        pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function () { comp.ta.focus({ preventScroll: true }); }, 350);
    }
    window.BibleChapterNotes = { open: open };

    render();
    if (/^#notes$/.test(location.hash)) setTimeout(function () { open(null); }, 0);
    window.addEventListener('bible-lang', function () { if (editing == null) render(); });
    window.addEventListener('storage', function (e) { if (e.key === STORE && editing == null) render(); });
    if (account) account.onChange(function (u) { user = u || null; if (user) pull(); });

    // Continuous listening (audio.js) swapped the next chapter into this page: its own Notes tab.
    window.addEventListener('bible-chapter', function (e) {
        var next = /^([1-3]?[a-z]+?)(\d+)$/.exec((e.detail && e.detail.page) || '');
        var nextBar = document.querySelector('.study-tabs');
        var nextAfter = document.getElementById('tab-reflection') || document.querySelector('.tab-content:last-of-type');
        if (!next || !nextBar || !nextAfter) return;
        m = next; bar = nextBar; after = nextAfter;
        PAGE = m[1] + m[2]; BOOK = m[1]; CH = m[2];
        draftRef = PAGE; editing = null;
        mount();
        render();
        if (user) pull();
    });
})();
