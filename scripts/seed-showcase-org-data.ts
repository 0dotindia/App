// Organisation-side data for the showcase: ZERO DOT (business), Scale Ladder (community), events,
// jobs, fundraising and reviews. Fictional; addresses and domains use invented names / .example.

export const BUSINESS = {
  slug: "dot",
  name: "ZERO DOT",
  tagline: "From one dot to the whole planet.",
  description: "0dot is the platform, and its programmes connect seed libraries, neighbourhood compost networks, city air data and national food datasets into one open, community-owned system. We work at every scale, from a single seed to the planet, on the things that matter to live: soil, water, air, food, health and learning. Everything we build is open, documented and free to copy.",
  category: "nonprofit",
  foundedYear: new Date().getFullYear() - 6,
  sizeRange: "51_200",
  locations: [
    { label: "Head office, Kochi", address: "12, Backwater Road, Fort Kochi, Kochi", lat: 9.9658, lng: 76.2421, hours: ["09:30", "18:00", ["mon", "tue", "wed", "thu", "fri"]] },
    { label: "Data hub, Bengaluru", address: "5th Floor, Indiranagar Innovation Hub, Bengaluru", lat: 12.9784, lng: 77.6408, hours: ["10:00", "18:30", ["mon", "tue", "wed", "thu", "fri", "sat"]] },
  ] as { label: string; address: string; lat: number; lng: number; hours: [string, string, string[]] }[],
  contact: { email: "hello@0dot.example", phone: "+91 484 555 0142", website: "https://0dot.example" },
  links: [["Annual impact report", "https://0dot.example/impact"], ["Open datasets", "https://data.0dot.example"], ["Volunteer with us", "https://0dot.example/volunteer"], ["Press kit", "https://0dot.example/press"]] as [string, string][],
  offerings: [
    { kind: "product", name: "Seed Kit (Starter)", description: "A jar of five heirloom seed varieties with recipe cards, a growing guide and a label set.", price: 499, stock: "in_stock" },
    { kind: "product", name: "Ward Compost Starter Bundle", description: "Bin, aerator, guide and a 90-day pilot checklist for 20 households.", price: 6500, stock: "made_to_order" },
    { kind: "product", name: "Community Air Sensor Kit", description: "A calibrated low-cost air sensor with mounting kit and dashboard access.", price: 4200, stock: "in_stock" },
    { kind: "service", name: "Community Workshop (half-day)", description: "A facilitated half-day workshop on seeds, water, waste or air for schools and neighbourhoods.", price: 18000 },
    { kind: "service", name: "Systems Thinking Talk", description: "A 60 minute keynote on the seven scales of living for teams and events.", price: 30000 },
    { kind: "service", name: "Custom Open Dataset Build", description: "We design, clean, document and publish an open dataset for your city or programme.", price: null },
  ] as { kind: string; name: string; description: string; price: number | null; stock?: string }[],
  posts: [
    "This season's seed kit orders are open. Every kit funds a second one for a school 🌱",
    "Our City Air Ledger just crossed 1,900 sensors across 40 cities. Thank you to every volunteer who mounts, cleans and checks them.",
    "Ward Compost update: 38 wards, 4.2 tonnes per ward per year. The soil is being sold back to local gardeners at cost.",
    "Hiring: we're looking for a Programme Manager for Community Systems. Details on our jobs page.",
    "The Seed to Planet Summit is 14 days away. Sessions for every scale, from soil to the planet. Tickets are open!",
    "We publish our failures. This month's postmortem: why the Ward 12 pilot stalled, and what we changed.",
    "New: Open Grain Commons now has 18 months of price data from 900 markets. CC-BY, documented, free.",
    "Volunteer spotlight: 74-year-old retired teacher Mrs. Thomas runs the seed swap in her lane every Saturday 🙏",
    "Impact report 2025 is out. Read it, break it, tell us what's missing.",
    "Thank you to the 300+ volunteers who counted, weighed and tested this year.",
    "Our schools programme is now in 120 classrooms. Sleep Commons posters are free to download.",
    "Reminder: seed kit applications for community groups close Friday.",
  ],
  reviews: [
    [5, "Volunteering here changed how I see my own street. The team is organised, warm and honest about what works."],
    [5, "We ran a Community Workshop for 60 students. Practical, joyful and well prepared."],
    [5, "The seed kit was beautifully done. My daughter checks her sprouts every morning."],
    [5, "Open data done right: documented, versioned and responsive to feedback."],
    [4, "Great programmes. Would love more events in smaller towns."],
    [5, "Their keynote at our conference was the highlight of the day."],
    [5, "The air sensor kit arrived calibrated with clear instructions. Our school mounted it in an hour."],
    [4, "Excellent work. Communication can be slow during summit season, but always kind."],
    [5, "A rare organisation that publishes its failures and learns in public."],
    [5, "Our ward composting pilot used their playbook and it just worked."],
    [5, "Bindu's dataset build helped us launch our own city dashboard in a month."],
    [4, "Inspiring team and useful resources."],
  ] as [number, string][],
  responses: ["Thank you so much! Volunteers like you make this work 🙏", "We're glad it helped. Please share your results with us!", "Thanks for the feedback. We're working on reaching smaller towns next season."],
};

