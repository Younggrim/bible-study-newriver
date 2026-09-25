/* Bible Study Site — Shared JavaScript */

/* ESV API Configuration — via Cloudflare Worker proxy */
var ESV_PROXY_URL = 'https://esv-proxy.cloudflare-dust598.workers.dev';

/* Service worker registration — every page, not just index.html/devotional.html,
   so offline caching and the install prompt below both work regardless of
   which page someone lands on first (a shared chapter link, a bookmark, etc). */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function() {});
}

/* ===== Add-to-Home-Screen install banner — site-wide =====
   Moved here from index.html so every entry point (a shared chapter link,
   a topical study, the devotional page) offers the install nudge, not just
   the homepage. Guards against double-injection in case a page already has
   its own #install-banner markup. */
(function() {
  if (document.getElementById('install-banner')) return;
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  if (localStorage.getItem('install-banner-dismissed')) return;

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.id = 'install-banner';
    wrap.style.cssText = "display:none;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#3d2b1f 0%,#5a3e2b 100%);color:#fff;padding:16px 20px;box-shadow:0 -4px 20px rgba(0,0,0,0.3);font-family:'Inter',sans-serif;";
    wrap.innerHTML =
      '<div style="max-width:600px;margin:0 auto;display:flex;align-items:center;gap:14px;">'
      + '<img src="site/icon-192.png" alt="Bible Study" style="width:48px;height:48px;border-radius:10px;flex-shrink:0;">'
      + '<div style="flex:1;">'
      + '<div style="font-weight:600;font-size:0.95rem;margin-bottom:4px;">Add Bible Study to Home Screen</div>'
      + '<div id="install-instructions" style="font-size:0.8rem;color:#ddd;line-height:1.4;"></div>'
      + '</div>'
      + '<button id="install-btn" style="background:#f0c865;color:#3d2b1f;border:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;cursor:pointer;white-space:nowrap;">Install</button>'
      + '<button id="install-dismiss" style="background:none;border:none;color:#aaa;font-size:1.4rem;cursor:pointer;padding:4px 8px;line-height:1;" aria-label="Dismiss">&times;</button>'
      + '</div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  var banner = null, installBtn, dismissBtn, instructions, deferredPrompt = null;

  function ensureBanner() {
    if (!banner) {
      banner = buildBanner();
      installBtn = document.getElementById('install-btn');
      dismissBtn = document.getElementById('install-dismiss');
      instructions = document.getElementById('install-instructions');

      installBtn.addEventListener('click', function() {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function() {
            deferredPrompt = null;
            banner.style.display = 'none';
          });
        }
      });
      dismissBtn.addEventListener('click', function() {
        banner.style.display = 'none';
        localStorage.setItem('install-banner-dismissed', '1');
      });
    }
    return banner;
  }

  // Android / Chrome — catches the native install prompt
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    var b = ensureBanner();
    instructions.textContent = 'Get quick access like a native app — works offline too.';
    b.style.display = 'block';
  });

  // iOS Safari — no native prompt exists, so show manual instructions
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
  if (isIOS && isSafari && !navigator.standalone) {
    var b = ensureBanner();
    instructions.innerHTML = 'Tap <strong>Share</strong> <span style="font-size:1.1em;">&#9757;</span> then <strong>"Add to Home Screen"</strong>';
    installBtn.style.display = 'none';
    b.style.display = 'block';
  }
})();

