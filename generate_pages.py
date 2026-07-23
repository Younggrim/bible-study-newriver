#!/usr/bin/env python3
"""Generate 54 HTML pages for bible-study-newriver."""
import os

DOCS = "/Users/P2742442/KIro Projects/bible-study-newriver/docs"

def make_page(filename, title, theme, hover, accent, back_link, subtitle, nav_bold, sections, hero_img, scriptures, section1_text, section3_text, questions):
    nav_items = [
        ("fruits-of-the-spirit.html", "Fruits of the Spirit"),
        ("armor-of-god.html", "Armor of God"),
        ("beatitudes.html", "Beatitudes"),
        ("names-of-god.html", "Names of God"),
        ("i-am-statements.html", "I AM Statements"),
        ("miracles-of-jesus.html", "Miracles of Jesus"),
        ("parables-of-jesus.html", "Parables of Jesus"),
        ("the-12-apostles.html", "The 12 Apostles"),
        ("kings-of-israel.html", "Kings of Israel"),
        ("men-of-the-bible.html", "Men of the Bible"),
        ("women-of-the-bible.html", "Women of the Bible"),
        ("covenants.html", "Covenants"),
        ("ten-commandments.html", "Ten Commandments"),
        ("the-trinity.html", "The Trinity"),
        ("the-gospel.html", "The Gospel"),
        ("promises-of-god.html", "Promises of God"),
        ("prayers-in-the-bible.html", "Prayers in the Bible"),
        ("prophecy-and-fulfillment.html", "Prophecy &amp; Fulfillment"),
        ("spiritual-disciplines.html", "Spiritual Disciplines"),
        ("marriage-and-family.html", "Marriage &amp; Family"),
    ]
    nav_links = ""
    for href, label in nav_items:
        if href == nav_bold:
            nav_links += f'<a href="{href}"><strong>{label}</strong></a>'
        else:
            nav_links += f'<a href="{href}">{label}</a>'

    verses_html = ""
    for ref, desc in scriptures:
        verses_html += f'                <li><span class="verse-ref" onclick="showVerse(\'{ref}\')">{ref}</span> — "{desc}"</li>\n'

    questions_html = ""
    for q in questions:
        questions_html += f"                <li>{q}</li>\n"

    s1_paragraphs = "\n".join([f"            <p>{p}</p>" for p in section1_text])
    s3_paragraphs = "\n".join([f"            <p>{p}</p>" for p in section3_text])

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="manifest" href="manifest.json"><meta name="theme-color" content="#3d2b1f">
    <title>{title} | {subtitle} — Bible Study</title>
    <link href="https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Inter:wght@400;500;600;700&family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <link rel="stylesheet" href="site/style.css">
    <style>
        .topic-hero {{ background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url("https://images.unsplash.com/{hero_img}?w=1200&q=80") center/cover no-repeat; border: none; border-radius: var(--radius-lg); padding: 48px 36px; text-align: center; margin-bottom: 32px; box-shadow: var(--shadow-sm); }}
        .topic-hero h1 {{ font-family: 'Cinzel', serif; font-size: 2.2rem; color: #fff; text-shadow: 2px 2px 8px rgba(0,0,0,0.7); margin-bottom: 8px; }}
        .topic-hero .subtitle {{ font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; color: {accent}; letter-spacing: 0.5px; }}

        .back-link {{ display: inline-block; margin-bottom: 20px; font-size: 0.88rem; color: {theme}; text-decoration: none; font-weight: 600; transition: color 0.2s; }}
        .back-link:hover {{ color: {hover}; }}
        .back-link i {{ margin-right: 6px; }}

        .section-block {{ background: var(--bg-card, #fff); border: 1px solid var(--border-light, #e8e0d6); border-radius: 12px; padding: 28px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 24px; }}
        .section-block h2 {{ font-family: 'Cinzel', serif; font-size: 1.2rem; color: {theme}; margin-bottom: 16px; }}
        .section-block p {{ font-size: 0.92rem; color: #3d342e; line-height: 1.8; margin-bottom: 14px; }}
        .section-block p:last-child {{ margin-bottom: 0; }}

        .verse-list {{ list-style: none; padding: 0; margin: 0; }}
        .verse-list li {{ margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e8e0d6; }}
        .verse-list li:last-child {{ border-bottom: none; margin-bottom: 0; padding-bottom: 0; }}

        .reflection-list {{ list-style: none; padding: 0; margin: 0; }}
        .reflection-list li {{ font-size: 0.92rem; color: #3d342e; line-height: 1.8; margin-bottom: 10px; padding-left: 22px; position: relative; }}
        .reflection-list li::before {{ content: "\\f059"; font-family: "Font Awesome 6 Free"; font-weight: 900; position: absolute; left: 0; color: {theme}; font-size: 0.8rem; top: 3px; }}

        .video-toggle-btn {{ background: {theme}; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-bottom: 16px; }}
        .video-toggle-btn:hover {{ background: {hover}; }}
        .video-section {{ display: none; }} .video-section.open {{ display: block; }}
        .video-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }}

        .topic-dropdown {{ position: relative; display: inline-block; }} .topic-dropdown-btn {{ background: rgba(255,255,255,0.9); border: 1px solid {theme}; border-radius: 8px; padding: 6px 14px; font-size: 0.85rem; font-weight: 600; color: #3d2b1f; cursor: pointer; transition: background 0.2s; }} .topic-dropdown-btn:hover {{ background: var(--bg-card); }} .topic-dropdown-menu {{ display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid var(--border-light); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 8px 0; min-width: 240px; z-index: 1000; margin-top: 6px; max-height: 400px; overflow-y: auto; }} .topic-dropdown-menu.open {{ display: block; }} .topic-dropdown-menu a {{ display: block; padding: 8px 18px; font-size: 0.83rem; color: #3d2b1f; text-decoration: none; font-weight: 500; transition: background 0.15s; }} .topic-dropdown-menu a:hover {{ background: #f5ebe0; color: {theme}; }}

        .verse-ref {{ color: {theme}; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; font-weight: 600; }}
        .verse-ref:hover {{ color: {hover}; }}
        .verse-popup-overlay {{ display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:9998; }}
        .verse-popup-overlay.show {{ display:block; }}
        .verse-popup {{ display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; border-radius:12px; padding:24px 28px; max-width:500px; width:90%; max-height:70vh; overflow-y:auto; box-shadow:0 16px 48px rgba(0,0,0,0.2); z-index:9999; }}
        .verse-popup.show {{ display:block; }}
        .verse-popup .popup-ref {{ font-family:'Cinzel',serif; font-size:1rem; color:{theme}; margin-bottom:12px; font-weight:700; }}
        .verse-popup .popup-text {{ font-family:'Merriweather',serif; font-size:0.92rem; line-height:1.9; color:#3d2b1f; }}
        .verse-popup .popup-close {{ position:absolute; top:12px; right:16px; background:none; border:none; font-size:1.3rem; cursor:pointer; color:#8a7e74; }}
        .verse-popup .popup-loading {{ font-size:0.85rem; color:#8a7e74; font-style:italic; }}

        @media (max-width: 768px) {{ .topic-hero h1 {{ font-size: 1.6rem; }} .topic-hero {{ padding: 28px 16px; }} .section-block {{ padding: 20px 16px; }} .video-grid {{ grid-template-columns: 1fr; }} }}
    </style>
</head>
<body>
    <nav class="top-nav">
        <a href="index.html" class="nav-home-btn"><i class="fas fa-home"></i></a>
        <a href="index.html" class="nav-brand">Bible Study</a>
        <div class="nav-center"><div class="topic-dropdown"><button class="topic-dropdown-btn" onclick="toggleTopicDropdown()">Topical Studies <i class="fas fa-chevron-down" style="font-size:0.7rem;margin-left:4px;"></i></button><div class="topic-dropdown-menu" id="topicDropdown">{nav_links}</div></div></div>
    </nav>
    <main class="main-content" style="margin-left:0; max-width:960px; margin-left:auto; margin-right:auto;">
        <a href="{back_link}" class="back-link"><i class="fas fa-arrow-left"></i> Back to {subtitle}</a>

        <div class="topic-hero">
            <p class="subtitle">{subtitle}</p>
            <h1>{title}</h1>
        </div>

        <div class="section-block">
            <h2>{sections[0]}</h2>
{s1_paragraphs}
        </div>

        <div class="section-block">
            <h2>{sections[1]}</h2>
            <ul class="verse-list">
{verses_html}            </ul>
        </div>

        <div class="section-block">
            <h2>{sections[2]}</h2>
{s3_paragraphs}
        </div>

        <div class="section-block">
            <h2>{sections[3]}</h2>
            <ul class="reflection-list">
{questions_html}            </ul>
        </div>

        <div class="section-block">
            <h2 style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;" onclick="var s=this.parentElement.querySelector('#videoSection');if(s){{s.style.display=s.style.display==='none'?'block':'none';this.querySelector('.chevron').style.transform=s.style.display==='none'?'':'rotate(90deg)';}}"><span>{sections[4]}</span><i class="fas fa-chevron-right chevron" style="font-size:0.8rem;transition:transform 0.2s;"></i></h2>
            <div id="videoSection" style="display:none;">
                <p style="font-size:0.9rem;color:#8a7e74;font-style:italic;">Videos coming soon.</p>
            </div>
        </div>
    </main>
    <script src="site/script.js"></script>
    <script>
    function toggleTopicDropdown(){{document.getElementById("topicDropdown").classList.toggle("open")}}document.addEventListener("click",function(e){{if(!e.target.closest(".topic-dropdown")){{document.getElementById("topicDropdown").classList.remove("open")}}}});
    function loadYT(el,id){{el.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;border-radius:10px;"></iframe>';el.style.position='relative';}}
    </script>
    <div class="verse-popup-overlay" id="verseOverlay" onclick="closeVerse()"></div>
    <div class="verse-popup" id="versePopup">
        <button class="popup-close" onclick="closeVerse()">&times;</button>
        <div class="popup-ref" id="popupRef"></div>
        <div class="popup-text" id="popupText"></div>
    </div>
    <script>
    function showVerse(passage) {{
        var overlay = document.getElementById('verseOverlay');
        var popup = document.getElementById('versePopup');
        var refEl = document.getElementById('popupRef');
        var textEl = document.getElementById('popupText');
        refEl.textContent = passage;
        textEl.innerHTML = '<span class="popup-loading">Loading verse...</span>';
        overlay.classList.add('show');
        popup.classList.add('show');
        fetch('https://esv-proxy.cloudflare-dust598.workers.dev/?q=' + encodeURIComponent(passage))
        .then(function(r) {{ return r.json(); }})
        .then(function(data) {{
            if (data.passages && data.passages[0]) {{
                textEl.innerHTML = data.passages[0];
            }} else {{
                textEl.innerHTML = '<em>Could not load this passage.</em>';
            }}
        }})
        .catch(function() {{
            textEl.innerHTML = '<em>Unable to fetch verse. Try again later.</em>';
        }});
    }}
    function closeVerse() {{
        document.getElementById('verseOverlay').classList.remove('show');
        document.getElementById('versePopup').classList.remove('show');
    }}
    </script>
</body>
</html>'''

    filepath = os.path.join(DOCS, filename)
    with open(filepath, 'w') as f:
        f.write(html)
    print(f"Created: {filename}")


# Image cycle
images = [
    "photo-1506905925346-21bda4d32df4",
    "photo-1470071459604-3b5ec3a7fe05",
    "photo-1441974231531-c6227db76b6e",
    "photo-1518173946687-a4c8892bbd9f",
    "photo-1475924156734-496f6cac6ec1",
    "photo-1507003211169-0a1dd7228f2d",
    "photo-1469474968028-56623f02e42e",
    "photo-1426604966848-d7adac402bff",
    "photo-1472214103451-9374bd1c798e",
    "photo-1465146344425-f00d5f5c8f07",
    "photo-1501785888041-af3ef285b470",
    "photo-1490730141103-6cac27aaab94",
]

# BATCH 1: Promises of God
P_THEME = "#2c6b4f"
P_HOVER = "#1a4a35"
P_ACCENT = "#a8e6cf"
P_BACK = "topical-studies.html#promises"
P_SUB = "Promises of God"
P_NAV = "promises-of-god.html"
P_SECTIONS = ["The Promise", "Key Scriptures", "Claiming the Promise", "Reflection Questions", "Video Resources"]

promises_data = [
    {
        "file": "promises-provision.html",
        "title": "God's Promise of Provision",
        "img": images[0],
        "scriptures": [
            ("Philippians 4:19", "And my God will supply every need of yours according to his riches in glory in Christ Jesus."),
            ("Matthew 6:31-33", "Therefore do not be anxious... your heavenly Father knows that you need them all. But seek first the kingdom of God."),
            ("Psalm 23:1", "The LORD is my shepherd; I shall not want."),
            ("2 Corinthians 9:8", "God is able to make all grace abound to you, so that having all sufficiency in all things at all times, you may abound in every good work."),
            ("Luke 12:24", "Consider the ravens: they neither sow nor reap... and yet God feeds them. Of how much more value are you than the birds!"),
        ],
        "s1": [
            "Throughout Scripture, God reveals Himself as Jehovah Jireh — the Lord who provides. This is not merely a title; it is a covenant commitment from the Creator of the universe to care for every need of His children. From the manna in the wilderness to the ravens that fed Elijah, God has consistently demonstrated that He is both willing and able to supply what His people require. His provision is not limited by economy, circumstance, or human possibility.",
            "The promise of provision rests not on our worthiness but on God's character. He is a Father who delights in giving good gifts to His children. Jesus taught that if earthly fathers know how to give good things, how much more will our Heavenly Father provide for those who ask Him. This promise invites us to release anxiety about material needs and trust in the infinite resources of a God who owns the cattle on a thousand hills.",
            "God's provision extends beyond material needs to encompass wisdom, strength, relationships, and opportunities. He provides not according to our wants but according to His riches in glory — a supply that never diminishes, never runs short, and is always perfectly timed.",
        ],
        "s3": [
            "Claiming God's promise of provision begins with shifting our focus from the size of our need to the greatness of our God. It requires active faith — not passive waiting, but trusting obedience that steps forward even when the resources are not yet visible. Abraham walked up the mountain believing God would provide a sacrifice, and God did.",
            "Practically, claiming this promise means bringing our needs honestly before God in prayer, being faithful stewards of what He has already given, and remaining open to His provision coming in unexpected ways. God's provision may come through a job, through the generosity of others, through creative solutions we never imagined, or through supernatural intervention.",
        ],
        "questions": [
            "Can you identify a time when God provided for you in an unexpected way? How did that experience strengthen your faith?",
            "What current need are you struggling to trust God with? What would it look like to fully release that concern to Him?",
            "How does the promise of God's provision change the way you think about generosity toward others?",
        ],
    },
    {
        "file": "promises-protection.html",
        "title": "God's Promise of Protection",
        "img": images[1],
        "scriptures": [
            ("Psalm 91:1-2", "He who dwells in the shelter of the Most High will abide in the shadow of the Almighty. I will say to the LORD, My refuge and my fortress, my God, in whom I trust."),
            ("Psalm 121:7-8", "The LORD will keep you from all evil; he will keep your life. The LORD will keep your going out and your coming in from this time forth and forevermore."),
            ("Isaiah 54:17", "No weapon that is fashioned against you shall succeed, and you shall refute every tongue that rises against you in judgment."),
            ("2 Thessalonians 3:3", "But the Lord is faithful. He will establish you and guard you against the evil one."),
            ("Nahum 1:7", "The LORD is good, a stronghold in the day of trouble; he knows those who take refuge in him."),
        ],
        "s1": [
            "God's promise of protection is one of the most comforting assurances in all of Scripture. The God who commands the stars in their courses and holds the oceans in the palm of His hand has pledged Himself as a shield, a fortress, and a refuge for His people. This does not mean believers will never face danger or hardship, but it means that nothing can touch us apart from His sovereign permission, and nothing can ultimately harm those who belong to Him.",
            "Throughout the Bible, we see God protecting His people in extraordinary ways — closing the mouths of lions for Daniel, parting the sea for Israel, sending angels to guard Elisha. But His protection also works in quieter ways: guiding us away from unseen dangers, surrounding us with His presence in the valley of the shadow of death, and preserving our souls even when our bodies face trial.",
            "The promise of divine protection invites us to live with courage rather than fear. When we know that the Almighty God stands between us and whatever threatens us, we can face each day with confidence — not because nothing bad will happen, but because nothing can separate us from His love or thwart His purposes for our lives.",
        ],
        "s3": [
            "Claiming God's promise of protection means anchoring our confidence not in the absence of threats but in the presence of God. It means choosing to trust that He is watching, He is aware, and He is actively working on our behalf even when danger feels close and deliverance feels far away. The psalmist declared, 'I will fear no evil, for you are with me' — protection is experienced through relationship, not isolation from difficulty.",
            "Living in this promise practically means refusing to let fear dictate our decisions, committing our safety to God in daily prayer, and remembering His past faithfulness when present circumstances seem threatening. It also means understanding that God's ultimate protection is eternal — He guards our souls, secures our inheritance, and guarantees that nothing in all creation can snatch us from His hand.",
        ],
        "questions": [
            "How has God protected you in ways you may not have recognized at the time?",
            "What fears are you currently facing? How does God's promise of protection speak to those fears?",
            "How can you distinguish between trusting God's protection and being reckless or presumptuous?",
            "In what ways does knowing God is your protector change how you respond to threatening situations?",
        ],
    },
    {
        "file": "promises-presence.html",
        "title": "God's Promise of His Presence",
        "img": images[2],
        "scriptures": [
            ("Matthew 28:20", "And behold, I am with you always, to the end of the age."),
            ("Hebrews 13:5", "I will never leave you nor forsake you."),
            ("Psalm 139:7-10", "Where shall I go from your Spirit? Or where shall I flee from your presence? If I ascend to heaven, you are there! If I make my bed in Sheol, you are there!"),
            ("Deuteronomy 31:6", "Be strong and courageous. Do not fear or be in dread of them, for it is the LORD your God who goes with you. He will not leave you or forsake you."),
            ("Joshua 1:9", "Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go."),
        ],
        "s1": [
            "Of all God's promises, perhaps none is more personally comforting than His promise to be present with us. The God who fills heaven and earth has chosen to draw near to His children — not as a distant observer, but as an intimate companion who walks with us through every season of life. His presence is not contingent on our location, our performance, or our emotional state. He is simply, unchangeably, always there.",
            "This promise echoes from Genesis to Revelation. God walked with Adam in the garden, dwelt among Israel in the tabernacle, and in Christ became Emmanuel — God with us. Through the Holy Spirit, He now indwells every believer, making our bodies His temple. We are never alone, never abandoned, never beyond the reach of His nearness.",
            "The promise of God's presence transforms our darkest moments. In grief, He is the God of all comfort who draws near to the brokenhearted. In confusion, He is the counselor who guides with His eye upon us. In loneliness, He is the friend who sticks closer than a brother. His presence does not remove our circumstances, but it fundamentally changes how we experience them.",
        ],
        "s3": [
            "Claiming God's promise of presence means cultivating an awareness of what is already true. God is with us whether we feel Him or not — the promise is not dependent on our perception but on His faithfulness. Yet we can learn to practice His presence through prayer, silence, worship, and attentiveness to His Spirit throughout our day. Brother Lawrence called this 'practicing the presence of God' — turning our hearts toward Him in every moment.",
            "When we feel most alone — in hospital rooms, in grief, in the small hours of sleepless nights — we can speak His promise aloud: 'You are with me.' This is not wishful thinking; it is the declaration of eternal truth. The God who promised never to leave or forsake us has staked His character on this commitment, and He cannot lie.",
        ],
        "questions": [
            "When have you felt God's presence most powerfully? What circumstances surrounded that experience?",
            "How do you typically respond when God feels distant? What practices help you reconnect with the awareness of His presence?",
            "What difference would it make in your daily life if you truly lived as though God were always with you — because He is?",
        ],
    },
    {
        "file": "promises-peace.html",
        "title": "God's Promise of Peace",
        "img": images[3],
        "scriptures": [
            ("Philippians 4:6-7", "Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus."),
            ("John 14:27", "Peace I leave with you; my peace I give to you. Not as the world gives do I give to you. Let not your hearts be troubled, neither let them be afraid."),
            ("Isaiah 26:3", "You keep him in perfect peace whose mind is stayed on you, because he trusts in you."),
            ("Romans 15:33", "May the God of peace be with you all. Amen."),
            ("Colossians 3:15", "And let the peace of Christ rule in your hearts, to which indeed you were called in one body. And be thankful."),
        ],
        "s1": [
            "In a world filled with anxiety, conflict, and uncertainty, God offers something the world cannot produce: supernatural peace. This is not merely the absence of trouble but the presence of divine tranquility in the midst of trouble. Jesus promised His disciples a peace that the world cannot give — a peace that defies circumstances, transcends understanding, and guards the soul like a sentinel at the gate of our hearts.",
            "God's peace operates on multiple levels. There is peace with God — the reconciliation accomplished through Christ's death on the cross, ending our rebellion and restoring our relationship with our Creator. There is the peace of God — that inexplicable calm that settles over a believer's heart even in the worst of storms. And there is the peace that flows outward — enabling us to be peacemakers in a fractured world.",
            "This peace is not something we manufacture through positive thinking or denial of reality. It is a gift from the Prince of Peace Himself, available to every believer who brings their anxieties to God in prayer. When we exchange our worry for worship, our fear for faith, God meets us with a peace so profound that it defies human explanation.",
        ],
        "s3": [
            "Claiming God's promise of peace requires an active exchange: we bring our anxieties to God, and He gives us His peace. Philippians 4:6-7 outlines the process clearly — prayer, supplication, and thanksgiving become the pathway through which God's peace flows into our lives. This is not a one-time transaction but a daily, moment-by-moment practice of releasing our concerns into His capable hands.",
            "Living in God's peace also means guarding our minds. Isaiah reminds us that perfect peace belongs to those whose minds are stayed on God. What we focus on determines what we feel. When we fix our thoughts on God's character, His promises, and His faithfulness, peace naturally follows. The battle for peace is often won in the mind — choosing truth over worry, faith over fear, and God's Word over the world's noise.",
        ],
        "questions": [
            "What situations in your life most frequently rob you of peace? How might you bring those specifically to God in prayer?",
            "What is the difference between the peace the world offers and the peace Christ gives? Have you experienced this difference personally?",
            "How can you practice keeping your mind 'stayed on God' throughout your daily routine?",
            "Is there a relationship in your life where you need to pursue peace? What step could you take this week?",
        ],
    },
    {
        "file": "promises-purpose.html",
        "title": "God's Promise of Purpose",
        "img": images[4],
        "scriptures": [
            ("Romans 8:28", "And we know that for those who love God all things work together for good, for those who are called according to his purpose."),
            ("Jeremiah 29:11", "For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope."),
            ("Ephesians 2:10", "For we are his workmanship, created in Christ Jesus for good works, which God prepared beforehand, that we should walk in them."),
            ("Philippians 1:6", "And I am sure of this, that he who began a good work in you will bring it to completion at the day of Jesus Christ."),
            ("Proverbs 3:5-6", "Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths."),
        ],
        "s1": [
            "One of humanity's deepest longings is the desire for purpose — to know that our lives matter, that our existence has meaning beyond mere survival. God addresses this longing with a breathtaking promise: He has created each person with intention, woven purpose into the very fabric of their being, and prepared good works for them to walk in before they were ever born.",
            "God's promise of purpose means that nothing in our lives is wasted. Every experience — even painful ones — is being woven into a larger tapestry that serves God's good purposes. Romans 8:28 does not promise that all things are good, but that God works all things together for good for those who love Him. Our setbacks, our detours, even our failures are raw material in the hands of a sovereign God who wastes nothing.",
            "This promise also assures us that God will complete what He has started. The same God who began a good work in us is faithful to carry it through to completion. We are not accidents, afterthoughts, or cosmic mistakes. We are His workmanship — His masterpiece — created with divine intentionality for purposes that will outlast our earthly lives.",
        ],
        "s3": [
            "Claiming God's promise of purpose does not require us to have every detail of our future mapped out. It requires trust — the willingness to take the next faithful step even when we cannot see the full path. Proverbs 3:5-6 invites us to acknowledge God in all our ways, trusting that He will direct our steps. Purpose is often revealed not in a single dramatic moment but in daily faithfulness to what God has placed before us.",
            "Practically, living in God's purpose means using the gifts He has given us, serving where He has placed us, and remaining open to His redirection. It means trusting that even seasons of waiting, confusion, or apparent failure are purposeful in His economy. Our job is not to manufacture purpose but to walk faithfully with the God who has already prepared our path.",
        ],
        "questions": [
            "How have you seen God bring good out of difficult circumstances in your past? How does this strengthen your trust for the future?",
            "What gifts, passions, or experiences has God given you that might point toward His purpose for your life?",
            "Are you currently in a season where God's purpose feels unclear? How can you remain faithful in the waiting?",
        ],
    },
    {
        "file": "promises-forgiveness.html",
        "title": "God's Promise of Forgiveness",
        "img": images[5],
        "scriptures": [
            ("1 John 1:9", "If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness."),
            ("Psalm 103:12", "As far as the east is from the west, so far does he remove our transgressions from us."),
            ("Isaiah 43:25", "I, I am he who blots out your transgressions for my own sake, and I will not remember your sins."),
            ("Ephesians 1:7", "In him we have redemption through his blood, the forgiveness of our trespasses, according to the riches of his grace."),
            ("Micah 7:19", "He will again have compassion on us; he will tread our iniquities underfoot. You will cast all our sins into the depths of the sea."),
        ],
        "s1": [
            "The promise of forgiveness is the heartbeat of the gospel. In a universe governed by a holy God, every human being stands guilty — not merely of occasional mistakes but of willful rebellion against our Creator. Yet God, in His unfathomable mercy, has provided complete and total forgiveness through the sacrifice of His Son. This forgiveness is not partial, not temporary, and not contingent on our ability to earn it. It is full, free, and forever.",
            "Scripture uses extraordinary imagery to describe the completeness of God's forgiveness: sins removed as far as east is from west, transgressions buried in the depths of the sea, iniquities blotted out and remembered no more. These are not mere metaphors — they describe the reality of what Christ accomplished on the cross. When God forgives, He does not merely overlook our sin; He deals with it completely, bearing its penalty Himself so that we can stand before Him spotless.",
            "This promise transforms not only our standing before God but our daily experience. Because we are forgiven, we can approach God without shame. Because our sins are removed, we can live free from the crushing weight of guilt. Because God remembers our transgressions no more, we can release the past and step into the future He has prepared.",
        ],
        "s3": [
            "Claiming God's promise of forgiveness begins with honest confession. First John 1:9 makes the pathway clear: when we confess — when we agree with God about our sin, calling it what He calls it — He is faithful and just to forgive. Notice that forgiveness flows from God's faithfulness and justice, not from our worthiness. Christ's sacrifice has satisfied divine justice, making forgiveness not merely possible but guaranteed for all who come in repentance.",
            "Living in forgiveness also means refusing to pick up what God has put down. Many believers confess their sins but continue to carry guilt, as though God's forgiveness were insufficient. But if God has cast our sins into the depths of the sea, we have no business going fishing for them. Claiming this promise means receiving forgiveness completely — letting go of shame, self-punishment, and the lie that we must somehow atone for what Christ has already paid for in full.",
        ],
        "questions": [
            "Is there a sin in your past that you have confessed but still struggle to believe God has truly forgiven? What does His Word say about it?",
            "How does understanding the completeness of God's forgiveness change the way you approach Him in prayer?",
            "Are there others you need to forgive as God has forgiven you? What is holding you back?",
            "How does the promise of forgiveness free you to be honest about your struggles rather than hiding them?",
        ],
    },
    {
        "file": "promises-strength.html",
        "title": "God's Promise of Strength",
        "img": images[6],
        "scriptures": [
            ("Isaiah 40:31", "But they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint."),
            ("Philippians 4:13", "I can do all things through him who strengthens me."),
            ("2 Corinthians 12:9", "But he said to me, My grace is sufficient for you, for my power is made perfect in weakness."),
            ("Deuteronomy 33:25", "As your days, so shall your strength be."),
            ("Psalm 73:26", "My flesh and my heart may fail, but God is the strength of my heart and my portion forever."),
        ],
        "s1": [
            "Life inevitably brings us to the end of our own resources. Whether through physical exhaustion, emotional depletion, or spiritual weariness, every person encounters moments when their own strength simply is not enough. It is precisely in these moments that God's promise of strength shines brightest — not strength that originates within us, but divine power that flows into us from an inexhaustible source.",
            "God's promise of strength is paradoxical: His power is made perfect in weakness. This means our insufficiency is not an obstacle to God's work but the very condition under which His strength is most gloriously displayed. When Paul pleaded for relief from his thorn in the flesh, God's answer was not removal but empowerment — sufficient grace and perfected power in the midst of weakness.",
            "This strength is not a one-time deposit but a daily renewal. Isaiah 40:31 promises that those who wait on the Lord will have their strength renewed — continuously replenished like a spring that never runs dry. God's strength is available for the marathon of faithful living, not just the sprints of crisis moments.",
        ],
        "s3": [
            "Claiming God's promise of strength requires the humility to admit we need it. As long as we insist on self-sufficiency, we cannot receive what God offers. But when we come to Him empty-handed, acknowledging our weakness, He fills us with power that transcends our natural abilities. This is the secret Paul discovered: 'When I am weak, then I am strong' — because weakness drives us to the only source of true strength.",
            "Practically, claiming divine strength means beginning each day in dependence on God, asking Him for the specific strength needed for the tasks ahead. It means pausing in moments of overwhelm to invite His power into our circumstances. It means refusing to quit when exhausted, not through gritting our teeth harder but through leaning more fully into His sustaining grace.",
        ],
        "questions": [
            "In what area of your life do you most need God's strength right now? Have you asked Him for it specifically?",
            "How does the idea that God's power is perfected in weakness challenge or comfort you?",
            "Can you recall a time when you experienced supernatural strength beyond your own capacity? What was that like?",
        ],
    },
    {
        "file": "promises-guidance.html",
        "title": "God's Promise of Guidance",
        "img": images[7],
        "scriptures": [
            ("Proverbs 3:5-6", "Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths."),
            ("Psalm 32:8", "I will instruct you and teach you in the way you should go; I will counsel you with my eye upon you."),
            ("Isaiah 30:21", "And your ears shall hear a word behind you, saying, This is the way, walk in it, when you turn to the right or when you turn to the left."),
            ("John 16:13", "When the Spirit of truth comes, he will guide you into all the truth."),
            ("Psalm 119:105", "Your word is a lamp to my feet and a light to my path."),
        ],
        "s1": [
            "The promise of divine guidance addresses one of our most common anxieties: the fear of making wrong decisions. God does not leave His children to navigate life's complexities alone. He has promised to instruct us, counsel us, and direct our paths. The God who knows the end from the beginning offers to share His wisdom with those who humbly seek it.",
            "God guides through multiple channels: through His written Word, which serves as a lamp to our feet; through His indwelling Spirit, who leads us into all truth; through wise counsel from mature believers; through circumstances that open and close doors; and through the inner witness of peace or conviction. He is not a distant God who sets us loose in a confusing world — He is an attentive Father who actively directs the steps of those who trust Him.",
            "The promise of guidance does not mean we will always know the full picture. God often reveals just enough light for the next step — a lamp to our feet, not a floodlight illuminating the entire road ahead. But this partial revelation is purposeful: it keeps us dependent, it builds faith, and it ensures we walk closely with our Guide rather than running ahead on our own.",
        ],
        "s3": [
            "Claiming God's promise of guidance begins with the posture described in Proverbs 3:5-6: wholehearted trust, refusal to rely solely on our own understanding, and consistent acknowledgment of God in every decision. Guidance flows to those who are already walking in obedience — God directs moving feet more easily than stationary ones. When we are faithful in what we know, He reveals what we need to know next.",
            "Practically, seeking God's guidance means saturating our minds with Scripture, spending time in prayer asking for wisdom, seeking counsel from godly people, paying attention to how God is moving in our circumstances, and checking our decisions against the peace of the Holy Spirit. When multiple channels align, we can move forward with confidence that God is directing our path.",
        ],
        "questions": [
            "What decision are you currently facing where you need God's guidance? Have you brought it to Him specifically in prayer?",
            "Which of God's guidance channels do you tend to rely on most? Which might you need to pay more attention to?",
            "How do you distinguish between God's guidance and your own desires or fears?",
            "Can you recall a time when God clearly directed your path? How did you recognize His leading?",
        ],
    },
