// Static content for scripts/seed-dots-portfolio.ts — portfolio items per role.
// Issuers, venues and events are fictional on purpose: seeded profiles must never
// claim a real certificate, award or publication from a real organisation.
import type { RoleKey } from "./seed-dots-data";

// [title, summary, description markdown, link labels]
export type ProjectT = readonly [string, string, string, readonly string[]];
export type RepoT = readonly [string, string, string]; // name, description, language
export type PaperT = readonly [string, string, string]; // title, venue, abstract
export type CertT = readonly [string, string]; // title, issuing org
export type AwardT = readonly [string, string, string]; // title, org, description

export type PortfolioPersona = {
  projects: ProjectT[];
  certs: CertT[];
  awards: AwardT[];
  repos?: RepoT[];
  papers?: PaperT[];
  paperChance?: number;
};

const md = (intro: string, bullets: string[]) => `${intro}\n\n## Highlights\n\n${bullets.map((b) => `- ${b}`).join("\n")}`;

export const PORTFOLIO: Record<RoleKey, PortfolioPersona> = {
  swe: {
    projects: [
      ["Queue Lens", "A tiny dashboard that shows what's stuck in your job queues.", md("Built after one too many 2am incidents. Connects to a Redis-backed queue and shows depth, age and failures at a glance.", ["Single binary, zero config", "Alerts to Slack on stuck jobs", "Used by three small teams"]), ["Live demo", "Source"]],
      ["Paisa Split", "Split shared expenses with roommates, with UPI deep links.", md("A weekend project that grew. Add expenses, see who owes whom, settle in one tap.", ["Offline-first PWA", "Smart settle-up minimises transfers", "1,200 monthly users"]), ["Live demo", "Source"]],
      ["Rate Limiter Kit", "Drop-in rate limiting middleware with sliding windows.", md("A small library with clear docs and a benchmark suite.", ["Memory and Redis stores", "99.9th percentile under 1ms", "Fully typed"]), ["Source", "Docs"]],
      ["Migrate Safe", "Checks database migrations for risky operations before they ship.", md("A CI check that flags locking migrations and missing indexes.", ["Postgres focused", "Runs in under 2 seconds", "GitHub Action included"]), ["Source"]],
    ],
    certs: [["Distributed Systems Practitioner", "Sundial Learning Academy"], ["Cloud Architecture Associate", "Nilgiri Cloud Institute"], ["Secure Coding Fundamentals", "Kaveri Security Guild"]],
    awards: [["Hack Bengal Finalist", "Hack Bengal", "Top 5 of 200 teams for an offline-first field data tool."], ["Engineering Excellence Award", "Sundial Software", "Recognised for reducing p99 API latency by 40%."]],
    repos: [["queue-lens", "Dashboard for background job queues", "Go"], ["ratelimit-kit", "Sliding window rate limiting", "TypeScript"], ["dotfiles", "My terminal and editor setup", "Shell"]],
    papers: [["Practical Backpressure in Small Services", "Sundial Symposium on Systems", "We describe simple backpressure patterns that keep small services healthy under load without complex tooling."]],
    paperChance: 0.3,
  },
  design: {
    projects: [
      ["Bharat Forms Redesign", "Making government-style forms understandable for first-time users.", md("A case study on rethinking a multi-step form for low-literacy and low-bandwidth users.", ["Task completion up 32%", "Tested with 40 participants", "Supports 4 languages"]), ["Case study", "Prototype"]],
      ["Chai Design System", "A small, accessible component library for side projects.", md("Tokens, components and documentation built for speed and accessibility.", ["WCAG AA colour tokens", "42 components", "Figma and code parity"]), ["Docs", "Prototype"]],
      ["Rail Ticket Flow", "A calmer way to book a train ticket on a slow phone.", md("Concept redesign focused on fewer taps and clearer states.", ["3-tap booking path", "Skeleton loading states", "Dark mode included"]), ["Case study"]],
      ["Sketchbook Journal App", "A gentle journaling app with hand-drawn illustrations.", md("Branding, illustration and full UI for a mindful journaling concept.", ["Custom icon set", "Onboarding under 60 seconds"]), ["Prototype"]],
    ],
    certs: [["UX Research Methods", "Tarang Design School"], ["Accessibility for Designers", "Kaveri Design Institute"], ["Design Systems in Practice", "Nilgiri UX Academy"]],
    awards: [["Best Mobile Concept", "Design Yatra", "Awarded for the rail ticket booking redesign."], ["Design Team of the Year", "Nilgiri Labs", "Shared recognition for a company-wide design system rollout."]],
  },
  pm: {
    projects: [
      ["Onboarding Revamp", "Cut new-user drop-off by a third in one quarter.", md("Led discovery, prioritisation and rollout of a redesigned onboarding flow.", ["Activation up 27%", "8 interviews, 3 experiments", "Cross-functional team of 9"]), ["Case study"]],
      ["Pricing Experiment", "A/B tested three pricing pages for a B2B SaaS.", md("Defined hypotheses, guardrail metrics and ran a six-week test.", ["Conversion up 11%", "No churn increase"]), ["Case study"]],
      ["Roadmap Playbook", "An open one-page template for outcome-based roadmaps.", md("A practical template I've refined across three teams.", ["Free to copy", "Used by 300+ PMs"]), ["Template"]],
    ],
    certs: [["Product Management Foundations", "Sundial Product Academy"], ["Data-Informed Product Decisions", "Nilgiri Analytics School"]],
    awards: [["Product Launch of the Year", "Tarang Cloud", "For leading a launch that hit its adoption goal in 6 weeks."], ["Customer Champion", "Kaveri Systems", "Voted by support and sales teams."]],
  },
  data: {
    projects: [
      ["Crop Price Forecaster", "Forecasts mandi prices with public agricultural data.", md("A time-series model using open commodity data with a simple dashboard for farmers' groups.", ["MAPE under 8%", "Weekly retraining", "Open notebook included"]), ["Notebook", "Live demo"]],
      ["Metro Crowd Predictor", "Predicts station crowding by time of day.", md("Combines ridership counts, weather and events into a crowd estimate.", ["Gradient boosted model", "Explainability with SHAP"]), ["Notebook", "Source"]],
      ["Clean CSV", "A CLI that profiles and fixes messy CSV files.", md("A tool for the unglamorous 80% of data work.", ["Detects encoding and type issues", "Reports before it fixes"]), ["Source"]],
      ["Hindi Sentiment Baseline", "A lightweight baseline for Hindi tweets.", md("Compares classic and transformer baselines with reproducible splits.", ["Open dataset card", "Reproducible in one command"]), ["Notebook"]],
    ],
    certs: [["Applied Machine Learning", "Sundial Learning Academy"], ["Statistics for Data Science", "Nilgiri Analytics School"], ["MLOps Essentials", "Kaveri Cloud Institute"]],
    awards: [["Data Hackathon Winner", "DataFest Bharat", "First place for the crop price forecasting project."], ["Analytics Impact Award", "Tarang Cloud", "For a churn model that saved an estimated ₹1.2 crore annually."]],
    repos: [["crop-forecast", "Mandi price forecasting notebooks", "Python"], ["clean-csv", "CLI for profiling messy CSVs", "Python"], ["hindi-sentiment", "Baselines for Hindi text classification", "Python"]],
    papers: [["Forecasting Regional Commodity Prices with Sparse Data", "Journal of Applied Analytics (Sundial)", "We evaluate seasonal and gradient boosting models on sparse mandi price series and share practical guidance for small datasets."], ["Reproducibility Habits in Small Data Teams", "Sundial Data Practice Workshop", "A short study of what makes analyses reproducible in teams without dedicated data infrastructure."]],
    paperChance: 0.7,
  },
  founder: {
    projects: [
      ["Kirana Connect", "Helps neighbourhood stores take orders on WhatsApp.", md("A small SaaS that turns WhatsApp chats into structured orders for local shops.", ["600 stores onboarded", "₹0 to ₹18 lakh monthly GMV", "Team of 6"]), ["Website", "Case study"]],
      ["Founder Diaries", "A public journal of the first 18 months.", md("Honest monthly notes on hiring, fundraising and mistakes.", ["24 issues", "5,000 readers"]), ["Read"]],
      ["Pilot Programme", "A 90-day pilot playbook for enterprise customers.", md("How we closed our first three enterprise pilots.", ["Reusable templates", "60% pilot-to-paid rate"]), ["Playbook"]],
    ],
    certs: [["Startup Fundamentals", "Sundial Entrepreneurship Academy"], ["Financial Modelling for Founders", "Nilgiri Business School"]],
    awards: [["Emerging Startup of the Year", "Startup Katta Awards", "Recognised for traction in the first year."], ["Best Pitch", "Founders Weekend", "Voted best pitch by 120 attendees."]],
  },
  photo: {
    projects: [
      ["Ghats at Dawn", "A photo series on morning rituals along the river.", md("Shot over six weeks, from first light until the crowds arrive.", ["32 selected frames", "Exhibited in a local gallery", "Shot on film and digital"]), ["Gallery"]],
      ["Faces of the Weekly Market", "Portraits of vendors at a weekend market.", md("Portraits made with permission, each with a short story.", ["24 portraits", "Featured in a city magazine"]), ["Gallery"]],
      ["Monsoon Streets", "Rain, reflections and umbrellas in the city.", md("A street photography series across five cities.", ["40 frames", "Print edition available"]), ["Gallery", "Shop"]],
    ],
    certs: [["Advanced Photography Techniques", "Tarang Arts Institute"], ["Lightroom Colour Grading", "Kaveri Visual School"]],
    awards: [["Photo Series of the Year", "Frame India Awards", "For 'Ghats at Dawn'."], ["Street Photography Runner-up", "Lensbharat Contest", "Second place among 800 entries."]],
  },
  writer: {
    projects: [
      ["Small Town Diaries", "A long-form reporting series on life in tier-3 towns.", md("Twelve stories from towns that rarely make national news.", ["12 features", "Read by 40,000 people"]), ["Read"]],
      ["The Editor's Desk", "A weekly newsletter about the craft of editing.", md("Practical notes on clarity, structure and cutting.", ["3,200 subscribers", "Weekly for 90 weeks"]), ["Subscribe"]],
      ["Ghost Stories of the Old City", "A short fiction collection set in old Kolkata.", md("Eight short stories with a local flavour.", ["Self-published", "Audio edition in progress"]), ["Read", "Buy"]],
    ],
    certs: [["Long-form Journalism Workshop", "Nilgiri Media School"], ["Editing and Style", "Sundial Writers' Guild"]],
    awards: [["Best Feature Writing", "Indian Press Circle (Sundial)", "For 'Small Town Diaries'."], ["Emerging Writer Prize", "Kolkata Words Festival", "Shortlisted from 300 entries."]],
  },
  food: {
    projects: [
      ["Regional Thali Project", "Documenting home-style thalis from 12 states.", md("Recipes, photographs and stories from home cooks across India.", ["12 states covered", "60 recipes", "Video series"]), ["Recipes", "Videos"]],
      ["Sourdough Masala", "Indian-flavoured sourdough loaves and a starter guide.", md("A baking guide that adapts sourdough to Indian kitchens and climates.", ["Works in 35°C kitchens", "Step-by-step photos"]), ["Guide"]],
      ["Street Food Map", "A community map of dependable street food across a city.", md("Crowd-sourced and taste-tested.", ["150 vendors mapped", "Hygiene notes from visits"]), ["Map"]],
    ],
    certs: [["Culinary Fundamentals", "Kaveri Culinary Institute"], ["Food Safety and Hygiene", "Nilgiri Hospitality Academy"]],
    awards: [["Best Home Baker", "Bake Bharat Fest", "Winner, home category."], ["Food Blog of the Year", "Tarang Food Awards", "Shortlisted among 90 blogs."]],
  },
  fitness: {
    projects: [
      ["Desk Worker Mobility", "A 6-week programme for stiff necks and tight hips.", md("Short daily routines for people who sit all day.", ["10 minutes a day", "800 participants", "Video and PDF"]), ["Programme"]],
      ["Beginner Strength 101", "A progressive strength plan for first-timers.", md("Three sessions a week with clear progressions.", ["12-week structure", "Form videos included"]), ["Programme"]],
      ["Sunrise Yoga Circle", "A free community yoga group in the park.", md("Weekly sessions open to all levels.", ["Running for 2 years", "60 regulars"]), ["Community"]],
    ],
    certs: [["Certified Yoga Instructor", "Kaveri Yoga Council"], ["Strength Coaching Level 2", "Nilgiri Fitness Academy"], ["Sports Nutrition Basics", "Sundial Wellness Institute"]],
    awards: [["Community Wellness Award", "City Fit Foundation", "For the free park yoga programme."], ["Coach of the Year", "Pranayama Collective", "Voted by members."]],
  },
  music: {
    projects: [
      ["Monsoon Sessions", "An EP of rain-inspired songs recorded at home.", md("Six songs written and recorded over one monsoon.", ["6 tracks", "80,000 streams", "Live acoustic video"]), ["Listen"]],
      ["Riyaz Companion", "Practice loops and drones for classical students.", md("A free set of tanpura and tabla loops for daily practice.", ["24 ragas", "Used by 900 students"]), ["Download"]],
      ["Live at the Lane", "A live recording from a neighbourhood gig.", md("Recorded in one take with a small band.", ["45 minutes", "Live video"]), ["Watch"]],
    ],
    certs: [["Music Theory Grade 8", "Tarang Music Board"], ["Audio Production Essentials", "Nilgiri Sound School"]],
    awards: [["Best Independent Artist", "Indie Sur Awards", "For 'Monsoon Sessions'."], ["Young Musician Award", "Kolkata Music Circle", "Recognised for community teaching."]],
  },
  doctor: {
    projects: [
      ["Village Health Camps", "Free monthly health camps in nearby villages.", md("Volunteer camps covering screening and awareness.", ["18 camps", "2,400 screened", "Referral network"]), ["Report"]],
      ["Parenting Q&A Series", "Plain-language answers to parents' health questions.", md("A monthly series answering the most common questions.", ["30 episodes", "Free and ad-free"]), ["Watch"]],
      ["Clinic Workflow Toolkit", "Small changes that cut waiting time in clinics.", md("A short guide based on a trial in two clinics.", ["Wait time down 25%", "Free PDF"]), ["Guide"]],
    ],
    certs: [["Advanced Life Support Provider", "Sundial Medical Council"], ["Medical Communication", "Nilgiri Health Academy"]],
    awards: [["Community Service Award", "Kochi Medical Circle", "For rural health camps."], ["Best Resident Teacher", "Kaveri Institute of Medical Sciences", "Voted by interns."]],
    papers: [["Screening Outcomes in Community Health Camps", "Journal of Community Health Practice (Sundial)", "A retrospective look at screening results across 18 volunteer-run health camps."]],
    paperChance: 0.8,
  },
  teacher: {
    projects: [
      ["Maths Without Fear", "A set of activities that make maths friendlier.", md("Classroom activities tested with 300 students.", ["40 activities", "Free for teachers"]), ["Download"]],
      ["Question of the Day", "A daily thinking prompt for classrooms.", md("One question per day, for five minutes of discussion.", ["180 prompts", "Used by 60 teachers"]), ["Browse"]],
      ["Exam Stress Toolkit", "Simple routines to help students prepare calmly.", md("Guidance for students, parents and teachers.", ["Printable planner", "Weekly check-ins"]), ["Download"]],
    ],
    certs: [["Teaching Excellence Programme", "Nilgiri Education Institute"], ["Inclusive Classroom Practices", "Sundial Teachers' Academy"]],
    awards: [["Teacher of the Year", "Nashik Education Circle", "Nominated by students and parents."], ["Innovation in Teaching", "Kaveri Schools Network", "For 'Maths Without Fear'."]],
    papers: [["Low-Cost Activities and Numeracy Outcomes", "Sundial Journal of Education Practice", "We report numeracy gains from short activity-based lessons in mixed-ability classrooms."]],
    paperChance: 0.5,
  },
  finance: {
    projects: [
      ["Tax Regime Calculator", "Compares tax regimes for salaried people.", md("A spreadsheet-based calculator with plain-language notes. Educational only.", ["Updated each budget", "Used by 5,000 people"]), ["Download"]],
      ["SME Books in a Box", "A simple bookkeeping template for small businesses.", md("A ready-to-use setup for GST-registered small businesses.", ["Works in spreadsheets", "Includes GST summary"]), ["Download"]],
      ["Money Basics Workshop", "A free workshop for first-time earners.", md("A two-hour session covering budgeting, insurance and investing basics.", ["12 workshops", "400 attendees"]), ["Slides"]],
    ],
    certs: [["Financial Planning Foundations", "Sundial Finance Institute"], ["GST Practitioner Course", "Nilgiri Tax Academy"]],
    awards: [["Young Finance Professional", "Ahmedabad CA Circle", "For community workshops."], ["Best Analyst Report", "Tarang Capital", "Internal award for equity research."]],
  },
  film: {
    projects: [
      ["Last Tram", "A 12-minute short film shot on the Kolkata tram line.", md("A quiet story about the last night of a tram route.", ["Shot in 4 nights", "Festival screenings", "Crew of 9"]), ["Watch", "Trailer"]],
      ["Monsoon Wedding Film", "A cinematic wedding film with natural light.", md("Shot in three days during heavy rain.", ["6-minute highlight", "Client favourite"]), ["Watch"]],
      ["Craft of Cut", "A video series on editing choices in short films.", md("Breakdowns of cuts, rhythm and sound.", ["10 episodes", "20,000 views"]), ["Watch"]],
    ],
    certs: [["Cinematography Workshop", "Tarang Film Institute"], ["Colour Grading for Film", "Nilgiri Post School"]],
    awards: [["Best Short Film", "Indie Frames Festival", "Winner for 'Last Tram'."], ["Best Cinematography", "Kolkata Shorts Circle", "For low-light work."]],
  },
  student: {
    projects: [
      ["Campus Bus Tracker", "Live location of college buses on a simple web app.", md("Built for our college's transport office.", ["600 daily users", "Runs on a budget server"]), ["Live demo", "Source"]],
      ["Study Buddy", "A tool to find study partners by subject and timing.", md("Match with peers who study the same subjects at the same times.", ["Built in a hackathon", "200 signups"]), ["Source"]],
      ["Placement Prep Notes", "Organised notes for campus interviews.", md("Shared notes on aptitude, DSA and interviews.", ["Used by 500 juniors", "Community edited"]), ["Notes"]],
    ],
    certs: [["Python for Everyone", "Sundial Learning Academy"], ["Web Development Bootcamp", "Nilgiri Code School"]],
    awards: [["Inter-College Hackathon Winner", "TechFest Bharat", "First place, team of four."], ["Dean's List", "Home university", "For academic performance."]],
    repos: [["campus-bus-tracker", "Live bus tracking for college", "JavaScript"], ["study-buddy", "Peer matching for study groups", "TypeScript"], ["placement-notes", "Interview preparation notes", "Markdown"]],
    papers: [["Low-Cost Bus Tracking Using Commodity Phones", "Student Track, Sundial Conference on Computing", "We describe a phone-based bus tracking system deployed on a college campus and its accuracy."]],
    paperChance: 0.3,
  },
  art: {
    projects: [
      ["Inktober Series", "31 ink drawings in 31 days.", md("A daily drawing practice using only black ink.", ["31 drawings", "Print available"]), ["Gallery"]],
      ["Village Fables Illustrations", "Illustrations for a children's picture book.", md("Twelve watercolour spreads for a book about village animals.", ["12 spreads", "Published by a small press"]), ["Gallery"]],
      ["Mural at Old Market", "A community mural in a neighbourhood market.", md("Designed with shopkeepers and painted over a weekend.", ["30 feet wide", "20 volunteers"]), ["Gallery"]],
    ],
    certs: [["Digital Illustration", "Tarang Arts Institute"], ["Colour Theory in Practice", "Kaveri Art School"]],
    awards: [["Young Artist Award", "Kochi Art Circle", "For the mural project."], ["Illustration Runner-up", "Chitra Bharat Contest", "Second place among 400 entries."]],
  },
  marketing: {
    projects: [
      ["Launch in 30 Days", "A go-to-market plan for a D2C snacks brand.", md("Positioning, channels and a content calendar for a first launch.", ["First 1,000 customers in 30 days", "CAC under ₹180"]), ["Case study"]],
      ["Brand Voice Guide", "A simple guide to finding and using a brand voice.", md("A workbook used with six small businesses.", ["Free template", "Worked examples"]), ["Download"]],
      ["Newsletter Growth Experiments", "Ten experiments that doubled a newsletter's subscribers.", md("What worked and what didn't.", ["Subscribers up 2.1x", "Experiment log"]), ["Read"]],
    ],
    certs: [["Digital Marketing Professional", "Sundial Marketing Academy"], ["Content Strategy", "Nilgiri Media School"]],
    awards: [["Best Campaign", "Lucknow Ad Circle", "For a festive campaign for a local brand."], ["Rising Marketer", "Tarang Cloud", "Company award."]],
  },
  sports: {
    projects: [
      ["Junior Cricket Academy", "A weekend academy for 60 kids.", md("Structured coaching for children aged 8 to 15.", ["60 players", "3 zonal-level selections"]), ["Website"]],
      ["Match Analysis Notebook", "A simple system to analyse match footage.", md("Templates for tracking shots, bowling zones and fielding.", ["Free for coaches", "Used by 20 academies"]), ["Download"]],
      ["Kabaddi Fitness Plan", "Conditioning plan for kabaddi players.", md("A 12-week plan focused on agility and grip.", ["Video demos", "Injury-prevention warm-ups"]), ["Programme"]],
    ],
    certs: [["Coaching Licence Level 1", "Sundial Sports Council"], ["Sports First Aid", "Nilgiri Medical Trust"]],
    awards: [["Coach of the Year", "District Cricket Circle", "Voted by parents and players."], ["State Level Medal", "State Kabaddi Meet (Sundial)", "Bronze at the state meet."]],
  },
};

