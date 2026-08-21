"""Generate portfolio/index.html.

Ordered for a recruiter or hiring manager: what he is doing now, then the
peer-reviewed work, then the industry track record, then teaching, awards,
and finally the student projects compressed into a plain register. Years are
taken from the resume; where the resume does not give one, the field is left
empty rather than guessed.

Sections carry a colour from the Wada palette. Sea Green and Dusky Green are
combination 284, which also supplies Eugenia Red and Apricot Yellow; Neutral
Gray comes from combination 340. Each colour appears only twice: a small
filled square by the section label, and a wash behind a row on hover.
"""
import html
import io
import json

IMG = "../assets/img/portfolio/"

# (year, title, blurb, image-or-None, [(url, label), ...])
SECTIONS = [
    ("Ventures", "sea", "Companies I have built and run.", [
        ("2023 – present", "Memcara",
         "Co-founder and Chief AI Officer. Memcara builds AI-enabled tools for caregiving in "
         "long-term care facilities. I joined as a researcher in 2023 and moved into the "
         "co-founder and CAIO role to help the company grow its AI offerings.",
         "memcara.png", [
             ("https://memcara.com/", "memcara.com"),
             ("https://doi.org/10.1145/3770687", "CareInsights (IMWUT 2025)"),
             ("https://doi.org/10.1145/3757599", "Family In The Loop (CSCW 2025)"),
             (None, "CareWare: Caregiver Smart Glasses (CHI 2026 submission)"),
         ]),
        ("2025–26", "Companion IQ",
         "Founder and Chief AI Officer of a startup building AI tools for person-centered "
         "dementia care. Our first product was an AI-powered dashboard giving long-term care "
         "staff insight into the needs and experiences of residents with dementia, piloted at "
         "facilities across the country. Raised $1M in seed funding.",
         "companion_iq.png", [
             ("https://companioniq.org/", "companioniq.org"),
         ]),
    ]),

    ("Research", "dusky", "Peer-reviewed work in human-AI interaction.", [
        ("2025", "CareInsights: AI-Enabled Infrastructure for Person-Centered Dementia Care",
         "First author. Infrastructure for person-centered dementia care in "
         "resource-constrained facilities. Published at IMWUT.",
         "imwut.jpg", [("https://doi.org/10.1145/3770687", "doi.org/10.1145/3770687")]),
        ("2025", "Family In The Loop",
         "First author. Enabling family involvement and person-centered dementia care at "
         "long-term care facilities with collaborative AI tools. Presented at CSCW.",
         "cscw_2025.jpg", [("https://doi.org/10.1145/3757599", "doi.org/10.1145/3757599")]),
        ("2025", "Collaborative Meaning-Making in Networked Learning Environments",
         "First author. An early sketch of SPARC, a learnersourcing framework for scaling "
         "collaborative meaning-making. Presented at Learning @ Scale.",
         "sparc.png", [
             ("https://drive.google.com/file/d/1TVCfHRdtLEJM3IYrlXAvKvqVbp0DoYXf/view", "Read the paper"),
         ]),
        ("2024", "Teaching AI in Extracurricular Contexts Through Narrative-Based Learnersourcing",
         "First author. Published at CHI.",
         "chi2024.jpg", [
             ("https://doi.org/10.1145/3613904.3642198", "doi.org/10.1145/3613904.3642198"),
         ]),
    ]),

    ("Industry", "red", "Software engineering before my PhD.", [
        ("2021", "Software Engineer, YouTube",
         "Paid Digital Goods team. Implemented the “Super Thanks” fan funding feature. "
         "TypeScript, C++.",
         "youtube.jpg", [
             ("https://support.google.com/youtube/answer/10879035?hl=en/", "About Super Thanks"),
         ]),
        ("2018–21", "Software Engineer, Lark Health",
         "Full stack and UX research. React Native migration and microservices. "
         "TypeScript, Python, React Native, Node.js.",
         "lark.jpg", [("https://www.lark.com/", "lark.com")]),
        ("2015–16", "Software Engineering Intern, Google",
         "Two internships, on the AdWords (Dart/Angular) and Knowledge Graph (Java/C++) teams.",
         "google_big_g.jpg", []),
        ("2014", "Software Engineering Intern, PayPal",
         "Core Payments team. Designed and implemented a metrics dashboard. JavaScript, Python.",
         "paypal.jpg", [("https://www.paypal.com/", "paypal.com")]),
        ("2011", "Mechanical Engineering Intern, Makani Power (now Google X)",
         "Helped manufacture self-guided kites for high-altitude wind turbines. Solidworks, CNC.",
         "makani.jpg", [("https://x.company/makani/", "x.company/makani")]),
    ]),

    ("Teaching", "yellow",
     "Eleven quarters as a TA at Stanford and Dartmouth, plus workshops and mentoring.", [
        ("", "Teaching Assistant, Stanford and Dartmouth",
         "CS221 (AI), CS147 (HCI), CS181 (Ethics), CS109, CS106A/B, and ENGM 191, Product "
         "Design and Development.",
         None, [
             ("https://stanfordcs181.github.io/", "CS181: Computers, Ethics, and Public Policy"),
             ("http://hci.stanford.edu/courses/cs147/2017/au/", "CS147: Introduction to HCI Design"),
             ("http://web.stanford.edu/class/cs221/", "CS221: Artificial Intelligence"),
             ("https://engineering.dartmouth.edu/courses#engm-191", "ENGM 191: Product Design and Development"),
         ]),
        ("2019–22", "Workshop leader, TUMO",
         "Designed and taught high school courses on AI and interactive storytelling in Berlin, "
         "Beirut, and Yerevan, including a month-long AI workshop and a storytelling series run "
         "with my sister Sophia.",
         "tumo.jpg", [
             ("https://www.youtube.com/watch?v=eNy72ObvKXU", "Yerevan course overview"),
             ("https://github.com/dylanedwardmoore/storyteller", "Storyteller engine on GitHub"),
             ("https://tumo.org/en/", "About TUMO"),
         ]),
        ("", "Curriculum advisor, TUMO Self-Learning Initiative",
         "Curriculum planning for TUMO's self-learning programme.",
         None, [
             ("https://drive.google.com/file/d/1_KH2EF2khd-DpXSC7J_QXCuShonzYoPi/view?usp=sharing", "About the Initiative"),
         ]),
        ("2021", "Mentor, UC Berkeley Fung Fellowship",
         "Mentored student teams on health and technology projects.",
         None, [("https://fungfellows.berkeley.edu/", "About the Fung Fellowship")]),
        ("2020", "Mentor, Stanford CS + Social Good",
         "Set and mentored a student challenge.",
         None, [
             ("https://cs4good.com/", "cs4good.com"),
             ("https://docs.google.com/document/d/1Sho3fEUPPFG2NbKfBUgJ3uH0ujKJiraKH_wfB_t1vOw/edit?usp=sharing",
              "My challenge statement"),
         ]),
        ("2020", "Section leader, Code in Place",
         "Taught an introductory programming section in Stanford's pandemic-era course.",
         None, [
             ("https://www.stanforddaily.com/2020/03/31/stanford-to-offer-free-online-cs-class-during-pandemic/",
              "About the course"),
         ]),
    ]),

    ("Recognition", "grey", "Awards, grants, and fellowships.", [
        ("2025", "Rilla NYC Hackathon, winner",
         "Our three-person team won the 2025 Rilla NYC Hackathon.",
         "rlla.png", [
             ("https://www.loom.com/share/0384b3cc46e44df1b9ec43597344bc3b?fbclid=IwZXh0bgNhZW0CMTEAAR7qr_NHFGTN8-G8X0mTv2MydZGL8QpBrReZ-Tl9ZaE5o-aQI__uKZ7RnySn2A_aem_d1gABC_XAQOppTyQNZAL7A", "Our presentation"),
             ("https://www.linkedin.com/feed/update/urn:li:activity:7341167981479010306/", "Rilla announcement"),
         ]),
        ("2023", "Dartmouth Digital Health Summit, third place", "", None, [
            ("https://drive.google.com/file/d/1UxroTa7q3ECYXxjUGsLFnHApo3x0Yz7d/view?usp=sharing", "The entry"),
        ]),
        ("2022", "Dartmouth Guarini Alumni Research Award", "", None, [
            ("https://graduate.dartmouth.edu/admissions-financial-aid/awards-grants/alumni-research-award", "About the award"),
        ]),
        ("2022", "Millett G. Morgan Fund Fellow", "", None, []),
        ("2021", "Dartmouth Innovation Fellowship", "", None, []),
        ("2021", "Dartmouth CompX Faculty Grant", "", None, [
            ("https://neukom.dartmouth.edu/funding/faculty/compx-faculty-grants", "About the grant"),
            ("https://docs.google.com/document/d/1Yvx1Sue6kzviB6CeQbl7xRb53pOHmTE_CSreMIMzaUA/edit?usp=sharing",
             "Our proposal"),
        ]),
        ("2021", "Armenian Professional Society Scholarship", "", None, [
            ("http://www.armenianprofessionalsociety.org/aps-scholarships-recipients.html", "Recipients"),
        ]),
        ("2017", "Stanford Teaching Honors", "", None, []),
        ("2012", "Eagle Scout", "", None, [
            ("https://troop89alameda.webs.com/", "Troop 89, Alameda"),
        ]),
        ("2011", "Intel ISEF, third place, Physics and Astronomy",
         "For work on finding harmonics in plasma.", None, []),
    ]),

    ("Earlier work", None,
     "Research and course projects from Stanford, kept for the record.", [
        ("", "Facet", "An emotionally sensitive, accessible corporate meeting assistant.", None, [
            ("https://drive.google.com/file/d/1su1K2T0b-cf14VqOXKPN30UUAsgtWcWm/view?usp=sharing", "Screenshots"),
        ]),
        ("", "NavCog and Ability Hacks",
         "Indoor navigation for blind users, with CMU and Microsoft.", None, [
            ("https://www.cs.cmu.edu/~NavCog/navcog.html", "NavCog documentation"),
            ("https://abilityhacks.org/about/", "About Ability Hacks"),
         ]),
        ("", "Smart Primer", "Using AI to reimagine education.", None, [
            ("https://hci.stanford.edu/research/smartprimer/", "Project homepage"),
        ]),
        ("", "Adversarial Examples for NLP Contexts", "", None, [
            ("https://drive.google.com/file/d/1U_g5SAsvcWB3Md4bHveYfyaY2sj2H28H/view?usp=sharing", "Paper"),
        ]),
        ("", "Visuomotor Learning: Object Classification", "", None, [
            ("https://drive.google.com/open?id=1yI4C4Y-0tSd0WSVDIi_A6twL08Q5agwt", "Paper"),
        ]),
        ("", "Video tagging using frame captions", "", None, [
            ("https://drive.google.com/file/d/17dVfAEMQJUmjsYnHHc8fcsAJB3EPpyLk/view?usp=sharing", "Paper"),
        ]),
        ("", "Finding protests in social media", "", None, [
            ("https://drive.google.com/open?id=1UksP447kuM7VpuhreQ4rV8aNMBrJx99P", "Paper"),
        ]),
        ("", "“Can you take my photo?”",
         "Assistive photography for people with visual impairments.", None, [
            ("https://drive.google.com/file/d/1RbJq-J1Jt_SOWTMI-tYPapQ-e4rMpNCZ/view?usp=sharing", "Paper"),
        ]),
        ("", "Pensieve", "", None, [
            ("https://drive.google.com/open?id=1b868SNDfESTWQaKP7j5MFI38Np8WMzNB", "Documentation"),
        ]),
        ("", "Creativity boosting environments in cars", "", None, [
            ("https://drive.google.com/open?id=1QAo-l2LvOR3CTVji52s4gCmRvb-r_Ri0", "Documentation"),
        ]),
        ("", "A general game playing agent", "", None, [
            ("https://drive.google.com/open?id=1hXBl_rZFLuCw9mlUidw-T7yNCffwIruM", "Documentation"),
        ]),
        ("", "Connect Four with an AI opponent", "", None, [
            ("https://github.com/dmoore2/ConnectFour", "GitHub"),
        ]),
        ("", "Platform for visualising multidimensional shapes", "", None, [
            ("https://github.com/dmoore2/Platform-for-Displaying-Multidimensional-Shapes", "GitHub"),
        ]),
        ("", "Call center audio transcription and analytics", "", None, [
            ("https://www.cbinsights.com/company/permanent-majority-corp", "Company info"),
        ]),
        ("", "Rally", "A social network for staying active.", None, [
            ("https://www.facebook.com/gorallyme/", "Facebook page"),
            ("https://www.youtube.com/watch?v=yIQWqWPzu5Q", "Promo video"),
        ]),
        ("", "Stanford Change Labs: water catchment for rural India", "", None, [
            ("https://changelabs.stanford.edu/systemsinitiatives/100l-water", "About the project"),
        ]),
        ("", "Archaeology research at Chavín de Huántar", "", None, [
            ("https://flic.kr/s/aHsmoRkNyK", "Photographs"),
        ]),
        ("", "Sustainable Amazon ecotourism", "", None, [
            ("https://flic.kr/s/aHsmhuokSW", "Photographs"),
            ("https://drive.google.com/open?id=18Yaw3LSDo2pG5H3smf8U4JckkxPxOeIb", "Research recommendations"),
        ]),
    ]),
]