export const JOBS = [
  { title: "Programme Manager, Community Systems", type: "full_time", description: "Lead our seed library, compost and air programmes across 40 cities. You'll manage partners, volunteers and outcomes. 5+ years in community programmes.", remote: false, city: "Kochi", min: 12000, max: 20000, fit: /Manager|Founder|Teacher|Educator/i },
  { title: "Data Engineer, Open Datasets", type: "full_time", description: "Build and maintain the pipelines behind our open datasets. Python, SQL and a passion for documentation.", remote: true, city: "", min: 15000, max: 28000, fit: /Engineer|Data|Developer/i },
  { title: "Field Coordinator, Seed Libraries", type: "part_time", description: "Support neighbourhood seed libraries in your city with visits, training and reports.", remote: false, city: "Kochi", min: 3000, max: 4800, fit: /Teacher|Food|Student|Chef/i },
  { title: "Communications Lead", type: "full_time", description: "Tell the story of our work across scales, from field notes to reports. Writing and editing experience.", remote: true, city: "", min: 9000, max: 16000, fit: /Writer|Journalist|Editor|Marketing/i },
  { title: "Research Intern, Climate & Cities", type: "internship", description: "Six months working on the Planetary Health Index and city air analysis with a mentor.", remote: true, city: "", min: 1000, max: 1800, fit: /Student|Data|Engineer/i },
];

export const COMMUNITY = {
  slug: "scale_ladder",
  name: "Scale Ladder",
  description: "A community for people who work on the things that matter to live, at every scale: seeds, bodies, homes, streets, cities, nations and the planet. Share projects, ask questions, find collaborators and learn by doing.",
  tags: ["science", "education", "food", "other"],
  rules: [
    ["Be kind and curious", "We are here to learn from each other at every scale."],
    ["Show your work", "Share what you tried, what happened and what you'd change."],
    ["Cite your data", "Link sources and state uncertainty."],
    ["Stay on the ladder", "Tag your post with the scale it belongs to."],
    ["No spam or self-promotion without value", "Share resources that others can use."],
    ["Respect privacy", "No personal data or photos of people without permission."],
  ] as [string, string][],
  flairs: [["Seed", "orange"], ["Body", "pink"], ["Home", "red"], ["Street", "yellow"], ["City", "green"], ["Nation", "blue"], ["Planet", "purple"]] as [string, string][],
  posts: [
    ["Seed", "Show and tell: what's the oldest seed variety in your family? Mine is a red rice my grandmother saved."],
    ["Body", "What's one sleep habit that actually stuck for you? Looking for realistic ones."],
    ["Home", "Balcony greywater loops: how are you filtering before it reaches the plants?"],
    ["Street", "Our ward is starting a compost pilot next month. Any tips for choosing the first 20 households?"],
    ["City", "Has anyone compared low-cost PM2.5 sensors against a regulatory monitor? Sharing my results below."],
    ["Nation", "Which open datasets do you use for food security work? Let's build a list."],
    ["Planet", "How do you connect local action to planetary indicators in your reporting?"],
    ["Home", "Rainwater harvesting for a two-storey house: what worked and what didn't."],
    ["Street", "Ideas for making a lane safer for children to walk to school?"],
    ["Seed", "Seed swap this weekend! Bring seeds and stories."],
    ["City", "Municipal data portals in India: which are actually usable?"],
    ["Body", "A 10-minute mobility routine for people who sit all day. Feedback welcome."],
    ["Nation", "Policy brief: why crop price data should be open by default."],
    ["Planet", "Reading group starts next week: 'Scales of Living', chapter by chapter."],
    ["Street", "Weekly wins thread: what small thing did you do this week?"],
  ] as [string, string][],
  pinned: "Welcome to Scale Ladder! Introduce yourself, tag your posts with a scale and read the rules. Start with the Field Guide in the wiki.",
  wiki: [["Getting Started", "Welcome! Read the rules, introduce yourself in the weekly thread and pick a scale to explore."], ["How to Tag Your Post", "Every post gets a scale flair: Seed, Body, Home, Street, City, Nation or Planet. Choose the smallest scale your post really concerns."], ["Reading List", "A community-curated list of books, papers and datasets. Add yours!"], ["Weekly Wins Thread", "Every Friday, share one small thing you did that mattered."]] as [string, string][],
  chat: ["Good morning ladder folk 🌱", "Anyone tried the sleep toolkit with a class?", "Sharing my sensor calibration sheet in a minute", "Seed swap on Saturday, who's in?", "Thanks for the welcome!", "Working on a lane-level ledger, need ideas", "Just posted my compost weights 📈", "Love this community", "Question on rainwater filters, thread coming", "Reminder: summit tickets are open"],
};