// Generic extras so every role has enough items for its target counts.
export const COMMENT_BODIES = [
  "Really well done. The detail in this is impressive.",
  "Love the way you explained the process. Thanks for sharing!",
  "This is exactly the kind of work I wish I saw more of here.",
  "Congratulations! Looks like a lot of effort went into this.",
  "Would love to hear more about how you got started on this.",
  "Bookmarked. Will try this myself over the weekend.",
  "Clean, thoughtful and useful. Great work.",
  "How long did this take from idea to first version?",
  "Beautiful. Following for more like this.",
  "Solid work. The highlights section says it all.",
];
export const PLATFORM_PROJECT_COMMENTS = [
  "Great work! This is what we love seeing in portfolios on 0dot.",
  "Really nicely presented. Thanks for sharing your project 🙏",
  "Love this. Featuring projects like this in our thoughts today ✨",
  "Thoughtful and well made. Keep building!",
];
export const COLLAB_ROLES = ["Design", "Backend", "Research", "Advisor", "Editing", "Photography", "Frontend", "Operations"];
export const EXTERNAL_COLLABS = ["Ananya S.", "Rohit M.", "Deepa K.", "Vikram P.", "Nandini R.", "Sanjay T."];
export const PAPER_COAUTHORS = ["A. Sharma", "R. Kulkarni", "S. Banerjee", "P. Nair", "M. Chatterjee", "V. Rao"];
export const AWARD_YEAR_SPREAD_DAYS = 1600;