function switchTab(tabId) {
    document.querySelectorAll('.study-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.study-tab[data-tab="${tabId}"]`);
    if (tab) tab.classList.add('active');
    const content = document.getElementById('tab-' + tabId);
    if (content) content.classList.add('active');
}

function toggleSidebar() {
    document.querySelector('.left-sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('show');
}

/* A splash of color per translation — the one deliberate spot of color on
   an otherwise black/white chapter page, kept from the original palette */
var TRANSLATION_COLORS = {
    'ESV': '#8b3a2a',
    'BSB': '#1f6b73',
    'KJV': '#4a5a8a',
    'ASV': '#7a5c2e',
    'NET': '#5c3d6e',
    'WEB': '#2c6b4f'
};

function switchTranslation(trans) {
    document.querySelectorAll('.translation-block').forEach(b => b.classList.remove('active'));
    const block = document.querySelector(`.translation-block[data-translation="${trans}"]`);
    if (block) block.classList.add('active');

    // Apply translation color to the active block
    var container = document.querySelector('.scripture-container');
    if (container) {
        container.style.color = TRANSLATION_COLORS[trans] || '#000000';
    }

    // Save preference to localStorage
    try { localStorage.setItem('preferredTranslation', trans); } catch(e) {}

    // Load ESV from API if needed
    if (trans === 'ESV') {
        loadESVText();
    }
}

/* Fetch ESV text via Cloudflare Worker proxy and inject into the ESV translation block */
function loadESVText() {
    var esvBlock = document.querySelector('.translation-block[data-translation="ESV"]');
    if (!esvBlock) return;

    // Already loaded
    if (esvBlock.dataset.loaded === 'true') return;

    var passage = esvBlock.dataset.passage;
    if (!passage) return;

    fetch(ESV_PROXY_URL + '/?q=' + encodeURIComponent(passage))
    .then(function(response) {
        if (!response.ok) throw new Error('ESV proxy error: ' + response.status);
        return response.json();
    })
    .then(function(data) {
        if (data.passages && data.passages.length > 0) {
            esvBlock.innerHTML = data.passages[0];
            esvBlock.dataset.loaded = 'true';
        } else {
            esvBlock.innerHTML = '<p class="verse" style="color:var(--text-muted);font-style:italic;">ESV text could not be loaded for this passage.</p>';
        }
    })
    .catch(function(err) {
        console.error('ESV fetch failed:', err);
        esvBlock.innerHTML = '<p class="verse" style="color:var(--text-muted);font-style:italic;">Unable to load ESV text. Please try again later.</p>';
    });
}

// Navigation: book/chapter selector
function navigateTo(book, chapter) {
    const slug = book.toLowerCase().replace(/\s+/g, '');
    window.location.href = `${slug}${chapter}.html`;
}

// Initialize tab clicks
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.study-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Prevent touch-drag on the tab bar (mobile fix)
    var tabBar = document.querySelector('.study-tabs');
    if (tabBar) {
        tabBar.addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });
    }

    // Book select navigation
    const bookSelect = document.querySelector('.nav-book-select');
    const chapterSelect = document.querySelector('.nav-chapter-select');
    if (bookSelect && chapterSelect) {
        const navBtn = document.querySelector('.nav-go-btn');
        if (navBtn) {
            navBtn.addEventListener('click', function() {
                navigateTo(bookSelect.value, chapterSelect.value);
            });
        }
    }

    // Restore saved translation preference or default to ESV
    var savedTrans = null;
    try { savedTrans = localStorage.getItem('preferredTranslation'); } catch(e) {}
    if (savedTrans && TRANSLATION_COLORS[savedTrans]) {
        switchTranslation(savedTrans);
        // Update the dropdown to match
        var transSelect = document.querySelector('.nav-translation');
        if (transSelect) transSelect.value = savedTrans;
    } else {
        // Auto-load ESV text on page load (ESV is default translation)
        loadESVText();
        // Set default translation color (ESV)
        var container = document.querySelector('.scripture-container');
        if (container) {
            container.style.color = TRANSLATION_COLORS['ESV'];
        }
    }
});

function updateChapters() {
    var bookSelect = document.getElementById('bookSelect');
    var chapterSelect = document.getElementById('chapterSelect');
    var chapters = bookSelect.options[bookSelect.selectedIndex].dataset.chapters;
    chapterSelect.innerHTML = '';
    for (var i = 1; i <= parseInt(chapters); i++) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'Ch ' + i;
        chapterSelect.appendChild(opt);
    }
}

