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
        'covenants','marriage-and-family'];
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

    // Check hash for tab highlighting on index
    var hash = window.location.hash;
    if (hash === '#topical') section = 'topical';
    if (hash === '#life') section = 'life';

    // On index page in app mode: show only the active section
    var isIndexPage = (path === 'index.html' || path === '' || path === '/' || path === 'index');
    if (isIndexPage) {
        // Hide hero section and welcome on index in app mode
        var heroSection = document.querySelector('.hero-section');
        if (heroSection) heroSection.style.display = 'none';

        // Get all section heroes and their following cards containers
        var allSectionHeroes = document.querySelectorAll('.section-hero');
        var allCardsContainers = document.querySelectorAll('.cards-container');
        var contentBlock = document.querySelector('.content-block');
        var siteFooter = document.querySelector('.site-footer');

        // Map sections: Bible = content-block + first section-hero + first 2 cards-containers
        // Topical = second section-hero + third cards-container
        // Life = third section-hero + fourth cards-container
        var bibleElements = [];
        var topicalElements = [];
        var lifeElements = [];

        if (contentBlock) bibleElements.push(contentBlock);
        if (allSectionHeroes[0]) bibleElements.push(allSectionHeroes[0]);
        if (allCardsContainers[0]) bibleElements.push(allCardsContainers[0]);

        if (allSectionHeroes[1]) topicalElements.push(allSectionHeroes[1]);
        if (allCardsContainers[1]) topicalElements.push(allCardsContainers[1]);

        if (allSectionHeroes[2]) lifeElements.push(allSectionHeroes[2]);
        if (allCardsContainers[2]) lifeElements.push(allCardsContainers[2]);

        // Hide all first
        bibleElements.concat(topicalElements).concat(lifeElements).forEach(function(el) {
            el.style.display = 'none';
        });
        if (siteFooter) siteFooter.style.display = 'none';

        // Show only the active section
        var activeElements = [];
        if (section === 'bible') activeElements = bibleElements;
        else if (section === 'topical') activeElements = topicalElements;
        else if (section === 'life') activeElements = lifeElements;

        activeElements.forEach(function(el) {
            el.style.display = '';
        });
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
        // Auto-dismiss after 8 seconds
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
        + '<a class="pwa-nav-item' + (section==='bible'?' active':'') + '" href="index.html">'
        + '<i class="fas fa-book-bible"></i><span>Bible</span></a>'
        + '<a class="pwa-nav-item' + (section==='topical'?' active':'') + '" href="index.html#topical">'
        + '<i class="fas fa-lightbulb"></i><span>Topical</span></a>'
        + '<a class="pwa-nav-item' + (section==='life'?' active':'') + '" href="index.html#life">'
        + '<i class="fas fa-heart"></i><span>Life</span></a>'
        + '<a class="pwa-nav-item" id="pwa-devotional-btn" href="#">'
        + '<i class="fas fa-hands-praying"></i><span>Devotional</span></a>';
    document.body.appendChild(nav);

    // Devotional "Coming Soon" overlay
    var devBtn = document.getElementById('pwa-devotional-btn');
    if (devBtn) {
        var devOverlay = document.createElement('div');
        devOverlay.className = 'pwa-coming-soon';
        devOverlay.innerHTML = ''
            + '<i class="fas fa-hands-praying"></i>'
            + '<h2>Devotional</h2>'
            + '<p>Daily devotionals are coming soon. This space will offer guided daily readings, reflections, and prayers to walk with you through each day in God\'s Word.</p>';
        document.body.appendChild(devOverlay);

        devBtn.addEventListener('click', function(e) {
            e.preventDefault();
            var isShowing = devOverlay.classList.contains('show');
            devOverlay.classList.toggle('show');
            // Update active state
            nav.querySelectorAll('.pwa-nav-item').forEach(function(item) { item.classList.remove('active'); });
            if (!isShowing) devBtn.classList.add('active');
        });
    }
})();
