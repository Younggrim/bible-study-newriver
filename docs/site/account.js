/* Bible Study accounts: optional sign-in so a person's study follows them
   across devices. Shared by every page that saves something (the Memory page
   today; chapter progress, notes and highlights later).

   Sign-in is passwordless: an email address, then a 6-digit code typed into
   the page (Supabase email OTP). A code rather than a link because on iPhone
   the installed app and Safari do not share storage, so a tapped link would
   sign in the wrong one.

   The Supabase library is loaded only when it is needed: when this device
   already holds a session, or when someone opens the sign-in dialog. Visitors
   who never sign in download nothing extra.

   Both values in CONFIG are public by design. Every table is protected by Row
   Level Security, so the key only lets a signed-in person reach their own
   rows. Never put a service-role or secret key in this file.

   window.BibleAccount
     .hasSession()        true if this device may be signed in (cheap, sync)
     .ready()             Promise of the Supabase client (loads the library)
     .user()              the signed-in user, or null
     .onChange(fn)        fn(user) now if known, and on every sign-in/out
     .openSignIn(opts)    show the sign-in dialog; opts.reason is one sentence
     .signOut()           Promise; signs out on this device                     */
(function () {
    'use strict';

    var CONFIG = {
        url: 'https://vqgumrfjxlhkzzzfgejl.supabase.co',
        key: 'sb_publishable_pG2kmWU11t4FShA7JpiHFQ_kpxBoRbW'
    };
    // When upgrading the library, change the version and the hash together.
    var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.0/dist/umd/supabase.js';
    var LIB_SRI = 'sha384-xPW3QHswsICVC2mW6BFNwMbhpLkbZ133fKOhxNx3QGGgAOJfL3O9t8r2aWn1aez6';
    var STORAGE_KEY = 'bible-study-auth';

    var client = null, clientPromise = null, currentUser = null, known = false, listeners = [];

    function hasSession() {
        try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; }
    }

    function loadLibrary() {
        return new Promise(function (resolve, reject) {
            if (window.supabase && window.supabase.createClient) { resolve(); return; }
            var s = document.createElement('script');
            s.src = LIB;
            if (LIB_SRI) { s.integrity = LIB_SRI; s.crossOrigin = 'anonymous'; }
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('offline')); };
            document.head.appendChild(s);
        });
    }

    function setUser(user) {
        var changed = !known || (user && user.id) !== (currentUser && currentUser.id);
        currentUser = user || null;
        known = true;
        if (changed) listeners.slice().forEach(function (fn) { try { fn(currentUser); } catch (e) {} });
    }

    function ready() {
        if (clientPromise) return clientPromise;
        clientPromise = loadLibrary().then(function () {
            client = window.supabase.createClient(CONFIG.url, CONFIG.key, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: STORAGE_KEY }
            });
            client.auth.onAuthStateChange(function (event, session) {
                // Defer: Supabase holds a lock while this callback runs.
                setTimeout(function () { setUser(session ? session.user : null); }, 0);
            });
            return client.auth.getSession().then(function (res) {
                setUser(res && res.data && res.data.session ? res.data.session.user : null);
                return client;
            });
        }).catch(function (err) {
            clientPromise = null;   // allow a retry once back online
            throw err;
        });
        return clientPromise;
    }

    function onChange(fn) {
        listeners.push(fn);
        if (known) { try { fn(currentUser); } catch (e) {} }
    }

    function signOut() {
        return ready().then(function (c) { return c.auth.signOut(); }).catch(function () {}).then(function () { setUser(null); });
    }

    /* ---------- sign-in dialog ---------- */

    var STYLE = ''
        + '.acct-overlay{position:fixed;inset:0;z-index:100000;background:rgba(20,14,10,0.55);display:flex;align-items:flex-end;justify-content:center;padding:0}'
        + '@media (min-width:560px){.acct-overlay{align-items:center;padding:20px}}'
        + '.acct-dialog{background:#fff;color:var(--ink-deep);width:100%;max-width:420px;border-radius:16px 16px 0 0;padding:24px 22px calc(24px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 32px rgba(0,0,0,0.2);font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;max-height:92vh;overflow:auto}'
        + '@media (min-width:560px){.acct-dialog{border-radius:16px;padding-bottom:24px}}'
        + '.acct-dialog h2{font-family:"Poppins","Inter",sans-serif;font-weight:700;font-size:1.25rem;margin:0 0 6px;color:var(--ink-deep)}'
        + '.acct-dialog p{font-size:0.9rem;line-height:1.55;color:var(--text-secondary);margin:0 0 16px}'
        + '.acct-dialog label{display:block;font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px}'
        + '.acct-dialog input{width:100%;font-family:inherit;font-size:1rem;color:var(--ink-deep);background:#fff;border:1px solid var(--border-medium);border-radius:8px;padding:12px}'
        + '.acct-dialog input.acct-code{font-size:1.5rem;letter-spacing:0.3em;text-align:center;font-variant-numeric:tabular-nums}'
        + '.acct-dialog input:focus-visible,.acct-btn:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
        + '.acct-btn{display:block;width:100%;margin-top:12px;font-family:inherit;font-weight:600;font-size:0.95rem;padding:12px;border-radius:8px;border:1px solid var(--accent-link);background:var(--accent-link);color:#fff;cursor:pointer}'
        + '.acct-btn.quiet{background:transparent;border-color:transparent;color:var(--accent-link);margin-top:4px}'
        + '.acct-btn:disabled{opacity:0.5;cursor:default}'
        + '.acct-error{color:#b5473f;font-size:0.85rem;margin:10px 0 0;min-height:1.2em}'
        + '.acct-small{font-size:0.78rem;color:var(--text-faint);margin:14px 0 0}';

    var overlay = null, lastFocus = null;

    function el(tag, attrs, children) {
        var n = document.createElement(tag), k;
        for (k in attrs || {}) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'class') n.className = attrs[k];
            else n.setAttribute(k, attrs[k]);
        }
        (children || []).forEach(function (c) { if (c) n.appendChild(c); });
        return n;
    }

    function explain(err) {
        var code = (err && (err.code || err.error_code)) || '', msg = (err && err.message) || '';
        if (msg === 'offline' || /Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'You seem to be offline. Check your connection and try again.';
        if (/rate_limit/.test(code) || err && err.status === 429) return 'Too many codes requested. Wait a minute, then try again.';
        if (code === 'otp_expired' || /expired|invalid/i.test(msg)) return 'That code did not work. Check it, or send a new one.';
        if (code === 'email_address_invalid' || code === 'validation_failed') return 'Enter a valid email address.';
        return 'Something went wrong. Try again in a moment.';
    }

    function closeSignIn() {
        if (!overlay) return;
        overlay.remove(); overlay = null;
        document.removeEventListener('keydown', onKey);
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }
    function onKey(e) { if (e.key === 'Escape') closeSignIn(); }

    function openSignIn(opts) {
        opts = opts || {};
        if (overlay) return;
        if (!document.getElementById('acct-style')) document.head.appendChild(el('style', { id: 'acct-style', text: STYLE }));
        lastFocus = document.activeElement;
        var dialog = el('div', { class: 'acct-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'acct-title' });
        overlay = el('div', { class: 'acct-overlay' }, [dialog]);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSignIn(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        ready().catch(function () {});   // start loading while the person types
        showEmail('');

        function busy(button, err, label, work) {
            return function (e) {
                if (e) e.preventDefault();
                if (button.disabled) return;
                var original = button.textContent;
                err.textContent = ''; button.disabled = true; button.textContent = label;
                Promise.resolve().then(work).catch(function (ex) { err.textContent = ex && ex.friendly ? ex.message : explain(ex); })
                    .then(function () { button.disabled = false; button.textContent = original; });
            };
        }
        function must(res) { if (res && res.error) throw res.error; return res && res.data; }
        function friendly(message) { var e = new Error(message); e.friendly = true; return e; }

        function showEmail(prefill) {
            var err = el('p', { class: 'acct-error', role: 'alert' });
            var input = el('input', { type: 'email', id: 'acct-email', name: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'none', spellcheck: 'false', required: 'required' });
            input.value = prefill || '';
            var send = el('button', { class: 'acct-btn', type: 'submit', text: 'Send my code' });
            var form = el('form', { novalidate: 'novalidate' }, [el('label', { for: 'acct-email', text: 'Email' }), input, send, err]);
            form.addEventListener('submit', busy(send, err, 'Sending…', function () {
                var email = input.value.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw friendly('Enter a valid email address.');
                return ready().then(function (c) {
                    return c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
                }).then(must).then(function () { showCode(email); });
            }));
            var cancel = el('button', { class: 'acct-btn quiet', type: 'button', text: 'Not now' });
            cancel.addEventListener('click', closeSignIn);
            dialog.replaceChildren(
                el('h2', { id: 'acct-title', text: 'Sign in to save your study' }),
                el('p', { text: opts.reason || 'Your study is saved to your account, so it follows you to any device.' }),
                form, cancel,
                el('p', { class: 'acct-small', text: 'We will email you a 6-digit code. No password needed. Your email is used only to sign you in.' }));
            input.focus();
        }

        function showCode(email) {
            var err = el('p', { class: 'acct-error', role: 'alert' });
            var input = el('input', { type: 'text', id: 'acct-code', name: 'code', class: 'acct-code', inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]*', maxlength: '10', required: 'required' });
            input.addEventListener('input', function () { var d = input.value.replace(/\D/g, ''); if (d !== input.value) input.value = d; });
            var go = el('button', { class: 'acct-btn', type: 'submit', text: 'Sign in' });
            var form = el('form', { novalidate: 'novalidate' }, [el('label', { for: 'acct-code', text: 'Sign-in code' }), input, go, err]);
            form.addEventListener('submit', busy(go, err, 'Checking…', function () {
                var token = input.value.replace(/\D/g, '');
                if (token.length < 6) throw friendly('Enter the 6-digit code from your email.');
                return ready().then(function (c) {
                    return c.auth.verifyOtp({ email: email, token: token, type: 'email' });
                }).then(must).then(function (data) {
                    setUser(data && data.user ? data.user : null);
                    closeSignIn();
                });
            }));
            var again = el('button', { class: 'acct-btn quiet', type: 'button', text: 'Send a new code' });
            again.addEventListener('click', busy(again, err, 'Sending…', function () {
                return ready().then(function (c) { return c.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }); })
                    .then(must).then(function () { err.textContent = 'New code sent.'; });
            }));
            var back = el('button', { class: 'acct-btn quiet', type: 'button', text: 'Use a different email' });
            back.addEventListener('click', function () { showEmail(email); });
            var sentTo = el('p', {});
            sentTo.append('We sent a code to ', el('strong', { text: email }), '. It can take a minute to arrive.');
            dialog.replaceChildren(el('h2', { id: 'acct-title', text: 'Enter your code' }), sentTo, form, again, back);
            input.focus();
        }
    }

    window.BibleAccount = {
        hasSession: hasSession,
        ready: ready,
        user: function () { return currentUser; },
        onChange: onChange,
        openSignIn: openSignIn,
        signOut: signOut
    };

    // A device that was signed in last time picks its session back up.
    if (hasSession()) ready().catch(function () { /* offline: pages keep working from local data */ });
})();