function goToChapter() {
    var book = document.getElementById('bookSelect').value;
    var chapter = document.getElementById('chapterSelect').value;
    window.location.href = book + chapter + '.html';
}

/* Lazy YouTube Embed — click thumbnail to load iframe */
function loadYT(el, id) {
    var label = (el.getAttribute('aria-label') || '').replace(/^Play video: /, '') || 'YouTube video';
    el.style.position = 'relative';
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
    el.removeAttribute('aria-label');
    el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" title="' + label.replace(/"/g, '&quot;') + '" style="width:100%;height:100%;position:absolute;top:0;left:0;border:none;" allow="autoplay;encrypted-media" allowfullscreen></iframe>';
}

/* Collapsible Video Sections */
function extractVerseNum(title) {
    // Extract starting verse number from video title
    // Matches patterns like "Genesis 1:6", "John 3:16-18", "Mark 4:1-20", "1:1-10"
    // Returns 0 for whole-chapter/overview videos (sort to top)
    // Returns 9999 for no match (sort to bottom)
    var lower = title.toLowerCase();
    // Check if it's a summary/overview (no verse ref = whole chapter)
    if (lower.indexOf('summary') !== -1 || lower.indexOf('overview') !== -1 || lower.indexOf('introduction') !== -1 || lower.indexOf('complete') !== -1) {
        return 0;
    }
    // Look for chapter:verse pattern
    var match = title.match(/(\d+):(\d+)/);
    if (match) {
        return parseInt(match[2], 10);
    }
    // No verse found — could be whole chapter video, put near top
    return 5000;
}

document.addEventListener('DOMContentLoaded', function() {
    // Find video tab content in chapter pages
    var videoTab = document.getElementById('tab-videos');
    if (videoTab) {
        var videos = videoTab.querySelectorAll('.yt-facade');
        if (videos.length > 0) {
            var h3 = videoTab.querySelector('h3');
            if (h3) h3.innerHTML = 'Videos (' + videos.length + ') <span style="font-size:0.75rem;color:#8a7e74;font-weight:400;"> — tap thumbnails to play</span>';

            // Sort videos by verse reference in title
            var videoArray = Array.from(videos);
            videoArray.sort(function(a, b) {
                var titleA = (a.querySelector('p') || {}).textContent || '';
                var titleB = (b.querySelector('p') || {}).textContent || '';
                var verseA = extractVerseNum(titleA);
                var verseB = extractVerseNum(titleB);
                return verseA - verseB;
            });
            // Re-append in sorted order
            var parent = videos[0].parentNode;
            videoArray.forEach(function(v) { parent.appendChild(v); });
        }
    }
});


