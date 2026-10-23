/* Listen: a play button above the chapter text that reads the chapter in
   whichever translation is showing.

   Where the sound comes from, in order:
     1. ESV            the ESV API's recording
     2. anything else  a Faith Comes By Hearing recording from Bible Brain,
                       when one exists for that same translation; the verse
                       being read is highlighted when Bible Brain has timings
     3. neither        the device's own speech voice, labelled "Device voice"
                       so nobody takes it for a recording

   1 and 2 are looked up by the bible-audio Supabase Edge Function
   (supabase/functions/bible-audio), which holds the API keys. This page only
   ever sees the URL of the publisher's own MP3, and streams it from there.
   If the function is unreachable or has no key, this quietly becomes 3.

   Nothing is looked up until someone presses play, so the ESV API quota is
   only spent on people who listen. On iPhone a sound may only start from a
   tap, and the lookup takes a moment, so the tap itself starts a silent clip
   and a silent utterance; whichever the answer needs is then allowed to play.

   Playback speed is remembered: in the account (user_metadata.audio_rate)
   when signed in, in localStorage otherwise.

   Kept identical in both repositories. Does not modify site/script.js; it
   wraps switchTranslation() from outside, the way translations.js does.     */
(function () {
    'use strict';

    var FUNCTION_URL = 'https://vqgumrfjxlhkzzzfgejl.supabase.co/functions/v1/bible-audio';
    var RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5];
    var RATE_KEY = 'bs-audio-rate';
    var ENGLISH = { ESV: 1, BSB: 1, KJV: 1, ASV: 1, NET: 1, WEB: 1 };

    var page = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    var container = document.querySelector('.scripture-container');
    if (!container || !/^\d?[a-z]+\d+$/.test(page)) return;

    function t(key, fallback) { return window.BibleI18n ? window.BibleI18n.t(key, fallback) : fallback; }
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }

    /* ---------- the button (top bar) and the strip above the text ----------
       The play button sits in the fixed top bar beside the translation picker,
       so it stays in reach while scrolling through the chapter. The strip above
       the text holds what goes with it: where the sound comes from, the speed,
       and the publisher's credit. It appears once someone starts listening.  */

    var STYLE = ''
        + '.bs-audio{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 14px;padding:10px 12px;border:1px solid var(--border-light);border-radius:10px;background:var(--bg-tint-2);font-family:"Inter",-apple-system,sans-serif;font-size:.85rem;color:var(--text-secondary)}'
        + '.bs-audio[hidden]{display:none}'
        + '.bs-audio-play{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 12px;border-radius:6px;border:none;background:var(--accent-link);color:#fff;font-family:"Inter",-apple-system,sans-serif;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap}'
        + '.bs-audio-play i{width:1em;text-align:center}'
        + '@media (max-width:600px){.top-nav .bs-audio-play{padding:5px 0;width:32px;min-height:30px}.top-nav .bs-audio-label{display:none}}'
        + '.bs-audio-play:disabled{opacity:.55;cursor:default}'
        + '.bs-audio-play:focus-visible,.bs-audio-rate:focus-visible{outline:2px solid var(--accent-link);outline-offset:2px}'
        + '.bs-audio-src{color:var(--text-muted)}'
        + '.bs-audio-src b{font-weight:600;color:var(--ink-deep)}'
        + '.bs-audio-rate{margin-left:auto;font:inherit;color:var(--ink-deep);background:#fff;border:1px solid var(--border-medium);border-radius:6px;padding:6px 8px;min-height:36px}'
        + '.bs-audio-credit{flex-basis:100%;margin:0;font-size:.72rem;line-height:1.5;color:var(--text-faint)}'
        + '.bs-audio-credit:empty{display:none}'
        + '.bs-audio-credit a{color:inherit}'
        + '.scripture-container [data-v].bs-reading{background:var(--bg-tint);box-shadow:0 0 0 2px var(--bg-tint);border-radius:3px}';
    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var bar = el('div', 'bs-audio');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t('audio.region', 'Listen to this chapter'));
    var playBtn = el('button', 'bs-audio-play');
    playBtn.type = 'button';
    var icon = el('i', 'fas fa-play');
    icon.setAttribute('aria-hidden', 'true');
    var playText = el('span', 'bs-audio-label', t('audio.listen', 'Listen'));
    playBtn.append(icon, playText);
    var srcLabel = el('span', 'bs-audio-src');
    srcLabel.setAttribute('aria-live', 'polite');
    var rateSel = el('select', 'bs-audio-rate');
    rateSel.setAttribute('aria-label', t('audio.speed', 'Playback speed'));
    RATES.forEach(function (r) {
        var o = el('option', null, r + '×');
        o.value = String(r);
        rateSel.appendChild(o);
    });
    var credit = el('p', 'bs-audio-credit');
    bar.append(srcLabel, rateSel, credit);
    container.parentNode.insertBefore(bar, container);
    var picker = document.querySelector('.top-nav select.nav-translation');
    var inNav = !!picker;
    if (inNav) picker.parentNode.insertBefore(playBtn, picker.nextSibling);
    else bar.insertBefore(playBtn, bar.firstChild);   // a page without the top bar keeps everything together

    // Hidden until there is something to say: playing, paused, or a message.
    function syncBar() { bar.hidden = inNav && state === 'idle' && !srcLabel.textContent; }

    /* ---------- playback speed, remembered ---------- */

    function validRate(r) { r = Number(r); return RATES.indexOf(r) >= 0 ? r : null; }
    var rate = 1;
    try { rate = validRate(localStorage.getItem(RATE_KEY)) || 1; } catch (e) {}
    rateSel.value = String(rate);

    var account = window.BibleAccount, signedIn = null, saveTimer = null;
    if (account) {
        account.onChange(function (user) {
            signedIn = user;
            var saved = user && user.user_metadata && validRate(user.user_metadata.audio_rate);
            if (saved && saved !== rate) applyRate(saved, false);
        });
    }

    function applyRate(r, persist) {
        rate = r;
        rateSel.value = String(r);
        try { localStorage.setItem(RATE_KEY, String(r)); } catch (e) {}
        if (audio) { audio.defaultPlaybackRate = r; audio.playbackRate = r; }
        if (engine === 'speech' && state === 'playing') speakFrom(verseIndex);   // takes effect from this verse
        if (persist && account && signedIn) {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(function () {
                account.ready().then(function (c) { return c.auth.updateUser({ data: { audio_rate: rate } }); }).catch(function () {});
            }, 800);
        }
    }
    rateSel.addEventListener('change', function () { applyRate(validRate(rateSel.value) || 1, true); });

    /* ---------- state ---------- */

    var state = 'idle';          // idle | loading | playing | paused
    var engine = null;           // 'media' | 'speech'
    var gen = 0;                 // bumped by stop(); late answers for an older generation are dropped
    var found = {};              // translation -> lookup answer, for this page view
    var audio = null, timings = [], verses = [], verseIndex = 0, utterance = null;

    function currentTranslation() {
        var b = container.querySelector('.translation-block.active');
        return { code: b ? b.getAttribute('data-translation') : 'ESV', block: b };
    }

    function setState(s) {
        state = s;
        icon.className = s === 'playing' ? 'fas fa-pause' : s === 'loading' ? 'fas fa-spinner fa-spin' : 'fas fa-play';
        playText.textContent = s === 'playing' ? t('audio.pause', 'Pause') : s === 'paused' ? t('audio.resume', 'Resume')
            : s === 'loading' ? t('audio.loading', 'Loading…') : t('audio.listen', 'Listen');
        playBtn.setAttribute('aria-label', playText.textContent);
        playBtn.title = playText.textContent;
        syncBar();
        if ('mediaSession' in navigator) {
            try { navigator.mediaSession.playbackState = s === 'playing' ? 'playing' : s === 'paused' ? 'paused' : 'none'; } catch (e) {}
        }
    }

    function showSource(answer) {
        srcLabel.replaceChildren();
        credit.replaceChildren();
        if (answer) fillSource(answer);
        syncBar();
    }

    function fillSource(answer) {
        if (answer.source === 'esv' || answer.source === 'fcbh') {
            srcLabel.append(el('b', null, answer.source === 'esv' ? t('audio.esv', 'ESV audio') : t('audio.recording', 'Audio recording')),
                answer.source === 'fcbh' ? ' · Faith Comes By Hearing' + (answer.drama ? ' · ' + t('audio.drama', 'dramatized') : '') : '');
            if (answer.credit) {
                credit.append(answer.credit.text + ' ');
                if (answer.credit.link) {
                    var a = el('a', null, answer.credit.link.replace(/^https?:\/\/(www\.)?/, ''));
                    a.href = answer.credit.link; a.target = '_blank'; a.rel = 'noopener';
                    credit.append(a);
                }
            }
        } else if (answer.source === 'speech') {
            srcLabel.append(el('b', null, t('audio.device', 'Device voice')));
            credit.textContent = t('audio.device.note', 'Read aloud by your device’s built-in voice. This is not a recording.');
        } else if (answer.source === 'unavailable') {
            srcLabel.textContent = answer.message;
        }
    }

    function clearHighlight() {
        container.querySelectorAll('.bs-reading').forEach(function (n) { n.classList.remove('bs-reading'); });
    }

    var lastUserScroll = 0, shownVerse = 0;
    ['wheel', 'touchmove', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, function () { lastUserScroll = Date.now(); }, { passive: true });
    });
    function highlight(v) {
        if (v === shownVerse) return;
        shownVerse = v;
        clearHighlight();
        var block = currentTranslation().block;
        if (!block || !v) return;
        var nodes = block.querySelectorAll('[data-v="' + v + '"]');
        nodes.forEach(function (n) { n.classList.add('bs-reading'); });
        // Follow along, unless the reader has scrolled away on purpose in the last few seconds.
        var first = nodes[0];
        if (first && Date.now() - lastUserScroll > 4000) {
            var r = first.getBoundingClientRect();
            if (r.top < 60 || r.bottom > window.innerHeight - 40) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    function stop() {
        gen++;
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            try { audio.load(); } catch (e) {}
        }
        if (window.speechSynthesis) { utterance = null; window.speechSynthesis.cancel(); }
        engine = null; timings = []; verses = []; verseIndex = 0; shownVerse = 0;
        clearHighlight();
        setState('idle');
    }

    /* ---------- the tap ---------- */

    // A few milliseconds of silence, played inside the tap so iOS lets this element play later.
    var silence = null;
    function silentClip() {
        if (silence) return silence;
        var n = 800, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
        function s(o, str) { for (var i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); }
        s(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
        d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
        d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
        s(36, 'data'); d.setUint32(40, n * 2, true);
        silence = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
        return silence;
    }

    function ensureAudio() {
        if (audio) return audio;
        audio = new Audio();
        audio.preload = 'none';
        audio.addEventListener('timeupdate', function () {
            if (engine !== 'media' || !timings.length) return;
            var now = audio.currentTime, v = 0;
            for (var i = 0; i < timings.length && timings[i][1] <= now + 0.15; i++) v = timings[i][0];
            highlight(v);
        });
        audio.addEventListener('ended', function () { if (engine === 'media') stop(); });
        audio.addEventListener('error', function () {
            if (engine !== 'media') return;
            var code = currentTranslation().code;
            delete found[code];   // a signed URL may have expired; look it up afresh next time
            stop();
            showSource({ source: 'unavailable', message: t('audio.failed', 'The recording could not be played. Tap Listen to try again.') });
        });
        return audio;
    }

    function unlock() {
        var a = ensureAudio();
        a.src = silentClip();
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
        if (window.speechSynthesis) {
            var u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            window.speechSynthesis.speak(u);
        }
    }

    function lookup(code) {
        if (found[code]) return Promise.resolve(found[code]);
        var ctrl = 'AbortController' in window ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
        return fetch(FUNCTION_URL + '?t=' + encodeURIComponent(code) + '&page=' + encodeURIComponent(page), ctrl ? { signal: ctrl.signal } : {})
            .then(function (r) { return r.ok ? r.json() : { source: 'none' }; })
            .catch(function () { return { source: 'none', transient: true }; })
            .then(function (answer) {
                clearTimeout(timer);
                if (!answer.transient) found[code] = answer;
                return answer;
            });
    }

    playBtn.addEventListener('click', function () {
        if (state === 'playing') { pause(); return; }
        if (state === 'paused') { resume(); return; }
        if (state === 'loading') return;

        var my = ++gen, tr = currentTranslation();
        unlock();
        if (found[tr.code]) { begin(found[tr.code], tr); return; }
        setState('loading');
        if (account && signedIn) {
            // Another device may have changed the speed since this session was stored.
            account.ready().then(function (c) { return c.auth.getUser(); }).then(function (res) {
                var u = res && res.data && res.data.user, saved = u && u.user_metadata && validRate(u.user_metadata.audio_rate);
                if (saved && saved !== rate) applyRate(saved, false);
            }).catch(function () {});
        }
        lookup(tr.code).then(function (answer) {
            if (my !== gen) return;   // stopped, or the translation changed, while looking
            begin(answer, currentTranslation());
        });
    });

    function begin(answer, tr) {
        if (answer.url && (answer.source === 'esv' || answer.source === 'fcbh')) {
            var a = ensureAudio();
            engine = 'media';
            timings = answer.timings || [];
            a.src = answer.url;
            a.defaultPlaybackRate = rate;
            a.playbackRate = rate;
            showSource(answer);
            setMediaSession(tr.code);
            setState('playing');
            var p = a.play();
            if (p && p.catch) p.catch(function () { if (engine === 'media') setState('paused'); });
            // Some browsers reset the speed when a new source loads.
            a.addEventListener('loadedmetadata', function once() { a.removeEventListener('loadedmetadata', once); a.playbackRate = rate; });
            return;
        }
        speak(tr);
    }

    function pause() {
        if (engine === 'media' && audio) audio.pause();
        if (engine === 'speech' && window.speechSynthesis) { utterance = null; window.speechSynthesis.cancel(); }
        setState('paused');
    }

    function resume() {
        if (engine === 'media' && audio) {
            setState('playing');
            var p = audio.play();
            if (p && p.catch) p.catch(function () { setState('paused'); });
        } else if (engine === 'speech') {
            setState('playing');
            speakFrom(verseIndex);   // restart the verse that was interrupted
        } else {
            stop();
        }
    }

    /* ---------- device voice ---------- */

    function langOf(code, block) {
        if (ENGLISH[code]) return 'en';
        return (block && block.lang) || document.documentElement.lang || 'en';
    }

    function voiceFor(lang) {
        var voices = window.speechSynthesis.getVoices() || [];
        var want = lang.toLowerCase(), prefixes;
        if (want === 'zh-hans') prefixes = ['zh-cn', 'cmn-cn', 'zh'];
        else if (want === 'zh-hant') prefixes = ['zh-tw', 'zh-hk', 'cmn-tw', 'zh'];
        else if (want === 'en') prefixes = ['en-us', 'en-gb', 'en'];
        else prefixes = [want];
        for (var i = 0; i < prefixes.length; i++) {
            var p = prefixes[i];
            var matches = voices.filter(function (v) {
                var l = (v.lang || '').replace('_', '-').toLowerCase();
                return l === p || l.indexOf(p + '-') === 0;
            });
            if (matches.length) {
                return matches.filter(function (v) { return v.localService; })[0] || matches[0];
            }
        }
        return null;
    }

    function voices() {
        // Voices load asynchronously the first time; wait briefly for them.
        return new Promise(function (resolve) {
            if (window.speechSynthesis.getVoices().length) { resolve(); return; }
            var done = false;
            function finish() { if (!done) { done = true; resolve(); } }
            window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
            setTimeout(finish, 1500);
        });
    }

    var SKIP = '.verse-num,.chapter-num,.bs-bm,.copyright,.extra_text,.footnote,.footnotes,sup,.bs-credit,.bs-msg';
    function readVerses(block) {
        var byVerse = {}, order = [];
        block.querySelectorAll('[data-v]').forEach(function (n) {
            if (n.closest(SKIP)) return;
            var c = n.cloneNode(true);
            c.querySelectorAll(SKIP).forEach(function (x) { x.remove(); });
            var text = c.textContent.replace(/\s+/g, ' ');
            if (!/[^\s()]/.test(text)) return;
            var v = n.getAttribute('data-v');
            if (!(v in byVerse)) { byVerse[v] = ''; order.push(v); }
            byVerse[v] += text;
        });
        return order.map(function (v) { return { v: parseInt(v, 10), text: byVerse[v].trim() }; }).filter(function (x) { return x.text; });
    }

    function speak(tr) {
        var my = gen;
        var block = tr.block;
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            setState('idle');
            showSource({ source: 'unavailable', message: t('audio.none', 'No audio is available for this translation on this device.') });
            return;
        }
        var list = block ? readVerses(block) : [];
        if (!list.length) {
            setState('idle');
            showSource({ source: 'unavailable', message: t('audio.wait', 'The text is still loading. Try again in a moment.') });
            return;
        }
        voices().then(function () {
            if (my !== gen) return;
            var lang = langOf(tr.code, block), voice = voiceFor(lang);
            if (!voice) {
                setState('idle');
                showSource({ source: 'unavailable', message: t('audio.novoice', 'No recording of this translation, and this device has no voice for its language.') });
                return;
            }
            engine = 'speech';
            verses = list;
            speakVoice = voice;
            speakLang = voice.lang || lang;
            showSource({ source: 'speech' });
            setMediaSession(tr.code);
            setState('playing');
            speakFrom(0);
        });
    }

    var speakVoice = null, speakLang = 'en';
    // One utterance per verse: it is what lets the verse being read be highlighted,
    // a new speed apply straight away, and avoids Chrome cutting off long utterances.
    function speakFrom(i) {
        var synth = window.speechSynthesis;
        utterance = null;
        synth.cancel();
        verseIndex = i;
        if (i >= verses.length) { stop(); return; }
        var u = new SpeechSynthesisUtterance(verses[i].text);
        u.voice = speakVoice; u.lang = speakLang; u.rate = rate;
        u.onstart = function () { if (utterance === u) highlight(verses[i].v); };
        u.onend = function () { if (utterance === u && state === 'playing') speakFrom(i + 1); };
        u.onerror = function (e) {
            if (utterance !== u || e.error === 'interrupted' || e.error === 'canceled') return;
            stop();
        };
        utterance = u;   // keep a reference: Chrome drops events for utterances it has garbage-collected
        highlight(verses[i].v);
        synth.speak(u);
    }

    /* ---------- lock screen and headphone controls ---------- */

    function setMediaSession(code) {
        if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
        var h1 = document.querySelector('.book-header h1');
        try {
            navigator.mediaSession.metadata = new MediaMetadata({ title: (h1 ? h1.textContent.trim() : page) + ' · ' + code, artist: document.title });
            navigator.mediaSession.setActionHandler('play', function () { if (state === 'paused') resume(); });
            navigator.mediaSession.setActionHandler('pause', function () { if (state === 'playing') pause(); });
        } catch (e) {}
    }

    /* ---------- stop cleanly when the text changes ---------- */

    var original = window.switchTranslation;
    if (typeof original === 'function') {
        window.switchTranslation = function (code) {
            var before = currentTranslation().code;
            original(code);
            if (code !== before || state !== 'idle') { stop(); showSource(null); }
        };
    }
    // A chapter change is a page load. Safari can keep speaking across one, so cancel it.
    window.addEventListener('pagehide', function () { stop(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { stop(); showSource(null); } });

    setState('idle');
})();