def esc(t):
    return html.escape(t, quote=False)


def render_entry(year, title, blurb, img, links, featured):
    out = ['        <article class="entry%s">' % (" entry--featured" if featured else "")]
    out.append('            <div class="entry-year">%s</div>' % esc(year))
    out.append('            <div class="entry-body">')
    out.append('                <h3 class="entry-title">%s</h3>' % esc(title))
    if blurb:
        out.append('                <p class="entry-blurb">%s</p>' % esc(blurb))
    if links:
        out.append('                <ul class="entry-links">')
        for url, label in links:
            if url:
                out.append('                    <li><a href="%s" target="_blank" rel="noopener">%s</a></li>'
                           % (esc(url), esc(label)))
            else:
                out.append('                    <li><span>%s</span></li>' % esc(label))
        out.append('                </ul>')
    out.append('            </div>')
    if img:
        out.append('            <div class="entry-figure"><img src="%s%s" alt="" loading="lazy"></div>'
                   % (IMG, img))
    out.append('        </article>')
    return "\n".join(out)


def build():
    parts = []
    for idx, (name, tone, standfirst, entries) in enumerate(SECTIONS, 1):
        cls = ' data-tone="%s"' % tone if tone else ""
        parts.append('    <section class="section"%s>' % cls)
        parts.append('        <div class="section-label">')
        parts.append('            <span class="section-index">%02d</span>' % idx)
        parts.append('            <h2>%s</h2>' % esc(name))
        parts.append('            <p>%s</p>' % esc(standfirst))
        parts.append('        </div>')
        parts.append('        <div class="section-entries">')
        featured = name in ("Ventures", "Research")
        for e in entries:
            parts.append(render_entry(*e, featured=featured))
        parts.append('        </div>')
        parts.append('    </section>')
    return "\n".join(parts)