/* ===== PWA Bottom Navigation — Only in standalone (app) mode ===== */
(function() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
    if (!isStandalone) return;

    // Mark body so CSS can respond
    document.documentElement.classList.add('pwa-standalone');
    document.body.classList.add('pwa-standalone');

    // Hide the prayer section on index (splash already shows it)
    var prayerSection = document.querySelector('.prayer-section');
    if (prayerSection) prayerSection.style.display = 'none';

    // Determine active section from current URL
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var section = 'bible';
    var topicPages = ['fruits-of-the-spirit','the-12-apostles','names-of-god','armor-of-god',
        'parables-of-jesus','prophecy-and-fulfillment','prayers-in-the-bible','i-am-statements',
        'beatitudes','men-of-the-bible','women-of-the-bible','kings-of-israel','promises-of-god',
        'spiritual-disciplines','the-trinity','miracles-of-jesus','ten-commandments','the-gospel',
        'covenants','marriage-and-family','topical-studies'];
    var strugglePages = ['addiction','anger','anxiety-and-fear','depression-and-hopelessness',
        'doubt-and-unbelief','greed-and-materialism','grief-and-loss','identity-and-self-worth',
        'loneliness','lust-and-sexual-sin','pride','suffering','temptation',
        'unforgiveness-and-bitterness','life-studies'];

    var baseName = path.replace('.html','');
    if (baseName === 'devotional') {
        section = 'devotional';
    } else if (topicPages.indexOf(baseName) !== -1) {
        section = 'topical';
    } else if (strugglePages.indexOf(baseName) !== -1) {
        section = 'life';
    } else if (baseName.indexOf('fruits-') === 0 || baseName.indexOf('apostles-') === 0 ||
               baseName.indexOf('names-') === 0 || baseName.indexOf('armor-') === 0 ||
               baseName.indexOf('parables-') === 0 || baseName.indexOf('iam-') === 0 ||
               baseName.indexOf('beatitudes-') === 0 || baseName.indexOf('commandments-') === 0 ||
               baseName.indexOf('miracles-') === 0 || baseName.indexOf('men-') === 0 ||
               baseName.indexOf('women-') === 0 || baseName.indexOf('kings-') === 0 ||
               baseName.indexOf('promises-') === 0 || baseName.indexOf('prayers-') === 0 ||
               baseName.indexOf('prophecy-') === 0 || baseName.indexOf('disciplines-') === 0 ||
               baseName.indexOf('trinity-') === 0 || baseName.indexOf('gospel-') === 0) {
        section = 'topical';
    } else {
        section = 'bible';
    }

    // Check hash for tab state on index
    var hash = window.location.hash;
    if (hash === '#topical') section = 'topical';
    if (hash === '#life') section = 'life';

    // On index page in app mode: show only the active section
    var isIndexPage = (path === 'index.html' || path === '' || path === '/' || path === 'index');
    var allSectionHeroes, allCardsContainers, contentBlock, siteFooter, heroSection;
    var bibleElements = [], topicalElements = [], lifeElements = [];

    function pwaShowSection(sec) {
        if (!isIndexPage) return;
        // Hide all
        bibleElements.concat(topicalElements).concat(lifeElements).forEach(function(el) {
            el.style.display = 'none';
        });
        // Show active
        var active = [];
        if (sec === 'bible') active = bibleElements;
        else if (sec === 'topical') active = topicalElements;
        else if (sec === 'life') active = lifeElements;
        active.forEach(function(el) { el.style.display = ''; });
        // Update nav highlights
        var navItems = document.querySelectorAll('.pwa-nav-item');
        navItems.forEach(function(item) { item.classList.remove('active'); });
        navItems.forEach(function(item) {
            if (item.dataset.section === sec) item.classList.add('active');
        });
        // Scroll to top
        window.scrollTo(0, 0);
    }

    if (isIndexPage) {
        heroSection = document.querySelector('.hero-section');
        if (heroSection) heroSection.style.display = 'none';

        allSectionHeroes = document.querySelectorAll('.section-hero');
        allCardsContainers = document.querySelectorAll('.cards-container');
        contentBlock = document.querySelector('.content-block');
        siteFooter = document.querySelector('.site-footer');

        // Bible = first section-hero (Bible) + compact passage navigator
        // (replaces the full 66-book grid — too long to scroll in-app)
        // Hide content-block (translation guide) — replaced by info icon
        if (contentBlock) contentBlock.style.display = 'none';
        // Hide the homepage devotional preview — the app has its own Devotional tab
        var devoPreview = document.querySelector('.devo-preview-section');
        if (devoPreview) devoPreview.style.display = 'none';
        if (allSectionHeroes[0]) bibleElements.push(allSectionHeroes[0]);
        var bibleNav = document.querySelector('.pwa-bible-nav');
        if (bibleNav) bibleElements.push(bibleNav);
        // The full book grid (allCardsContainers[0]) is permanently hidden
        // in app mode, not part of the tab rotation — it's still used on
        // the normal scrolling website, so hide it here rather than in CSS.
        if (allCardsContainers[0]) allCardsContainers[0].style.display = 'none';

        // Topical = second section-hero + second cards-container
        if (allSectionHeroes[1]) topicalElements.push(allSectionHeroes[1]);
        if (allCardsContainers[1]) topicalElements.push(allCardsContainers[1]);

        // Life = third section-hero + third cards-container
        if (allSectionHeroes[2]) lifeElements.push(allSectionHeroes[2]);
        if (allCardsContainers[2]) lifeElements.push(allCardsContainers[2]);

        if (siteFooter) siteFooter.style.display = 'none';

        // Show initial section
        pwaShowSection(section);

        // Add info button to the Bible section hero
        var bibleHero = allSectionHeroes[0];
        if (bibleHero) {
            var infoBtn = document.createElement('button');
            infoBtn.className = 'pwa-info-btn';
            infoBtn.innerHTML = '<i class="fas fa-circle-info"></i>';
            infoBtn.title = 'Translation & Commentary Guide';
            bibleHero.querySelector('.section-hero-overlay').appendChild(infoBtn);

            // Info popup
            var infoPopup = document.createElement('div');
            infoPopup.className = 'pwa-info-popup';
            infoPopup.innerHTML = ''
                + '<button class="pwa-info-close" onclick="this.parentElement.classList.remove(\'show\')">&times;</button>'
                + '<h3>Translation Guide</h3>'
                + '<div class="pwa-info-item"><strong style="color:#8b3a2a;">ESV</strong> — English Standard Version (2001). Word-for-word accuracy with modern readability.</div>'
                + '<div class="pwa-info-item"><strong style="color:#1f6b73;">BSB</strong> — Berean Standard Bible (2022). Modern and readable, dedicated to the public domain.</div>'
                + '<div class="pwa-info-item"><strong style="color:#4a5a8a;">KJV</strong> — King James Version (1611). Majestic, poetic language. Most influential English Bible.</div>'
                + '<div class="pwa-info-item"><strong style="color:#7a5c2e;">ASV</strong> — American Standard Version (1901). Extremely literal, great for word studies.</div>'
                + '<div class="pwa-info-item"><strong style="color:#5c3d6e;">NET</strong> — New English Translation (2005). 60,000+ translator notes.</div>'
                + '<div class="pwa-info-item"><strong style="color:#2c6b4f;">WEB</strong> — World English Bible (2000). Modern, public domain.</div>'
                + '<h3 style="margin-top:18px;">Commentaries</h3>'
                + '<div class="pwa-info-item"><strong>David Guzik</strong> — Enduring Word. Verse-by-verse commentary, freely available online.</div>'
                + '<div class="pwa-info-item"><strong>Jamieson-Fausset-Brown</strong> — Commentary Critical and Explanatory (1871). Concise, close to the original languages, public domain.</div>'
                + '<div class="pwa-info-item"><strong>Matthew Henry</strong> — Exposition (1710). Devotional, verse-by-verse, public domain.</div>';
            document.body.appendChild(infoPopup);

            infoBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                infoPopup.classList.toggle('show');
            });
            // Close on tap outside
            document.addEventListener('click', function(e) {
                if (!infoPopup.contains(e.target) && e.target !== infoBtn) {
                    infoPopup.classList.remove('show');
                }
            });
        }
    }

    // Inject splash screen on app open (once per session)
    var splashShown = false;
    try { splashShown = sessionStorage.getItem('pwa-splash-done') === '1'; } catch(e) {}
    if (!splashShown) {
        var splash = document.createElement('div');
        splash.className = 'pwa-splash';
        splash.innerHTML = ''
            + '<div class="splash-icon"><img src="site/dove-black.png" alt="New River" style="width:120px;height:auto;"></div>';
        document.body.appendChild(splash);
        try { sessionStorage.setItem('pwa-splash-done', '1'); } catch(e) {}
        splash.addEventListener('click', function() {
            splash.classList.add('fade-out');
            setTimeout(function() { splash.remove(); }, 700);
        });
        setTimeout(function() {
            if (!splash.classList.contains('fade-out')) {
                splash.classList.add('fade-out');
                setTimeout(function() { splash.remove(); }, 700);
            }
        }, 2200);
    }

    // Inject bottom nav (4 tabs: Bible, Topical, Life, Devotional)
    var nav = document.createElement('nav');
    nav.className = 'pwa-bottom-nav';
    nav.innerHTML = ''
        + '<a class="pwa-nav-item' + (section==='bible'?' active':'') + '" data-section="bible" href="#">'
        + '<i class="fas fa-book-bible"></i><span>Bible</span></a>'
        + '<a class="pwa-nav-item' + (section==='topical'?' active':'') + '" data-section="topical" href="#">'
        + '<i class="fas fa-lightbulb"></i><span>Topical</span></a>'
        + '<a class="pwa-nav-item' + (section==='life'?' active':'') + '" data-section="life" href="#">'
        + '<i class="fas fa-heart"></i><span>Life</span></a>'
        + '<a class="pwa-nav-item' + (section==='devotional'?' active':'') + '" data-section="devotional" id="pwa-devotional-btn" href="#">'
        + '<i class="fas fa-hands-praying"></i><span>Devotional</span></a>';
    document.body.appendChild(nav);

    // Tab click handling
    nav.querySelectorAll('.pwa-nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var sec = this.dataset.section;
            if (sec === 'devotional') {
                window.location.href = 'devotional.html';
                return;
            }
            if (sec === 'topical') {
                window.location.href = 'topical-studies.html';
                return;
            }
            if (sec === 'life') {
                window.location.href = 'life-studies.html';
                return;
            }
            // Bible tab
            if (isIndexPage) {
                pwaShowSection(sec);
            } else {
                window.location.href = 'index.html';
            }
        });
    });
})();


