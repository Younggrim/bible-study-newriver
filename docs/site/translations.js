/* Bibles in other languages: Spanish, Hausa, Yoruba, Igbo, Urdu, Hindi.

   They join the translation picker beside ESV, BSB and the rest, under
   "Other languages". Unlike those five, their text is not baked into each
   chapter page: it is fetched from docs/bible/<CODE>/<page>.json only when
   someone picks that language, so nobody else downloads it. Built by
   build_bibles.py from the eBible.org USFM; see that file for sources and
   licences. Each pane ends with the translation's credit line, which the
   licences require.

   The verse markup matches the other translations
   (<p class="verse" data-v="N"><span class="verse-num">N</span>...),
   so highlights, bookmarks and the saved place in study.js work unchanged.

   Kept identical in both repositories. Does not modify site/script.js; it
   extends switchTranslation() and TRANSLATION_COLORS from outside.          */
(function () {
    'use strict';

    var LANGS = [
        { code: 'RV09', short: 'ESP', label: 'Español', name: 'Reina-Valera 1909', lang: 'es', color: '#7a3b5c',
          credit: 'Santa Biblia Reina-Valera 1909. Public domain.' },
        { code: 'HAU', short: 'HAU', label: 'Hausa', name: 'Sabon Rai Don Kowa', lang: 'ha', color: '#2f6b3a',
          credit: 'Biblica® Open Hausa Contemporary Bible (Littafi Mai Tsarki, Sabon Rai Don Kowa™). Copyright © 2009, 2020 Biblica, Inc.',
          licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'YOR', short: 'YOR', label: 'Yorùbá', name: 'Bíbélì Mímọ́ Yorùbá Òde-Òní', lang: 'yo', color: '#6b4a1f',
          credit: 'Biblica® Open Yoruba Contemporary Bible (Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní). Copyright © 2009, 2017 Biblica, Inc.',
          licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'IBO', short: 'IBO', label: 'Igbo', name: 'Baịbụlụ Nsọ nʼIgbo Ndị Ugbu a', lang: 'ig', color: '#1f5a6b',
          credit: 'Biblica® Open Igbo Contemporary Bible (Baịbụlụ Nsọ nʼIgbo Ndị Ugbu a). Copyright © 1980, 1988, 2019, 2020 Biblica, Inc.',
          licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'URD', short: 'URD', label: 'اردو', name: 'Urdu Geo Version', lang: 'ur', dir: 'rtl', color: '#3b4f7a',
          font: 'Noto Nastaliq Urdu', fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap',
          credit: 'کتابِ مقدّس, Urdu Geo Version. Copyright © 2019 Urdu Geo Version.',
          licence: ['CC BY-NC-ND 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/'] },
        { code: 'HIN', short: 'HIN', label: 'हिन्दी', name: 'Indian Revised Version (IRV) Hindi', lang: 'hi', color: '#8a4b14',
          credit: 'इंडियन रिवाइज्ड वर्जन (IRV) हिंदी - 2019. Copyright © 2017, 2018, 2019 Bridge Connectivity Solutions.',
          licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] }
    ];
    var BY_CODE = {};
    LANGS.forEach(function (l) { BY_CODE[l.code] = l; });

    var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var container = document.querySelector('.scripture-container');
    var isChapter = !!(container && /^\d?[a-z]+\d+$/.test(page));

    // 1. Colours, so script.js restores a saved choice of one of these languages on load.
    if (window.TRANSLATION_COLORS) LANGS.forEach(function (l) { window.TRANSLATION_COLORS[l.code] = l.color; });

    // 2. Every translation picker on the page (chapter top bar, the app's "Choose a Passage").
    //    The chapter top bar is tight on a phone, so it uses three-letter codes like ESV and KJV;
    //    the app's "Choose a Passage" picker has room for each language's own name.
    document.querySelectorAll('select.nav-translation').forEach(function (sel) {
        if (sel.querySelector('optgroup[data-langs]')) return;
        var compact = !!sel.closest('.top-nav');
        var group = document.createElement('optgroup');
        group.label = 'Other languages';
        group.setAttribute('data-langs', '1');
        LANGS.forEach(function (l) {
            var o = document.createElement('option');
            o.value = l.code; o.textContent = compact ? l.short : l.label + ' (' + l.short + ')'; o.lang = l.lang;
            o.title = l.label + ' — ' + l.name;
            group.appendChild(o);
        });
        sel.appendChild(group);
    });

    // A longer name ("Español") must not push the top bar onto a second line on a phone.
    var narrow = document.createElement('style');
    narrow.textContent = '@media (max-width:600px){.top-nav select.nav-translation{max-width:68px;text-overflow:ellipsis}}';
    document.head.appendChild(narrow);

    if (!isChapter) return;

    // 3. An empty pane per language, filled the first time it is chosen.
    var STYLE = ''
        + '.translation-block .bs-d{font-style:italic;opacity:.8;font-size:.9em;margin:0 0 10px}'
        + '.translation-block .bs-credit{font-size:.75rem;line-height:1.5;color:var(--text-faint);margin:18px 0 0;font-family:"Inter",-apple-system,sans-serif;direction:ltr;text-align:left}'
        + '.translation-block .bs-credit a{color:inherit}'
        + '.translation-block[dir="rtl"] .verse{line-height:2.4;font-size:1.15em}'
        + '.translation-block[dir="rtl"] .verse-num{margin-left:6px;margin-right:0}'
        + '.translation-block .bs-msg{font-style:italic;color:var(--text-muted)}';
    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var blocks = container.querySelectorAll('.translation-block');
    var after = blocks[blocks.length - 1];
    LANGS.forEach(function (l) {
        var b = document.createElement('div');
        b.className = 'translation-block';
        b.setAttribute('data-translation', l.code);
        b.lang = l.lang;
        if (l.dir) b.dir = l.dir;
        if (l.font) b.style.fontFamily = '"' + l.font + '", serif';
        after.parentNode.insertBefore(b, after.nextSibling);
        after = b;
    });

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    function credit(l) {
        var p = el('p', 'bs-credit', l.credit + ' ');
        if (l.licence) {
            var a = el('a', null, l.licence[0]);
            a.href = l.licence[1]; a.rel = 'license noopener'; a.target = '_blank';
            p.append('Licensed under ', a, '. Footnotes are not shown.');
        }
        return p;
    }

    var loading = {};
    function load(code) {
        var l = BY_CODE[code], b = container.querySelector('.translation-block[data-translation="' + code + '"]');
        if (!l || !b || b.getAttribute('data-loaded') || loading[code]) return;
        loading[code] = true;
        if (l.fontUrl && !document.querySelector('link[data-font="' + code + '"]')) {
            var link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = l.fontUrl; link.setAttribute('data-font', code);
            document.head.appendChild(link);
        }
        b.replaceChildren(el('p', 'verse bs-msg', 'Loading ' + l.name + '…'));
        fetch('bible/' + code + '/' + page + '.json')
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (data) {
                var out = [];
                (data.v || []).forEach(function (row) {
                    // row: [verse, text, label?, heading?]  label is set for combined verses ("1-2")
                    if (row[3]) out.push(el('p', 'bs-d', row[3]));
                    var p = el('p', 'verse');
                    p.setAttribute('data-v', row[0]);
                    p.append(el('span', 'verse-num', row[2] || String(row[0])), row[1]);
                    out.push(p);
                });
                out.push(credit(l));
                b.replaceChildren.apply(b, out);
                b.setAttribute('data-loaded', '1');
            })
            .catch(function () {
                b.replaceChildren(el('p', 'verse bs-msg', 'Could not load ' + l.name + ' for this chapter. Check your connection, then choose it again.'), credit(l));
            })
            .then(function () { loading[code] = false; });
    }

    // 4. Choosing one of these languages loads it. script.js calls switchTranslation()
    //    both from the picker and when restoring a saved choice, so wrapping it covers both.
    var original = window.switchTranslation;
    if (typeof original === 'function') {
        window.switchTranslation = function (code) {
            original(code);
            if (BY_CODE[code]) load(code);
        };
    }
})();
