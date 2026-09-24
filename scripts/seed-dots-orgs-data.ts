// Static content for scripts/seed-dots-orgs.ts — communities and businesses.
// Every business is fictional on purpose (invented names, `.example` domains,
// made-up street addresses) so seeded data never impersonates a real one.
// `match` is tested against a seeded dot's bio ("<Title> at <Company> · 📍 <City>. ...")
// to pick owners/members whose profile fits the community or business.

export type CommunitySeed = {
  slug: string;
  name: string;
  description: string;
  visibility: "public" | "restricted" | "private";
  tags: string[];
  match: RegExp;
  size: [number, number]; // member count range
  rules: [string, string][];
  posts: string[];
};

export const COMMUNITIES: CommunitySeed[] = [
  {
    slug: "desi_devs",
    name: "Desi Devs",
    description: "Engineers, data folks and tinkerers building software from India. Code reviews, career questions, side projects and weekend hackathons.",
    visibility: "public",
    tags: ["tech", "education"],
    match: /Engineer|Developer|Data|ML|Analytics/i,
    size: [30, 48],
    rules: [
      ["Be kind in code reviews", "Critique the code, never the person."],
      ["No recruiter spam", "Job posts go in the weekly thread only."],
      ["Show your work", "Questions get better answers with a snippet or repro."],
    ],
    posts: [
      "Weekly thread: what are you building this weekend? I'm finally rewriting my side project's auth in a saner way.",
      "Hot take: most 'microservices' at small startups are just a distributed monolith with extra latency. Change my mind.",
      "Just crossed 100 stars on my first open-source library. The trick was writing the README before the code.",
      "Question: how do you all handle on-call without burning out? Our rotation is 1 week in 4 and it's rough.",
      "Sharing my notes from a system design study group — happy to run another batch if there's interest.",
    ],
  },
  {
    slug: "product_chai",
    name: "Product Chai",
    description: "Product managers and designers swapping notes over virtual chai. Roadmaps, research, metrics and the occasional rant about stakeholder alignment.",
    visibility: "public",
    tags: ["business", "design", "tech"],
    match: /Product|Design|PM\b|UX/i,
    size: [22, 38],
    rules: [
      ["No confidential info", "Talk patterns, not your employer's unreleased roadmap."],
      ["Give context", "Say the stage and size of your product when asking for advice."],
    ],
    posts: [
      "What's your favourite way to say no to a feature request without losing the relationship?",
      "We killed a feature nobody used and NPS went UP. Deleting code is underrated.",
      "Designers: how do you hand off to engineers when the sprint is already halfway through?",
      "Sharing a one-page PRD template that has survived three companies. Reply if you want it.",
    ],
  },
  {
    slug: "chai_and_lens",
    name: "Chai & Lens",
    description: "A friendly home for photographers and filmmakers across India. Share your frames, ask for critique and plan photo walks together.",
    visibility: "public",
    tags: ["photography", "art", "travel"],
    match: /Photograph|Visual Storyteller|Filmmaker|Cinematograph|Video/i,
    size: [20, 34],
    rules: [
      ["Credit the photographer", "Always tag and credit; no reposting without permission."],
      ["Constructive critique only", "Say what works before what doesn't."],
      ["Post the story", "One line about where and how you shot it."],
    ],
    posts: [
      "Golden hour at the ghats this morning. 35mm, f/2.8, no edits besides a small curve. What would you change?",
      "Photo walk in Old Delhi this Sunday, 6:30am start. Chai after. Who's in?",
      "Prime lens or zoom for street? I keep going back and forth. My 50mm makes me lazy about moving my feet.",
      "Monsoon shots are the best shots. Reflections everywhere. Drop your favourite rain frame below.",
    ],
  },
  {
    slug: "lekhak_circle",
    name: "Lekhak Circle",
    description: "For anyone who writes — journalism, fiction, essays, newsletters. Weekly prompts, honest feedback and no judgement.",
    visibility: "public",
    tags: ["writing", "news", "education"],
    match: /Writer|Journalist|Editor|Columnist|Storyteller/i,
    size: [16, 28],
    rules: [
      ["Feedback is a gift", "Be specific and kind."],
      ["No plagiarism", "Post only what you wrote."],
    ],
    posts: [
      "Prompt of the week: write about the last train you missed. 300 words max.",
      "I've been writing daily for 60 days. The habit matters more than the quality, at least at the start.",
      "How do you decide when a draft is done? I can edit forever.",
    ],
  },
  {
    slug: "desi_kitchen_diaries",
    name: "Desi Kitchen Diaries",
    description: "Regional recipes, street food, home baking and honest restaurant finds. Every state, every kitchen, every grandmother's secret.",
    visibility: "public",
    tags: ["food", "hobbies"],
    match: /Chef|Food|Baker|Culinary/i,
    size: [24, 40],
    rules: [
      ["Share the recipe", "If you post a dish, add the method or a link."],
      ["Respect every cuisine", "No fights about whose biryani is better. (Okay, some fights.)"],
    ],
    posts: [
      "Made my nani's kadhi today — the secret is patience and a properly sour curd. Recipe in the comments.",
      "Sourdough with a masala twist worked better than expected. Methi thepla loaf, anyone?",
      "Best street food in your city? I'll start: Chaat in Lucknow, no contest.",
      "Tips for getting dosa batter to ferment in winter? Mine refuses to cooperate.",
    ],
  },
  {
    slug: "sunrise_yoga_strength",
    name: "Sunrise Yoga & Strength",
    description: "Early risers, yogis and lifters. Daily accountability, form checks and beginner-friendly routines.",
    visibility: "public",
    tags: ["fitness", "hobbies"],
    match: /Fitness|Yoga|Strength|Wellness|Coach|Athlete/i,
    size: [18, 30],
    rules: [
      ["No medical advice", "Talk to a doctor for injuries."],
      ["Be encouraging", "Everyone starts somewhere."],
    ],
    posts: [
      "Day 30 of the 5:30am club. It's not motivation, it's just a boring routine that works.",
      "Beginner tip: master the bodyweight squat before touching a barbell. Your knees will thank you.",
      "Yoga for desk workers — a 10 minute sequence I use between meetings. Sharing below.",
    ],
  },
  {
    slug: "cricket_adda",
    name: "Cricket Adda",
    description: "Match-day chatter, tactics, coaching tips and local-league stories. Gully to stadium, it all counts.",
    visibility: "public",
    tags: ["sports", "entertainment"],
    match: /Cricket|Athlete|Sports|Kabaddi|Coach/i,
    size: [28, 46],
    rules: [
      ["No spoilers without a warning", "Use the Spoiler flair for live match results."],
      ["Banter, not abuse", "Rivalries are fun; personal attacks are not."],
    ],
    posts: [
      "Who's your pick for the finisher role? Reliable at the death is rarer than a big hitter.",
      "Our local league final is tomorrow. Nerves worse than an actual match day!",
      "Coaching tip for juniors: fewer nets sessions, more match simulations. Skill under pressure is its own skill.",
      "Underrated: a good fielding unit wins more games than an extra 20 runs.",
    ],
  },
  {
    slug: "startup_katta",
    name: "Startup Katta",
    description: "Founders and early team members sharing the honest side of building in India — fundraising, hiring, compliance and grit.",
    visibility: "public",
    tags: ["business", "finance", "tech"],
    match: /Founder|Co-founder|CEO|CTO|Marketing|Growth/i,
    size: [18, 30],
    rules: [
      ["Honest numbers only", "Vanity metrics get called out, lovingly."],
      ["Give before you ask", "Introductions and help are welcome, cold pitches are not."],
    ],
    posts: [
      "First 10 customers came from WhatsApp groups and personal calls. Nothing scalable, everything valuable.",
      "Hiring lesson: a slow no beats a fast yes to the wrong person. Learned the hard way.",
      "GST filing is the most 'grown-up' thing about running a company. What tools do you use to keep it sane?",
    ],
  },
  {
    slug: "rupee_wise",
    name: "Rupee Wise",
    description: "Personal finance, tax and investing in plain language for Indians. Educational discussion only — not investment advice.",
    visibility: "public",
    tags: ["finance", "education"],
    match: /Accountant|Financial|Investment|Tax|Finance/i,
    size: [16, 28],
    rules: [
      ["Educational only", "Nothing here is investment advice."],
      ["No stock tips or referral links", "Posts pushing products get removed."],
    ],
    posts: [
      "Reminder: an emergency fund of 6 months' expenses before any investing. Boring, correct.",
      "Old vs new tax regime — I built a simple comparison sheet. Happy to share the method, not the advice.",
      "Index funds explained in one paragraph: own a slice of the whole market, pay less, wait longer.",
    ],
  },
  {
    slug: "sur_aur_taal",
    name: "Sur aur Taal",
    description: "Musicians, producers and listeners. Classical, film, indie and everything in between. Jam invites, gear talk and new releases.",
    visibility: "public",
    tags: ["music", "art", "entertainment"],
    match: /Music|Singer|Producer/i,
    size: [16, 28],
    rules: [
      ["Tag your genre", "Helps everyone find what they love."],
      ["Original work only", "Covers are welcome if credited."],
    ],
    posts: [
      "Just finished a lo-fi remix of an old Kishore Kumar classic. Would love ears on the mix.",
      "Riyaz tip: slow practice with a tanpura app beats hours of fast, sloppy runs.",
      "Looking for a tabla player for a small weekend gig in Pune. DM me!",
    ],
  },
  {
    slug: "campus_connect",
    name: "Campus Connect",
    description: "Students, teachers and mentors helping each other with exams, internships, projects and careers.",
    visibility: "public",
    tags: ["education", "tech"],
    match: /Student|Teacher|Professor|Educator|Principal|Intern/i,
    size: [26, 42],
    rules: [
      ["Help, don't cheat", "Explain concepts; never share exam answers."],
      ["Respect everyone's stage", "First-years and PhDs are equally welcome."],
    ],
    posts: [
      "Internship season tips: apply broadly, follow up politely, and treat every interview as practice.",
      "Can someone explain dynamic programming without the usual textbook example? I keep getting lost.",
      "Study group for the upcoming semester exams — comment your subject and we'll form small groups.",
      "Teachers: what's one small thing that changed how your class runs? Mine: ending each session with a question.",
    ],
  },
  {
    slug: "indie_cinema_club",
    name: "Indie Cinema Club",
    description: "Watch, discuss and make independent films. Weekly screenings, script feedback and crew calls.",
    visibility: "public",
    tags: ["entertainment", "art", "photography"],
    match: /Film|Cinematograph|Video|Documentary/i,
    size: [16, 26],
    rules: [
      ["Spoiler tags please", "Mark spoilers for the first two weeks."],
      ["Credit your crew", "Everyone who worked on it gets named."],
    ],
    posts: [
      "This week's watch: a quiet Malayalam drama that says more in silence than most films do in dialogue.",
      "Looking for a sound recordist for a 12-minute short shooting in Kolkata next month. Paid, small crew.",
      "Sharing my rough cut for feedback: does the second act drag or is it just me?",
    ],
  },
  {
    slug: "doodle_desk",
    name: "Doodle Desk",
    description: "Illustrators, painters and digital artists. Daily sketches, art challenges and gentle feedback.",
    visibility: "public",
    tags: ["art", "design", "hobbies"],
    match: /Illustrator|Artist|Painter|Designer|Design/i,
    size: [16, 28],
    rules: [
      ["Credit references", "Always link inspiration and reference photos."],
      ["No AI-only posts", "Human-made work is the point here."],
    ],
    posts: [
      "Inktober is coming. Who's joining? Let's make a shared prompt list.",
      "Watercolour tip: let the first wash dry completely. Patience is the whole technique.",
      "Finished my first digital piece after years of pencils. The undo button is dangerous.",
    ],
  },
  {
    slug: "founders_circle",
    name: "Founders Circle",
    description: "Invite-only. A small, private room for founders to talk openly about fundraising, layoffs, burnout and everything the timeline doesn't show.",
    visibility: "restricted",
    tags: ["business"],
    match: /Founder|Co-founder|CEO|CTO/i,
    size: [8, 12],
    rules: [
      ["What's said here stays here", "Chatham House rule, always."],
      ["No pitching", "This is a peer group, not a deal room."],
    ],
    posts: [
      "Honest question: how do you tell your co-founder the pace isn't sustainable?",
      "We had our first payroll scare last month. Sharing what I'd do differently — mostly, keep 6 months of runway sooner.",
    ],
  },
];

