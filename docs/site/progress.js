/* Chapters studied and study streaks.

   On a chapter page, a "Mark chapter studied" button sits right under the
   scripture. Marking a chapter records the chapter and today's date. The
   streak is the run of consecutive days with at least one chapter studied,
   counted on the reader's own calendar, ending today or yesterday (so it
   is still alive until tonight's midnight). The home page shows the streak
   and the number of chapters studied, and warns when a streak will end
   tonight unless a chapter is studied today.

   Works with no account (localStorage). Signed in, it syncs with the
   chapters_studied and study_days tables. Days are only ever added, so
   unmarking a chapter never breaks a streak.

   window.BibleProgress
     .streak()          { days, today, atRisk, last }
     .studiedCount()    number of chapters marked studied
     .isStudied(page)   true if that chapter is marked studied
     .onChange(fn)      fn() after any change (local or synced)

   Kept identical in both repositories.                                     */
(function () {
    'use strict';

    var K_CH = 'bs-studied', K_DAYS = 'bs-days', K_CUR = 'bs-progress-cursor', K_OWNER = 'bs-progress-owner';
    var BOOKS = { genesis:50, exodus:40, leviticus:27, numbers:36, deuteronomy:34, joshua:24, judges:21, ruth:4, '1samuel':31, '2samuel':24, '1kings':22, '2kings':25, '1chronicles':29, '2chronicles':36, ezra:10, nehemiah:13, esther:10, job:42, psalms:150, proverbs:31, ecclesiastes:12, songofsolomon:8, isaiah:66, jeremiah:52, lamentations:5, ezekiel:48, daniel:12, hosea:14, joel:3, amos:9, obadiah:1, jonah:4, micah:7, nahum:3, habakkuk:3, zephaniah:3, haggai:2, zechariah:14, malachi:4, matthew:28, mark:16, luke:24, john:21, acts:28, romans:16, '1corinthians':16, '2corinthians':13, galatians:6, ephesians:6, philippians:4, colossians:4, '1thessalonians':5, '2thessalonians':3, '1timothy':6, '2timothy':4, titus:3, philemon:1, hebrews:13, james:5, '1peter':5, '2peter':3, '1john':5, '2john':1, '3john':1, jude:1, revelation:22 };

    function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function dayOf(date) { return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()); }
    function today() { return dayOf(new Date()); }
    function shift(day, n) { var p = day.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dayOf(d); }
    function isPage(p) { var m = /^(\d?[a-z]+?)(\d+)$/.exec(p || ''); return !!(m && BOOKS[m[1]] && +m[2] >= 1 && +m[2] <= BOOKS[m[1]]); }
    function t(key, fallback) { return window.BibleI18n ? window.BibleI18n.t(key, fallback) : fallback; }
    function english() { return !window.BibleI18n || window.BibleI18n.lang() === 'en'; }

    // chapters: { "luke6": { d: "2026-10-21", r: false, t: ms, dirty: true } }
    var chapters = load(K_CH, {});
    // days: { "2026-10-21": 1 }   (2 = not yet sent to the account)
    var days = load(K_DAYS, {});
    var listeners = [];

    function changed() {
        save(K_CH, chapters); save(K_DAYS, days);
        listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
    }

    function streak() {
        var now = today(), y = shift(now, -1);
        var start = days[now] ? now : (days[y] ? y : null);
        if (!start) return { days: 0, today: false, atRisk: false, last: lastDay() };
        var n = 0, d = start;
        while (days[d]) { n++; d = shift(d, -1); }
        return { days: n, today: !!days[now], atRisk: !days[now], last: start };
    }
    function lastDay() { var k = Object.keys(days).sort(); return k.length ? k[k.length - 1] : null; }
    function studiedCount() { return Object.keys(chapters).filter(function (p) { return !chapters[p].r; }).length; }
    function isStudied(p) { return !!(chapters[p] && !chapters[p].r); }

    // Tell the reminder service the current streak, so the 7 PM nudge goes out
    // only on a night it would really end. Only for devices that turned on
    // devotional reminders; nothing about what was read is sent.
    var PUSH_WORKER = 'https://devotional-push.cloudflare-dust598.workers.dev';
    function reportStreak(force) {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
            var s = streak(), last = lastDay();
            if (!last) return;
            var stamp = today() + '|' + last + '|' + s.days;
            if (!force && localStorage.getItem('bs-streak-reported') === stamp) return;
            navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
                if (!sub) return;
                return fetch(PUSH_WORKER + '/studied', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint, day: last, streak: s.days,
                        text: t('streak.risk', 'Your {n}-day streak ends tonight. Study a chapter today to keep it going.') })
                }).then(function (r) { if (r.ok) localStorage.setItem('bs-streak-reported', stamp); });
            }).catch(function () {});
        } catch (e) {}
    }

    function mark(page, on) {
        var c = chapters[page] || { d: today(), r: false };
        if (on) { c.d = today(); c.r = false; if (!days[c.d]) days[c.d] = 2; }
        else c.r = true;
        c.t = Date.now(); c.dirty = true;
        chapters[page] = c;
        changed();
        scheduleSync();
        if (on) reportStreak(true);
    }

    /* ---------- account sync ---------- */

    var account = window.BibleAccount || null, user = null, timer = null, busy = null, again = false;

    function scheduleSync(delay) {
        if (!user) return;
        clearTimeout(timer);
        timer = setTimeout(syncNow, delay == null ? 1200 : delay);
    }

    function syncNow() {
        if (!user || !account) return Promise.resolve();
        if (busy) { again = true; return busy; }
        var uid = user.id, started = Date.now();
        busy = account.ready().then(function (sb) {
            var chKeys = Object.keys(chapters).filter(function (p) { return chapters[p].dirty; });
            var dayKeys = Object.keys(days).filter(function (d) { return days[d] === 2; });
            var push = Promise.resolve();
            if (chKeys.length) push = push.then(function () {
                return sb.from('chapters_studied').upsert(chKeys.map(function (p) {
                    return { user_id: uid, page: p, studied_on: chapters[p].d, removed: !!chapters[p].r };
                }), { onConflict: 'user_id,page' }).then(function (res) {
                    if (res.error) throw res.error;
                    chKeys.forEach(function (p) { if (chapters[p] && chapters[p].t <= started) delete chapters[p].dirty; });
                });
            });
            if (dayKeys.length) push = push.then(function () {
                return sb.from('study_days').upsert(dayKeys.map(function (d) { return { user_id: uid, day: d }; }),
                    { onConflict: 'user_id,day', ignoreDuplicates: true }).then(function (res) {
                    if (res.error) throw res.error;
                    dayKeys.forEach(function (d) { days[d] = 1; });
                });
            });
            var cur = load(K_CUR, null);
            if (!cur || cur.uid !== uid) cur = { uid: uid, ch: null, day: null };
            function pull(table, cols, field, apply) {
                var q = sb.from(table).select(cols + ',updated_at').order('updated_at', { ascending: true }).limit(1000);
                if (cur[field]) q = q.gt('updated_at', cur[field]);
                return q.then(function (res) {
                    if (res.error) throw res.error;
                    (res.data || []).forEach(function (r) { apply(r); cur[field] = r.updated_at; });
                    if ((res.data || []).length === 1000) return pull(table, cols, field, apply);
                });
            }
            return push.then(function () {
                return pull('chapters_studied', 'page,studied_on,removed', 'ch', function (r) {
                    if (chapters[r.page] && chapters[r.page].dirty) return;
                    chapters[r.page] = { d: r.studied_on, r: !!r.removed, t: Date.parse(r.updated_at) || Date.now() };
                });
            }).then(function () {
                return pull('study_days', 'day', 'day', function (r) { if (!days[r.day]) days[r.day] = 1; });
            }).then(function () { save(K_CUR, cur); });
        }).catch(function () { /* offline: kept on this device, retried later */ })
          .then(function () {
            busy = null; save(K_OWNER, uid); changed(); publish();
            if (again) { again = false; scheduleSync(0); }
        });
        return busy;
    }

    // For people who set up Friends: keep the streak and progress they show
    // their friends current. Nobody else's device ever sends this.
    var lastPublished = null;
    function publish() {
        if (!user || !account) return;
        var friendsOn = null;
        try { friendsOn = localStorage.getItem('bs-friends'); } catch (e) {}
        if (friendsOn !== user.id) return;
        var pos = load('bs-position', null);
        var row = { user_id: user.id, streak: streak().days, chapters: Math.min(studiedCount(), 1189),
                    current_page: pos && isPage(pos.page) ? pos.page : null };
        var key = JSON.stringify(row);
        if (key === lastPublished) return;
        account.ready().then(function (sb) {
            return sb.from('friend_stats').upsert(row, { onConflict: 'user_id' }).then(function (res) { if (!res.error) lastPublished = key; });
        }).catch(function () {});
    }

    function onAccount(u) {
        var owner = load(K_OWNER, null);
        if (!u) {
            if (owner) {
                // Signed out: what is saved to the account leaves this device; unsent changes stay.
                Object.keys(chapters).forEach(function (p) { if (!chapters[p].dirty) delete chapters[p]; });
                Object.keys(days).forEach(function (d) { if (days[d] !== 2) delete days[d]; });
                save(K_CUR, null); save(K_OWNER, null); changed();
            }
            user = null; return;
        }
        if (owner && owner !== u.id) { chapters = {}; days = {}; save(K_CUR, null); changed(); }
        user = u; syncNow();
    }

    /* ---------- chapter page button ---------- */

    var STYLE = ''
        + '.bs-studied{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0 6px;padding:12px 14px;border:1px solid var(--border-light);border-radius:12px;background:var(--bg-tint-2);font-family:"Inter",-apple-system,sans-serif;color:var(--ink-deep)}'
        + '.bs-studied-btn{font-family:inherit;font-weight:600;font-size:.92rem;padding:10px 16px;border-radius:8px;border:1px solid var(--accent-link);background:var(--accent-link);color:#fff;cursor:pointer}'
        + '.bs-studied-btn.done{background:transparent;color:var(--accent-link)}'
        + '.bs-studied-btn:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
        + '.bs-studied-info{font-size:.85rem;color:var(--text-secondary)}'
        + '.bs-flame{color:#d9622b}'
        + '.bs-studied-note{font-size:.85rem;font-weight:600;color:var(--accent-link);text-decoration:none;white-space:nowrap}'
        + '.bs-progress{max-width:640px;margin:22px auto 0;padding:0 16px;font-family:"Inter",-apple-system,sans-serif}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-progress{margin:0 0 16px;padding:0;text-align:left}'
        + '.bs-progress-in{display:flex;gap:10px;align-items:stretch}'
        + '.bs-stat{flex:1;background:#fff;border:1px solid var(--border-light);border-radius:12px;padding:12px 14px;color:var(--ink-deep)}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-stat{background:var(--bg-tint-2)}'
        + '.bs-stat b{display:block;font-family:"Poppins","Inter",sans-serif;font-size:1.35rem;line-height:1.2}'
        + '.bs-stat span{font-size:.78rem;color:var(--text-faint)}'
        + '.bs-risk{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#fff4e5;border:1px solid #f0c27a;color:#7a4a0a;font-size:.86rem}';
    function style() { if (!document.getElementById('bs-progress-style')) { var s = document.createElement('style'); s.id = 'bs-progress-style'; s.textContent = STYLE; document.head.appendChild(s); } }

    var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var box = null;

    function streakText(s) {
        if (!s.days) return '';
        return t('streak.n', '{n}-day streak').replace('{n}', s.days);
    }

    function renderChapter() {
        if (!isPage(page)) return;
        var anchor = document.querySelector('.scripture-container');
        if (!anchor) return;
        style();
        if (!box) {
            box = document.createElement('div');
            box.className = 'bs-studied';
            anchor.parentNode.insertBefore(box, anchor.nextSibling);
        }
        var on = isStudied(page), s = streak();
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bs-studied-btn' + (on ? ' done' : '');
        btn.textContent = on ? '✓ ' + t('studied.done', 'Studied') : t('studied.mark', 'Mark chapter studied');
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.addEventListener('click', function () { mark(page, !isStudied(page)); });
        var info = document.createElement('span');
        info.className = 'bs-studied-info';
        if (s.days) {
            var f = document.createElement('i'); f.className = 'fas fa-fire bs-flame'; f.setAttribute('aria-hidden', 'true');
            info.append(f, ' ' + streakText(s));
            if (s.atRisk && english()) info.append(' · study today to keep it');
        } else {
            info.textContent = english() ? 'Mark chapters as you finish them to build a streak.' : '';
        }
        // Notes for this chapter live in the Notes study tab (chapter-notes.js).
        box.replaceChildren(btn, info);
    }

    var homeBox = null;
    function renderHome() {
        var isHome = /^(|index(\.html)?)$/.test(location.pathname.split('/').pop() || '');
        if (!isHome) return;
        var s = streak(), n = studiedCount();
        if (!s.days && !n) { if (homeBox) { homeBox.remove(); homeBox = null; } return; }
        style();
        if (!homeBox) {
            homeBox = document.createElement('div');
            homeBox.className = 'bs-progress';
            var standalone = document.body.classList.contains('pwa-standalone');
            var pwaNav = document.querySelector('.pwa-bible-nav'), hero = document.querySelector('.hero-section');
            if (standalone && pwaNav) pwaNav.insertBefore(homeBox, pwaNav.firstChild);
            else if (hero) hero.parentNode.insertBefore(homeBox, hero.nextSibling);
            else return;
        }
        function stat(icon, big, small) {
            var d = document.createElement('div'); d.className = 'bs-stat';
            var b = document.createElement('b');
            if (icon) { var i = document.createElement('i'); i.className = icon; i.setAttribute('aria-hidden', 'true'); b.append(i, ' '); }
            b.append(String(big));
            var sp = document.createElement('span'); sp.textContent = small;
            d.append(b, sp); return d;
        }
        var row = document.createElement('div'); row.className = 'bs-progress-in';
        row.append(stat('fas fa-fire bs-flame', s.days, t('home.daystreak', 'day streak')),
                   stat('fas fa-check', n, n === 1 && english() ? 'chapter studied' : t('home.chstudied', 'chapters studied')));
        var parts = [row];
        if (s.days && s.atRisk) {
            var r = document.createElement('p'); r.className = 'bs-risk';
            r.textContent = t('streak.risk', 'Your {n}-day streak ends tonight. Study a chapter today to keep it going.').replace('{n}', s.days);
            parts.push(r);
        }
        homeBox.replaceChildren.apply(homeBox, parts);
    }

    function render() { renderChapter(); renderHome(); }
    listeners.push(render);

    window.BibleProgress = {
        streak: streak, studiedCount: studiedCount, isStudied: isStudied,
        publish: function () { lastPublished = null; publish(); },
        studiedOn: function (p) { return chapters[p] && !chapters[p].r ? chapters[p].d : null; },
        today: today,
        mark: function (p, on) { mark(p, on !== false); },
        reset: function () { chapters = {}; days = {}; changed(); },
        onChange: function (fn) { listeners.push(fn); },
        render: render
    };

    function start() {
        render();
        setTimeout(function () { reportStreak(false); }, 3000);
        if (account) {
            account.onChange(onAccount);
            window.addEventListener('online', function () { if (user) scheduleSync(0); });
        }
        window.addEventListener('bible-lang', render);
        window.addEventListener('storage', function (e) {
            if (e.key === K_CH || e.key === K_DAYS) { chapters = load(K_CH, {}); days = load(K_DAYS, {}); render(); }
        });
        // A page left open past midnight: refresh the streak line when it comes back into view.
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') render(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
