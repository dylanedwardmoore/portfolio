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
import math
import os

IMG = "../assets/img/portfolio/"
SHAPES = "../assets/img/shapes/library/"

# Which mark belongs to which section, by the tone the section already carries.
# The tone is the only thing the register knows about a section's identity, and
# the marks were built against the same six.
MARK_OF = {"sea": "ventures", "dusky": "research", "red": "industry",
           "yellow": "teaching", "blue": "recognition", None: "earlier"}

_LIB = json.load(io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                      "img", "shapes", "library.json"),
                         encoding="utf-8"))


def mark_parts(tone):
    """The section's mark, as one element per shape, plus where each one goes
    when the mark gathers.

    It used to be a single span with the whole mark masked out of the tone in
    one piece. One piece cannot come apart, and the register wants it to.

    The gathering is worked out here rather than written by hand in the
    stylesheet, because it depends on the shapes: every part is brought onto
    the centre of the largest one and shrunk enough to be lost inside it. The
    largest then SWELLS, so a gathered mark is not the big part with the others
    hidden behind it -- it is visibly fatter than any part on its own, which is
    what makes a merge read as a merge rather than as a tidying away.

    What the stylesheet gets is four numbers per part: how far to travel, how
    much to shrink, and which number in the queue it is. Every choreography is
    written against those, so any story can be told by any of the six marks
    without knowing which shapes it is made of.
    """
    mark = _LIB["marks"][MARK_OF.get(tone, "earlier")]
    bw, bh = mark["box"]
    # The box's own width, carried through to the element that holds the
    # parts. It used to be restated by hand in the stylesheet, one value per
    # tone, and the moment a mark was recomposed the two disagreed -- the parts
    # are placed in per cent of the box, so a container of the wrong width does
    # not clip anything, it stretches every traced shape in the mark sideways
    # and nothing looks obviously broken. Emitted, it cannot drift.
    qs = mark["parts"]


    # The one everything else hides in. By area, which for these is always the
    # part the mark is really about.
    lead = max(qs, key=lambda q: q["w"] * q["h"])
    lx, ly = lead["x"] + lead["w"] / 2.0, lead["y"] + lead["h"] / 2.0

    # The queue the choreography works through. The lead goes first and the
    # rest follow in the order they stand, so a story reads as a body settling
    # and its limbs coming off it one at a time rather than as a row of things
    # all leaving at once.
    order = {}
    n = 1
    for q in qs:
        if q is lead:
            order[id(q)] = 0
        else:
            order[id(q)] = n
            n += 1

    # HOW LONG THE WHOLE TELLING LASTS, for this mark.
    #
    # The body has to still be there when the last piece arrives, because what
    # it does in the second half is answer them. A piece's duration follows its
    # travel, so the mark's span is the longest of those plus enough for the
    # queue to have emptied. Without this the body finished first and spent the
    # end of every telling doing nothing while pieces landed around it.
    span = 0.0
    for q in qs:
        if q is lead:
            continue
        cx, cy = q["x"] + q["w"] / 2.0, q["y"] + q["h"] / 2.0
        d = min(1.0, math.hypot(lx - cx, ly - cy) / 24.0)
        span = max(span, 0.22 + 1.30 * d)
    span += 0.1 + 0.12 * max(0, len(qs) - 2)

    out = []
    for i, q in enumerate(qs):
        style = ("-webkit-mask-image:url(%s%s.svg);mask-image:url(%s%s.svg);"
                 "left:%.3f%%;top:%.3f%%;width:%.3f%%;height:%.3f%%"
                 % (SHAPES, q["shape"], SHAPES, q["shape"],
                    100.0 * q["x"] / bw, 100.0 * q["y"] / bh,
                    100.0 * q["w"] / bw, 100.0 * q["h"] / bh))
        if q is lead:
            style += ";--gx:0px;--gy:0px;--gs:1.24;--dist:0;--mass:1;--arcpx:0px"
        else:
            cx, cy = q["x"] + q["w"] / 2.0, q["y"] + q["h"] / 2.0
            dx, dy = lx - cx, ly - cy
            fit = min(1.0, lead["w"] * 0.78 / q["w"], lead["h"] * 0.78 / q["h"])
            # HOW FAR, AND HOW HEAVY.
            #
            # Across the six marks a satellite has between 8 and 24 pixels to
            # cross -- three times the distance for the same money, and until
            # now the same money: every one of them got the same duration, so
            # the far ones moved at three times the speed of the near ones and
            # the register had no consistent sense of pace at all.
            #
            # dist is that travel against the longest of them, and the
            # stylesheet spends it on duration. mass is the part's area against
            # the body it came off, and the stylesheet spends it on how much a
            # part is allowed to overshoot: heavy things settle, light things
            # ring.
            #
            # arcpx is how far off the straight line the part swings on the way.
            # Nothing alive travels in a straight line between two points, and
            # every one of these did.
            dist = min(1.0, math.hypot(dx, dy) / 24.0)
            mass = min(1.0, (q["w"] * q["h"]) / (lead["w"] * lead["h"]))
            style += (";--gx:%.2fpx;--gy:%.2fpx;--gs:%.3f"
                      ";--dist:%.3f;--mass:%.3f;--arcpx:%.2fpx"
                      % (dx, dy, fit, dist, mass,
                         (1.6 + dist * 3.4) * (1.32 - mass)))
        style += ";--i:%d" % order[id(q)]
        if q["alpha"] < 1:
            style += ";--a:%g" % q["alpha"]
        # The body is marked as such. It behaves differently from the parts
        # that leave it -- it stays where it is and relaxes, where they travel
        # -- and a stylesheet cannot pick an element out by the value of a
        # custom property, so it has to be said in an attribute.
        # aria-hidden because these carry no meaning read aloud: each one is
        # a masked rectangle, and <i> is a tag some screen readers announce as
        # emphasis. The register's number beside them stays readable -- it is
        # visible content, not decoration.
        out.append('<i aria-hidden="true"%s style="%s"></i>'
                   % (" data-lead" if q is lead else "", style))
    return "".join(out), span, bw


