/* The Bible in its original languages: Hebrew (Old Testament) and Greek (New Testament).

   1. Word by word: tapping a verse opens the verse sheet (study.js); its "Hebrew" or
      "Greek" button opens a panel listing each original word with its pronunciation,
      meaning, grammar and Strong's number.
   2. Tapping a word opens its lexicon entry and every other verse that uses it.
   3. "Hebrew" / "Greek" is also in the translation picker, under "Original languages",
      to read the whole chapter in the original.

   Data: docs/bible/ORIG/, built by build_original.py from STEPBible.org (Tyndale House,
   CC BY 4.0) and Strong's Hebrew Dictionary (OpenScriptures.org, CC BY 4.0). A chapter,
   lexicon bucket or word list is fetched only when someone opens it.

   Kept identical in both repositories. Does not modify site/script.js; like
   translations.js it extends switchTranslation() and TRANSLATION_COLORS from outside,
   and it adds its button through study.js's window.BibleSheetExtras hook.            */
(function () {
    'use strict';

    var BASE = 'bible/ORIG/';
    var CODE = 'ORIG';
    var FONTS = 'https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;600&family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400&display=swap';
    var SLUGS = ['genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy', 'joshua', 'judges', 'ruth', '1samuel', '2samuel',
        '1kings', '2kings', '1chronicles', '2chronicles', 'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'proverbs',
        'ecclesiastes', 'songofsolomon', 'isaiah', 'jeremiah', 'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel',
        'amos', 'obadiah', 'jonah', 'micah', 'nahum', 'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
        'matthew', 'mark', 'luke', 'john', 'acts', 'romans', '1corinthians', '2corinthians', 'galatians', 'ephesians',
        'philippians', 'colossians', '1thessalonians', '2thessalonians', '1timothy', '2timothy', 'titus', 'philemon',
        'hebrews', 'james', '1peter', '2peter', '1john', '2john', '3john', 'jude', 'revelation'];
    var STEP = ['Gen', 'Exo', 'Lev', 'Num', 'Deu', 'Jos', 'Jdg', 'Rut', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh',
        'Est', 'Job', 'Psa', 'Pro', 'Ecc', 'Sng', 'Isa', 'Jer', 'Lam', 'Ezk', 'Dan', 'Hos', 'Jol', 'Amo', 'Oba', 'Jon', 'Mic',
        'Nam', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal', 'Mat', 'Mrk', 'Luk', 'Jhn', 'Act', 'Rom', '1Co', '2Co', 'Gal', 'Eph', 'Php',
        'Col', '1Th', '2Th', '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jas', '1Pe', '2Pe', '1Jn', '2Jn', '3Jn', 'Jud', 'Rev'];
    var CREDIT = {
        he: 'Hebrew text, glosses and grammar: Translators Amalgamated Hebrew OT (the Leningrad Codex, following the Qere) and the Brief Lexicon of Extended Strongs, from STEPBible.org, based on work at Tyndale House, Cambridge. Definitions: Strong’s Hebrew Dictionary, from OpenScriptures.org. Cantillation marks are not shown.',
        grc: 'Greek text, glosses and grammar: Translators Amalgamated Greek NT (the Nestle-Aland text) and the Brief Lexicon of Extended Strongs (Abbott-Smith), from STEPBible.org, based on work at Tyndale House, Cambridge. Verses the oldest manuscripts leave out are given from the Greek behind the KJV, and marked.'
    };
    var LICENCE = ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'];

    function T(key, fallback) { return window.BibleI18n ? window.BibleI18n.t(key, fallback) : fallback; }
    function bookLabel(slug) {
        if (window.BibleI18n && window.BibleI18n.book && window.BibleI18n.book(slug)) return window.BibleI18n.book(slug);
        return slug.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon')
            .replace(/\b(?!of\b)[a-z]/g, function (m) { return m.toUpperCase(); });
    }
    function el(tag, cls, kids) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        (kids == null ? [] : [].concat(kids)).forEach(function (c) {
            if (c == null || c === false) return;
            n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return n;
    }
    function parsePage(name) {
        var m = /^(\d?[a-z]+?)(\d+)$/.exec(name || '');
        if (!m) return null;
        var i = SLUGS.indexOf(m[1]);
        return i < 0 ? null : { book: m[1], chapter: parseInt(m[2], 10), index: i, greek: i >= 39 };
    }

    var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var here = parsePage(page);
    var container = document.querySelector('.scripture-container');
    var isChapter = !!(container && here);

    /* ---------- data ---------- */

    var cache = {};
    function getJSON(path) {
        if (!cache[path]) {
            cache[path] = fetch(BASE + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
            cache[path].catch(function () { delete cache[path]; });
        }
        return cache[path];
    }
    function bucketOf(strong) {
        var m = /^([HGA])0*(\d+)/.exec(strong || '');
        return m ? (m[1] === 'A' ? 'H' : m[1]) + Math.floor(parseInt(m[2], 10) / 100) : null;
    }
    function rootOf(w, greek) {
        if (greek) return w[3];
        var m = /\{([HA]?\d+[A-Za-z]?)\}/.exec(w[3] || '');
        return m ? m[1].replace(/^A/, 'H') : null;
    }
    function lexEntry(strong) {
        var b = bucketOf(strong);
        if (!b) return Promise.resolve(null);
        return getJSON('lex/' + b + '.json').then(function (d) {
            if (d[strong]) return d[strong];
            var base = strong.replace(/[A-Za-z]$/, '');
            for (var k in d) if (k.replace(/[A-Za-z]$/, '') === base) return d[k];
            return null;
        });
    }
    function verseRef(id) {
        var b = Math.floor(id / 1000000), c = Math.floor(id / 1000) % 1000, v = id % 1000;
        return { slug: SLUGS[b - 1], chapter: c, verse: v };
    }

    var fontsAdded = false;
    function addFonts() {
        if (fontsAdded) return;
        fontsAdded = true;
        var link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = FONTS;
        document.head.appendChild(link);
    }

    /* ---------- plain-English grammar ---------- */

    var HG = { m: 'masculine', f: 'feminine', c: 'common', b: 'masc. or fem.' };
    var HN = { s: 'singular', p: 'plural', d: 'dual' };
    var HS = { a: 'absolute', c: 'construct ("of")', d: 'determined' };
    var HP = { 1: '1st person', 2: '2nd person', 3: '3rd person' };
    var SUFFIX = { '1cs': 'my, me', '2ms': 'your, you (m.)', '2fs': 'your, you (f.)', '3ms': 'his, him, its', '3fs': 'her, its',
        '1cp': 'our, us', '2mp': 'your, you (pl.)', '2fp': 'your, you (f. pl.)', '3mp': 'their, them', '3fp': 'their, them (f.)' };
    var STEMS_H = { q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil', H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal',
        r: 'Hithpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal', f: 'Hithpalpel',
        D: 'Nithpael', j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil', v: 'Hishtaphel', w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel' };
    var STEMS_A = { q: 'Peal', Q: 'Peil', u: 'Hithpeel', p: 'Pael', P: 'Ithpaal', M: 'Hithpaal', a: 'Aphel', h: 'Haphel', s: 'Saphel',
        e: 'Shaphel', H: 'Hophal', i: 'Ithpeel', t: 'Hishtaphel', v: 'Ishtaphel', w: 'Hithaphel', o: 'Polel', z: 'Ithpoel',
        r: 'Hithpolel', f: 'Hithpalpel', b: 'Hephal', c: 'Tiphel', m: 'Poel', l: 'Palpel', L: 'Ithpalpel', O: 'Ithpolel', G: 'Ittaphal' };
    var ASPECT = { p: 'perfect', q: 'perfect with "and" (sequential)', i: 'imperfect', w: 'imperfect with "and" (narrative past)',
        h: 'cohortative ("let me / let us")', j: 'jussive ("let him")', v: 'imperative (command)', r: 'participle', s: 'passive participle',
        a: 'infinitive absolute', c: 'infinitive construct' };
    var PART = { a: 'particle of affirmation', c: 'particle', d: 'the definite article ("the")', e: 'particle of exhortation',
        i: 'question marker', j: 'interjection', m: 'particle', n: 'negative ("not")', o: 'direct-object marker (not translated)', r: 'relative particle ("who, which")' };

    function pgn(s) {   // "3ms" -> "3rd person masculine singular"
        var out = [];
        for (var i = 0; i < s.length; i++) {
            var ch = s[i];
            if (HP[ch]) out.push(HP[ch]);
            else if (i === s.length - 1 && /[acd]/.test(ch) && out.length >= 1 && /singular|plural|dual/.test(out[out.length - 1])) out.push(HS[ch]);
            else if (HN[ch] && out.some(function (x) { return /masc|fem|common/.test(x); })) out.push(HN[ch]);
            else if (HG[ch]) out.push(HG[ch]);
            else if (HN[ch]) out.push(HN[ch]);
        }
        return out.join(' ');
    }

    function hebrewSegment(seg, aramaic) {
        var c = seg[0], rest = seg.slice(1);
        switch (c) {
            case 'A': return ({ a: 'adjective', c: 'number', g: 'gentilic adjective', o: 'ordinal number' }[rest[0]] || 'adjective') + (rest.length > 1 ? ', ' + pgn(rest.slice(1)) : '');
            case 'C': return 'conjunction';
            case 'D': return 'adverb';
            case 'N':
                if (rest[0] === 'p') return ({ m: 'name of a man', f: 'name of a woman', l: 'name of a place', t: 'title or name' }[rest[1]] || 'proper name');
                return (rest[0] === 'g' ? 'gentilic noun' : 'noun') + (rest.length > 1 ? ', ' + pgn(rest.slice(1)) : '');
            case 'P': return ({ d: 'demonstrative pronoun', f: 'indefinite pronoun', i: 'interrogative pronoun', p: 'personal pronoun', r: 'relative pronoun' }[rest[0]] || 'pronoun') + (rest.length > 1 ? ', ' + pgn(rest.slice(1)) : '');
            case 'R': return rest[0] === 'd' ? 'preposition with "the"' : 'preposition';
            case 'S':
                if (rest[0] === 'p') return 'suffix: ' + (SUFFIX[rest.slice(1)] || pgn(rest.slice(1)));
                return ({ d: 'directional ending ("toward")', h: 'paragogic ending', n: 'paragogic ending' }[rest[0]] || 'suffix');
            case 'T': return PART[rest[0]] || 'particle';
            case 'V':
                var stem = (aramaic ? STEMS_A : STEMS_H)[rest[0]] || '', asp = ASPECT[rest[1]] || '';
                var more = rest.slice(2);
                return ['verb', stem, asp].filter(Boolean).join(', ') + (more ? ', ' + pgn(more) : '');
            default: return '';
        }
    }

    var GCASE = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
    var GNUM = { S: 'singular', P: 'plural' };
    var GGEN = { M: 'masculine', F: 'feminine', N: 'neuter' };
    var GTENSE = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect' };
    var GVOICE = { A: 'active', M: 'middle', P: 'passive', E: 'middle or passive', D: 'middle (deponent)', O: 'passive (deponent)',
        N: 'middle or passive (deponent)', Q: 'impersonal active', X: '' };
    var GMOOD = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle', R: 'imperative participle' };
    var GHEAD = { N: 'noun', A: 'adjective', T: 'article ("the")', P: 'personal pronoun', R: 'relative pronoun', C: 'reciprocal pronoun',
        D: 'demonstrative pronoun', K: 'correlative pronoun', I: 'interrogative pronoun', X: 'indefinite pronoun', Q: 'correlative pronoun',
        F: 'reflexive pronoun', S: 'possessive pronoun', ADV: 'adverb', CONJ: 'conjunction', COND: 'conditional ("if")', PRT: 'particle',
        PREP: 'preposition', INJ: 'interjection', ARAM: 'Aramaic word', HEB: 'Hebrew word' };
    var GEXTRA = { T: 'title', L: 'place name', PRI: 'proper name', NUI: 'number', LI: 'letter', N: 'negative', I: 'question',
        C: 'contracted', S: 'superlative', K: 'combined with "and"', ATT: 'Attic form', ABB: 'abbreviated', P: 'with particle' };

    function greekForm(s) {   // "NSM" or "1GS" or "3ASM"
        var out = [], i = 0;
        if (/^[123]/.test(s)) { out.push(HP[s[0]]); i = 1; }
        if (GCASE[s[i]]) out.push(GCASE[s[i++]]);
        if (GNUM[s[i]]) out.push(GNUM[s[i++]]);
        if (GGEN[s[i]]) out.push(GGEN[s[i++]]);
        if (out.length === 1 && /person/.test(out[0]) && GNUM[s[s.length - 1]]) out.push(GNUM[s[s.length - 1]]);
        return out.join(' ');
    }

    function greekGrammar(code) {
        var p = (code || '').split('-'), head = p[0];
        if (head === 'V') {
            var m = /^(2?)([A-Z])([A-Z])([A-Z])$/.exec(p[1] || '');
            if (!m) return 'verb';
            var bits = ['verb', (m[1] ? '2nd ' : '') + (GTENSE[m[2]] || ''), GVOICE[m[3]], GMOOD[m[4]]];
            if (p[2]) bits.push(greekForm(p[2]));
            return bits.filter(Boolean).join(', ');
        }
        var name = GHEAD[head] || head.toLowerCase();
        var rest = p.slice(1), form = '';
        if (rest.length && /^[123]?[NGDAV][SP]?[MFN]?$|^[123][SP]$/.test(rest[0]) && !/^(ADV|CONJ|PRT|PREP|INJ|COND|HEB|ARAM)$/.test(head)) form = greekForm(rest.shift());
        var extras = rest.map(function (x) { return GEXTRA[x]; }).filter(Boolean);
        return [name, form].concat(extras).filter(Boolean).join(', ');
    }

    function lexMorph(m) {   // TBESH/TBESG "H:N-M", "G:V", "N:N-M-P"
        var lang = { H: 'Hebrew', A: 'Aramaic', G: 'Greek', N: 'Name' }[m.split(':')[0]] || '';
        var t = (m.split(':')[1] || '').split('-');
        var kind = { A: 'adjective', Adv: 'adverb', Art: 'article', Cond: 'conditional', Conj: 'conjunction', Cor: 'correlative',
            DemP: 'demonstrative pronoun', ImpP: 'pronoun', Intg: 'interrogative', Intj: 'interjection', N: 'noun', Neg: 'negative',
            Part: 'particle', Prep: 'preposition', PerP: 'personal pronoun', PosP: 'possessive pronoun', RefP: 'reflexive pronoun',
            RelP: 'relative pronoun', V: 'verb', ADV: 'adverb', CONJ: 'conjunction', PREP: 'preposition', PRT: 'particle', INJ: 'interjection' }[t[0]] || '';
        var g = { M: 'masculine', F: 'feminine', N: 'neuter', 'M/F': 'masculine or feminine' }[t[1]] || '';
        var extra = { P: 'person', L: 'place', T: 'title', PG: 'people group', LG: 'people group' }[t[2]] || '';
        return [lang, [g, kind].filter(Boolean).join(' '), extra].filter(Boolean).join(' · ');
    }

    // "be./re.Shit" -> syllables, the stressed one (capital) marked.
    function translitNode(raw, greek) {
        var span = el('span', 'og-tr');
        if (greek || !/\./.test(raw)) { span.textContent = raw; return span; }
        raw.split('.').forEach(function (syl, i) {
            if (i) span.appendChild(document.createTextNode('·'));
            if (/[A-Z]/.test(syl)) span.appendChild(el('b', null, syl.toLowerCase()));
            else span.appendChild(document.createTextNode(syl));
        });
        return span;
    }
    function shortStrong(s) { return (s || '').replace(/^([HG])0*(\d+)[A-Za-z]?$/, '$1$2'); }

    // "<the>", "<obj.>": in the original but best left untranslated.
    function glossNode(g) {
        var m = /^<(.*)>$/.exec(g);
        if (!m) return el('span', 'og-gl', g || '—');
        var n = el('span', 'og-gl og-untr', m[1].replace(/^obj\.$/, 'object marker'));
        n.title = T('orig.untranslated', 'In the original, but usually not translated');
        return n;
    }
    function plainTranslit(raw, greek) { return greek ? raw : raw.replace(/\./g, '').toLowerCase(); }

    /* ---------- style ---------- */

    var STYLE = ''
        + '.og-veil{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.28);display:flex;align-items:flex-end;justify-content:center}'
        + '.og-panel{background:#fff;color:var(--ink-deep);width:100%;max-width:560px;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;border-radius:14px 14px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.18);font-family:"Inter",-apple-system,sans-serif}'
        + '.og-head{display:flex;align-items:center;gap:8px;padding:12px 12px 10px 16px;border-bottom:1px solid var(--rule-soft)}'
        + '.og-head h2{flex:1;margin:0;font-size:1rem;font-weight:700;font-family:inherit;color:var(--ink-deep)}'
        + '.og-head h2 small{display:block;font-weight:500;font-size:.75rem;color:var(--text-faint)}'
        + '.og-btn{background:none;border:0;font:inherit;color:var(--text-faint);cursor:pointer;padding:6px 8px;border-radius:8px;font-size:1.4rem;line-height:1}'
        + '.og-back{font-size:.9rem;font-weight:600;color:var(--accent-link)}'
        + '.og-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px calc(18px + env(safe-area-inset-bottom,0px))}'
        + '.og-he{font-family:"Noto Serif Hebrew","SBL Hebrew","Times New Roman",serif}'
        + '.og-grc{font-family:"Gentium Book Plus","Gentium Plus","Noto Serif",serif}'
        + '.og-verse{margin:0 0 6px;font-size:1.35rem;line-height:1.9}'
        + '.og-verse[dir=rtl]{text-align:right;font-size:1.55rem}'
        + '.og-verse .ow{cursor:pointer;border-radius:4px;padding:0 1px}'
        + '.og-verse .ow:hover,.og-verse .ow.on{background:var(--bg-tint)}'
        + '.og-sec{margin:4px 0 14px}'
        + '.og-sec h3{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);margin:14px 0 6px;font-family:inherit}'
        + '.og-flag{font-size:.8rem;color:var(--text-muted);background:var(--bg-tint);border-radius:8px;padding:8px 10px;margin:4px 0 10px}'
        + '.og-words{list-style:none;margin:0;padding:0}'
        + '.og-word{border-top:1px solid var(--rule-soft)}'
        + '.og-word button{display:block;width:100%;text-align:left;background:none;border:0;font:inherit;color:inherit;cursor:pointer;padding:10px 2px}'
        + '.og-word button:hover,.og-word.on button{background:var(--bg-tint)}'
        + '.og-line{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}'
        + '.og-w{font-size:1.45rem;line-height:1.3;color:var(--ink-deep)}'
        + '.og-he.og-w{font-size:1.6rem}'
        + '.og-gl{font-weight:700;font-size:.98rem}'
        + '.og-untr{font-weight:500;font-style:italic;color:var(--text-faint)}'
        + '.og-tr{color:var(--text-muted);font-size:.85rem}'
        + '.og-tr b{font-weight:700;color:var(--ink-deep)}'
        + '.og-gr{font-size:.8rem;color:var(--text-muted);margin-top:3px}'
        + '.og-num{float:right;font-size:.72rem;font-weight:600;color:var(--accent-link);border:1px solid var(--border-light);border-radius:6px;padding:1px 6px;margin-left:8px}'
        + '.og-parts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}'
        + '.og-part{font-size:.78rem;background:var(--bg-tint);border-radius:6px;padding:3px 7px;color:var(--text-muted)}'
        + '.og-part.root{background:transparent;border:1px solid var(--border-light)}'
        + '.og-part .og-he{font-size:1rem;color:var(--ink-deep);margin-right:4px}'
        + '.og-note{font-size:.78rem;color:var(--text-faint);margin:6px 0 0;font-style:italic}'
        + '.og-lex-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:4px 0 2px}'
        + '.og-lex-top .og-w{font-size:2rem}'
        + '.og-lex-gloss{font-size:1.1rem;font-weight:700;margin:4px 0}'
        + '.og-lex-kind{font-size:.8rem;color:var(--text-muted);margin:0 0 10px}'
        + '.og-def{font-size:.9rem;line-height:1.6;color:var(--text-body);font-family:"Gentium Book Plus","Noto Serif Hebrew",Georgia,serif}'
        + '.og-def a{color:var(--accent-link);cursor:pointer;text-decoration:underline}'
        + '.og-count{font-size:.9rem;margin:16px 0 8px;font-weight:600}'
        + '.og-book{font-size:.8rem;font-weight:700;color:var(--text-faint);margin:10px 0 4px}'
        + '.og-refs{display:flex;flex-wrap:wrap;gap:6px}'
        + '.og-refs a{font-size:.82rem;padding:4px 8px;border-radius:6px;background:var(--bg-tint);color:var(--ink-deep);text-decoration:none}'
        + '.og-refs a.here{background:var(--accent-link);color:#fff}'
        + '.og-more{margin-top:10px;font:inherit;font-size:.85rem;font-weight:600;padding:8px 12px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-tint);color:var(--ink-deep);cursor:pointer}'
        + '.og-credit{font-size:.72rem;line-height:1.5;color:var(--text-faint);margin:18px 0 0}'
        + '.og-credit a{color:inherit}'
        + '.og-msg{font-style:italic;color:var(--text-muted)}'
        + '.og-btn:focus-visible,.og-word button:focus-visible,.og-refs a:focus-visible,.og-more:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
        + '.translation-block[data-translation="ORIG"] .verse{line-height:2}'
        + '.translation-block[data-translation="ORIG"][dir="rtl"] .verse{font-size:1.3em;line-height:2.1}'
        + '.translation-block[data-translation="ORIG"][dir="rtl"] .verse-num{margin-left:8px;margin-right:0}'
        + '.translation-block[data-translation="ORIG"] .bs-credit{font-size:.75rem;line-height:1.5;color:var(--text-faint);margin:18px 0 0;font-family:"Inter",-apple-system,sans-serif;direction:ltr;text-align:left}'
        + '.translation-block[data-translation="ORIG"] .bs-credit a{color:inherit}'
        + '.translation-block[data-translation="ORIG"] .og-kv{font-size:.72rem;font-family:"Inter",-apple-system,sans-serif;color:var(--text-faint);font-style:italic;margin-inline-start:6px}'
        + '.translation-block[data-translation="ORIG"] .og-title{font-style:italic;opacity:.85}';

    function injectStyle() {
        if (document.getElementById('og-style')) return;
        var s = document.createElement('style');
        s.id = 'og-style'; s.textContent = STYLE;
        document.head.appendChild(s);
    }

    function credit(lang, cls) {
        var p = el('p', cls || 'og-credit', CREDIT[lang] + ' Licensed under ');
        var a = el('a', null, LICENCE[0]);
        a.href = LICENCE[1]; a.rel = 'license noopener'; a.target = '_blank';
        p.append(a, '.');
        return p;
    }

    /* ---------- the panel ---------- */

    var veil = null, panel = null, stack = [], lastFocus = null;

    function closePanel() {
        if (!veil) return;
        veil.remove(); veil = null; panel = null; stack = [];
        document.removeEventListener('keydown', onKey, true);
        if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
    }
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); if (stack.length > 1) back(); else closePanel(); }
    }
    function back() { stack.pop(); render(); }

    function show(view) {
        injectStyle(); addFonts();
        if (!veil) {
            lastFocus = document.activeElement;
            veil = el('div', 'og-veil');
            veil.addEventListener('click', function (e) { if (e.target === veil) closePanel(); });
            panel = el('div', 'og-panel');
            panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
            veil.appendChild(panel);
            document.body.appendChild(veil);
            document.addEventListener('keydown', onKey, true);
        }
        stack.push(view);
        render();
    }

    function render() {
        var view = stack[stack.length - 1];
        if (!view) { closePanel(); return; }
        var title = el('h2', null, [view.title, view.sub ? el('small', null, view.sub) : null]);
        var head = el('div', 'og-head');
        if (stack.length > 1) {
            var b = el('button', 'og-btn og-back', '‹ ' + T('orig.back', 'Back'));
            b.type = 'button';
            b.addEventListener('click', back);
            head.appendChild(b);
        }
        var x = el('button', 'og-btn', '×');
        x.type = 'button'; x.setAttribute('aria-label', T('orig.close', 'Close'));
        x.addEventListener('click', closePanel);
        head.append(title, x);
        var body = el('div', 'og-body');
        panel.setAttribute('aria-label', view.title);
        panel.replaceChildren(head, body);
        view.fill(body);
        if (view.scroll) body.scrollTop = view.scroll;
        body.addEventListener('scroll', function () { view.scroll = body.scrollTop; });
        x.focus({ preventScroll: true });
    }

    function refLabel(slug, ch, verses) {
        return bookLabel(slug) + ' ' + ch + (verses && verses.length ? ':' + verses.join(', ') : '');
    }

    // 1. Word by word for the chosen verses.
    function openWords(slug, chapter, verses) {
        var info = parsePage(slug + chapter);
        if (!info) return;
        verses = verses.slice().sort(function (a, b) { return a - b; });
        var greek = info.greek;
        var name = greek ? T('orig.greek', 'Greek') : T('orig.hebrew', 'Hebrew');
        var view = {
            title: refLabel(slug, chapter, compact(verses)),
            sub: name + ' · ' + T('orig.wordbyword', 'word by word'),
            fill: function (body) {
                body.appendChild(el('p', 'og-msg', T('orig.loading', 'Loading…')));
                getJSON(slug + chapter + '.json').then(function (data) {
                    body.replaceChildren();
                    var byV = {};
                    (data.v || []).forEach(function (r) { byV[r[0]] = r[1]; });
                    var aramaic = false;
                    verses.forEach(function (v) {
                        var groups = [];
                        if (v === 1 && data.t) groups.push({ label: T('orig.title', 'Title'), words: data.t });
                        groups.push({ label: verses.length > 1 || data.t && v === 1 ? T('orig.verse', 'Verse') + ' ' + v : '', words: byV[v] || [] });
                        groups.forEach(function (g) {
                            g.words.forEach(function (w) { if (!greek && /^A/.test(w[4] || '')) aramaic = true; });
                            body.appendChild(verseSection(g, greek, (data.k || []).indexOf(v) >= 0, slug, chapter, v));
                        });
                    });
                    if (aramaic) view.sub = T('orig.aramaic', 'Hebrew & Aramaic') + ' · ' + T('orig.wordbyword', 'word by word');
                    var h2s = panel.querySelector('.og-head h2 small');
                    if (h2s) h2s.textContent = view.sub;
                    body.appendChild(credit(data.l));
                }).catch(function () {
                    body.replaceChildren(el('p', 'og-msg', T('orig.fail', 'Could not load the original text. Check your connection and try again.')));
                });
            }
        };
        show(view);
    }

    function compact(vs) {
        var out = [], s = vs[0], p = vs[0];
        for (var i = 1; i <= vs.length; i++) {
            if (vs[i] === p + 1) { p = vs[i]; continue; }
            out.push(s === p ? String(s) : s + '–' + p);
            s = p = vs[i];
        }
        return out;
    }

    function verseSection(g, greek, laterOnly, slug, chapter, v) {
        var sec = el('section', 'og-sec');
        if (g.label) sec.appendChild(el('h3', null, g.label));
        if (!g.words.length) {
            sec.appendChild(el('p', 'og-msg', greek ? T('orig.noneg', 'This verse is not in the Greek text.') : T('orig.noneh', 'This verse is not in the Hebrew text.')));
            return sec;
        }
        if (laterOnly) sec.appendChild(el('p', 'og-flag', T('orig.later', 'This verse is in later Greek manuscripts, which the KJV followed, but not in the oldest ones, so most modern translations leave it out or put it in a footnote. The Greek shown is the KJV’s.')));
        var fontCls = greek ? 'og-grc' : 'og-he';
        var line = el('p', 'og-verse ' + fontCls);
        if (!greek) { line.dir = 'rtl'; line.lang = 'he'; } else line.lang = 'grc';
        var list = el('ul', 'og-words');
        var items = [];
        g.words.forEach(function (w, i) {
            var text = greek ? w[0] : w[0].replace(/\//g, '');
            var span = el('span', 'ow', text);
            line.appendChild(span);
            var punct = greek ? '' : (w[6] || '');
            if (punct) line.appendChild(document.createTextNode(punct));
            if (i < g.words.length - 1 && punct !== '־') line.appendChild(document.createTextNode(' '));
            var li = wordItem(w, greek, slug, chapter, v);
            items.push(li);
            list.appendChild(li);
            span.addEventListener('click', function () {
                items.forEach(function (x) { x.classList.remove('on'); });
                line.querySelectorAll('.ow').forEach(function (x) { x.classList.remove('on'); });
                li.classList.add('on'); span.classList.add('on');
                li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        });
        sec.append(line, list);
        return sec;
    }

    function wordItem(w, greek, slug, chapter, v) {
        var li = el('li', 'og-word');
        var btn = el('button');
        btn.type = 'button';
        var fontCls = greek ? 'og-grc' : 'og-he';
        var root = rootOf(w, greek);
        var gloss = (greek ? w[2] : w[2].replace(/\//g, '')).replace(/\s+/g, ' ').replace(/[,.;:!?]+$/, '').trim();
        var shown = greek ? w[0].replace(/[,.;·:!?;·]+$/, '') : w[0].replace(/\//g, '');
        var word = el('span', fontCls + ' og-w', shown);
        word.lang = greek ? 'grc' : 'he';
        if (!greek) word.dir = 'rtl';
        var num = root ? el('span', 'og-num', shortStrong(root)) : null;
        btn.append(num || '', el('span', 'og-line', [word, glossNode(gloss), translitNode(w[1] || '', greek)]));

        var grammar = '';
        var parts = null;
        if (greek) {
            grammar = greekGrammar(w[4]);
        } else {
            var morph = w[4] || '', aramaic = morph[0] === 'A';
            var segs = morph.slice(1).split('/');
            var texts = w[0].split('/'), glosses = w[2].split('/'), tags = w[3].split('/');
            var rootIdx = -1;
            tags.forEach(function (t, i) { if (/\{/.test(t)) rootIdx = i; });
            grammar = (aramaic ? 'Aramaic · ' : '') + (rootIdx >= 0 && segs[rootIdx] ? hebrewSegment(segs[rootIdx], aramaic) : segs.map(function (s) { return hebrewSegment(s, aramaic); }).join(' + '));
            if (texts.length > 1 && texts.length === segs.length) {
                parts = el('span', 'og-parts');
                texts.forEach(function (t, i) {
                    var gl = (glosses[i] || '').trim();
                    var desc = i === rootIdx ? '' : hebrewSegment(segs[i], aramaic);
                    if (desc && gl && desc.indexOf('"' + gl + '"') >= 0) gl = '';
                    if (/^<.*>$/.test(gl)) gl = '';
                    var chip = el('span', 'og-part' + (i === rootIdx ? ' root' : ''), [el('span', 'og-he', t), (gl ? '“' + gl + '”' : '') + (desc ? (gl ? ' ' : '') + desc : '')]);
                    chip.querySelector('.og-he').dir = 'rtl';
                    parts.appendChild(chip);
                });
            }
        }
        btn.appendChild(el('div', 'og-gr', grammar));
        if (parts) btn.appendChild(parts);
        var flag = !greek && w[7];
        if (flag) btn.appendChild(el('p', 'og-note', {
            Q: T('orig.qere', 'Read as the scribes’ margin note says (the Qere); the letters in the text itself differ slightly.'),
            X: T('orig.lxx', 'Not in the Leningrad Codex: preserved in the Greek Septuagint and given here in Hebrew.'),
            R: T('orig.restored', 'Missing from the Leningrad Codex and restored from the parallel passage.')
        }[flag] || ''));
        btn.setAttribute('aria-label', shown + ', ' + gloss + '. ' + T('orig.openlex', 'Open in lexicon'));
        btn.addEventListener('click', function () {
            if (!root) return;
            openLexicon(root, greek, { slug: slug, chapter: chapter, verse: v }, w[5] || shown);
        });
        li.appendChild(btn);
        return li;
    }

    // 2. A word's lexicon entry and every verse it appears in.
    function openLexicon(strong, greek, from, fallbackLemma) {
        var view = {
            title: T('orig.lexicon', 'Lexicon') + ' · ' + shortStrong(strong),
            sub: from ? T('orig.from', 'from') + ' ' + bookLabel(from.slug) + ' ' + from.chapter + ':' + from.verse : '',
            limit: 60,
            fill: function (body) {
                body.appendChild(el('p', 'og-msg', T('orig.loading', 'Loading…')));
                var occP = getJSON('occ/' + bucketOf(strong) + '.json').then(function (d) { return d[strong] || []; }).catch(function () { return null; });
                Promise.all([lexEntry(strong), occP]).then(function (r) {
                    var e = r[0], occ = r[1];
                    body.replaceChildren();
                    var fontCls = greek ? 'og-grc' : 'og-he';
                    var lemma = el('span', fontCls + ' og-w', e ? e[0] : (fallbackLemma || ''));
                    if (!greek) lemma.dir = 'rtl';
                    lemma.lang = greek ? 'grc' : 'he';
                    body.appendChild(el('div', 'og-lex-top', [lemma, e ? translitNode(e[1], greek) : null]));
                    if (e) {
                        body.appendChild(el('p', 'og-lex-gloss', e[3].replace(/^:\s*/, '').replace(/^first:\s*/, '')));
                        body.appendChild(el('p', 'og-lex-kind', lexMorph(e[2])));
                        if (e[4]) {
                            var def = el('div', 'og-def');
                            def.innerHTML = e[4];          // built by build_original.py: escaped text with <b>, <i>, <br> and <a data-r|data-s> only
                            def.querySelectorAll('a[data-r]').forEach(function (a) {
                                var href = stepRefHref(a.getAttribute('data-r'));
                                if (href) a.href = href; else a.replaceWith(document.createTextNode(a.textContent));
                            });
                            def.querySelectorAll('a[data-s]').forEach(function (a) {
                                var s = a.getAttribute('data-s');
                                a.href = '#';
                                a.addEventListener('click', function (ev) { ev.preventDefault(); openLexicon(normStrong(s), false, from, ''); });
                            });
                            body.appendChild(def);
                        }
                    } else {
                        body.appendChild(el('p', 'og-msg', T('orig.nolex', 'No lexicon entry for this word.')));
                    }
                    if (occ) body.appendChild(occurrences(occ, from, view));
                    body.appendChild(credit(greek ? 'grc' : 'he'));
                }).catch(function () {
                    body.replaceChildren(el('p', 'og-msg', T('orig.fail', 'Could not load the original text. Check your connection and try again.')));
                });
            }
        };
        show(view);
    }

    function normStrong(s) {   // "H7218" -> "H7218" padded the way the data keys are ("H7218" stays, "H43" -> "H0043")
        var m = /^([HG])(\d+)([A-Za-z]?)$/.exec(s || '');
        if (!m) return s;
        var n = m[2]; while (n.length < 4) n = '0' + n;
        return m[1] + n + m[3];
    }

    function stepRefHref(r) {   // "Mat.5.43", "Mat.5.43; 6.30", "2Ti.4.8, 10"
        var m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)/.exec((r || '').trim());
        if (!m) return null;
        var i = STEP.indexOf(m[1]);
        return i < 0 ? null : SLUGS[i] + m[2] + '.html#v' + m[3];
    }

    function occurrences(ids, from, view) {
        var wrap = el('div');
        var n = ids.length;
        wrap.appendChild(el('p', 'og-count', n === 1 ? T('orig.once', 'Appears in 1 verse') : T('orig.count', 'Appears in {n} verses').replace('{n}', n.toLocaleString())));
        var hereId = (SLUGS.indexOf(from.slug) + 1) * 1000000 + from.chapter * 1000 + from.verse;
        var list = el('div');
        function draw() {
            list.replaceChildren();
            var lastBook = null, row = null;
            ids.slice(0, view.limit).forEach(function (id) {
                var r = verseRef(id);
                if (r.slug !== lastBook) {
                    lastBook = r.slug;
                    list.appendChild(el('p', 'og-book', bookLabel(r.slug)));
                    row = el('div', 'og-refs');
                    list.appendChild(row);
                }
                var a = el('a', id === hereId ? 'here' : null, r.chapter + ':' + r.verse);
                a.href = r.slug + r.chapter + '.html#v' + r.verse;
                a.setAttribute('aria-label', bookLabel(r.slug) + ' ' + r.chapter + ':' + r.verse);
                row.appendChild(a);
            });
            if (n > view.limit) {
                var more = el('button', 'og-more', T('orig.showall', 'Show all {n}').replace('{n}', n.toLocaleString()));
                more.type = 'button';
                more.addEventListener('click', function () { view.limit = Infinity; draw(); });
                list.appendChild(more);
            }
        }
        draw();
        wrap.appendChild(list);
        return wrap;
    }

    window.BibleOriginal = { open: openWords, lexicon: openLexicon };

    /* ---------- the verse sheet button (study.js) ---------- */

    window.BibleSheetExtras = window.BibleSheetExtras || [];
    window.BibleSheetExtras.push(function (ctx) {
        var info = parsePage(ctx.book + ctx.chapter);
        if (!info) return null;
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'bs-act';
        var i = document.createElement('i');
        i.className = 'fas fa-language'; i.setAttribute('aria-hidden', 'true');
        b.append(i, info.greek ? T('orig.greek', 'Greek') : T('orig.hebrew', 'Hebrew'));
        b.addEventListener('click', function () {
            var vs = ctx.verses.slice();
            ctx.close();
            openWords(ctx.book, ctx.chapter, vs);
        });
        return b;
    });

    /* ---------- 3. the translation picker ---------- */

    if (window.TRANSLATION_COLORS) window.TRANSLATION_COLORS[CODE] = '#2f3a4a';

    document.querySelectorAll('select.nav-translation').forEach(function (sel) {
        if (sel.querySelector('option[value="' + CODE + '"]')) return;
        var compactPicker = !!sel.closest('.top-nav');
        var group = document.createElement('optgroup');
        group.label = T('orig.group', 'Original languages');
        var o = document.createElement('option');
        o.value = CODE;
        if (here) {
            o.textContent = compactPicker ? (here.greek ? 'GRK' : 'HEB') : (here.greek ? T('orig.greeknt', 'Greek (New Testament)') : T('orig.hebrewot', 'Hebrew (Old Testament)'));
        } else {
            o.textContent = compactPicker ? 'H/G' : T('orig.both', 'Hebrew (OT) / Greek (NT)');
        }
        o.title = T('orig.both', 'Hebrew (OT) / Greek (NT)');
        group.appendChild(o);
        // Before the other-language groups, so the originals sit right under the English translations.
        var langs = sel.querySelector('optgroup[data-langs]');
        sel.insertBefore(group, langs || null);
    });

    if (!isChapter) return;

    function addBlock() {
        var blocks = container.querySelectorAll('.translation-block');
        if (container.querySelector('.translation-block[data-translation="' + CODE + '"]')) return;
        var b = document.createElement('div');
        b.className = 'translation-block';
        b.setAttribute('data-translation', CODE);
        b.lang = here.greek ? 'grc' : 'he';
        if (!here.greek) b.dir = 'rtl';
        b.classList.add(here.greek ? 'og-grc' : 'og-he');
        var after = blocks[blocks.length - 1];
        after.parentNode.insertBefore(b, after.nextSibling);
    }
    injectStyle();
    addBlock();

    var loading = false;
    function loadReading() {
        var b = container.querySelector('.translation-block[data-translation="' + CODE + '"]');
        if (!b || b.getAttribute('data-loaded') || loading) return;
        loading = true;
        addFonts();
        b.replaceChildren(el('p', 'verse og-msg', T('orig.loading', 'Loading…')));
        getJSON(page + '.json').then(function (data) {
            var greek = data.l === 'grc', out = [];
            (data.v || []).forEach(function (row) {
                var p = el('p', 'verse');
                p.setAttribute('data-v', row[0]);
                p.appendChild(el('span', 'verse-num', String(row[0])));
                var words = row[1];
                if (row[0] === 1 && data.t) {
                    var t = el('span', 'og-title', joinWords(data.t, greek));
                    p.append(t, ' ');
                }
                p.appendChild(document.createTextNode(joinWords(words, greek)));
                if ((data.k || []).indexOf(row[0]) >= 0) p.appendChild(el('span', 'og-kv', T('orig.latershort', '(later manuscripts)')));
                out.push(p);
            });
            out.push(credit(data.l, 'bs-credit'));
            b.replaceChildren.apply(b, out);
            b.setAttribute('data-loaded', '1');
        }).catch(function () {
            b.replaceChildren(el('p', 'verse og-msg', T('orig.fail', 'Could not load the original text. Check your connection and try again.')));
        }).then(function () { loading = false; });
    }

    function joinWords(words, greek) {
        var s = '';
        words.forEach(function (w, i) {
            if (greek) { s += (i ? ' ' : '') + w[0]; return; }
            var punct = w[6] || '';
            s += w[0].replace(/\//g, '') + punct + (i < words.length - 1 && punct !== '־' ? ' ' : '');
        });
        return s;
    }

    var orig = window.switchTranslation;
    if (typeof orig === 'function') {
        window.switchTranslation = function (code) {
            orig(code);
            if (code === CODE) loadReading();
        };
    }

    // Continuous listening (audio.js) swapped the next chapter into this page.
    window.addEventListener('bible-chapter', function (e) {
        var next = e.detail && e.detail.page, box = document.querySelector('.scripture-container');
        var info = parsePage(next);
        if (!info || !box) return;
        page = next; here = info; container = box; loading = false;
        addBlock();
    });
})();
