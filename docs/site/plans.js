/* Reading plans.

   Pick a plan on the home page; each day the card shows that day's chapters
   with a button straight to the next one. A day is done when all of its
   chapters have been marked studied (progress.js) on or after the day the
   plan started. Missing a day never marks anything late: the plan simply
   waits at the first unfinished day.

   The plans themselves are in site/plans-data.js (build_plans.py). The plan
   a person is following is kept in localStorage and, signed in, in the
   reading_plans table. Kept identical in both repositories.               */
(function () {
    'use strict';

    var PLANS = window.BIBLE_PLANS || [];
    var BY_ID = {};
    PLANS.forEach(function (p) { BY_ID[p.id] = p; });
    var K = 'bs-plan', K_OWNER = 'bs-plan-owner';
    var P = window.BibleProgress;

    function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function T(k, d) { return window.BibleI18n ? window.BibleI18n.t(k, d) : d; }
    function bookName(slug) {
        if (window.BibleI18n && window.BibleI18n.bookName) return window.BibleI18n.bookName(slug);
        return slug.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon').replace(/\b(?!of\b)[a-z]/g, function (m) { return m.toUpperCase(); });
    }
    function label(page) { var m = /^(\d?[a-z]+?)(\d+)$/.exec(page); return m ? bookName(m[1]) + ' ' + m[2] : page; }
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

    // plan: { id, start: "YYYY-MM-DD", active: true, t: ms, dirty: true }
    var plan = load(K, null);
    function current() { return plan && plan.active && BY_ID[plan.id] ? plan : null; }

    function done(page) {
        var d = P && P.studiedOn(page);
        return !!(d && plan && d >= plan.start);
    }
    function status() {
        var c = current();
        if (!c) return null;
        var def = BY_ID[c.id], idx = -1;
        for (var i = 0; i < def.days.length; i++) {
            if (!def.days[i].every(done)) { idx = i; break; }
        }
        return { def: def, day: idx, finished: idx < 0, total: def.days.length, doneDays: idx < 0 ? def.days.length : idx };
    }

    function setPlan(id) {
        plan = id ? { id: id, start: P ? P.today() : new Date().toISOString().slice(0, 10), active: true, t: Date.now(), dirty: true }
                  : { id: plan ? plan.id : 'john-21', start: plan ? plan.start : '1970-01-01', active: false, t: Date.now(), dirty: true };
        save(K, plan);
        render();
        scheduleSync();
    }

    /* ---------- account sync ---------- */

    var account = window.BibleAccount || null, user = null, timer = null, busy = null;
    function scheduleSync(d) { if (!user) return; clearTimeout(timer); timer = setTimeout(sync, d == null ? 1000 : d); }
    function sync() {
        if (!user || !account || busy) return busy || Promise.resolve();
        var uid = user.id;
        busy = account.ready().then(function (sb) {
            return sb.from('reading_plans').select('plan_id,started_on,active,updated_at').maybeSingle().then(function (res) {
                if (res.error) throw res.error;
                var r = res.data, rt = r ? Date.parse(r.updated_at) : 0;
                if (plan && plan.dirty && plan.t >= rt - 5000) {
                    var sent = plan.t;
                    return sb.from('reading_plans').upsert({ user_id: uid, plan_id: plan.id, started_on: plan.start, active: !!plan.active }, { onConflict: 'user_id' })
                        .then(function (up) { if (up.error) throw up.error; if (plan && plan.t === sent) { delete plan.dirty; save(K, plan); } });
                }
                if (r && (!plan || rt > plan.t)) { plan = { id: r.plan_id, start: r.started_on, active: r.active, t: rt }; save(K, plan); }
            });
        }).catch(function () {}).then(function () { busy = null; save(K_OWNER, uid); render(); });
        return busy;
    }
    function onAccount(u) {
        var owner = load(K_OWNER, null);
        if (!u) {
            if (owner) { if (plan && !plan.dirty) { plan = null; save(K, null); } save(K_OWNER, null); render(); }
            user = null; return;
        }
        if (owner && owner !== u.id) { plan = null; save(K, null); }
        user = u; sync();
    }

    /* ---------- home page ---------- */

    var STYLE = ''
        + '.bs-plan{max-width:640px;margin:16px auto 0;padding:0 16px;font-family:"Inter",-apple-system,sans-serif;color:var(--ink-deep)}'
        + '#planMount .bs-plan{margin:0 auto;padding:0}'
        + '.bs-plan-card{background:#fff;border:1px solid var(--border-light);border-radius:14px;padding:16px 18px;box-shadow:0 4px 16px rgba(0,0,0,.05)}'
        + '.bs-plan-eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);margin:0 0 4px}'
        + '.bs-plan-name{font-family:"Poppins","Inter",sans-serif;font-weight:700;font-size:1.05rem;margin:0 0 2px}'
        + '.bs-plan-day{font-size:.85rem;color:var(--text-secondary);margin:0 0 10px}'
        + '.bs-plan-bar{height:6px;border-radius:3px;background:var(--rule-soft);overflow:hidden;margin:0 0 12px}'
        + '.bs-plan-bar i{display:block;height:100%;background:var(--accent-link)}'
        + '.bs-plan-list{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-wrap:wrap;gap:8px}'
        + '.bs-plan-list a{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid var(--border-light);background:var(--bg-tint);color:var(--ink-deep);text-decoration:none;font-size:.85rem;font-weight:600}'
        + '.bs-plan-list a.done{opacity:.6}'
        + '.bs-plan-list a.done i{color:#2e7d4f}'
        + '.bs-plan-go{display:inline-block;background:var(--accent-link);color:#fff;border-radius:8px;padding:10px 16px;font-weight:600;font-size:.9rem;text-decoration:none}'
        + '.bs-plan-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}'
        + '.bs-plan-link{background:none;border:0;padding:0;font:inherit;font-size:.82rem;color:var(--text-faint);text-decoration:underline;cursor:pointer}'
        + '.bs-plan-choose{list-style:none;margin:8px 0 0;padding:0}'
        + '.bs-plan-choose li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--rule-soft)}'
        + '.bs-plan-choose span{font-size:.9rem;font-weight:600}'
        + '.bs-plan-choose small{display:block;font-weight:400;color:var(--text-faint);font-size:.78rem}'
        + '.bs-plan-start{font-family:inherit;font-size:.82rem;font-weight:600;padding:7px 12px;border-radius:8px;border:1px solid var(--accent-link);background:transparent;color:var(--accent-link);cursor:pointer;white-space:nowrap}'
        + '.bs-plan-today{margin:10px 0 0;font-size:.85rem;color:var(--text-secondary);font-family:"Inter",-apple-system,sans-serif}'
        + '.bs-plan-today a{color:var(--accent-link);font-weight:600;text-decoration:none}';
    function style() { if (!document.getElementById('bs-plan-style')) { var s = el('style', { id: 'bs-plan-style', text: STYLE }); document.head.appendChild(s); } }

    var homeEl = null, choosing = false;
    function pageName() { return location.pathname.split('/').pop() || ''; }
    function isHome() { return /^(|index(\.html)?)$/.test(pageName()); }
    function isPlansPage() { return /^plans(\.html)?$/.test(pageName()); }
    // In the installed app, plans live on their own Plans tab (plans.html), not the home page.
    function isApp() {
        return document.body.classList.contains('pwa-standalone')
            || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    }

    function chooser(cancel, skip) {
        var list = el('ul', { class: 'bs-plan-choose' }, PLANS.filter(function (p) { return p.id !== skip; }).map(function (p) {
            var chs = p.days.reduce(function (a, d) { return a + d.length; }, 0);
            var b = el('button', { type: 'button', class: 'bs-plan-start', text: T('plan.start', 'Start') });
            b.addEventListener('click', function () { choosing = false; setPlan(p.id); });
            return el('li', {}, [el('span', {}, [p.name, el('small', { text: p.days.length + ' days · ' + chs + ' chapters' })]), b]);
        }));
        var kids = [el('p', { class: 'bs-plan-eyebrow', text: skip ? T('plan.others', 'Other plans') : T('plan.choose', 'Start a reading plan') }), list];
        if (cancel) {
            var c = el('button', { type: 'button', class: 'bs-plan-link', text: T('plan.cancel', 'Keep my current plan') });
            c.addEventListener('click', function () { choosing = false; render(); });
            kids.push(el('p', { style: 'margin:10px 0 0' }, [c]));
        }
        return el('div', { class: 'bs-plan-card' }, kids);
    }

    function renderHome() {
        var onPlans = isPlansPage();
        if (!PLANS.length || !(onPlans || (isHome() && !isApp()))) {
            if (homeEl && !onPlans) { homeEl.remove(); homeEl = null; }
            return;
        }
        style();
        if (!homeEl) {
            homeEl = el('div', { class: 'bs-plan' });
            var mountAt = document.getElementById('planMount');
            var hero = document.querySelector('.hero-section');
            if (onPlans && mountAt) mountAt.appendChild(homeEl);
            else if (!onPlans && hero) hero.parentNode.insertBefore(homeEl, hero.nextSibling);
            else { homeEl = null; return; }
        }
        var st = status();
        if (!st || choosing) { homeEl.replaceChildren(chooser(!!st)); return; }
        // The plans page also lists every plan under the one being followed.
        var others = onPlans ? chooser(false, st.def.id) : null;
        if (others) others.style.marginTop = '16px';

        var change = el('button', { type: 'button', class: 'bs-plan-link', text: T('plan.change', 'Change plan') });
        change.addEventListener('click', function () { choosing = true; render(); });
        var pct = Math.round(100 * st.doneDays / st.total);
        var bar = el('div', { class: 'bs-plan-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.total), 'aria-valuenow': String(st.doneDays) }, [el('i', { style: 'width:' + pct + '%' })]);

        if (st.finished) {
            var again = el('button', { type: 'button', class: 'bs-plan-start', text: T('plan.another', 'Start another plan') });
            again.addEventListener('click', function () { choosing = true; render(); });
            homeEl.replaceChildren(el('div', { class: 'bs-plan-card' }, [
                el('p', { class: 'bs-plan-eyebrow', text: T('plan.title', 'Reading plan') }),
                el('p', { class: 'bs-plan-name', text: st.def.name }),
                el('p', { class: 'bs-plan-day', text: '🎉 ' + T('plan.finished', 'Finished! Well done.') }), bar, again]), others || '');
            return;
        }
        var today = st.def.days[st.day];
        var next = today.filter(function (p) { return !done(p); })[0];
        var chips = el('ul', { class: 'bs-plan-list' }, today.map(function (p) {
            var ok = done(p);
            return el('li', {}, [el('a', { href: p + '.html', class: ok ? 'done' : '' }, [ok ? el('i', { class: 'fas fa-check', 'aria-hidden': 'true' }) : null, label(p)])]);
        }));
        homeEl.replaceChildren(el('div', { class: 'bs-plan-card' }, [
            el('p', { class: 'bs-plan-eyebrow', text: T('plan.title', 'Reading plan') }),
            el('p', { class: 'bs-plan-name', text: st.def.name }),
            el('p', { class: 'bs-plan-day', text: T('plan.day', 'Day {n} of {total}').replace('{n}', st.day + 1).replace('{total}', st.total) }),
            bar, chips,
            el('div', { class: 'bs-plan-row' }, [el('a', { class: 'bs-plan-go', href: next + '.html' }, [T('plan.read', 'Read') + ' ' + label(next) + ' ', el('i', { class: 'fas fa-arrow-right', 'aria-hidden': 'true' })]), change])
        ]), others || '');
    }

    /* ---------- chapter page: where this chapter sits in today's reading ---------- */

    var lineEl = null;
    function renderChapter() {
        var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
        var box = document.querySelector('.bs-studied');
        var st = status();
        if (!box || !st || st.finished) { if (lineEl) { lineEl.remove(); lineEl = null; } return; }
        var today = st.def.days[st.day];
        var dayText = function (i) { return T('plan.title', 'Reading plan') + ' · ' + T('plan.day', 'Day {n} of {total}').replace('{n}', i + 1).replace('{total}', st.total) + '. '; };
        var kids;
        if (today.indexOf(page) >= 0) {
            // This chapter is part of the day being read now.
            var next = today.filter(function (p) { return !done(p) && p !== page; })[0];
            kids = [dayText(st.day)];
            if (next) kids.push(T('plan.next', 'Next:') + ' ', el('a', { href: next + '.html', text: label(next) + ' →' }));
        } else if (st.day > 0 && st.def.days[st.day - 1].indexOf(page) >= 0 && done(page)) {
            // Marking this chapter just finished a day: point straight at the next one.
            kids = ['✓ ' + dayText(st.day - 1) + T('plan.next', 'Next:') + ' ', el('a', { href: today[0] + '.html', text: label(today[0]) + ' →' })];
        } else {
            if (lineEl) { lineEl.remove(); lineEl = null; }
            return;
        }
        style();
        if (!lineEl) { lineEl = el('p', { class: 'bs-plan-today' }); box.parentNode.insertBefore(lineEl, box.nextSibling); }
        lineEl.replaceChildren.apply(lineEl, kids);
    }

    function render() { renderHome(); renderChapter(); }

    function start() {
        render();
        if (P && P.onChange) P.onChange(render);
        window.addEventListener('bible-lang', render);
        if (account) account.onChange(onAccount);
        window.addEventListener('storage', function (e) { if (e.key === K) { plan = load(K, null); render(); } });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
