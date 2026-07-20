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
