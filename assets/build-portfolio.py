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
         "Co-founder and Chief AI Officer of Memcara, working on building AI-enabled "
         "tools for caregiving in long-term care facilities. I joined Memcara as a "
         "researcher in 2023 and transitioned into a CAIO and cofounder role to help "
         "the company grow its AI offerings.",
         "memcara.png", [
             ("https://memcara.com/", "memcara.com"),
             ("https://doi.org/10.1145/3770687", "CareInsights (IMWUT 2025)"),
             ("https://doi.org/10.1145/3757599", "Family In The Loop (CSCW 2025)"),
             (None, "CareWare: Caregiver Smart Glasses (CHI 2026 submission)"),
         ]),
        ("2025–26", "Companion IQ",
         "Founder and Chief AI Officer of Companion IQ, a startup that builds AI "
         "tools to support person-centered dementia care. Our first product is an "
         "AI-powered dashboard for long-term care staff that provides insights into "
         "the needs and experiences of residents with dementia. We are currently "
         "piloting this product at several long-term care facilities across the "
         "country. We have raised $1M in seed funding.",
         "companion_iq.png", [("https://companioniq.org/", "companioniq.org")]),
    ]),

    ("Research", "dusky", "Peer-reviewed work in human-AI interaction.", [
        ("2025", "CareInsights: AI-Enabled Infrastructure for Person-Centered Dementia Care",
         "Our paper \"CareInsights: AI-enabled Infrastructure for Person-centered "
         "Dementia Care in Resource-constrained Facilities\" was accepted at IMWUT, "
         "2025.",
         "imwut.jpg", [("https://doi.org/10.1145/3770687", "doi.org/10.1145/3770687")]),
        ("2025", "Family In The Loop",
         "I presented the paper \"Family In The Loop: Enabling Family Involvement "
         "and Person-Centered Dementia Care at Long-Term Care Facilities with "
         "Collaborative AI Tools\" at CSCW, 2025.",
         "cscw_2025.jpg", [("https://doi.org/10.1145/3757599", "doi.org/10.1145/3757599")]),
        ("2025", "Collaborative Meaning-Making in Networked Learning Environments",
         "I presented an early sketch of a new learnersourcing framework I developed "
         "at Learning @ Scale, 2025.",
         "sparc.png", [
             ("https://drive.google.com/file/d/1TVCfHRdtLEJM3IYrlXAvKvqVbp0DoYXf/view", "Read the paper"),
         ]),
        ("2024", "Teaching AI in Extracurricular Contexts Through Narrative-Based Learnersourcing",
         "I was first author on the paper \"Teaching Teaching artificial "
         "intelligence in extracurricular contexts through narrative-based "
         "learnersourcing\" at CHI 2024.",
         "chi2024.jpg", [
             ("https://doi.org/10.1145/3613904.3642198", "doi.org/10.1145/3613904.3642198"),
         ]),
    ]),

    ("Industry", "red", "Software engineering before my PhD.", [
        ("2021", "Software Engineer, YouTube",
         "I worked at YouTube, within Google, from March, 2021 through August, 2021. "
         "I was a SWE on the Paid Digital Goods team. During my time at YouTube, I "
         "was part of the small (a dozen person sized) team that implemented the "
         "\"Super Thanks\" feature, which allows users to directly financially "
         "support creators on all YouTube videos (provided creators enable the "
         "feature and the video is legally eligible for monetization).",
         "youtube.jpg", [
             ("https://support.google.com/youtube/answer/10879035?hl=en/", "About Super Thanks"),
         ]),
        ("2018\u201321", "Software Engineer, Lark Health",
         "I worked at Lark Health from October, 2018 to February, 2021. During my "
         "first year, I was one of only two mobile developers. Since I joined, the "
         "company has tripled in headcount. In 2020, we raised an additional $70 "
         "million in Series C funding. The Company Lark is the world's largest A.I. "
         "healthcare provider, we service patients suffering from or at risk of "
         "chronic disease with A.I. Nurses.",
         "lark.jpg", [("https://www.lark.com/", "lark.com")]),
        ("2015\u201316", "Software Engineering Intern, Google",
         "Two internships, on the AdWords (Dart/Angular) and Knowledge Graph (Java/C++) teams.",
         "google_big_g.jpg", []),
        ("2014", "Software Engineering Intern, PayPal",
         "I designed and implemented a dashboard and other internal tools as an "
         "intern on the Core Payments Team.",
         "paypal.jpg", [("https://www.paypal.com/", "paypal.com")]),
        ("2011", "Mechanical Engineering Intern, Makani Power (now Google X)",
         "I helped manufacture high altitude wind turbines and self-guided kites. I "
         "used SolidWorks and operated tools in the CAD workshop.",
         "makani.jpg", []),
    ]),

    ("Leadership and Teaching", "yellow",
     "Eleven quarters as a TA at Stanford and Dartmouth, plus workshops, mentoring, and "
     "student leadership.", [
        ("", "Teaching Assistant, Stanford and Dartmouth",
         "I was a TA at Stanford for nine quarters during college and received the "
         "Stanford Teaching Honors Award in 2017. See the links below for more "
         "information on each of the courses that I've staffed.",
         "stanford_icon.jpg", [
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
             ("https://tumo.org/en/", "About TUMO"),
         ]),
        ("", "Curriculum advisor, TUMO Self-Learning Initiative",
         "Over the summer of 2021, I served as an expert advisor for planning the AI "
         "+ CS curriculum of an ambitious new TUMO initiative. The goal of this "
         "project is to create a fast track for the upskilling of young Armenian "
         "professionals seeking to join industry. This project was sponsored by the "
         "European Union for Armenia, among other major organizations.",
         "TUMO_self_learning.jpg", [
             ("https://drive.google.com/file/d/1_KH2EF2khd-DpXSC7J_QXCuShonzYoPi/view?usp=sharing",
              "About the Initiative"),
         ]),
        ("2021", "Mentor, UC Berkeley Fung Fellowship",
         "I developed a partnership between the Fung Fellowship entrepreneurship and "
         "innovation program at U.C. Berkeley and Ability Hacks. Through my role as "
         "a sponsor mentor, I advised two teams of students who developed technology "
         "to help people with visual impairments navigate city environments.",
         "fung_fellowship.jpg", [("https://fungfellows.berkeley.edu/", "About the Fung Fellowship")]),
        ("2020", "Mentor, Stanford CS + Social Good",
         "I was Lark\u2019s representative for a two quarter design studio at "
         "Stanford, CS + Social Good. I mentored students on d.school techniques and "
         "how to build impactful technical projects. To follow up on the success of "
         "this 2020 class, I recently organized a partnership between AbilityHacks "
         "and CS + Social Good and will be returning as a mentor for this coming "
         "(2021) Winter and Spring quarters.",
         "cs_plus_social_good.jpg", [
             ("https://cs4good.com/", "cs4good.com"),
             ("https://docs.google.com/document/d/1Sho3fEUPPFG2NbKfBUgJ3uH0ujKJiraKH_wfB_t1vOw/edit?usp=sharing",
              "My challenge statement"),
         ]),
        ("2020", "Section leader, Code in Place",
         "I was a section leader (TA) for Stanford\u2019s Code in Place course. This "
         "was a free, open enrollment version of Stanford\u2019s intro to CS course "
         "that was specifically tailored for the circumstances of the COVID-19 "
         "pandemic.",
         "code_in_place copy.jpg", [
             ("https://www.stanforddaily.com/2020/03/31/stanford-to-offer-free-online-cs-class-during-pandemic/",
              "About the course"),
         ]),
        ("2014", "E-Challenge Coordinator, BASES",
         "I was the BASES E-Challenge Coordinator in 2014. In this role, I planned a "
         "$150k startup competition.",
         "bases-2.jpg", [("http://bases.stanford.edu/", "bases.stanford.edu")]),
        ("", "Junior Class President, Stanford",
         "I was elected as a Junior class president. In this role I attended "
         "administrative meetings and planned campus wide events, such as our class "
         "formal on a boat and Stanford Full Moon on the Quad.",
         "class_president copy.jpg", [
             ("https://assu.stanford.edu/leadership/class-presidents", "About the role"),
         ]),
        ("2012\u201316", "Founding member, Stanford Competitive Running Club",
         "I was a founding member and a leader of the Stanford Running Club. "
         "I\u2019ve been actively involved in the Stanford running community since "
         "2012 and have competed in many events including national club "
         "championships (NIRCA), iron man triathlon, and hundred mile relays.",
         "running_club.jpg", [("https://running.stanford.edu/index.html", "The club")]),
    ]),

    ("Recognition", "blue", "Awards, grants, and fellowships.", [
        ("2025", "Rilla NYC Hackathon, winner",
         "Our three person team won the 2025 Rilla NYC Hackathon.",
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
        ("2021", "Armenian Professional Society Scholarship", "", "aps.jpg", [
            ("http://www.armenianprofessionalsociety.org/aps-scholarships-recipients.html", "Recipients"),
        ]),
        ("2017", "Stanford Teaching Honors", "", "stanford_icon.jpg", []),
        ("2012", "Eagle Scout", "", "eagle_scout.jpg", []),
        ("2011", "Intel ISEF, third place, Physics and Astronomy",
         "For a predictive model of standing wave patterns in plasma, built from my own "
         "high-speed photography of neon signs. Also won an American Vacuum Society Award and a "
         "full-tuition scholarship to Drexel University.",
         "isef.jpg", []),
    ]),

    ("Earlier work", None,
     "Older work from my time at Stanford.", [
        ("", "Facet",
         "Corporate meetings are notoriously inefficient and often biased. My CS210 "
         "senior project team confirmed this through rounds of user research at "
         "large software companies, where \"too many inefficient and biased "
         "meetings\" was a frequent complaint. To address the problem, we built "
         "Facet, a smart assistant that facilitates and analyses corporate meetings.",
         "facet_circle.jpg", []),
        ("", "NavCog and Ability Hacks",
         "With AbilityHacks, I do HCI research and engineering work to build "
         "solutions to disability-related challenges. Currently, I am leading the "
         "continuation of the NavCog project. NavCog started in CMU\u2019s Cognitive "
         "Assistance Laboratory and was passed off to AbilityHacks in 2020.",
         "navcog.jpg", [("https://www.cs.cmu.edu/~NavCog/navcog.html", "CMU NavCog documentation")]),
        ("", "Smart Primer",
         "I did early work under Dr. James Landay on the Smart Primer Project, a "
         "tablet-based intelligent tutoring system for kids that leverages "
         "compelling narratives, intelligent tutoring chatbots, real-world "
         "activities, and a child\u2019s physical and educational context.",
         "smart_primer_circle.jpg", [("https://hci.stanford.edu/research/smartprimer/", "Project page")]),
        ("", "Creativity boosting environments in cars",
         "Research in collaboration with the Volkswagen Automotive Innovation Lab at "
         "Stanford on increasing creativity during daily commuting, with Dr. "
         "Elizabeth Murnane and Dr. James Landay. This project investigated how "
         "intelligent in-car agents can engage with drivers and passengers to guide "
         "creative activities and elicit novel ideas, in an effective, enjoyable, "
         "and safe manner.",
         "creative_drive.jpg", [
             ("https://drive.google.com/open?id=1QAo-l2LvOR3CTVji52s4gCmRvb-r_Ri0", "Documentation"),
         ]),
        ("", "Adversarial Examples for NLP Contexts",
         "My colleague and I present two methods of generating adversarial examples "
         "for an NLP task. We introduce a new loss function for training word "
         "vectors in a CBOW model. This was our CS221 and CS224N class projects.",
         "adversarial2.jpg", [
             ("https://drive.google.com/file/d/1U_g5SAsvcWB3Md4bHveYfyaY2sj2H28H/view?usp=sharing", "Paper"),
         ]),
        ("", "Visuomotor Learning: Object Classification",
         "My team made a CNN for Amazon's robotic arm pick-and-place task. Our model "
         "can use large amounts of generated data (multiple camera angles, many "
         "scenes) and is intended to boost the performance of existing models on the "
         "actual task via transfer learning. This was a CS230 class project.",
         "robot_arm3.jpg", [
             ("https://drive.google.com/open?id=1yI4C4Y-0tSd0WSVDIi_A6twL08Q5agwt", "Paper"),
         ]),
        ("", "Video tagging using frame captions",
         "My team extended state of the art CNN image captioning techniques to a "
         "video tagging task. This was our CS229 class project",
         "video_tagging.jpg", [
             ("https://drive.google.com/file/d/17dVfAEMQJUmjsYnHHc8fcsAJB3EPpyLk/view?usp=sharing", "Paper"),
         ]),
        ("", "Finding protests in social media",
         "My team used CNNs to identify protest images on Chinese social media that "
         "are likely to be censored. This was our CS224N class project",
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
         "My team made an app for sharing memories with loved ones at specific "
         "moments. This was a CS247 class project.",
         "pensieve4.jpg", [
             ("https://drive.google.com/open?id=1b868SNDfESTWQaKP7j5MFI38Np8WMzNB", "Documentation"),
         ]),
        ("", "Rally",
         "My team made a mobile web app for people to connect with friends and plan "
         "activities. This was a CS147 class project.",
         "rally.jpg", [
             ("https://www.facebook.com/gorallyme/", "Facebook page"),
             ("https://www.youtube.com/watch?v=yIQWqWPzu5Q", "Promo video"),
         ]),
        ("", "A general game playing agent",
         "My team made a Java prop net GGP player with performance boosts from "
         "factoring and latches. This program made it to the semifinals of the end "
         "of year class competition. This was a CS227b class project.",
         "chess_piece2.jpg", [
             ("https://drive.google.com/open?id=1hXBl_rZFLuCw9mlUidw-T7yNCffwIruM", "Documentation"),
         ]),
        ("", "CS106B Recursion Competition, Grand Prize",
         "Connect Four with an AI opponent \u2014 my freshman-year entry to the 2013 competition in "
         "CS106B (Programming Abstractions).",
         "connect_four3.jpg", []),
        ("", "CS106A Graphics Competition, Grand Prize",
         "A platform for creating, manipulating, and visualising multidimensional shapes \u2014 my "
         "freshman-year entry to the 2012 competition in CS106A (Programming Methodology).",
         "shape3.jpg", [
         ]),
        ("", "Stanford Change Labs: water catchment for rural India",
         "I did mechanical engineering and design research with The 100 Liter Water "
         "Project at Stanford Change Labs. My focus in this project was on designing "
         "a sun-tracking solar panel power supply.",
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
         "I created the audio transcription and conversation analytics prototype for "
         "an early stage political polling data analytics startup.",
         None, [("https://www.cbinsights.com/company/permanent-majority-corp", "Company info")]),
    ]),
]