/* ===== Chapter Navigation Arrows ===== */
(function() {
    var path = window.location.pathname.split('/').pop() || '';
    var baseName = path.replace('.html', '');

    // Bible chapter pages: add prev/next arrows. At a book's first or last
    // chapter they step into the neighbouring book rather than to a page
    // that does not exist (luke25.html, genesis0.html).
    var BOOKS = [['genesis',50],['exodus',40],['leviticus',27],['numbers',36],['deuteronomy',34],['joshua',24],['judges',21],['ruth',4],['1samuel',31],['2samuel',24],['1kings',22],['2kings',25],['1chronicles',29],['2chronicles',36],['ezra',10],['nehemiah',13],['esther',10],['job',42],['psalms',150],['proverbs',31],['ecclesiastes',12],['songofsolomon',8],['isaiah',66],['jeremiah',52],['lamentations',5],['ezekiel',48],['daniel',12],['hosea',14],['joel',3],['amos',9],['obadiah',1],['jonah',4],['micah',7],['nahum',3],['habakkuk',3],['zephaniah',3],['haggai',2],['zechariah',14],['malachi',4],['matthew',28],['mark',16],['luke',24],['john',21],['acts',28],['romans',16],['1corinthians',16],['2corinthians',13],['galatians',6],['ephesians',6],['philippians',4],['colossians',4],['1thessalonians',5],['2thessalonians',3],['1timothy',6],['2timothy',4],['titus',3],['philemon',1],['hebrews',13],['james',5],['1peter',5],['2peter',3],['1john',5],['2john',1],['3john',1],['jude',1],['revelation',22]];
    var chapterMatch = baseName.match(/^(\d*[a-z]+?)(\d+)$/i);
    var bookIdx = -1;
    if (chapterMatch) {
        for (var bi = 0; bi < BOOKS.length; bi++) { if (BOOKS[bi][0] === chapterMatch[1]) { bookIdx = bi; break; } }
    }
    if (bookIdx >= 0) {
        var book = chapterMatch[1];
        var chapter = parseInt(chapterMatch[2]);
        var last = BOOKS[bookIdx][1];

        // Find the study-tabs or tab bar to place arrows after
        var insertAfter = document.querySelector('.study-tabs') || document.querySelector('.tab-bar');
        if (!insertAfter) {
            // Fallback: insert before main content
            var mainContent = document.querySelector('.main-content') || document.querySelector('main');
            if (mainContent) insertAfter = mainContent.firstElementChild;
        }
        if (!insertAfter) return;

        function bookLabel(slug) {
            return slug.replace(/^(\d)/, '$1 ').replace(/^songofsolomon$/, 'song of solomon')
                .replace(/\b(?!of\b)[a-z]/g, function (m) { return m.toUpperCase(); });
        }
        var btnStyle = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--bg-tint);border:1px solid var(--border-light);border-radius:8px;text-decoration:none;color:var(--ink-deep);font-size:0.85rem;font-weight:600;transition:background 0.2s;';
        var iconStyle = 'font-size:0.75rem;color:var(--accent-link);';

        var navDiv = document.createElement('div');
        navDiv.className = 'chapter-nav-arrows';
        navDiv.setAttribute('role', 'navigation');
        navDiv.setAttribute('aria-label', 'Chapter');
        navDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 20px;margin:0 0 16px;';

        var prevHref = '', prevText = '';
        if (chapter > 1) { prevHref = book + (chapter - 1); prevText = 'Ch ' + (chapter - 1); }
        else if (bookIdx > 0) { var pb = BOOKS[bookIdx - 1]; prevHref = pb[0] + pb[1]; prevText = bookLabel(pb[0]) + ' ' + pb[1]; }
        var nextHref = '', nextText = '';
        if (chapter < last) { nextHref = book + (chapter + 1); nextText = 'Ch ' + (chapter + 1); }
        else if (bookIdx < BOOKS.length - 1) { var nb = BOOKS[bookIdx + 1]; nextHref = nb[0] + '1'; nextText = bookLabel(nb[0]) + ' 1'; }

        var prevBtn = prevHref
            ? '<a href="' + prevHref + '.html" class="chapter-arrow-btn" rel="prev" style="' + btnStyle + '"><i class="fas fa-chevron-left" aria-hidden="true" style="' + iconStyle + '"></i> ' + prevText + '</a>'
            : '<span></span>';
        var nextBtn = nextHref
            ? '<a href="' + nextHref + '.html" class="chapter-arrow-btn" rel="next" style="' + btnStyle + '">' + nextText + ' <i class="fas fa-chevron-right" aria-hidden="true" style="' + iconStyle + '"></i></a>'
            : '<span></span>';

        navDiv.innerHTML = prevBtn + '<span style="font-size:0.8rem;color:var(--text-faint);font-weight:500;">' + bookLabel(book) + ' ' + chapter + '</span>' + nextBtn;

        insertAfter.parentNode.insertBefore(navDiv, insertAfter.nextSibling);
    }
})();