V = "v=20260821g"
HEAD = """<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Portfolio &mdash; Dylan Edward Moore</title>
    <meta name="description" content="Ventures, research, industry work, teaching, and awards by Dylan Edward Moore.">
    <link rel="shortcut icon" type="image/png" href="../assets/img/icon/DEM_logo.ico">
    <link rel="preload" as="font" type="font/woff" href="../assets/fonts/fff/fff-Regular.woff?{V}" crossorigin>
    <link rel="stylesheet" href="../assets/css/site.css?{V}">
    <link rel="stylesheet" href="../assets/css/portfolio.css?{V}">

    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-125440044-1"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() {{ dataLayer.push(arguments); }}
        gtag('js', new Date());

        gtag('config', 'UA-125440044-1');
    </script>
</head>

<body class="portfolio">
    <div class="frame-left" aria-hidden="true"></div>
    <div class="frame-bottom" aria-hidden="true"></div>

    <header class="masthead">
        <a class="backlink" href="../">Dylan Moore</a>
        <h1>Portfolio</h1>
        <p class="masthead-note">Ventures, research, industry work, teaching, and awards.</p>
    </header>

    <main class="register">
""".replace("{V}", V)

TAIL = """    </main>
</body>

</html>
"""

io.open("/Users/dylanmoore/Documents/portfolio/portfolio/index.html", "w",
        encoding="utf-8", newline="\n").write(HEAD + build() + "\n" + TAIL)

n = sum(len(s[3]) for s in SECTIONS)
print("wrote portfolio/index.html")
print("  sections: %d | entries: %d" % (len(SECTIONS), n))
for name, tone, _, entries in SECTIONS:
    print("    %-14s %-7s %d" % (name, tone or "-", len(entries)))