export const EVENTS = [
  { slug: "seed_to_planet_summit", title: "Seed to Planet Summit", host: "business", format: "hybrid", day: 14, hour: 9, hours: 9, city: "Kochi", capacity: 400, visibility: "public", tickets: [["Virtual pass", null, 2000], ["Early bird", 1499, 100], ["Standard", 2499, 200], ["Patron", 9999, 30]] as [string, number | null, number | null][], size: [70, 95], description: "Our flagship gathering: seven tracks, one for each scale, from soil to the planet. Keynotes, workshops, a seed swap, open-data hackathon demos and a community dinner.\n\n## What to expect\n\n- Seven tracks, one per scale\n- A seed swap and live cooking\n- Open data demos\n- Networking across scales" },
  { slug: "seed_library_workshop", title: "Seed Library Workshop, Kochi", host: "business", format: "in_person", day: 9, hour: 10, hours: 4, city: "Kochi", capacity: 30, visibility: "public", tickets: [["Workshop ticket", 399, 30]] as [string, number | null, number | null][], size: [22, 34], description: "Learn how to start a neighbourhood seed library. We'll label, swap and plan.\n\n## What to expect\n\n- Hands-on seed labelling\n- A starter kit to take home\n- Chai and snacks" },
  { slug: "book_launch_kochi", title: "Scales of Living: Book Launch", host: "user", format: "in_person", day: 30, hour: 18, hours: 3, city: "Kochi", capacity: 120, visibility: "public", tickets: [["Entry (includes a signed book)", 699, 120]] as [string, number | null, number | null][], size: [30, 55], description: "The launch of *Scales of Living*, with a reading, a conversation and a small seed swap.\n\n## What to expect\n\n- A reading from the book\n- Conversation with local practitioners\n- Signed copies" },
  { slug: "open_data_panel", title: "Panel: Open Data for Food Security", host: "community", format: "virtual", day: 21, hour: 19, hours: 2, city: "", capacity: null, visibility: "public", tickets: [], size: [35, 60], description: "Researchers, farmers and policymakers discuss what open data can do for food security.\n\n## Speakers\n\n- Data engineers and policy researchers\n- A farmers' cooperative representative" },
  { slug: "ward_compost_field_day", title: "Ward Compost Field Day", host: "business", format: "in_person", day: -25, hour: 8, hours: 5, city: "Kochi", capacity: 60, visibility: "public", tickets: [["Volunteer pass", null, 60]] as [string, number | null, number | null][], size: [30, 45], description: "A day in the field with the Ward Compost Network. We weighed, turned and celebrated.\n\n## What we did\n\n- Weighed a week of kitchen waste\n- Turned twelve bins\n- Sold soil back to gardeners" },
  { slug: "air_sensor_build_night", title: "Air Sensor Build Night", host: "community", format: "virtual", day: -12, hour: 20, hours: 2, city: "", capacity: 150, visibility: "public", tickets: [["Free entry", null, 150]] as [string, number | null, number | null][], size: [40, 65], description: "Build and calibrate a low-cost air sensor together, live on video.\n\n## What we covered\n\n- Assembly\n- Calibration against a reference\n- Publishing your data" },
  { slug: "open_data_hackathon", title: "Open Data Hackathon: Food & Air", host: "business", format: "hybrid", day: 35, hour: 9, hours: 10, city: "Bengaluru", capacity: 120, visibility: "public", tickets: [["Participant", null, 120]] as [string, number | null, number | null][], size: [40, 70], description: "Two datasets, one weekend. Build tools, dashboards and stories from the Open Grain Commons and the City Air Ledger.\n\n## What to expect\n\n- Mentors from data, policy and farming\n- Prizes for impact, not polish" },
  { slug: "scale_ladder_meetup", title: "Scale Ladder Monthly Meetup", host: "community", format: "hybrid", day: 5, hour: 18, hours: 2, city: "Kochi", capacity: 80, visibility: "public", tickets: [["Free entry", null, 80]] as [string, number | null, number | null][], size: [35, 60], description: "Our monthly community meetup: lightning talks, weekly wins and open questions.\n\n## What to expect\n\n- Five-minute lightning talks\n- Weekly wins\n- Open floor" },
] as const;