/* ===== Extra videos overlay (New River channel only) =====
   Looks for newriver-videos.json, a file that exists ONLY in the New River
   deployment (keyed by page filename, e.g. "1kings1.html"). It never exists
   on the main site, so this fetch 404s there and the block below is a silent
   no-op — that's what keeps New River's channel videos from ever appearing
   on bible.macdwellings.com without needing a separate copy of this file. */
(function() {
    var tabVideos = document.getElementById('tab-videos');
    if (!tabVideos) return;
    var page = window.location.pathname.split('/').pop() || 'index.html';

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    fetch('newriver-videos.json', { cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
            var entries = data && data[page];
            if (!entries || !entries.length) return;
            entries.forEach(function(v) {
                var card = document.createElement('div');
                card.className = 'yt-facade';
                card.style.cssText = "position:relative;cursor:pointer;border-radius:10px;overflow:hidden;border:1px solid var(--border-light);aspect-ratio:16/9;background:#000 url('https://img.youtube.com/vi/" + v.id + "/hqdefault.jpg') center/cover;";
                card.setAttribute('onclick', "loadYT(this,'" + v.id + "')");
                card.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><div style="width:60px;height:42px;background:#c0392b;border-radius:10px;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:18px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px;"></div></div></div><p style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;margin:0;background:rgba(0,0,0,0.7);color:#fff;font-size:0.78rem;font-weight:600;">'
                    + escapeHtml(v.title) + '<br><span class="yt-src" style="font-size:0.64rem;font-weight:400;opacity:0.75;">' + escapeHtml(v.source || 'New River Church') + '</span></p>';
                tabVideos.appendChild(card);
            });
            var h3 = tabVideos.querySelector('h3');
            if (h3) {
                var count = tabVideos.querySelectorAll('.yt-facade').length;
                h3.innerHTML = 'Videos (' + count + ') <span style="font-size:0.75rem;color:#8a7e74;font-weight:400;"> — tap thumbnails to play</span>';
            }
        })
        .catch(function() { /* no overlay file on this deployment — expected */ });
})();


