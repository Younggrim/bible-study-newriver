/* Bibles in other languages: 29 of them, grouped Africa / South Asia / World.

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
        { code: 'HAU', short: 'HAU', label: 'Hausa', name: 'Sabon Rai Don Kowa', lang: 'ha', group: 'Africa', color: '#2f6b3a', credit: 'Biblica® Open Hausa Contemporary Bible (Littafi Mai Tsarki, Sabon Rai Don Kowa™). Copyright © 2009, 2020 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'YOR', short: 'YOR', label: 'Yorùbá', name: 'Bíbélì Mímọ́ Yorùbá Òde-Òní', lang: 'yo', group: 'Africa', color: '#6b4a1f', credit: 'Biblica® Open Yoruba Contemporary Bible (Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní). Copyright © 2009, 2017 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'IBO', short: 'IBO', label: 'Igbo', name: 'Baịbụlụ Nsọ nʼIgbo Ndị Ugbu a', lang: 'ig', group: 'Africa', color: '#1f5a6b', credit: 'Biblica® Open Igbo Contemporary Bible (Baịbụlụ Nsọ nʼIgbo Ndị Ugbu a). Copyright © 1980, 1988, 2019, 2020 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'SWA', short: 'SWA', label: 'Kiswahili', name: 'Neno: Bibilia Takatifu', lang: 'sw', group: 'Africa', color: '#2c6b5a', credit: 'Biblica® Toleo Wazi Neno: Bibilia Takatifu™ (Open Kiswahili Contemporary Version). Copyright © 1984, 1989, 2009, 2015 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'TWI', short: 'TWI', label: 'Twi (Akuapem)', name: 'Nkwa Asɛm', lang: 'tw', group: 'Africa', color: '#5c4a7a', credit: 'Biblica® Wonhia ɛho kwamma nhoma Akuapem Twi Nkwa Asɛm™. Copyright © 1996, 2020 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'TWA', short: 'TWA', label: 'Twi (Asante)', name: 'Nkwa Asɛm', lang: 'tw', group: 'Africa', color: '#4a5c7a', credit: 'Biblica® Wɔnhia ɛho kwamma nwoma Asante Twi Nkwa Asɛm™. Copyright © 1996, 2020 Biblica, Inc.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'URD', short: 'URD', label: 'اردو', name: 'Urdu Geo Version', lang: 'ur', group: 'South Asia', dir: 'rtl', font: 'Noto Nastaliq Urdu', fontUrl: 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600&display=swap', color: '#3b4f7a', credit: 'کتابِ مقدّس, Urdu Geo Version. Copyright © 2019 Urdu Geo Version.', licence: ['CC BY-NC-ND 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/'] },
        { code: 'HIN', short: 'HIN', label: 'हिन्दी', name: 'Indian Revised Version (IRV) Hindi', lang: 'hi', group: 'South Asia', color: '#8a4b14', credit: 'इंडियन रिवाइज्ड वर्जन (IRV) हिंदी - 2019. Copyright © 2017, 2018, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'BEN', short: 'BEN', label: 'বাংলা', name: 'Indian Revised Version (IRV) Bengali', lang: 'bn', group: 'South Asia', color: '#7a2f4f', credit: 'Indian Revised Version (IRV). Copyright © 2018, 2019 Bridge Connectivity Solutions Pvt. Ltd..', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'TAM', short: 'TAM', label: 'தமிழ்', name: 'Indian Revised Version (IRV) Tamil', lang: 'ta', group: 'South Asia', color: '#6b2f2f', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'TEL', short: 'TEL', label: 'తెలుగు', name: 'Indian Revised Version (IRV) Telugu', lang: 'te', group: 'South Asia', color: '#2f4f6b', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'MAL', short: 'MAL', label: 'മലയാളം', name: 'Indian Revised Version (IRV) Malayalam', lang: 'ml', group: 'South Asia', color: '#3a6b2f', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Communication Systems.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'MAR', short: 'MAR', label: 'मराठी', name: 'Indian Revised Version (IRV) Marathi', lang: 'mr', group: 'South Asia', color: '#7a5a1f', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'GUJ', short: 'GUJ', label: 'ગુજરાતી', name: 'Indian Revised Version (IRV) Gujarati', lang: 'gu', group: 'South Asia', color: '#5a1f7a', credit: 'Indian Revised Version (IRV). Copyright © 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'KAN', short: 'KAN', label: 'ಕನ್ನಡ', name: 'Indian Revised Version (IRV) Kannada', lang: 'kn', group: 'South Asia', color: '#1f6b5a', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'ORI', short: 'ORI', label: 'ଓଡ଼ିଆ', name: 'Indian Revised Version (IRV) Odia', lang: 'or', group: 'South Asia', color: '#6b5a2f', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019, 2021 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'ASM', short: 'ASM', label: 'অসমীয়া', name: 'Indian Revised Version (IRV) Assamese', lang: 'as', group: 'South Asia', color: '#4f2f6b', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2018 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'PAN', short: 'PAN', label: 'ਪੰਜਾਬੀ', name: 'Indian Revised Version (IRV) Punjabi', lang: 'pa', group: 'South Asia', color: '#6b3a1f', credit: 'Indian Revised Version (IRV). Copyright © 2017, 2019 Bridge Connectivity Solutions.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'NEP', short: 'NEP', label: 'नेपाली', name: 'Nepali Unlocked Literal Bible', lang: 'ne', group: 'South Asia', color: '#2f5a6b', credit: 'पवित्र बाइबल, Nepali Unlocked Literal Bible. Copyright © 2019 Door43 World Missions Community.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'RV09', short: 'ESP', label: 'Español', name: 'Reina-Valera 1909', lang: 'es', group: 'World', color: '#7a3b5c', credit: 'Santa Biblia Reina-Valera 1909. Public domain.' },
        { code: 'FRA', short: 'FRA', label: 'Français', name: 'Louis Segond 1910', lang: 'fr', group: 'World', color: '#2f3f7a', credit: 'La Sainte Bible, Louis Segond 1910. Public domain.' },
        { code: 'POR', short: 'POR', label: 'Português', name: 'Bíblia Livre', lang: 'pt', group: 'World', color: '#2f6b4a', credit: 'Bíblia Livre (BLIVRE). Copyright © 2018 Diego Santos, Mario Sérgio e Marco Teles.', licence: ['CC BY 4.0 Brasil', 'https://creativecommons.org/licenses/by/4.0/br/'] },
        { code: 'ARA', short: 'ARA', label: 'العربية', name: 'Van Dyck', lang: 'ar', group: 'World', dir: 'rtl', color: '#5a3a1f', credit: 'الكتاب المقدس، ترجمة فان دايك (Arabic Van Dyck Bible). Public domain.' },
        { code: 'FAS', short: 'FAS', label: 'فارسی', name: 'Old Persian Version', lang: 'fa', group: 'World', dir: 'rtl', color: '#3a5a6b', credit: 'ترجمه قدیم (Old Persian Version). Public domain.' },
        { code: 'ZHS', short: 'ZHS', label: '简体中文', name: 'Chinese Union Version (simplified)', lang: 'zh-Hans', group: 'World', color: '#7a1f1f', credit: '新标点和合本 (Chinese Union Version, simplified). Public domain.' },
        { code: 'ZHT', short: 'ZHT', label: '繁體中文', name: 'Chinese Union Version (traditional)', lang: 'zh-Hant', group: 'World', color: '#6b1f3a', credit: '新標點和合本 (Chinese Union Version, traditional). Public domain.' },
        { code: 'VIE', short: 'VIE', label: 'Tiếng Việt', name: 'Kinh Thánh 1934', lang: 'vi', group: 'World', color: '#1f4f7a', credit: 'Kinh Thánh (Vietnamese Bible, 1925/1934). Public domain.' },
        { code: 'TGL', short: 'TGL', label: 'Tagalog', name: 'Tagalog Unlocked Literal Bible', lang: 'tl', group: 'World', color: '#4a6b1f', credit: 'Banal na Bibliya, Tagalog Unlocked Literal Bible. Copyright © 2018 Door43 World Missions Community.', licence: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'] },
        { code: 'HAT', short: 'HAT', label: 'Kreyòl Ayisyen', name: 'Bib La', lang: 'ht', group: 'World', color: '#1f6b6b', credit: 'Bib La (Haitian Creole Bible). Public domain.' }
    ];
    var GROUPS = ['Africa', 'South Asia', 'World'];
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
        GROUPS.forEach(function (g) {
            var group = document.createElement('optgroup');
            group.label = g === 'World' ? 'World languages' : g;
            group.setAttribute('data-langs', '1');
            LANGS.filter(function (l) { return l.group === g; }).forEach(function (l) {
                var o = document.createElement('option');
                o.value = l.code; o.textContent = compact ? l.short : l.label + ' (' + l.short + ')'; o.lang = l.lang;
                o.title = l.label + ' — ' + l.name;
                group.appendChild(o);
            });
            sel.appendChild(group);
        });
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
