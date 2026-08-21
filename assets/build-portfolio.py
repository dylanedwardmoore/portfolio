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
         "companion_iq.png", [("https://companioniq.org/", "companioniq.org")]),
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
         "Paid Digital Goods team. Implemented the \u201cSuper Thanks\u201d fan funding feature. "
         "TypeScript, C++.",
         "youtube.jpg", [
             ("https://support.google.com/youtube/answer/10879035?hl=en/", "About Super Thanks"),
         ]),
        ("2018\u201321", "Software Engineer, Lark Health",
         "Full stack and UX research. React Native migration and microservices. "
         "TypeScript, Python, React Native, Node.js.",
         "lark.jpg", [("https://www.lark.com/", "lark.com")]),
        ("2015\u201316", "Software Engineering Intern, Google",
         "Two internships, on the AdWords (Dart/Angular) and Knowledge Graph (Java/C++) teams.",
         "google_big_g.jpg", []),
        ("2014", "Software Engineering Intern, PayPal",
         "Core Payments team. Designed and implemented a metrics dashboard. JavaScript, Python.",
         "paypal.jpg", [("https://www.paypal.com/", "paypal.com")]),
        ("2011", "Mechanical Engineering Intern, Makani Power (now Google X)",
         "Helped manufacture self-guided kites for high-altitude wind turbines. Solidworks, CNC.",
         "makani.jpg", []),
    ]),

    ("Leadership and Teaching", "yellow",
     "Eleven quarters as a TA at Stanford and Dartmouth, plus workshops, mentoring, and "
     "student leadership.", [
        ("", "Teaching Assistant, Stanford and Dartmouth",
         "CS221 (AI), CS147 (HCI), CS181 (Ethics), CS109, CS106A/B, and ENGM 191, Product "
         "Design and Development.",
         None, [
             ("https://stanfordcs181.github.io/", "CS181: Computers, Ethics, and Public Policy"),
             ("http://hci.stanford.edu/courses/cs147/2017/au/", "CS147: Introduction to HCI Design"),
             ("http://web.stanford.edu/class/cs221/", "CS221: Artificial Intelligence"),
             ("https://engineering.dartmouth.edu/courses#engm-191", "ENGM 191: Product Design and Development"),
         ]),
        ("2019\u201322", "Workshop leader, TUMO",
         "Designed and taught high school courses on AI and interactive storytelling in Berlin, "
         "Beirut, and Yerevan, covering minimax search, neural networks, and style transfer. The "
         "storytelling series was run with my sister Sophia.",
         "tumo.jpg", [
             ("https://www.youtube.com/watch?v=eNy72ObvKXU", "Yerevan course overview"),
             ("https://github.com/dylanedwardmoore/storyteller", "Storyteller engine on GitHub"),
             ("https://tumo.org/en/", "About TUMO"),
         ]),
        ("", "Curriculum advisor, TUMO Self-Learning Initiative",
         "Curriculum planning for TUMO\u2019s self-learning programme.",
         None, [
             ("https://drive.google.com/file/d/1_KH2EF2khd-DpXSC7J_QXCuShonzYoPi/view?usp=sharing",
              "About the Initiative"),
         ]),
        ("2021", "Mentor, UC Berkeley Fung Fellowship",
         "Mentored student teams on health and technology projects.",
         None, [("https://fungfellows.berkeley.edu/", "About the Fung Fellowship")]),
        ("2020", "Mentor, Stanford CS + Social Good",
         "Set and mentored a student challenge, and brought Ability Hacks in as a non-profit "
         "partner.",
         None, [
             ("https://cs4good.com/", "cs4good.com"),
             ("https://docs.google.com/document/d/1Sho3fEUPPFG2NbKfBUgJ3uH0ujKJiraKH_wfB_t1vOw/edit?usp=sharing",
              "My challenge statement"),
         ]),
        ("2020", "Section leader, Code in Place",
         "Taught an introductory programming section in Stanford\u2019s pandemic-era course.",
         None, [
             ("https://www.stanforddaily.com/2020/03/31/stanford-to-offer-free-online-cs-class-during-pandemic/",
              "About the course"),
         ]),
        ("2014", "E-Challenge Coordinator, BASES",
         "Planned a $150k startup competition for the Business Association of Stanford "
         "Entrepreneurial Students.",
         "bases-2.jpg", [("http://bases.stanford.edu/", "bases.stanford.edu")]),
        ("", "Junior Class President, Stanford",
         "Elected class president. Attended administrative meetings and planned campus-wide "
         "events, including the class formal and Full Moon on the Quad.",
         "class_president-2.jpg", [
             ("https://assu.stanford.edu/leadership/class-presidents", "About the role"),
         ]),
        ("2012\u201316", "Founding member, Stanford Competitive Running Club",
         "Founding member and club leader. Competed in national club championships (NIRCA), an "
         "Ironman triathlon, and hundred-mile relays.",
         "running_club.jpg", [("https://running.stanford.edu/index.html", "The club")]),
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
            ("https://graduate.dartmouth.edu/admissions-financial-aid/awards-grants/alumni-research-award",
             "About the award"),
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
        ("2012", "Eagle Scout", "", None, []),
        ("2011", "Intel ISEF, third place, Physics and Astronomy",
         "For a predictive model of standing wave patterns in plasma, built from my own "
         "high-speed photography of neon signs. Also won an American Vacuum Society Award and a "
         "full-tuition scholarship to Drexel University.",
         "isef.jpg", []),
    ]),

    ("Earlier work", None,
     "Research and course projects from Stanford, kept for the record.", [
        ("", "Facet",
         "An emotionally sensitive, accessible corporate meeting assistant, built as my CS210 "
         "(Software Project Experience with Corporate Partners) senior project with VMware as "
         "sponsor. Facet ran meetings through an Alexa app, aggregated video and audio, and gave "
         "management analytics on team dynamics and patterns of bias. Winner of the Class Project "
         "Award and the Pejman and Mar (Pear VC) Award.",
         "facet_circle.jpg", []),
        ("", "NavCog and Ability Hacks",
         "HCI research and engineering on disability-related challenges. I led the continuation "
         "of NavCog, an indoor navigation app for people with visual impairments, which began in "
         "CMU\u2019s Cognitive Assistance Laboratory and passed to Ability Hacks in 2020.",
         "navcog.jpg", [("https://www.cs.cmu.edu/~NavCog/navcog.html", "CMU NavCog documentation")]),
        ("", "Smart Primer",
         "Early work under Dr James Landay on a tablet-based intelligent tutoring system for "
         "children, built around narrative, tutoring chatbots, and real-world activities.",
         "smart_primer_circle.jpg", [("https://hci.stanford.edu/research/smartprimer/", "Project page")]),
        ("", "Creativity boosting environments in cars",
         "Research with the Volkswagen Automotive Innovation Lab at Stanford, with Dr Elizabeth "
         "Murnane and Dr James Landay, on how in-car agents can guide creative activity during a "
         "commute safely and enjoyably.",
         "creative_drive.jpg", [
             ("https://drive.google.com/open?id=1QAo-l2LvOR3CTVji52s4gCmRvb-r_Ri0", "Documentation"),
         ]),
        ("", "Adversarial Examples for NLP Contexts",
         "Two methods for generating adversarial examples for an NLP task, including a new loss "
         "function for training word vectors in a CBOW model. Final project for CS221 (Artificial "
         "Intelligence: Principles and Techniques) and CS224N (Natural Language Processing with "
         "Deep Learning).",
         "adversarial2.jpg", [
             ("https://drive.google.com/file/d/1U_g5SAsvcWB3Md4bHveYfyaY2sj2H28H/view?usp=sharing", "Paper"),
         ]),
        ("", "Visuomotor Learning: Object Classification",
         "A CNN for Amazon\u2019s robotic arm pick-and-place task, trained on generated data across "
         "many camera angles and scenes to boost existing models by transfer learning. Final "
         "project for CS230 (Deep Learning).",
         "robot_arm3.jpg", [
             ("https://drive.google.com/open?id=1yI4C4Y-0tSd0WSVDIi_A6twL08Q5agwt", "Paper"),
         ]),
        ("", "Video tagging using frame captions",
         "Extended state-of-the-art CNN image captioning to a video tagging task. Final project "
         "for CS229 (Machine Learning).",
         "video_tagging.jpg", [
             ("https://drive.google.com/file/d/17dVfAEMQJUmjsYnHHc8fcsAJB3EPpyLk/view?usp=sharing", "Paper"),
         ]),
        ("", "Finding protests in social media",
         "CNNs to identify protest images on Chinese social media likely to be censored. Final "
         "project for CS224N (Natural Language Processing with Deep Learning).",
         "eye_green.jpg", [
             ("https://drive.google.com/open?id=1UksP447kuM7VpuhreQ4rV8aNMBrJx99P", "Paper"),
         ]),
        ("", "\u201cCan you take my photo?\u201d",
         "A lightweight guidance system that helps a stranger capture the shot you wanted. Final "
         "project for CS376 (Research Topics in Human-Computer Interaction).",
         "photo_assist_circle.jpg", [
             ("https://drive.google.com/file/d/1RbJq-J1Jt_SOWTMI-tYPapQ-e4rMpNCZ/view?usp=sharing", "Paper"),
         ]),
        ("", "Pensieve",
         "An app for sharing memories with loved ones at particular moments. Final project for "
         "CS247 (Human-Computer Interaction Design Studio).",
         "pensieve4.jpg", [
             ("https://drive.google.com/open?id=1b868SNDfESTWQaKP7j5MFI38Np8WMzNB", "Documentation"),
         ]),
        ("", "Rally",
         "A mobile web app for connecting with friends and planning activities. Final project for "
         "CS147 (Introduction to Human-Computer Interaction Design).",
         "rally.jpg", [
             ("https://www.facebook.com/gorallyme/", "Facebook page"),
             ("https://www.youtube.com/watch?v=yIQWqWPzu5Q", "Promo video"),
         ]),
        ("", "A general game playing agent",
         "A Java propositional-network player with performance gains from factoring and latches, "
         "which reached the semifinals of the end-of-year competition. Final project for CS227B "
         "(General Game Playing).",
         "chess_piece2.jpg", [
             ("https://drive.google.com/open?id=1hXBl_rZFLuCw9mlUidw-T7yNCffwIruM", "Documentation"),
         ]),
        ("", "CS106B Recursion Competition, Grand Prize",
         "Connect Four with an AI opponent \u2014 my freshman-year entry to the 2013 competition in "
         "CS106B (Programming Abstractions).",
         "connect_four3.jpg", [("https://github.com/dmoore2/ConnectFour", "Source on GitHub")]),
        ("", "CS106A Graphics Competition, Grand Prize",
         "A platform for creating, manipulating, and visualising multidimensional shapes \u2014 my "
         "freshman-year entry to the 2012 competition in CS106A (Programming Methodology).",
         "shape3.jpg", [
             ("https://github.com/dmoore2/Platform-for-Displaying-Multidimensional-Shapes", "Source on GitHub"),
         ]),
        ("", "Stanford Change Labs: water catchment for rural India",
         "Mechanical engineering and design research with the 100 Litre Water Project. My focus "
         "was a sun-tracking solar panel power supply.",
         "water_catchment.jpg", []),
        ("", "Archaeology research at Chav\u00edn de Hu\u00e1ntar",
         "Stanford researcher on a small team that located a buried ceremonial chamber over 2,500 "
         "years old at a UNESCO World Heritage site in the Peruvian Andes. 700+ hours of field and "
         "lab work.",
         "peru2.jpg", [("https://flic.kr/s/aHsmoRkNyK", "Photographs")]),
        ("", "Sustainable Amazon ecotourism",
         "60+ hours of interviews with experts and members of Quechua and Waorani communities in "
         "the Amazon basin and cloud forests of Ecuador, supported by Stanford BOSP and Dr "
         "Margaret Fuller.",
         "sani_circle.jpg", [
             ("https://flic.kr/s/aHsmhuokSW", "Photographs"),
             ("https://drive.google.com/open?id=18Yaw3LSDo2pG5H3smf8U4JckkxPxOeIb", "Research recommendations"),
         ]),
        ("", "Call center audio transcription and analytics",
         "Built the audio transcription and conversation analytics prototype for an early-stage "
         "political polling analytics startup.",
         None, [("https://www.cbinsights.com/company/permanent-majority-corp", "Company info")]),
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


V = "v=20260821i"
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

    <div class="topbar">
        <a class="backlink" href="../">Back</a>
    </div>

    <header class="masthead">
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