def esc(t):
    return html.escape(t, quote=False)


def render_entry(year, title, blurb, img, links, featured, delay=0):
    out = ['        <article class="entry%s" style="--d:%d">'
           % (" entry--featured" if featured else "", delay)]
    out.append('            <div class="entry-year">%s</div>' % esc(year))
    if img:
        out.append('            <div class="entry-figure"><img src="%s%s" alt="" loading="lazy"></div>'
                   % (IMG, img))
    out.append('            <h3 class="entry-title">%s</h3>' % esc(title))
    out.append('            <div class="entry-body">')
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
    out.append('        </article>')
    return "\n".join(out)


def build():
    parts = []
    step = [2]   # 0 and 1 belong to the masthead and the bar

    def nxt():
        step[0] += 1
        # Capped: past this the item is well below the fold and has finished
        # long before anyone scrolls to it.
        return min(step[0], 26)

    for idx, (name, tone, standfirst, entries) in enumerate(SECTIONS, 1):
        cls = ' data-tone="%s"' % tone if tone else ""
        parts.append('    <section class="section" id="s%d"%s>' % (idx, cls))
        parts.append('        <div class="section-label" style="--d:%d">' % nxt())
        parts.append('            <span class="section-index">%02d</span>' % idx)
        parts.append('            <h2>%s</h2>' % esc(name))
        parts.append('            <p>%s</p>' % esc(standfirst))
        parts.append('        </div>')
        parts.append('        <div class="section-entries">')
        featured = name in ("Ventures", "Research")
        for e in entries:
            parts.append(render_entry(*e, featured=featured, delay=nxt()))
        parts.append('        </div>')
        parts.append('    </section>')
    return "\n".join(parts)