export const CAMPAIGNS = [
  { title: "10,000 Seed Kits", description: "Fund 10,000 seed kits for schools and community groups across 40 cities. Every kit includes five heirloom varieties, recipe cards and a growing guide.", goal: 10000, days: 75, boost: 1 },
  { title: "Lane-Level Air Ledger", description: "Extend the City Air Ledger from streets to lanes: 800 more calibrated sensors in 12 cities.", goal: 8000, days: 50, boost: 1 },
  { title: "Open Grain Commons Hosting", description: "One year of hosting, storage and maintenance for the Open Grain Commons dataset.", goal: 3000, days: 20, boost: 2 },
] as const;

export const BUSINESS_FORM = {
  title: "Volunteer Sign-Up",
  description: "Tell us how you'd like to help. We'll match you with a programme near you.",
  fields: [
    { label: "Full name", type: "text", required: true, options: [], description: "" },
    { label: "Which programme interests you?", type: "choice", required: true, options: ["Seed libraries", "Ward compost", "City air", "Open data", "Schools"], description: "" },
    { label: "Weekly hours you can offer", type: "rating", required: false, options: [], description: "1 = 1-2 hours, 5 = 10+ hours" },
    { label: "Earliest start date", type: "date", required: false, options: [], description: "" },
    { label: "Anything else we should know?", type: "text", required: false, options: [], description: "" },
  ],
};

export const TEAM_TITLES = ["Programme Director", "Head of Data", "Community Lead", "Field Operations", "Communications", "Research Lead"];
export const APPLICATION_NOTES = ["I've followed 0dot's work for a year and would love to contribute.", "This role matches my experience and values. Happy to share examples of my work.", "I'm based in the region and can start within a month.", "Please consider my application. I care deeply about this work."];
export const DOC_FILES = [
  { title: "Impact Report 2025", filename: "impact-report-2025.md", visibility: "public", content: "# Impact Report 2025\n\n- 312 seed varieties saved\n- 38 wards composting\n- 1,900 air sensors in 40 cities\n- 900 markets in the Open Grain Commons\n" },
  { title: "Open Data Governance Policy", filename: "open-data-policy.md", visibility: "public", content: "# Open Data Governance\n\nAll datasets are CC-BY, versioned and documented. Personal data is never published.\n" },
  { title: "Volunteer Handbook", filename: "volunteer-handbook.md", visibility: "team_only", content: "# Volunteer Handbook\n\nWelcome. This handbook covers safety, communication and reporting for volunteers.\n" },
];
