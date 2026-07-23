/* Bible Study Site — Shared JavaScript */

/* ESV API Configuration — via Cloudflare Worker proxy */
var ESV_PROXY_URL = 'https://esv-proxy.cloudflare-dust598.workers.dev';

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

/* Translation colors — match homepage Translation Guide */
var TRANSLATION_COLORS = {
    'ESV': '#8b3a2a',
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
        container.style.color = TRANSLATION_COLORS[trans] || '#3d2b1f';
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
    el.style.position = 'relative';
    el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" style="width:100%;height:100%;position:absolute;top:0;left:0;border:none;" allow="autoplay;encrypted-media" allowfullscreen></iframe>';
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
    // Find all video containers in topical cards (divs containing yt-facade with border-top style)
    document.querySelectorAll('.fruit-card > div[style*="border-top"]').forEach(function(container) {
        var videos = container.querySelectorAll('.yt-facade');
        if (videos.length === 0) return;

        // Collapse the videos
        container.style.display = 'none';

        // Create toggle button
        var btn = document.createElement('button');
        btn.className = 'video-toggle-btn';
        btn.innerHTML = '<i class="fas fa-play-circle"></i> Videos (' + videos.length + ')';
        btn.addEventListener('click', function() {
            var isHidden = container.style.display === 'none';
            container.style.display = isHidden ? '' : 'none';
            btn.classList.toggle('open', isHidden);
        });
        container.parentNode.insertBefore(btn, container);
    });

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

    // Find video sections in Life/struggle pages (section-block with "Video Resources" heading)
    document.querySelectorAll('.section-block').forEach(function(block) {
        var heading = block.querySelector('h2');
        if (!heading || heading.textContent.indexOf('Video') === -1) return;
        var videos = block.querySelectorAll('.yt-facade');
        if (videos.length === 0) return;

        // Hide all videos
        videos.forEach(function(v) { v.style.display = 'none'; });

        // Replace heading with toggle button
        heading.style.cursor = 'pointer';
        heading.innerHTML = '<i class="fas fa-play-circle" style="color:#c0392b;margin-right:8px;"></i>Videos (' + videos.length + ') <i class="fas fa-chevron-down" style="font-size:0.7rem;margin-left:6px;color:#8a7e74;"></i>';
        var expanded = false;
        heading.addEventListener('click', function() {
            expanded = !expanded;
            videos.forEach(function(v) { v.style.display = expanded ? '' : 'none'; });
            heading.querySelector('.fa-chevron-down, .fa-chevron-up').className = expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
            heading.querySelector('.fa-chevron-down, .fa-chevron-up').style.fontSize = '0.7rem';
            heading.querySelector('.fa-chevron-down, .fa-chevron-up').style.marginLeft = '6px';
            heading.querySelector('.fa-chevron-down, .fa-chevron-up').style.color = '#8a7e74';
        });
    });
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
        'covenants','marriage-and-family','topical-studies',
        'fruits-love','fruits-joy','fruits-peace','fruits-patience','fruits-kindness',
        'fruits-goodness','fruits-faithfulness','fruits-gentleness','fruits-self-control'];
    var strugglePages = ['addiction','anger','anxiety-and-fear','depression-and-hopelessness',
        'doubt-and-unbelief','greed-and-materialism','grief-and-loss','identity-and-self-worth',
        'loneliness','lust-and-sexual-sin','pride','suffering','temptation',
        'unforgiveness-and-bitterness'];

    var baseName = path.replace('.html','');
    if (topicPages.indexOf(baseName) !== -1) {
        section = 'topical';
    } else if (strugglePages.indexOf(baseName) !== -1) {
        section = 'life';
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
        // Hide devotional overlay if showing
        var devOv = document.querySelector('.pwa-coming-soon');
        if (devOv) devOv.classList.remove('show');
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

        // Bible = first section-hero (Bible) + first cards-container (books)
        // Hide content-block (translation guide) — replaced by info icon
        if (contentBlock) contentBlock.style.display = 'none';
        if (allSectionHeroes[0]) bibleElements.push(allSectionHeroes[0]);
        if (allCardsContainers[0]) bibleElements.push(allCardsContainers[0]);

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
                + '<div class="pwa-info-item"><strong style="color:#4a5a8a;">KJV</strong> — King James Version (1611). Majestic, poetic language. Most influential English Bible.</div>'
                + '<div class="pwa-info-item"><strong style="color:#7a5c2e;">ASV</strong> — American Standard Version (1901). Extremely literal, great for word studies.</div>'
                + '<div class="pwa-info-item"><strong style="color:#5c3d6e;">NET</strong> — New English Translation (2005). 60,000+ translator notes.</div>'
                + '<div class="pwa-info-item"><strong style="color:#2c6b4f;">WEB</strong> — World English Bible (2000). Modern, public domain.</div>'
                + '<h3 style="margin-top:18px;">Commentaries</h3>'
                + '<div class="pwa-info-item"><strong>David Guzik</strong> — Enduring Word. Verse-by-verse commentary, freely available online.</div>'
                + '<div class="pwa-info-item"><strong>C.H. Spurgeon</strong> — The Prince of Preachers. Christ-centered, doctrinally rich sermons (public domain).</div>';
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
            + '<div class="splash-icon"><i class="fas fa-cross"></i></div>'
            + '<p class="splash-label">A Prayer for You</p>'
            + '<p class="splash-prayer">Lord, we pray that this resource brings glory to Your name. Use it as a tool to draw hearts closer to You and to reveal Your plan and purpose for each person who visits these pages. May Your Word not return void, but accomplish everything You desire. Open eyes, soften hearts, and let the truth of Scripture transform lives for Your kingdom. In Jesus\' name, Amen.</p>'
            + '<p class="splash-tap">Tap anywhere to continue</p>';
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
        }, 8000);
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
        + '<a class="pwa-nav-item" data-section="devotional" id="pwa-devotional-btn" href="#">'
        + '<i class="fas fa-hands-praying"></i><span>Devotional</span></a>';
    document.body.appendChild(nav);

    // Tab click handling
    nav.querySelectorAll('.pwa-nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var sec = this.dataset.section;
            if (sec === 'devotional') {
                // Show coming soon overlay
                var devOv = document.querySelector('.pwa-coming-soon');
                if (devOv) {
                    devOv.classList.add('show');
                    nav.querySelectorAll('.pwa-nav-item').forEach(function(i) { i.classList.remove('active'); });
                    this.classList.add('active');
                }
                return;
            }
            // If on index page, switch sections in place
            if (isIndexPage) {
                pwaShowSection(sec);
            } else {
                // Navigate to index with hash
                window.location.href = 'index.html' + (sec !== 'bible' ? '#' + sec : '');
            }
        });
    });

    // Devotional "Coming Soon" overlay
    var devOverlay = document.createElement('div');
    devOverlay.className = 'pwa-coming-soon';
    devOverlay.innerHTML = ''
        + '<i class="fas fa-hands-praying"></i>'
        + '<h2>Devotional</h2>'
        + '<p>Daily devotionals are coming soon. This space will offer guided daily readings, reflections, and prayers to walk with you through each day in God\'s Word.</p>'
        + '<p style="margin-top:20px;font-size:0.8rem;color:#8a7e74;">Tap another tab to go back</p>';
    document.body.appendChild(devOverlay);
})();