SECTIONS = [
    ("Ventures", "sea", "Companies I have helped found and build.", [
        ("2023 – present", "Memcara",
         "Cofounder and Chief AI Officer of Memcara, building AI-enabled tools for "
         "caregiving in long-term care facilities. I joined as a researcher in 2023 "
         "and moved into the cofounder and CAIO role to help the company grow its "
         "AI offerings.",
         "memcara.png", [
             ("https://memcara.com/", "memcara.com"),
             ("https://doi.org/10.1145/3770687", "CareInsights (IMWUT 2025)"),
             ("https://doi.org/10.1145/3757599", "Family In The Loop (CSCW 2025)"),
             (None, "CareWare: Caregiver Smart Glasses (CHI 2026 submission)"),
         ]),
        ("2025–26", "Companion IQ",
         "Cofounder and Chief AI Officer of Companion IQ, a startup building AI "
         "tools for person-centered dementia care. Our first product is a dashboard "
         "that gives long-term care staff insight into the needs and experiences of "
         "residents with dementia. We are piloting it at several facilities across "
         "the country, and have raised $1M in seed funding.",
         "companion_iq.png", [("https://companioniq.org/", "companioniq.org")]),
    ]),

    ("Research", "dusky", "Peer-reviewed work in human-AI interaction.", [
        ("2025", "CareInsights: AI-Enabled Infrastructure for Person-Centered Dementia Care",
         "Our paper \"CareInsights: AI-enabled Infrastructure for Person-centered "
         "Dementia Care in Resource-constrained Facilities\" was accepted at IMWUT "
         "2025.",
         "imwut.jpg", [("https://doi.org/10.1145/3770687", "doi.org/10.1145/3770687")]),
        ("2025", "Family In The Loop",
         "I presented the paper \"Family In The Loop: Enabling Family Involvement "
         "and Person-Centered Dementia Care at Long-Term Care Facilities with "
         "Collaborative AI Tools\" at CSCW 2025.",
         "cscw_2025.jpg", [("https://doi.org/10.1145/3757599", "doi.org/10.1145/3757599")]),
        ("2025", "Collaborative Meaning-Making in Networked Learning Environments",
         "I presented an early sketch of a new learnersourcing framework I developed "
         "at Learning @ Scale 2025.",
         "sparc.png", [
             ("https://drive.google.com/file/d/1TVCfHRdtLEJM3IYrlXAvKvqVbp0DoYXf/view", "Read the paper"),
         ]),
        ("2024", "Teaching AI in Extracurricular Contexts Through Narrative-Based Learnersourcing",
         "I was first author on the paper \"Teaching artificial intelligence in "
         "extracurricular contexts through narrative-based learnersourcing\" at "
         "CHI 2024.",
         "chi2024.jpg", [
             ("https://doi.org/10.1145/3613904.3642198", "doi.org/10.1145/3613904.3642198"),
         ]),
    ]),

    ("Industry", "red", "Software engineering before my PhD.", [
        ("2021", "Software Engineer, YouTube",
         "I worked at YouTube, within Google, from March to August 2021, as a "
         "software engineer on the Paid Digital Goods team. I was part of the "
         "dozen-person team that built \"Super Thanks\", which lets viewers support "
         "a creator directly on any video, provided the creator enables it and the "
         "video is eligible for monetization.",
         "youtube.jpg", [
             ("https://support.google.com/youtube/answer/10879035?hl=en/", "About Super Thanks"),
         ]),
        ("2018\u201321", "Software Engineer, Lark Health",
         "I worked at Lark Health from October 2018 to February 2021. For my first "
         "year I was one of only two mobile developers; by the time I left, the "
         "company had tripled in headcount and raised a $70 million Series C. Lark "
         "is the world's largest AI healthcare provider, serving patients who have "
         "or are at risk of chronic disease through AI nurses.",
         "lark.jpg", [("https://www.lark.com/", "lark.com")]),
        ("2015\u201316", "Software Engineering Intern, Google",
         "Two internships, on the AdWords (Dart/Angular) and Knowledge Graph (Java/C++) teams.",
         "google_big_g.jpg", []),
        ("2014", "Software Engineering Intern, PayPal",
         "I designed and implemented a dashboard and other internal tools as an "
         "intern on the Core Payments Team.",
         "paypal.jpg", [("https://www.paypal.com/", "paypal.com")]),
        ("2011", "Mechanical Engineering Intern, Makani Power (now Google X)",
         "I helped manufacture high-altitude wind turbines and self-guided kites, "
         "working in SolidWorks and on the tools in the workshop.",
         "makani.jpg", []),
    ]),

    ("Leadership and Teaching", "yellow",
     "Eleven quarters as a TA at Stanford and Dartmouth, plus workshops, mentoring, and "
     "student leadership.", [
        ("", "Teaching Assistant, Stanford and Dartmouth",
         "I was a TA for nine quarters at Stanford and two at Dartmouth, and "
         "received the Stanford Teaching Honors Award in 2017. The links below cover "
         "each of the courses I staffed.",
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
         "Over the summer of 2021 I advised on the AI and CS curriculum for a new "
         "TUMO initiative: a fast track for upskilling young Armenian professionals "
         "entering industry. The project was sponsored by the European Union for "
         "Armenia, among other organizations.",
         "TUMO_self_learning.jpg", [
             ("https://drive.google.com/file/d/1_KH2EF2khd-DpXSC7J_QXCuShonzYoPi/view?usp=sharing",
              "About the Initiative"),
         ]),
        ("2021", "Mentor, UC Berkeley Fung Fellowship",
         "I built a partnership between AbilityHacks and the Fung Fellowship, "
         "U.C. Berkeley’s entrepreneurship and innovation program. As a sponsor "
         "mentor I advised two student teams building technology to help people with "
         "visual impairments navigate cities.",
         "fung_fellowship.jpg", [("https://fungfellows.berkeley.edu/", "About the Fung Fellowship")]),
        ("2020", "Mentor, Stanford CS + Social Good",
         "I was Lark\u2019s representative for a two-quarter design studio at "
         "Stanford\u2019s CS + Social Good, mentoring students on d.school methods and "
         "how to build technical projects that matter. I later organized a "
         "partnership between AbilityHacks and CS + Social Good, and returned as a "
         "mentor in the 2021 winter and spring quarters.",
         "cs_plus_social_good.jpg", [
             ("https://cs4good.com/", "cs4good.com"),
             ("https://docs.google.com/document/d/1Sho3fEUPPFG2NbKfBUgJ3uH0ujKJiraKH_wfB_t1vOw/edit?usp=sharing",
              "My challenge statement"),
         ]),
        ("2020", "Section leader, Code in Place",
         "I was a section leader (TA) for Code in Place, a free, open-enrollment "
         "version of Stanford\u2019s introductory CS course, built for the "
         "circumstances of the COVID-19 pandemic.",
         "code_in_place copy.jpg", [
             ("https://www.stanforddaily.com/2020/03/31/stanford-to-offer-free-online-cs-class-during-pandemic/",
              "About the course"),
         ]),
        ("2014", "E-Challenge Coordinator, BASES",
         "I planned the E-Challenge, a $150k startup competition.",
         "bases-2.jpg", [("http://bases.stanford.edu/", "bases.stanford.edu")]),
        ("", "Junior Class President, Stanford",
         "I attended administrative meetings and planned campus-wide events, "
         "including our class formal on a boat and Full Moon on the Quad.",
         "class_president copy.jpg", [
             ("https://assu.stanford.edu/leadership/class-presidents", "About the role"),
         ]),
        ("2012\u201316", "Founding member, Stanford Competitive Running Club",
         "I helped found the club and have been part of the Stanford running "
         "community since 2012, competing in NIRCA national club championships, an "
         "Ironman triathlon, and hundred-mile relays.",
         "running_club.jpg", [("https://running.stanford.edu/index.html", "The club")]),
    ]),

    ("Recognition", "blue", "Awards, grants, and fellowships.", [
        ("2025", "Rilla NYC Hackathon, winner",
         "Our three-person team took first place.",
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
         "high-speed photography of neon signs. The work also won an American Vacuum "
         "Society Award and a full-tuition scholarship to Drexel University.",
         "isef.jpg", []),
    ]),

    ("Earlier work", None,
     "Projects and research from my time at Stanford.", [
        ("", "Facet",
         "Corporate meetings are often inefficient and biased, which my CS210 senior "
         "project team confirmed through user research at large software companies: "
         "\"too many inefficient and biased meetings\" was a frequent complaint. We "
         "built Facet, a smart assistant that facilitates and analyzes them.",
         "facet_circle.jpg", []),
        ("", "NavCog and AbilityHacks",
         "With AbilityHacks I did HCI research and engineering on disability-related "
         "challenges, leading the continuation of NavCog \u2014 a project that began "
         "in CMU\u2019s Cognitive Assistance Laboratory and passed to AbilityHacks in "
         "2020.",
         "navcog.jpg", [("https://www.cs.cmu.edu/~NavCog/navcog.html", "CMU NavCog documentation")]),
        ("", "Smart Primer",
         "Early work under Dr. James Landay on the Smart Primer Project, a "
         "tablet-based intelligent tutoring system for children that draws on "
         "narrative, chatbots, real-world activities, and a child\u2019s physical and "
         "educational context.",
         "smart_primer_circle.jpg", [("https://hci.stanford.edu/research/smartprimer/", "Project page")]),
        ("", "Creativity boosting environments in cars",
         "Research with the Volkswagen Automotive Innovation Lab at Stanford, with "
         "Dr. Elizabeth Murnane and Dr. James Landay, on increasing creativity "
         "during the daily commute. It investigated how in-car agents might guide "
         "drivers and passengers through creative activities and draw out new ideas, "
         "safely and enjoyably.",
         "creative_drive.jpg", [
             ("https://drive.google.com/open?id=1QAo-l2LvOR3CTVji52s4gCmRvb-r_Ri0", "Documentation"),
         ]),
        ("", "Adversarial Examples for NLP Contexts",
         "My colleague and I developed two methods for generating adversarial "
         "examples for an NLP task, including a new loss function for training word "
         "vectors in a CBOW model. Final project for both CS221 (Artificial "
         "Intelligence: Principles and Techniques) and CS224N (Natural Language "
         "Processing with Deep Learning).",
         "adversarial2.jpg", [
             ("https://drive.google.com/file/d/1U_g5SAsvcWB3Md4bHveYfyaY2sj2H28H/view?usp=sharing", "Paper"),
         ]),
        ("", "Visuomotor Learning: Object Classification",
         "My team built a CNN for Amazon's robotic-arm pick-and-place task. It "
         "trains on large amounts of generated data \u2014 multiple camera angles, "
         "many scenes \u2014 to improve existing models on the real task through "
         "transfer learning. Final project for CS230 (Deep Learning).",
         "robot_arm3.jpg", [
             ("https://drive.google.com/open?id=1yI4C4Y-0tSd0WSVDIi_A6twL08Q5agwt", "Paper"),
         ]),
        ("", "Video tagging using frame captions",
         "My team extended state-of-the-art CNN image captioning to a "
         "video tagging task. Final project for CS229 (Machine Learning).",
         "video_tagging.jpg", [
             ("https://drive.google.com/file/d/17dVfAEMQJUmjsYnHHc8fcsAJB3EPpyLk/view?usp=sharing", "Paper"),
         ]),
        ("", "Finding protests in social media",
         "My team used CNNs to identify protest images on Chinese social media that "
         "are likely to be censored. Final project for CS224N (Natural Language Processing with Deep Learning).",
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
         "moments. Final project for CS247 (Human-Computer Interaction Design Studio).",
         "pensieve4.jpg", [
             ("https://drive.google.com/open?id=1b868SNDfESTWQaKP7j5MFI38Np8WMzNB", "Documentation"),
         ]),
        ("", "Rally",
         "My team made a mobile web app for people to connect with friends and plan "
         "activities. Final project for CS147 (Introduction to Human-Computer Interaction Design).",
         "rally.jpg", [
             ("https://www.facebook.com/gorallyme/", "Facebook page"),
             ("https://www.youtube.com/watch?v=yIQWqWPzu5Q", "Promo video"),
         ]),
        ("", "A general game playing agent",
         "My team made a Java prop net GGP player with performance boosts from "
         "factoring and latches. This program made it to the semifinals of the end "
         "of year class competition. Final project for CS227B (General Game Playing).",
         "chess_piece2.jpg", [
             ("https://drive.google.com/open?id=1hXBl_rZFLuCw9mlUidw-T7yNCffwIruM", "Documentation"),
         ]),
        ("", "CS106B Recursion Competition, Grand Prize",
         "Connect Four with an AI opponent \u2014 my freshman-year entry to the 2013 competition in "
         "CS106B (Programming Abstractions).",
         "connect_four3.jpg", []),
        ("", "CS106A Graphics Competition, Grand Prize",
         "A platform for creating, manipulating, and visualizing multidimensional shapes \u2014 my "
         "freshman-year entry to the 2012 competition in CS106A (Programming Methodology).",
         "shape3.jpg", [
         ]),
        ("", "Stanford Change Labs: water catchment for rural India",
         "Mechanical engineering and design research with the 100 Liter Water "
         "Project at Stanford Change Labs, where I designed a sun-tracking solar "
         "power supply.",
         "water_catchment.jpg", []),
        ("", "Archaeology research at Chav\u00edn de Hu\u00e1ntar",
         "Stanford researcher on a small team that located a buried ceremonial chamber over 2,500 "
         "years old at a UNESCO World Heritage site in the Peruvian Andes. 700+ hours of field and "
         "lab work.",
         "peru2.jpg", [("https://flic.kr/s/aHsmoRkNyK", "Photographs")]),
        ("", "Sustainable Amazon ecotourism",
         "60+ hours of interviews with experts and members of Quechua and Waorani communities in "
         "the Amazon basin and cloud forests of Ecuador, supported by Stanford BOSP and Dr. "
         "Margaret Fuller.",
         "sani_circle.jpg", [
             ("https://flic.kr/s/aHsmhuokSW", "Photographs"),
             ("https://drive.google.com/open?id=18Yaw3LSDo2pG5H3smf8U4JckkxPxOeIb", "Research recommendations"),
         ]),
        ("", "Call center audio transcription and analytics",
         "I built the audio transcription and conversation analytics prototype for "
         "an early-stage political polling startup.",
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
        body, span, markw = mark_parts(tone)
        parts.append('            <span class="section-index" data-mark="%s" '
                     'style="--span:%.3f;--mark-w:%.2fpx">'
                     '<span class="section-index-n">%02d</span>%s</span>'
                     % (MARK_OF.get(tone, "earlier"), span, markw, idx, body))
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


V = "v=20260825g"
HEAD = """<!doctype html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Portfolio &mdash; Dylan Edward Moore</title>
    <meta name="description" content="Ventures, research, industry work, teaching, and awards by Dylan Edward Moore.">
    <link rel="icon" type="image/x-icon" href="../assets/img/icon/dem_mark.ico?{V}">
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
    <script src="../assets/js/hoverfill.js?{V}"></script>
    <script src="../assets/js/figures.js?{V}"></script>
    <script src="../assets/js/drag.js?{V}"></script>
    <script src="../assets/js/marks.js?{V}"></script>
    <script src="../assets/js/idle.js?{V}"></script>
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