V = "v=20260821z"
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
    <script>
        // Marks documents that arrived through a view transition, so the
        // title's colour settle runs only then and not on a cold load.
        // In <head> deliberately: `pagereveal` fires before end-of-body
        // scripts, and the class has to be present for the first frame.
        // Direction of travel, supplied to both documents as a view-transition
        // type so they animate the same way round. Depth of the path decides
        // it: "/" is the top, "/portfolio/" is one below.
        function depth(u) {
            try { return new URL(u, location.href).pathname.split('/').filter(Boolean).length; }
            catch (err) { return 0; }
        }
        window.addEventListener('pageswap', function (e) {
            if (!e.viewTransition || !e.activation || !e.activation.entry) return;
            e.viewTransition.types.add(
                depth(e.activation.entry.url) > depth(location.href) ? 'go-in' : 'go-out');
        });
        window.addEventListener('pagereveal', function (e) {
            if (!e.viewTransition) return;
            document.documentElement.classList.add('vt-in');
            var nav = window.navigation && navigation.activation && navigation.activation.from;
            if (nav) {
                e.viewTransition.types.add(
                    depth(location.href) > depth(nav.url) ? 'go-in' : 'go-out');
            }
        });
        // Arms the entry cascade. Set from script so that with none, nothing
        // is ever left invisible.
        document.documentElement.classList.add('js-cascade');
        window.addEventListener('pagehide', function () {
            document.documentElement.classList.remove('vt-in');
        });
    </script>

    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-125440044-1"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() {{ dataLayer.push(arguments); }}
        gtag('js', new Date());

        gtag('config', 'UA-125440044-1');
    </script>