export type BusinessSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  city: string;
  address: string;
  foundedYear: number;
  sizeRange: string;
  verified: boolean;
  match: RegExp; // owner picker
  hours: [string, string];
  days: string[];
  offerings: { kind: "product" | "service"; name: string; description: string; price: number | null; stock?: string }[];
  posts: string[];
  job?: { title: string; type: string; description: string; remote: boolean; min: number; max: number };
};

export const BUSINESSES: BusinessSeed[] = [
  {
    slug: "masala_lane_cafe",
    name: "Masala Lane Café",
    tagline: "Slow chai, fast conversations.",
    description: "A neighbourhood café serving hand-pounded masala chai, fresh baked bun maska and an all-day breakfast menu. Board games on the shelf, Wi-Fi on the house.",
    category: "restaurant_food",
    city: "Pune",
    address: "14, Lane 5, Koregaon Park, Pune",
    foundedYear: 2019,
    sizeRange: "11_50",
    verified: true,
    match: /Chef|Food|Baker|Culinary/i,
    hours: ["08:00", "23:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    offerings: [
      { kind: "product", name: "Masala Chai (kulhad)", description: "Ginger, cardamom and a pinch of black pepper, served in a clay kulhad.", price: 60, stock: "made_to_order" },
      { kind: "product", name: "Bun Maska Basket", description: "Two soft buns with generous white butter, best with chai.", price: 120, stock: "made_to_order" },
      { kind: "product", name: "House Chai Masala (200g)", description: "Our signature blend, ground weekly.", price: 240, stock: "in_stock" },
      { kind: "service", name: "Private Table Booking (up to 8)", description: "Reserve the corner table for birthdays and small meetups.", price: null },
    ],
    posts: [
      "New on the menu this week: cardamom cold brew. Come try it before it sells out!",
      "Board game night this Friday from 7pm. Bring a friend, we'll bring the chai.",
      "Thank you for 5 wonderful years, Pune. Free cutting chai for everyone this Sunday morning ☕",
    ],
    job: { title: "Barista (Part-time)", type: "part_time", description: "Weekend shifts, training provided. Love for chai a must.", remote: false, min: 12000, max: 16000 },
  },
  {
    slug: "pranayama_studio",
    name: "Pranayama Studio",
    tagline: "Yoga and strength for real, busy lives.",
    description: "Small-batch yoga, mobility and strength classes with certified instructors. Beginner friendly, no mirrors, no judgement.",
    category: "health_wellness",
    city: "Bengaluru",
    address: "27, 12th Main, Indiranagar, Bengaluru",
    foundedYear: 2021,
    sizeRange: "2_10",
    verified: true,
    match: /Fitness|Yoga|Strength|Wellness/i,
    hours: ["06:00", "20:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "Drop-in Class", description: "60 minute group class, all levels.", price: 500 },
      { kind: "service", name: "Monthly Membership", description: "Unlimited group classes for a month.", price: 3500 },
      { kind: "service", name: "Private 1:1 Session", description: "Personalised session with an instructor.", price: 1500 },
    ],
    posts: [
      "Morning batch is now open at 6am! Limited to 10 people so everyone gets attention.",
      "Reminder: mobility work isn't a warm-up, it's the workout. Try our new Saturday flow class.",
    ],
  },
  {
    slug: "kaagaz_print_design",
    name: "Kaagaz Print & Design",
    tagline: "Branding and print that people actually keep.",
    description: "Design studio and print shop for small businesses: logos, packaging, brochures, menus and everything on paper.",
    category: "media_marketing",
    city: "Delhi",
    address: "Shop 9, Lajpat Market, New Delhi",
    foundedYear: 2016,
    sizeRange: "2_10",
    verified: false,
    match: /Marketing|Brand|Design|Visual|Illustrator|Artist/i,
    hours: ["10:00", "19:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "Logo & Brand Kit", description: "Logo, colour palette, typography and a one-page brand guide.", price: 15000 },
      { kind: "service", name: "Menu & Brochure Design", description: "Print-ready layout with two revision rounds.", price: 6000 },
      { kind: "product", name: "Business Cards (100)", description: "350gsm matte, both sides printed.", price: 450, stock: "made_to_order" },
      { kind: "service", name: "Packaging Design", description: "Custom packaging for small product brands.", price: null },
    ],
    posts: [
      "Before / after: a neighbourhood bakery's new packaging. Swipe to see the old one 👀",
      "Diwali print orders are open. Book your slots early — we sell out every year.",
    ],
  },
  {
    slug: "tarang_music_academy",
    name: "Tarang Music Academy",
    tagline: "Learn music the way it's meant to be learned.",
    description: "Hindustani vocal, tabla, guitar and keyboard lessons for children and adults. Small batches, monthly recitals.",
    category: "education",
    city: "Kolkata",
    address: "3B, Gariahat Road, Kolkata",
    foundedYear: 2014,
    sizeRange: "11_50",
    verified: true,
    match: /Music|Singer|Producer|Teacher/i,
    hours: ["11:00", "20:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    offerings: [
      { kind: "service", name: "Vocal Lessons (monthly, 8 classes)", description: "Hindustani classical and light music, individual attention.", price: 3200 },
      { kind: "service", name: "Guitar for Beginners", description: "From first chord to first song in 12 weeks.", price: 3600 },
      { kind: "service", name: "Tabla Foundation Course", description: "Taal, theka and basic compositions.", price: 3000 },
    ],
    posts: [
      "Our students' annual recital is on the 14th! Free entry, all are welcome.",
      "Admissions open for the next batch. Trial class is always free.",
    ],
    job: { title: "Keyboard Instructor", type: "part_time", description: "Evening batches, 3 days a week. Grade 6 or equivalent preferred.", remote: false, min: 15000, max: 22000 },
  },
  {
    slug: "lens_and_loom",
    name: "Lens & Loom Studios",
    tagline: "Weddings, portraits and brand films.",
    description: "A small team of photographers and film editors. We shoot honest, unposed stories and edit them with care.",
    category: "entertainment_events",
    city: "Mumbai",
    address: "Studio 2, Versova, Mumbai",
    foundedYear: 2018,
    sizeRange: "2_10",
    verified: false,
    match: /Photograph|Filmmaker|Cinematograph|Video|Visual Storyteller/i,
    hours: ["10:00", "18:00"],
    days: ["mon", "tue", "wed", "thu", "fri"],
    offerings: [
      { kind: "service", name: "Wedding Photography (1 day)", description: "Two photographers, 400+ edited photos, online gallery.", price: 65000 },
      { kind: "service", name: "Portrait Session", description: "90 minute shoot, 20 edited photos.", price: 6500 },
      { kind: "service", name: "Brand Film (60–90s)", description: "Concept, shoot and edit for your product or story.", price: null },
    ],
    posts: [
      "A quiet moment from last weekend's wedding. Sometimes the best shot is between the shots.",
      "Limited portrait slots this month. DM to book.",
    ],
  },
  {
    slug: "nirmaan_tech_labs",
    name: "Nirmaan Tech Labs",
    tagline: "Software that ships, for teams that can't wait.",
    description: "Product engineering studio building web and mobile apps for startups. Fixed-scope sprints, transparent pricing, clean handoff.",
    category: "technology",
    city: "Hyderabad",
    address: "Level 4, Madhapur Tech Park, Hyderabad",
    foundedYear: 2020,
    sizeRange: "11_50",
    verified: true,
    match: /Founder|Engineer|Developer|CTO|Product/i,
    hours: ["09:30", "18:30"],
    days: ["mon", "tue", "wed", "thu", "fri"],
    offerings: [
      { kind: "service", name: "MVP in 6 Weeks", description: "Scoped web or mobile MVP with weekly demos.", price: 450000 },
      { kind: "service", name: "Cloud Cost Audit", description: "We find and fix the waste in your cloud bill.", price: 60000 },
      { kind: "service", name: "Engineering Retainer", description: "Dedicated engineers embedded in your team.", price: null },
    ],
    posts: [
      "We just shipped an MVP in five weeks for a fintech founder. Lessons on scoping in our blog soon.",
      "We're hiring! Backend engineers with a taste for boring, reliable systems.",
    ],
    job: { title: "Backend Engineer", type: "full_time", description: "Node or Python, Postgres, a preference for simple designs.", remote: true, min: 1800000, max: 3000000 },
  },
  {
    slug: "sahayak_tax_accounts",
    name: "Sahayak Tax & Accounts",
    tagline: "GST, ITR and books, without the headache.",
    description: "Chartered accountants helping freelancers and small businesses with GST returns, income tax, bookkeeping and compliance.",
    category: "professional_services",
    city: "Ahmedabad",
    address: "402, Ashram Road, Ahmedabad",
    foundedYear: 2012,
    sizeRange: "2_10",
    verified: false,
    match: /Accountant|Tax|Financial|Investment|Finance/i,
    hours: ["10:00", "19:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "Individual ITR Filing", description: "Salaried and freelance income, with capital gains support.", price: 1500 },
      { kind: "service", name: "Monthly GST Filing", description: "Return preparation and filing for one GSTIN.", price: 1200 },
      { kind: "service", name: "Bookkeeping (monthly)", description: "Books maintained and reconciled, with a monthly summary.", price: null },
    ],
    posts: [
      "Reminder: advance tax due dates are close. Book a review before the last week rush.",
      "Freelancers: yes, you can claim your home-office costs. Here's what qualifies.",
    ],
  },
  {
    slug: "vidya_path_tutors",
    name: "Vidya Path Tutors",
    tagline: "Concepts first. Marks follow.",
    description: "Small-group coaching for classes 8–12 in mathematics, science and English. Weekly tests, monthly parent updates.",
    category: "education",
    city: "Nashik",
    address: "12, College Road, Nashik",
    foundedYear: 2017,
    sizeRange: "2_10",
    verified: false,
    match: /Teacher|Educator|Professor|Principal/i,
    hours: ["15:00", "20:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "Class 10 Maths & Science (monthly)", description: "Small batch of 8 students, weekly test.", price: 2500 },
      { kind: "service", name: "Class 12 Physics (monthly)", description: "Board exam focused, with doubt-clearing hours.", price: 3000 },
      { kind: "service", name: "Spoken English Course", description: "8-week course for confidence and fluency.", price: 4000 },
    ],
    posts: [
      "New batches for the coming session start next Monday. Seats are limited to 8 per batch.",
      "A tip for board exams: solve one previous-year paper every Sunday under timed conditions.",
    ],
  },
  {
    slug: "grihasetu_realty",
    name: "Grihasetu Realty",
    tagline: "Finding homes, not just flats.",
    description: "Neighbourhood real estate advisors for buying, renting and selling homes, with honest advice on paperwork and pricing.",
    category: "real_estate",
    city: "Gurugram",
    address: "Office 18, Sector 29, Gurugram",
    foundedYear: 2015,
    sizeRange: "11_50",
    verified: false,
    match: /Founder|Marketing|Finance|Manager|Analyst/i,
    hours: ["10:00", "19:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "Home Search Assistance", description: "Shortlist, visits and negotiation support.", price: null },
      { kind: "service", name: "Rental Agreement Package", description: "Drafting, registration guidance and police verification help.", price: 3500 },
      { kind: "service", name: "Property Valuation Report", description: "Comparable-based valuation for sellers.", price: 5000 },
    ],
    posts: [
      "Buying your first home? Our free checklist covers the 12 documents you must verify.",
      "Rental market update for Gurugram: demand is up near metro corridors.",
    ],
  },
  {
    slug: "green_thumb_nursery",
    name: "Green Thumb Nursery",
    tagline: "Plants for small balconies and big dreams.",
    description: "Indoor plants, herbs, planters and gardening supplies, with care guides and free doorstep advice in the city.",
    category: "retail",
    city: "Mysuru",
    address: "7, Nazarbad Main Road, Mysuru",
    foundedYear: 2020,
    sizeRange: "2_10",
    verified: false,
    match: /Teacher|Founder|Food|Wellness|Marketing|Student/i,
    hours: ["09:00", "19:30"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    offerings: [
      { kind: "product", name: "Money Plant in Ceramic Pot", description: "Low-maintenance, great for beginners.", price: 350, stock: "in_stock" },
      { kind: "product", name: "Herb Starter Kit (basil, mint, coriander)", description: "Seeds, soil and pots with a care card.", price: 599, stock: "in_stock" },
      { kind: "product", name: "Snake Plant (medium)", description: "Purifies air, forgives forgetful owners.", price: 450, stock: "in_stock" },
      { kind: "service", name: "Balcony Garden Setup", description: "We plan and plant your balcony in one visit.", price: 4000 },
    ],
    posts: [
      "Monsoon special: 15% off all herb kits this week. Your kitchen deserves fresh coriander.",
      "Care tip: most houseplants die from overwatering, not neglect. Check the soil first.",
    ],
  },
  {
    slug: "asha_family_clinic",
    name: "Asha Family Clinic",
    tagline: "Caring for every generation.",
    description: "A family clinic offering general consultations, child health, vaccinations and preventive check-ups in a calm, unhurried setting.",
    category: "health_wellness",
    city: "Kochi",
    address: "21, MG Road, Ernakulam, Kochi",
    foundedYear: 2010,
    sizeRange: "11_50",
    verified: true,
    match: /Physician|Paediatrician|Doctor|Practitioner/i,
    hours: ["09:00", "20:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [
      { kind: "service", name: "General Consultation", description: "20 minute consultation with a physician.", price: 600 },
      { kind: "service", name: "Child Health Check-up", description: "Growth, vaccination review and nutrition advice.", price: 800 },
      { kind: "service", name: "Annual Preventive Health Package", description: "Basic blood tests and a doctor's review.", price: 2999 },
    ],
    posts: [
      "Flu season is here. A short reminder: wash hands, sleep well and don't skip your child's vaccinations.",
      "We're now open on Saturdays until 8pm for working parents.",
    ],
    job: { title: "Front Desk Coordinator", type: "full_time", description: "Appointments, records and patient communication. Malayalam and English.", remote: false, min: 216000, max: 288000 },
  },
  {
    slug: "saarthi_cares",
    name: "Saarthi Cares Foundation",
    tagline: "Small acts. Lasting change.",
    description: "A volunteer-run nonprofit running free evening classes, health camps and book drives for underserved communities.",
    category: "nonprofit",
    city: "Lucknow",
    address: "5, Hazratganj, Lucknow",
    foundedYear: 2016,
    sizeRange: "11_50",
    verified: true,
    match: /Teacher|Doctor|Physician|Writer|Journalist|Student|Educator/i,
    hours: ["10:00", "17:00"],
    days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    offerings: [],
    posts: [
      "Our free evening classes now serve 120 children. Thank you to every volunteer who showed up.",
      "Book drive this Saturday. Drop off gently used children's books at our Hazratganj office.",
      "Health camp report: 340 people screened, 62 referred for follow-up care. Gratitude to our volunteer doctors.",
    ],
  },
  {
    slug: "glow_and_grace",
    name: "Glow & Grace Salon",
    tagline: "Hair, skin and a little self-care.",
    description: "A friendly unisex salon offering haircuts, colour, skin care and bridal packages by trained stylists.",
    category: "beauty_personal_care",
    city: "Jaipur",
    address: "Shop 6, C-Scheme, Jaipur",
    foundedYear: 2018,
    sizeRange: "2_10",
    verified: false,
    match: /Wellness|Marketing|Design|Artist|Founder/i,
    hours: ["10:00", "20:00"],
    days: ["tue", "wed", "thu", "fri", "sat", "sun"],
    offerings: [
      { kind: "service", name: "Haircut & Styling", description: "Consultation, wash, cut and blow-dry.", price: 700 },
      { kind: "service", name: "Signature Facial", description: "Deep cleanse with a relaxing massage.", price: 1800 },
      { kind: "service", name: "Bridal Package", description: "Trial, makeup and hair on the day.", price: null },
    ],
    posts: [
      "Wedding season bookings are open. Trials are free with a confirmed booking.",
      "Skin tip: sunscreen every day, even indoors. Your future self says thanks.",
    ],
  },
];

export const REVIEW_BODIES: Record<number, string[]> = {
  5: [
    "Absolutely loved it. Friendly team and great attention to detail.",
    "Exactly as described, and better than I expected. Highly recommend!",
    "Been a regular for months. Consistent quality every single time.",
    "Super professional and warm. Would happily come back.",
    "Great value and lovely people. Told all my friends already.",
  ],
  4: [
    "Really good overall. Small wait but worth it.",
    "Solid experience. A couple of tiny things could improve but I'd return.",
    "Good service and fair prices. Will visit again.",
    "Very good, helpful staff. Just wish they were open a bit later.",
  ],
  3: [
    "Decent, but it took longer than promised. Staff were polite though.",
    "Average experience. Good potential if they fix the scheduling.",
  ],
};

export const REVIEW_RESPONSES = [
  "Thank you so much for the kind words! Looking forward to seeing you again.",
  "We appreciate the honest feedback and are working on it. Thanks for giving us a chance.",
  "So glad you enjoyed it! Your support means a lot to our small team.",
];
