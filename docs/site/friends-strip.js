/* Friends strip on the home page.
 *
 * Shown only to someone signed in who has set up friends on this device
 * (localStorage 'bs-friends' holds their user id, written by friends.html).
 * It shows each friend's streak, how many things friends have shared since
 * the friends page was last opened ('bs-friends-seen'), and any waiting
 * friend requests, all linking to friends.html. Everything comes from the
 * friends_list() and friends_feed() database functions, the same as the
 * friends page, so it shows nothing a friend has not chosen to share.
 */
(function () {
    'use strict';

    function T(k, d) { return window.BibleI18n ? window.BibleI18n.t(k, d) : d; }
    function fmt(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
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
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

    var isHome = /^(|index(\.html)?)$/.test(location.pathname.split('/').pop() || '');
    var account = window.BibleAccount;
    if (!isHome || !account) return;

    var STYLE = ''
        + '.bs-fr{max-width:640px;margin:16px auto 0;padding:0 16px;font-family:"Inter",-apple-system,sans-serif;color:var(--ink-deep)}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-fr{margin:0 0 16px;padding:0;text-align:left}'
        + '.bs-fr-card{display:block;background:#fff;border:1px solid var(--border-light);border-radius:14px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,.05);color:inherit;text-decoration:none}'
        + 'body.pwa-standalone .pwa-bible-nav .bs-fr-card{background:var(--bg-tint-2);box-shadow:none}'
        + '.bs-fr-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 8px}'
        + '.bs-fr-eyebrow{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);margin:0}'
        + '.bs-fr-news{font-size:.8rem;font-weight:600;color:var(--accent-link)}'
        + '.bs-fr-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}'
        + '.bs-fr-list li{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid var(--border-light);background:var(--bg-tint);font-size:.85rem;font-weight:600}'
        + '.bs-fr-list small{font-weight:500;color:var(--text-secondary)}'
        + '.bs-fr-empty{font-size:.85rem;color:var(--text-secondary);margin:0}';

    var box = null, user = null, data = null, seq = 0;

    function mount() {
        if (box) return true;
        if (!document.getElementById('bs-fr-style')) document.head.appendChild(el('style', { id: 'bs-fr-style', text: STYLE }));
        box = el('div', { class: 'bs-fr' });
        var standalone = document.body.classList.contains('pwa-standalone');
        var pwaNav = document.querySelector('.pwa-bible-nav'), hero = document.querySelector('.hero-section');
        var plan = document.querySelector('.bs-plan');
        if (plan && plan.parentNode) plan.parentNode.insertBefore(box, plan.nextSibling);   // just after the reading plan
        else if (standalone && pwaNav) pwaNav.insertBefore(box, pwaNav.firstChild);
        else if (hero) hero.parentNode.insertBefore(box, hero.nextSibling);
        else { box = null; return false; }
        return true;
    }

    function render() {
        if (!data || !mount()) { if (box && !data) box.replaceChildren(); return; }
        var friends = data.list.filter(function (f) { return f.status === 'accepted'; });
        var incoming = data.list.filter(function (f) { return f.status === 'pending' && f.incoming; }).length;
        if (!friends.length && !incoming) { box.replaceChildren(); return; }

        var seen = Number(get('bs-friends-seen')) || 0;
        var fresh = data.feed.filter(function (i) { return Date.parse(i.created_at) > seen; }).length;

        var news = [];
        if (incoming) news.push(incoming === 1 ? T('fr.request1', '1 friend request') : fmt(T('fr.requests', '{n} friend requests'), { n: incoming }));
        if (fresh) news.push(fresh === 1 ? T('fr.new1', '1 new share') : fmt(T('fr.newN', '{n} new shares'), { n: fresh }));

        // Friends studying today first, longest streaks first.
        friends.sort(function (a, b) { return (b.streak || 0) - (a.streak || 0); });
        var chips = friends.slice(0, 8).map(function (f) {
            return el('li', {}, [f.display_name, f.streak ? el('small', { text: '\u{1F525} ' + f.streak }) : null]);
        });
        if (friends.length > 8) chips.push(el('li', { text: '+' + (friends.length - 8) }));

        box.replaceChildren(el('a', { class: 'bs-fr-card', href: 'friends.html' }, [
            el('div', { class: 'bs-fr-top' }, [
                el('p', { class: 'bs-fr-eyebrow', text: T('fr.title', 'Friends') }),
                news.length ? el('span', { class: 'bs-fr-news', text: news.join(' · ') }) : null
            ]),
            chips.length ? el('ul', { class: 'bs-fr-list' }, chips)
                         : el('p', { class: 'bs-fr-empty', text: T('fr.waiting', 'Someone wants to study with you. Tap to answer.') })
        ]));
    }

    function load() {
        var mine = ++seq;
        account.ready().then(function (sb) {
            return Promise.all([sb.rpc('friends_list'), sb.rpc('friends_feed', { max_items: 50 })]);
        }).then(function (res) {
            if (mine !== seq || !user) return;
            if (res[0].error || res[1].error) return;
            data = { list: res[0].data || [], feed: res[1].data || [] };
            render();
        }).catch(function () { /* offline: no strip */ });
    }

    account.onChange(function (u) {
        user = u && get('bs-friends') === u.id ? u : null;
        data = null; render();
        if (user) load();
    });
    window.addEventListener('bible-lang', render);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && user) load(); });
})();
