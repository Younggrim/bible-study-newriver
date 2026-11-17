/* Site search.
 *
 * Two jobs, both in this one file so every page needs only one tag:
 *
 * 1. On every page, a way in: a search button in the top bar on chapter pages,
 *    a search box on the home page and the Topical and Life indexes, and a small
 *    round button on the other pages.
 * 2. On search.html, the search itself, over three data files that
 *    build_search.py writes into site/search/:
 *      topics.json  Stories & Topics: parables, miracles, Bible stories and
 *                   well-known teachings by the names people know them by
 *      site.json    Studies: topical and life study sections, chapter summaries,
 *                   section titles, key themes, Deep Dive headings, devotionals
 *      bible.json   Verses: the BSB text (public domain, so it can be searched
 *                   on the device and offline)
 *    A Bible reference ("John 3:16", "1 cor 13", "Ps 23") jumps straight there.
 *
 * Colours come from the site's CSS custom properties, so the same file works on
 * both sites. Never put a theme colour literal in here.
 */
(function () {
    'use strict';

    var ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    function css() {
        if (document.getElementById('bs-search-css')) return;
        var s = document.createElement('style');
        s.id = 'bs-search-css';
        s.textContent = ''
            + '.bs-search-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:16px;border:1px solid var(--border-light);background:var(--bg-tint);color:var(--accent-link);text-decoration:none;flex:0 0 auto;margin:0 6px}'
            + '@media (max-width:600px){.top-nav .bs-search-btn{width:28px;height:28px;margin:0 4px}}'
            + '.bs-search-fab{position:fixed;top:calc(env(safe-area-inset-top,0px) + 12px);right:12px;z-index:900;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:20px;background:var(--bg-page);color:var(--accent-link);border:1px solid var(--border-light);box-shadow:0 2px 10px rgba(0,0,0,.18);text-decoration:none}'
            + '.bs-search-btn:focus-visible,.bs-search-fab:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
            + '.bs-search-bar{display:flex;align-items:center;gap:8px;max-width:520px;margin:18px auto 0;background:var(--bg-page);border:1px solid var(--border-light);border-radius:24px;padding:4px 6px 4px 14px;box-shadow:0 2px 12px rgba(0,0,0,.18);color:var(--accent-link)}'
            + '.bs-search-bar input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-family:"Inter",-apple-system,sans-serif;font-size:1rem;color:var(--text-body);padding:8px 0;outline:none}'
            + '.bs-search-bar button{border:0;border-radius:18px;background:var(--accent-link);color:var(--bg-page);font:inherit;font-family:"Inter",-apple-system,sans-serif;font-weight:600;font-size:.9rem;padding:8px 14px;cursor:pointer}'
            + '';
        document.head.appendChild(s);
    }

    function bar(placeholder) {
        var f = document.createElement('form');
        f.className = 'bs-search-bar';
        f.setAttribute('role', 'search');
        f.action = 'search.html';
        f.innerHTML = ICON + '<input type="search" name="q" autocomplete="off" enterkeyhint="search" aria-label="Search the Bible and studies">'
            + '<button type="submit">Search</button>';
        f.querySelector('input').placeholder = placeholder;
        return f;
    }

    function entryPoints() {
        if (page === 'search.html') return;
        css();
        var link = function (cls) {
            var a = document.createElement('a');
            a.className = cls; a.href = 'search.html';
            a.setAttribute('aria-label', 'Search'); a.title = 'Search';
            a.innerHTML = ICON;
            return a;
        };
        var hint = 'Search stories, topics, verses';
        if (page === 'index.html' || page === '' || page === 'index') {
            // Website: in the welcome banner. App: the welcome banner is hidden, so it goes in
            // the Bible tab's banner, at the top of the screen and above the reading cards
            // (study.js, progress.js and friends-strip.js put those at the top of the passage
            // picker, which would push a box there out of sight).
            var hero = document.querySelector(standalone ? '.section-hero .section-hero-overlay' : '.hero-overlay');
            if (hero) hero.appendChild(bar(hint));
            return;
        }
        if (page === 'topical-studies.html' || page === 'life-studies.html') {
            var ov = document.querySelector('.section-hero-overlay');
            if (ov) { ov.appendChild(bar(hint)); return; }
        }
        var nav = document.querySelector('.top-nav');
        if (nav && getComputedStyle(nav).display !== 'none') {   // offsetParent is null for a fixed bar
            var after = nav.querySelector('.nav-home-btn') || nav.querySelector('.hamburger');
            var btn = link('bs-search-btn');
            if (after && after.nextSibling) nav.insertBefore(btn, after.nextSibling); else nav.insertBefore(btn, nav.firstChild);
            return;
        }
        document.body.appendChild(link('bs-search-fab'));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', entryPoints); else entryPoints();

    /* ================================================================ search.html */

    var app = document.getElementById('bs-search-app');
    if (!app) return;

    var V = app.getAttribute('data-v') || '';
    var BOOKS = [['genesis','Genesis',50],['exodus','Exodus',40],['leviticus','Leviticus',27],['numbers','Numbers',36],['deuteronomy','Deuteronomy',34],['joshua','Joshua',24],['judges','Judges',21],['ruth','Ruth',4],['1samuel','1 Samuel',31],['2samuel','2 Samuel',24],['1kings','1 Kings',22],['2kings','2 Kings',25],['1chronicles','1 Chronicles',29],['2chronicles','2 Chronicles',36],['ezra','Ezra',10],['nehemiah','Nehemiah',13],['esther','Esther',10],['job','Job',42],['psalms','Psalms',150],['proverbs','Proverbs',31],['ecclesiastes','Ecclesiastes',12],['songofsolomon','Song of Solomon',8],['isaiah','Isaiah',66],['jeremiah','Jeremiah',52],['lamentations','Lamentations',5],['ezekiel','Ezekiel',48],['daniel','Daniel',12],['hosea','Hosea',14],['joel','Joel',3],['amos','Amos',9],['obadiah','Obadiah',1],['jonah','Jonah',4],['micah','Micah',7],['nahum','Nahum',3],['habakkuk','Habakkuk',3],['zephaniah','Zephaniah',3],['haggai','Haggai',2],['zechariah','Zechariah',14],['malachi','Malachi',4],['matthew','Matthew',28],['mark','Mark',16],['luke','Luke',24],['john','John',21],['acts','Acts',28],['romans','Romans',16],['1corinthians','1 Corinthians',16],['2corinthians','2 Corinthians',13],['galatians','Galatians',6],['ephesians','Ephesians',6],['philippians','Philippians',4],['colossians','Colossians',4],['1thessalonians','1 Thessalonians',5],['2thessalonians','2 Thessalonians',3],['1timothy','1 Timothy',6],['2timothy','2 Timothy',4],['titus','Titus',3],['philemon','Philemon',1],['hebrews','Hebrews',13],['james','James',5],['1peter','1 Peter',5],['2peter','2 Peter',3],['1john','1 John',5],['2john','2 John',1],['3john','3 John',1],['jude','Jude',1],['revelation','Revelation',22]];
    // Abbreviations people actually type. Numbers are already normalised to a leading digit.
    var ABBR = {gen:0,ge:0,gn:0,ex:1,exo:1,exod:1,lev:2,lv:2,num:3,nm:3,nb:3,deut:4,dt:4,deu:4,josh:5,jos:5,judg:6,jdg:6,jg:6,rth:7,ru:7,
        '1sam':8,'1sa':8,'1s':8,'2sam':9,'2sa':9,'2s':9,'1kgs':10,'1ki':10,'1k':10,'2kgs':11,'2ki':11,'2k':11,'1chron':12,'1chr':12,'1ch':12,'2chron':13,'2chr':13,'2ch':13,
        ezr:14,neh:15,ne:15,est:16,esth:16,jb:17,ps:18,psa:18,psalm:18,pss:18,psm:18,prov:19,pr:19,prv:19,pro:19,eccl:20,ecc:20,eccles:20,qoh:20,
        song:21,songofsongs:21,sos:21,ss:21,canticles:21,songs:21,isa:22,is:22,jer:23,je:23,lam:24,la:24,ezek:25,eze:25,ezk:25,dan:26,dn:26,da:26,hos:27,ho:27,jl:28,
        am:29,obad:30,ob:30,jon:31,jnh:31,mic:32,mi:32,nah:33,na:33,hab:34,zeph:35,zep:35,hag:36,zech:37,zec:37,mal:38,
        matt:39,mt:39,mat:39,mk:40,mrk:40,mar:40,lk:41,luk:41,jn:42,jhn:42,joh:42,ac:43,act:43,rom:44,rm:44,ro:44,
        '1cor':45,'1co':45,'2cor':46,'2co':46,gal:47,ga:47,eph:48,ephes:48,phil:49,php:49,pp:49,col:50,'1thess':51,'1thes':51,'1th':51,'2thess':52,'2thes':52,'2th':52,
        '1tim':53,'1ti':53,'2tim':54,'2ti':54,tit:55,phlm:56,philem:56,phm:56,heb:57,jas:58,jm:58,jam:58,'1pet':59,'1pe':59,'1pt':59,'1p':59,'2pet':60,'2pe':60,'2pt':60,'2p':60,
        '1jn':61,'1jo':61,'1jhn':61,'2jn':62,'2jo':62,'3jn':63,'3jo':63,jud:64,jude:64,rev:65,re:65,revelations:65,apocalypse:65};
    BOOKS.forEach(function (b, i) { ABBR[b[1].toLowerCase().replace(/\s+/g, '')] = i; });

    var STOP = {'a':1,'an':1,'the':1,'of':1,'and':1,'in':1,'on':1,'to':1,'is':1,'are':1,'was':1,'about':1,'what':1,'does':1,'do':1,'bible':1,
        'say':1,'says':1,'verse':1,'verses':1,'where':1,'find':1,'for':1,'with':1,'at':1,'by':1,'who':1,'how':1,'scripture':1,'scriptures':1,'god\'s':0};
    var KIND_WORDS = {parable:'Parable',parables:'Parable',miracle:'Miracle',miracles:'Miracle',story:'Story',stories:'Story'};
    var KIND_LABEL = {Parable:'Parable',Miracle:'Miracle',Story:'Bible story',Teaching:'Teaching'};

    var input = document.getElementById('bs-q');
    var out = document.getElementById('bs-results');
    var status = document.getElementById('bs-status');
    var chips = app.querySelectorAll('.bs-chip');
    var filter = 'all';
    var data = { topics: null, site: null, bible: null };
    var lastQ = null, timer = null;

    function get(name) {
        return fetch('site/search/' + name + '.json?v=' + V).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        });
    }
    var loading = {
        topics: get('topics').then(function (d) { data.topics = prepTopics(d); rerun(); }),
        site: get('site').then(function (d) { data.site = prepSite(d); rerun(); })
    };
    // The verse text is the biggest file, so it is fetched only once a search actually runs.
    function needBible() {
        if (loading.bible) return;
        loading.bible = get('bible').then(function (d) { data.bible = prepBible(d); rerun(); })
            .catch(function () { data.bible = { failed: true }; rerun(); });
    }
    loading.topics.catch(function () { data.topics = []; rerun(); });
    loading.site.catch(function () { data.site = []; rerun(); });

    /* ---------- text helpers */

    function fold(s) {
        return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[‘’ʼ]/g, '\'').replace(/[“”]/g, '"');
    }
    function clean(s) { return fold(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // A term matches the start of a word, so "forgiv" finds forgive, forgiven and
    // forgiveness. A trailing s or 's is dropped first so "parables" finds parable.
    function stem(t) {
        if (t.length > 4 && /'s$/.test(t)) t = t.slice(0, -2);
        else if (t.length > 4 && /[^s]s$/.test(t)) t = t.slice(0, -1);
        return t.replace(/'/g, '');
    }
    function termRe(t) { return new RegExp('(^|[^a-z0-9])' + reEsc(t)); }
    // The query's words next to each other, in order ("born again", not "born ... again").
    function phraseRe(terms) {
        return terms.length > 1 ? new RegExp('(^|[^a-z0-9])' + terms.map(reEsc).join("[a-z']*(?:[^a-z0-9]+(?:a|an|the|of|at|in|on|to|and|is|for|with|by|from|who|was))*[^a-z0-9]+")) : null;
    }

    function parse(q) {
        var phrases = [];
        var rest = fold(q).replace(/"([^"]+)"/g, function (_, p) { var c = clean(p); if (c) phrases.push(c); return ' '; });
        var words = clean(rest).split(' ').filter(Boolean);
        var kind = null;
        var terms = [], kindTerms = [];
        words.forEach(function (w) {
            if (KIND_WORDS[w]) { kind = KIND_WORDS[w]; kindTerms.push(stem(w)); return; }
            if (STOP[w]) return;
            terms.push(stem(w));
        });
        if (!terms.length && !phrases.length && !kind) {
            // Only stop words ("who is god"): search for them rather than nothing.
            terms = words.map(stem);
        }
        // "Miracles of Jesus", "parables of Christ": every one of them is, so list them all.
        var topicTerms = kind ? terms.filter(function (t) { return !/^(jesu|christ|god|lord|bible|old|new|testament|famou|best|all)$/.test(t); }) : terms;
        return { terms: topicTerms, phrases: phrases, kind: kind, all: words, siteTerms: kindTerms.concat(terms) };
    }

    /* ---------- references */

    function parseRef(q) {
        var s = fold(q).trim().replace(/\./g, ' ').replace(/\s+/g, ' ')
            .replace(/^(first|1st|i)\s/, '1 ').replace(/^(second|2nd|ii)\s/, '2 ').replace(/^(third|3rd|iii)\s/, '3 ');
        var m = /^([1-3]?\s?[a-z][a-z ]*?)\s*(\d+)?(?:\s*[:v]\s*(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$/.exec(s);
        if (!m) return null;
        var key = m[1].replace(/\s+/g, '');
        var idx = ABBR.hasOwnProperty(key) ? ABBR[key] : -1;
        if (idx < 0 && key.length >= 3) {
            var hits = BOOKS.map(function (b, i) { return [b[1].toLowerCase().replace(/\s+/g, ''), i]; })
                .filter(function (b) { return b[0].indexOf(key) === 0; });
            if (hits.length === 1) idx = hits[0][1];
        }
        if (idx < 0) return null;
        var b = BOOKS[idx];
        var ch = m[2] ? parseInt(m[2], 10) : 0;
        if (b[2] === 1 && ch > 1 && !m[3]) { m[3] = String(ch); ch = 1; }   // "Jude 3" means verse 3
        if (ch > b[2]) return null;
        var v = m[3] ? parseInt(m[3], 10) : 0;
        // End of a range: "6:9-9:17" ends in another chapter, "15:11-32" in this one, "5-7" is chapters.
        var c2 = ch || 1, v2 = v;
        if (m[5]) { c2 = parseInt(m[4], 10); v2 = parseInt(m[5], 10); }
        else if (m[4] && v) v2 = parseInt(m[4], 10);
        else if (m[4]) { c2 = parseInt(m[4], 10); v2 = 0; }
        var label = b[1] + (ch ? ' ' + ch + (v ? ':' + v : '') + (m[4] ? '–' + m[4] + (m[5] ? ':' + m[5] : '') : '') : '');
        return { book: idx, chapter: ch || 1, verse: v, c2: c2, v2: v2, label: label, bookOnly: !ch,
                 url: b[0] + (ch || 1) + '.html' + (v > 1 ? '#v' + v : '') };
    }

    // Do two references share any verse? Verse 0 means "the whole chapter".
    function overlaps(a, b) {
        if (!a || !b || a.book !== b.book) return false;
        var aS = a.chapter * 1000 + (a.verse || 0), aE = a.c2 * 1000 + (a.v2 || 999);
        var bS = b.chapter * 1000 + (b.verse || 0), bE = b.c2 * 1000 + (b.v2 || 999);
        return aS <= bE && bS <= aE;
    }

    /* ---------- data prep */

    function prepTopics(list) {
        list.forEach(function (t) {
            t._n = clean(t.n);
            t._a = clean((t.a || []).join(' | '));
            t._r = clean(t.r.map(function (r) { return r.r; }).join(' | ').replace(/:/g, ' '));
        });
        return list;
    }
    function prepSite(list) {
        list.forEach(function (e) {
            e._t = clean(e.t);
            e._h = clean([].concat(e.h || [], e.d || []).join(' | ') + ' ' + (e.p || ''));
            e._m = clean(e.m || '');
            e._x = clean(e.x || '');
        });
        return list;
    }
    function prepBible(d) {
        var flat = [];
        d.v.forEach(function (chs, bi) {
            chs.forEach(function (vs, ci) {
                vs.forEach(function (text, vi) { if (text) flat.push([bi, ci + 1, vi + 1, text, fold(text)]); });
            });
        });
        return { names: d.b, slugs: d.s, flat: flat, t: d.t };
    }

    /* ---------- scoring */

    function fieldScore(field, re) { return re.test(field) ? 1 : 0; }

    function scoreTopics(p) {
        if (!data.topics) return null;
        var res = [];
        var res_ = p.terms.map(termRe);
        var near = phraseRe(p.terms);
        data.topics.forEach(function (t) {
            if (p.kind && t.k !== p.kind) return;
            var score = 0;
            for (var i = 0; i < res_.length; i++) {
                var s = 10 * fieldScore(t._n, res_[i]) + 6 * fieldScore(t._a, res_[i]) + 4 * fieldScore(t._r, res_[i]);
                if (!s) return;
                score += s;
            }
            for (var j = 0; j < p.phrases.length; j++) {
                if ((t._n + ' | ' + t._a).indexOf(p.phrases[j]) < 0) return;
                score += 12;
            }
            if (near) score += 15 * fieldScore(t._n, near) || 8 * fieldScore(t._a, near);
            if (!res_.length && !p.phrases.length) score = 1;   // "parables": list them all
            res.push([score, t]);
        });
        res.sort(function (a, b) { return b[0] - a[0]; });
        return res.map(function (r) { return r[1]; });
    }

    function scoreSite(p) {
        if (!data.site) return null;
        // "parables" alone lists the parables above, and also finds pages about parables here.
        if (p.kind) p = { terms: p.siteTerms, phrases: p.phrases };
        if (!p.terms.length && !p.phrases.length) return [];
        var res_ = p.terms.map(termRe);
        var near = phraseRe(p.terms);
        var res = [];
        data.site.forEach(function (e) {
            var score = 0;
            for (var i = 0; i < res_.length; i++) {
                var s = 8 * fieldScore(e._t, res_[i]) + 5 * fieldScore(e._h, res_[i]) + 3 * fieldScore(e._m, res_[i]) + fieldScore(e._x, res_[i]);
                if (!s) return;
                score += s;
            }
            for (var j = 0; j < p.phrases.length; j++) {
                var all = e._t + ' ' + e._h + ' ' + e._m + ' ' + e._x;
                if (all.indexOf(p.phrases[j]) < 0) return;
                score += 6;
            }
            if (near) score += 14 * fieldScore(e._t, near) || 10 * fieldScore(e._h, near) || 4 * fieldScore(e._m + ' ' + e._x, near);
            if (e.k === 'Topical study' || e.k === 'Life study') score += 2;
            res.push([score, e]);
        });
        res.sort(function (a, b) { return b[0] - a[0]; });
        return res.map(function (r) { return r[1]; });
    }

    function searchVerses(p) {
        if (!data.bible || data.bible.failed) return data.bible ? [] : null;
        if (p.kind) p = { terms: p.siteTerms, phrases: p.phrases };
        var res_ = p.terms.map(termRe);
        var phr = p.phrases.map(function (x) { return new RegExp('(^|[^a-z0-9])' + reEsc(x).replace(/ /g, '[^a-z0-9]+') + '(?![a-z0-9])'); });
        if (!res_.length && !phr.length) return [];
        var out_ = [];
        var flat = data.bible.flat;
        outer:
        for (var i = 0; i < flat.length; i++) {
            var t = flat[i][4];
            for (var a = 0; a < res_.length; a++) if (!res_[a].test(t)) continue outer;
            for (var b = 0; b < phr.length; b++) if (!phr[b].test(t)) continue outer;
            out_.push(flat[i]);
        }
        return out_;
    }

    // The verses of a reference, for "John 3:16" or "Ps 23" (at most 180).
    function passage(ref) {
        if (!data.bible || data.bible.failed) return data.bible ? [] : null;
        var out_ = [];
        var flat = data.bible.flat;
        var lo = ref.chapter * 1000 + (ref.verse || 0), hi = ref.c2 * 1000 + (ref.v2 || 999);
        for (var i = 0; i < flat.length && out_.length < 180; i++) {
            var v = flat[i];
            if (v[0] !== ref.book) continue;
            var n = v[1] * 1000 + v[2];
            if (n >= lo && n <= hi) out_.push(v);
        }
        return out_;
    }

    function highlight(text, p) {
        var parts = p.terms.map(function (t) { return reEsc(t) + '[a-z’\']*'; })
            .concat(p.phrases.map(function (x) { return reEsc(x).replace(/ /g, '[^A-Za-z0-9]+'); }));
        var h = esc(text);
        if (!parts.length) return h;
        try {
            return h.replace(new RegExp('(^|[^A-Za-z0-9])(' + parts.join('|') + ')', 'gi'), '$1<mark>$2</mark>');
        } catch (e) { return h; }
    }

    function snippet(text, p, n) {
        n = n || 200;
        if (!text) return '';
        var f = fold(text);
        var at = -1;
        for (var i = 0; i < p.terms.length && at < 0; i++) {
            var m = termRe(p.terms[i]).exec(f);
            if (m) at = m.index;
        }
        var start = at > 80 ? text.lastIndexOf(' ', at - 60) + 1 : 0;
        var s = text.slice(start, start + n);
        if (start + n < text.length) s = s.replace(/\s+\S*$/, '') + '…';
        return (start > 0 ? '…' : '') + highlight(s, p);
    }

    /* ---------- render */

    var PER_GROUP = { all: 5, topics: 200, studies: 60, verses: 100 };
    var verseLimit = 100;

    function group(id, title, count, html, more) {
        return '<section class="bs-group" data-group="' + id + '"><h2>' + esc(title)
            + (count != null ? ' <span class="bs-count">' + count + '</span>' : '') + '</h2>' + html
            + (more ? '<button type="button" class="bs-more" data-show="' + id + '">' + more + '</button>' : '') + '</section>';
    }

    function topicCard(t, p) {
        var first = t.r[0];
        var rest = t.r.slice(1).map(function (r) { return '<a href="' + esc(r.u) + '">' + esc(r.r) + '</a>'; }).join(', ');
        var alias = '';
        if (t.a && p.terms.length) {
            var hit = t.a.filter(function (a) { return p.terms.every(function (x) { return termRe(x).test(clean(a)); }); })[0];
            if (hit && !p.terms.every(function (x) { return termRe(x).test(t._n); })) alias = '<p class="bs-aka">Also called ' + highlight(hit, p) + '</p>';
        }
        return '<article class="bs-card bs-topic">'
            + '<p class="bs-kind">' + esc(KIND_LABEL[t.k] || t.k) + '</p>'
            + '<h3><a href="' + esc(first.u) + '">' + highlight(t.n, p) + '</a></h3>'
            + alias
            + '<p class="bs-refs"><a class="bs-ref" href="' + esc(first.u) + '">' + esc(first.r) + '</a>'
            + (rest ? '<span class="bs-also"> Also in ' + rest + '</span>' : '') + '</p>'
            + (t.s ? '<p class="bs-study"><a href="' + esc(t.s) + '">Read the study →</a></p>' : '')
            + '</article>';
    }

    function siteCard(e, p) {
        var kind = e.k === 'Chapter' ? 'Chapter study' : e.k;
        var where = e.p ? ' · ' + esc(e.p) : '';
        var heads = [].concat(e.h || [], e.d || []).filter(function (h) {
            var c = clean(h); return p.terms.some(function (x) { return termRe(x).test(c); });
        }).slice(0, 3);
        var body = heads.length
            ? '<ul class="bs-heads">' + heads.map(function (h) { return '<li>' + highlight(h, p) + '</li>'; }).join('') + '</ul>'
            : '<p class="bs-snip">' + snippet(e.x || e.m || '', p) + '</p>';
        return '<article class="bs-card">'
            + '<p class="bs-kind">' + esc(kind) + where + '</p>'
            + '<h3><a href="' + esc(e.u) + '">' + highlight(e.t, p) + '</a></h3>'
            + body + '</article>';
    }

    function verseRow(v, p) {
        var b = data.bible;
        var ref = b.names[v[0]] + ' ' + v[1] + ':' + v[2];
        var url = b.slugs[v[0]] + v[1] + '.html' + (v[2] > 1 ? '#v' + v[2] : '');
        return '<li><a href="' + url + '"><span class="bs-vref">' + esc(ref) + '</span> ' + highlight(v[3], p) + '</a></li>';
    }

    function refCard(r) {
        return '<a class="bs-card bs-go" href="' + esc(r.url) + '"><span class="bs-kind">Go to</span><strong>' + esc(r.label) + '</strong><span class="bs-arrow" aria-hidden="true">→</span></a>';
    }

    function run(q, force) {
        q = (q || '').trim();
        if (!force && q === lastQ) return;
        lastQ = q;
        try { history.replaceState(null, '', q ? 'search.html?q=' + encodeURIComponent(q) + (filter !== 'all' ? '&in=' + filter : '') : 'search.html'); } catch (e) {}
        if (!q) { out.innerHTML = ''; status.textContent = ''; app.classList.remove('bs-has'); return; }
        app.classList.add('bs-has');
        needBible();
        var ref = parseRef(q);
        var p = (ref && !ref.bookOnly) ? { terms: [], phrases: [], kind: null, all: [] } : parse(q);
        var html = '';
        if (ref && (filter === 'all' || filter === 'verses')) html += refCard(ref);
        html += '<!--verses-->';

        var topics, site, verses;
        if (ref && !ref.bookOnly) {
            // A reference: what is at that passage, rather than pages that mention its numbers.
            topics = data.topics && data.topics.filter(function (t) {
                return t.r.some(function (r) { return overlaps(r._p || (r._p = parseRef(r.r)), ref); });
            });
            site = data.site && data.site.filter(function (e) {
                if (e.k === 'Chapter') return e.u === BOOKS[ref.book][0] + ref.chapter + '.html'
                    || (ref.c2 !== ref.chapter && overlaps(parseRef(e.t), ref));
                if (e.k === 'Devotional') return overlaps(e._p === undefined ? (e._p = parseRef(e.t.split(/[,;]/)[0])) : e._p, ref);
                return false;
            });
            verses = passage(ref);
        } else {
            topics = scoreTopics(p); site = scoreSite(p); verses = searchVerses(p);
        }
        var n = { topics: topics ? topics.length : 0, studies: site ? site.length : 0, verses: verses ? verses.length : 0 };
        var lim = PER_GROUP[filter];

        if ((filter === 'all' || filter === 'topics') && topics && topics.length) {
            html += group('topics', 'Stories & Topics', topics.length,
                '<div class="bs-cards">' + topics.slice(0, lim).map(function (t) { return topicCard(t, p); }).join('') + '</div>',
                filter === 'all' && topics.length > lim ? 'See all ' + topics.length + ' stories & topics' : '');
        }
        if ((filter === 'all' || filter === 'studies') && site && site.length) {
            html += group('studies', 'Studies', site.length,
                '<div class="bs-cards">' + site.slice(0, lim).map(function (e) { return siteCard(e, p); }).join('') + '</div>',
                filter === 'all' && site.length > lim ? 'See all ' + site.length + ' studies'
                    : (filter === 'studies' && site.length > lim ? 'Showing the top ' + lim : ''));
        }
        if ((filter === 'all' || filter === 'verses') && verses && verses.length) {
            var isRef = ref && !ref.bookOnly;
            var vl = isRef ? 180 : (filter === 'all' ? lim : verseLimit);
            var vh = group('verses', isRef ? ref.label + ' (BSB)' : 'Verses', isRef ? null : verses.length,
                '<ol class="bs-verses">' + verses.slice(0, vl).map(function (v) { return verseRow(v, p); }).join('') + '</ol>',
                verses.length > vl ? (filter === 'all' ? 'See all ' + verses.length + ' verses' : 'Show more verses') : '')
                + '<p class="bs-note">Verse wording is from the Berean Standard Bible. Tap a verse to read it in context in any translation.</p>';
            // For a reference the passage itself comes first, right under "Go to".
            if (isRef) html = html.replace('<!--verses-->', vh); else html += vh;
        }
        html = html.replace('<!--verses-->', '');

        var pending = [];
        if (!data.topics) pending.push('stories');
        if (!data.site) pending.push('studies');
        if (!data.bible) pending.push('verses');
        var total = n.topics + n.studies + n.verses;
        if (!html) {
            html = pending.length ? '' : '<div class="bs-empty"><p>Nothing found for <strong>' + esc(q) + '</strong>.</p>'
                + '<p>Try fewer words, a different word for the same idea (<em>worry</em> instead of <em>anxious</em>), or the name of a person or place.</p></div>';
        }
        if (data.bible && data.bible.failed && (filter === 'all' || filter === 'verses'))
            html += '<p class="bs-note">Verse search could not load. Check your connection and try again.</p>';
        out.innerHTML = html;
        status.textContent = pending.length ? 'Searching…' : (total ? total + ' result' + (total === 1 ? '' : 's') : '');
        chips.forEach(function (c) {
            var k = c.getAttribute('data-f'), cnt = c.querySelector('.bs-chip-n');
            if (cnt) cnt.textContent = k === 'all' ? '' : (n[k] ? n[k] : '');
        });
    }

    function rerun() { if (lastQ) run(lastQ, true); }

    function setFilter(f) {
        filter = f;
        verseLimit = 100;
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-f') === f ? 'true' : 'false'); });
        run(input.value, true);
    }

    input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { run(input.value); }, 160);
    });
    document.getElementById('bs-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var r = parseRef(input.value);
        if (r && !r.bookOnly) { location.href = r.url; return; }
        clearTimeout(timer);
        run(input.value, true);
        input.blur();
    });
    chips.forEach(function (c) { c.addEventListener('click', function () { setFilter(c.getAttribute('data-f')); }); });
    out.addEventListener('click', function (e) {
        var b = e.target.closest('.bs-more');
        if (!b) return;
        var g = b.getAttribute('data-show');
        if (filter === g && g === 'verses') { verseLimit += 200; run(input.value, true); return; }
        setFilter(g);
        window.scrollTo(0, 0);
    });
    app.querySelectorAll('.bs-try a').forEach(function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); input.value = a.textContent; run(input.value, true); });
    });

    var back = document.getElementById('bs-back');
    if (back && document.referrer && document.referrer.indexOf(location.origin) === 0 && history.length > 1) {
        back.addEventListener('click', function (e) { e.preventDefault(); history.back(); });
    }
    if (standalone && back) back.style.display = 'none';   // the app has its bottom bar

    var params = new URLSearchParams(location.search);
    if (params.get('in') && /^(topics|studies|verses)$/.test(params.get('in'))) {
        filter = params.get('in');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-f') === filter ? 'true' : 'false'); });
    }
    if (params.get('q')) { input.value = params.get('q'); run(input.value, true); }
    else if (!('ontouchstart' in window)) input.focus();
})();
