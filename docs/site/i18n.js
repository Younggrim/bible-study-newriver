/* Buttons and labels in the reader's language.

   When someone reads in one of the other-language Bibles (translations.js),
   the interface follows: tab names, the Go buttons, the passage picker, the
   app's bottom bar, book names and "Chapter", and the labels of the
   highlight, notes, streak and account controls. Study notes, commentary
   and other tab contents stay in English.

   Wording lives in site/i18n/<lang>.json (written by i18n_strings.py) and
   book names in bible/<CODE>/books.json (written by build_bibles.py). Both
   are kept in localStorage after the first load so pages switch language
   instantly, and offline.

   window.BibleI18n
     .lang()            "en", "es", "hi", ...
     .t(key, fallback)  the label in the current language
     .book(slug)        the book's name in the current Bible, or null
     .relTime(ms)       "3 hours ago" in the current language
   Fires window "bible-lang" after the language changes.

   Kept identical in both repositories.                                     */
(function () {
    'use strict';

    // Bible code -> interface language (see LANGS in i18n_strings.py)
    var LANG = { RV09: 'es', FRA: 'fr', POR: 'pt', ARA: 'ar', FAS: 'fa', ZHS: 'zh-Hans', ZHT: 'zh-Hant', VIE: 'vi',
        TGL: 'tl', HAT: 'ht', HAU: 'ha', YOR: 'yo', IBO: 'ig', SWA: 'sw', TWI: 'tw', TWA: 'tw', URD: 'ur', HIN: 'hi',
        BEN: 'bn', TAM: 'ta', TEL: 'te', MAL: 'ml', MAR: 'mr', GUJ: 'gu', KAN: 'kn', ORI: 'or', ASM: 'as', PAN: 'pa', NEP: 'ne' };

    var EN = {
        'tab.summary': 'Summary', 'tab.authorship': 'Authorship & Background', 'tab.mapgeo': 'Map & Geography',
        'tab.commentary': 'Commentary', 'tab.videos': 'Videos', 'tab.articles': 'Articles', 'tab.reflection': 'Reflection',
        'nav.go': 'Go', 'nav.ch': 'Ch {n}', 'nav.chapter': '{book} — Chapter {n}', 'home.choose': 'Choose a Passage', 'home.goto': 'Go to Chapter',
        'bn.bible': 'Bible', 'bn.topical': 'Topical', 'bn.life': 'Life', 'bn.devotional': 'Devotional', 'bn.memory': 'Memory', 'bn.notes': 'Notes'
    };

    function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

    var code = null, lang = 'en', dict = {}, books = null;

    function current() {
        var c = null;
        try { c = localStorage.getItem('preferredTranslation'); } catch (e) {}
        return c && LANG[c] ? c : null;
    }

    function t(key, fallback) {
        var v = dict[key];
        if (v == null) v = fallback != null ? fallback : EN[key];
        return v == null ? key : v;
    }
    function fmt(key, vars, fallback) {
        var s = t(key, fallback);
        Object.keys(vars || {}).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
        return s;
    }
    function book(slug) { return books && books[slug] ? books[slug] : null; }
    function enBook(slug) {
        return slug.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon')
            .replace(/\b(?!of\b)[a-z]/g, function (m) { return m.toUpperCase(); });
    }
    function bookName(slug) { return book(slug) || enBook(slug); }
    function relTime(ms) {
        var mins = Math.round((ms - Date.now()) / 60000);
        try {
            var rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en' : lang, { numeric: 'auto' });
            if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
            var h = Math.round(mins / 60);
            if (Math.abs(h) < 24) return rtf.format(h, 'hour');
            return rtf.format(Math.round(h / 24), 'day');
        } catch (e) { return ''; }
    }

    /* ---------- the page's own labels ---------- */

    function setText(node, text) {
        if (!node) return;
        if (!node.hasAttribute('data-en')) node.setAttribute('data-en', node.textContent);
        node.textContent = text != null ? text : node.getAttribute('data-en');
    }
    // Only the element's own leading text, keeping any icon or count inside it.
    function setLead(node, text) {
        if (!node) return;
        var tn = null;
        for (var i = 0; i < node.childNodes.length; i++) { if (node.childNodes[i].nodeType === 3 && node.childNodes[i].nodeValue.trim()) { tn = node.childNodes[i]; break; } }
        if (!tn) return;
        if (!node.hasAttribute('data-en')) node.setAttribute('data-en', tn.nodeValue.trim());
        tn.nodeValue = text != null ? text : node.getAttribute('data-en');
    }
    function L(key) { return lang === 'en' ? null : t(key); }

    function chapterOf(href) { var m = /([1-3]?[a-z]+?)(\d+)\.html/.exec(href || ''); return m ? { b: m[1], c: m[2] } : null; }

    function apply() {
        // Study tabs and the heading at the top of each pane.
        document.querySelectorAll('.study-tab[data-tab]').forEach(function (tab) {
            var k = 'tab.' + tab.getAttribute('data-tab');
            if (!(k in EN)) return;
            setLead(tab, L(k));
            var pane = document.getElementById('tab-' + tab.getAttribute('data-tab'));
            var h = pane && pane.querySelector('h3');
            if (h && (h.hasAttribute('data-en') || h.textContent.trim() === EN[k])) setLead(h, L(k));
        });
        // Go buttons and the app's passage picker.
        document.querySelectorAll('.top-nav button[onclick^="goToChapter"]').forEach(function (b) { setText(b, L('nav.go')); });
        document.querySelectorAll('.nav-go-btn').forEach(function (b) { setText(b, L('home.goto')); });
        document.querySelectorAll('.pwa-bible-nav > h3').forEach(function (h) { setText(h, L('home.choose')); });
        // Book and chapter pickers.
        document.querySelectorAll('select.nav-book-select option[value]').forEach(function (o) {
            setText(o, lang === 'en' ? null : bookName(o.value));
        });
        document.querySelectorAll('select.nav-chapter-select option').forEach(function (o) {
            if (!/^\d+$/.test(o.value)) return;
            o.textContent = fmt('nav.ch', { n: o.value });
        });
        // Chapter heading, e.g. "Luke — Chapter 6".
        var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
        var here = chapterOf(page + '.html');
        var h1 = document.querySelector('.book-header h1');
        if (h1 && here && /— Chapter \d+$/.test(h1.getAttribute('data-en') || h1.textContent)) {
            setText(h1, lang === 'en' ? null : fmt('nav.chapter', { book: bookName(here.b), n: here.c }));
        }
        // Previous / next chapter buttons and the label between them.
        document.querySelectorAll('.chapter-nav-arrows a.chapter-arrow-btn').forEach(function (a) {
            var to = chapterOf(a.getAttribute('href'));
            if (!to) return;
            var label = to.b === (here && here.b) ? fmt('nav.ch', { n: to.c }) : bookName(to.b) + ' ' + to.c;
            for (var i = 0; i < a.childNodes.length; i++) {
                var n = a.childNodes[i];
                if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = a.getAttribute('rel') === 'prev' ? ' ' + label : label + ' '; break; }
            }
        });
        var mid = document.querySelector('.chapter-nav-arrows > span');
        if (mid && here) mid.textContent = bookName(here.b) + ' ' + here.c;
        // The app's bottom bar.
        document.querySelectorAll('.pwa-bottom-nav .pwa-nav-item[data-section]').forEach(function (a) {
            var k = 'bn.' + a.getAttribute('data-section');
            if (k in EN) setText(a.querySelector('span'), L(k));
        });
        // Any element that asks for a label by key.
        document.querySelectorAll('[data-i18n]').forEach(function (n) { setText(n, L(n.getAttribute('data-i18n'))); });
    }

    /* ---------- switching ---------- */

    function fetchJSON(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

    function use(newCode, announce) {
        code = newCode;
        lang = newCode ? LANG[newCode] : 'en';
        dict = lang === 'en' ? {} : (load('bs-i18n-' + lang) || {});
        books = newCode ? load('bs-books-' + newCode) : null;
        apply();
        if (announce) window.dispatchEvent(new Event('bible-lang'));
        if (lang === 'en') return;
        // Refresh from the site (first visit, or wording updated), then re-apply if anything changed.
        var want = newCode;
        Promise.all([
            fetchJSON('site/i18n/' + lang + '.json').catch(function () { return null; }),
            fetchJSON('bible/' + newCode + '/books.json').catch(function () { return null; })
        ]).then(function (res) {
            if (code !== want) return;
            var changed = false;
            if (res[0] && JSON.stringify(res[0]) !== JSON.stringify(dict)) { dict = res[0]; save('bs-i18n-' + lang, dict); changed = true; }
            if (res[1] && JSON.stringify(res[1]) !== JSON.stringify(books)) { books = res[1]; save('bs-books-' + newCode, books); changed = true; }
            if (changed) { apply(); window.dispatchEvent(new Event('bible-lang')); }
        });
    }

    window.BibleI18n = {
        lang: function () { return lang; }, t: t, fmt: fmt, book: book, bookName: bookName, relTime: relTime, apply: apply
    };

    use(current(), false);

    // Picking a Bible changes the interface language with it.
    var original = window.switchTranslation;
    if (typeof original === 'function') {
        window.switchTranslation = function (c) {
            original(c);
            var next = LANG[c] ? c : null;
            if (next !== code) use(next, true);
        };
    }
    // The app's passage picker only stores the choice; follow it too.
    document.querySelectorAll('select.nav-translation').forEach(function (sel) {
        sel.addEventListener('change', function () {
            var next = LANG[sel.value] ? sel.value : null;
            if (next !== code) setTimeout(function () { use(next, true); }, 0);
        });
    });
    // Choosing a book rebuilds the chapter list in English; label it again.
    document.querySelectorAll('select.nav-book-select').forEach(function (sel) {
        sel.addEventListener('change', function () { setTimeout(apply, 0); });
    });
    // Another tab or the app changed the language.
    window.addEventListener('storage', function (e) { if (e.key === 'preferredTranslation') use(current(), true); });
    // script.js adds the chapter arrows and bottom bar as the page loads.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
})();