/* ===== Accessibility =====
   Study tabs, video thumbnails and verse references are plain divs and spans
   in the HTML, so without this a keyboard cannot reach them and a screen
   reader does not announce them. This gives them the semantics of the
   controls they behave like. Kept identical in both repositories. */
(function () {
    function pressable(el, label) {
        if (el.getAttribute('data-a11y')) return;
        el.setAttribute('data-a11y', '1');
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        if (label) el.setAttribute('aria-label', label);
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
        });
    }
    function facades(root) {
        (root || document).querySelectorAll('.yt-facade:not([data-a11y])').forEach(function (el) {
            if (el.querySelector('iframe')) return;
            var cap = el.querySelector('p'), src = el.querySelector('.yt-src');
            var text = cap ? (cap.firstChild ? cap.firstChild.textContent : '').replace(/\s+/g, ' ').trim() : '';
            if (src && src.textContent.trim()) text += ' (' + src.textContent.trim() + ')';
            pressable(el, 'Play video' + (text ? ': ' + text : ''));
        });
    }
    function init() {
        // Study tabs as an ARIA tablist, with arrow-key movement
        var bar = document.querySelector('.study-tabs');
        if (bar) {
            var tabs = Array.prototype.slice.call(bar.querySelectorAll('.study-tab'));
            bar.setAttribute('role', 'tablist');
            var refresh = function () {
                tabs.forEach(function (t) {
                    var on = t.classList.contains('active');
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                    t.tabIndex = on ? 0 : -1;
                });
            };
            tabs.forEach(function (t, i) {
                var pane = document.getElementById('tab-' + t.dataset.tab);
                t.setAttribute('role', 'tab');
                if (!t.id) t.id = 'tabbtn-' + t.dataset.tab;
                if (pane) {
                    t.setAttribute('aria-controls', pane.id);
                    pane.setAttribute('role', 'tabpanel');
                    pane.setAttribute('aria-labelledby', t.id);
                }
                t.addEventListener('keydown', function (e) {
                    var j = -1;
                    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
                    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
                    else if (e.key === 'Home') j = 0;
                    else if (e.key === 'End') j = tabs.length - 1;
                    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); return; }
                    if (j < 0) return;
                    e.preventDefault();
                    tabs[j].click();
                    tabs[j].focus();
                });
                new MutationObserver(refresh).observe(t, { attributes: true, attributeFilter: ['class'] });
            });
            refresh();
        }
        // Video thumbnails, including any the New River overlay adds later
        facades();
        new MutationObserver(function () { facades(); })
            .observe(document.body, { childList: true, subtree: true });
        // Verse references on topical and life-study pages open a popup
        document.querySelectorAll('span.verse-ref').forEach(function (el) {
            pressable(el, 'Show ' + el.textContent.replace(/\s+/g, ' ').trim());
        });
        // Unlabelled navigation selects
        [['.nav-book-select', 'Book'], ['.nav-chapter-select', 'Chapter'], ['.nav-translation', 'Translation']]
            .forEach(function (p) {
                document.querySelectorAll(p[0]).forEach(function (el) {
                    if (!el.getAttribute('aria-label') && !el.labels.length) el.setAttribute('aria-label', p[1]);
                });
            });
        // Escape closes an open verse popup
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('.verse-popup-overlay.active .close-popup, .verse-popup-overlay.active .popup-close')
                .forEach(function (b) { b.click(); });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