</head>

<body class="portfolio no-js">
    <script>document.body.classList.remove('no-js');</script>

    <div class="frame-left" aria-hidden="true"></div>
    <div class="frame-bottom" aria-hidden="true"></div>
    <div class="scrollrail" data-scroll="window" data-rail-top=".topbar"
        aria-hidden="true" hidden>
        <div class="scrollrail-thumb"></div>
    </div>

    <header class="masthead">
        <h1>Portfolio</h1>
    </header>

    <div class="topbar">
        <a class="backlink" href="../">Back</a>
    </div>

    <main class="register">
""".replace("{V}", V)

TAIL = """    </main>

    <script src="../assets/js/scrollrail.js?{V}"></script>
    <script src="../assets/js/figures.js?{V}"></script>
</body>

</html>
""".replace("{V}", V)

io.open("/Users/dylanmoore/Documents/portfolio/portfolio/index.html", "w",
        encoding="utf-8", newline="\n").write(HEAD + build() + "\n" + TAIL)

n = sum(len(s[3]) for s in SECTIONS)
print("wrote portfolio/index.html")
print("  sections: %d | entries: %d" % (len(SECTIONS), n))
for name, tone, _, entries in SECTIONS:
    print("    %-14s %-7s %d" % (name, tone or "-", len(entries)))
