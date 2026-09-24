// Persona and profile data for the showcase account (@ira), see seed-showcase-common.ts.
// Every organisation, publication, award and credential is fictional on purpose.

export type Scale = {
  key: string;
  name: string; // the scale
  size: string;
  matters: string; // what matters to live at this scale
  color: string;
};

// From the smallest dot to the largest thing that matters to live.
export const SCALES: Scale[] = [
  { key: "seed", name: "The Seed", size: "10⁻³ m", matters: "soil, food and the living cell", color: "#7a4b1e" },
  { key: "body", name: "The Body", size: "1 m", matters: "sleep, movement and mental health", color: "#c2255c" },
  { key: "home", name: "The Home", size: "10 m", matters: "water, shelter and energy", color: "#e8590c" },
  { key: "street", name: "The Street", size: "10³ m", matters: "neighbours, waste and safety", color: "#f59f00" },
  { key: "city", name: "The City", size: "10⁵ m", matters: "air, transport and clean water", color: "#2f9e44" },
  { key: "nation", name: "The Nation", size: "10⁶ m", matters: "food security, energy and education", color: "#1971c2" },
  { key: "planet", name: "The Planet", size: "10⁷ m", matters: "climate, oceans and biodiversity", color: "#5f3dc4" },
];

export const PERSON = {
  name: "Ira Menon",
  city: "Kochi",
  bio: "Systems thinker from the smallest dot to the whole planet 🌍 Building what matters to live: soil, water, air, food, health, learning. Founder, Bindu Foundation · 📍 Kochi. Small acts, planetary scale.",
  headline: "Founder & Systems Designer",
};

// [company, title, location, startYearsAgo, endYearsAgo|null, description]
export const WORK: [string, string, string, number, number | null, string][] = [
  ["Bindu Foundation", "Founder & Director", "Kochi", 6, null, "Runs a non-profit that connects seed libraries, neighbourhood compost networks, city air data and national food datasets into one open, community-owned system."],
  ["Deepwell Water Labs", "Head of Systems Design", "Bengaluru", 11, 6, "Led a team of 14 building low-cost household water treatment and monitoring for 400,000 homes."],
  ["Sundial Climate Institute", "Research Fellow", "Chennai", 14, 11, "Modelled urban heat and rainfall for coastal cities. Co-authored four papers and an open dataset."],
  ["Kaveri Agro Systems", "Product Manager", "Mysuru", 16, 14, "Shipped a crop-advisory app used by 120,000 farmers, from the first prototype."],
  ["Tarang Design Studio", "Service Designer", "Kochi", 18, 16, "Designed public services and community programmes for municipal partners."],
];

// [institution, degree, field, startYearsAgo, endYearsAgo, description]
export const EDUCATION: [string, string, string, number, number, string][] = [
  ["Sundial Institute of Technology", "Ph.D. (audited)", "Complex Systems", 14, 11, "Fellowship research on urban resilience."],
  ["Nilgiri School of Design", "M.Des", "Systems & Service Design", 20, 18, "Thesis: designing for the last mile of public water."],
  ["Kaveri University", "B.Sc.", "Environmental Science", 24, 21, "Graduated with distinction; field-work on backwater ecology."],
];

// [title, issuer, yearsAgo]
export const CERTIFICATES: [string, string, number][] = [
  ["Systems Thinking & Modelling", "Sundial Complexity Academy", 9],
  ["Regenerative Agriculture Practitioner", "Nilgiri Soil Institute", 7],
  ["Community Facilitation (Advanced)", "Tarang Civic Academy", 5],
  ["Open Data Stewardship", "Kaveri Open Knowledge Guild", 4],
  ["Climate Risk Assessment", "Sundial Climate Institute", 3],
  ["Public Health Data Literacy", "Nilgiri Public Health School", 2],
];

// [title, issuer, yearsAgo, description]
export const AWARDS: [string, string, number, string][] = [
  ["Global Commons Prize", "Commons Futures Foundation", 1, "For building open, community-owned environmental datasets across 40 cities."],
  ["Young Systems Designer of the Decade", "Sundial Design Council", 5, "Recognised for the household water loop programme."],
  ["Clean Air Champion", "City Air Alliance", 3, "For the City Air Ledger citizen sensor network."],
  ["Social Innovation Fellowship", "Tarang Civic Trust", 7, "Two-year fellowship for the Ward Compost Network."],
  ["Best Open Dataset", "India Open Data Awards (Sundial)", 2, "For the Open Grain Commons."],
  ["Women in Climate Leadership", "Nilgiri Climate Forum", 4, "For leadership across research, policy and community practice."],
];

// [title, authors-tail, venue, yearsAgo, abstract]
export const PAPERS: [string, string, string, number, string][] = [
  ["Household Greywater Loops as Urban Resilience Infrastructure", "R. Pillai, S. Banerjee", "Journal of Urban Water Systems (Sundial)", 9, "We evaluate low-cost household greywater loops across 1,200 homes and show a 31% reduction in freshwater demand with no measurable health risk."],
  ["Community Sensor Networks and Air-Quality Policy", "A. Sharma, M. Chatterjee", "Sundial Conference on Environmental Informatics", 5, "Community-owned air sensors can complement regulatory monitors. We describe a calibration approach and three cases where the data changed local decisions."],
  ["Ward-Level Composting: Behaviour, Logistics and Soil Outcomes", "V. Rao, P. Nair", "Journal of Regenerative Systems (Sundial)", 6, "A two-year study of neighbourhood composting programmes and their effects on collection cost and soil organic matter."],
  ["Open Data as Food-Security Infrastructure", "S. Iyer", "Proceedings of the Sundial Symposium on Data for Good", 3, "We describe the design, governance and use of an open national dataset on crop prices, yields and storage capacity."],
  ["Scales of Living: A Framework for Local-to-Global Systems Thinking", "K. Menon", "Journal of Systems Practice (Sundial)", 2, "A seven-scale framework for reasoning about the essentials of life, from the seed to the planet, with worked examples."],
];

// [name, description, language, stars]
export const REPOS: [string, string, string, number][] = [
  ["scale-ladder", "The Scale Ladder framework: templates, data schemas and worked examples", "TypeScript", 1840],
  ["city-air-ledger", "Firmware and dashboard for low-cost community air sensors", "C++", 960],
  ["open-grain-commons", "Pipelines for the open national crop price and yield dataset", "Python", 1320],
  ["seed-library-kit", "Everything a neighbourhood needs to run a seed library", "Markdown", 410],
  ["planet-health-index", "Open indicators for a planetary health index", "Python", 2210],
];

// [label, path-or-url, featured]
export const LINKS: [string, string, boolean][] = [
  ["Bindu Foundation", "/b/bindu_foundation", true],
  ["Join the Scale Ladder community", "/c/scale_ladder", true],
  ["Read: Scales of Living (book)", "/ira/books/scales_of_living", false],
  ["Subscribe: Scale Notes newsletter", "/ira", false],
  ["Listen: Small Big Things podcast", "/ira", false],
  ["Fund 10,000 Seed Kits", "/b/bindu_foundation", true],
  ["Book a systems-thinking session", "/ira", false],
  ["Open datasets & code", "https://data.bindu-foundation.example", false],
];

export const SOCIALS: [string, string][] = [
  ["twitter", "https://twitter.example/ira_menon"],
  ["linkedin", "https://linkedin.example/in/ira-menon"],
  ["github", "https://github.example/ira-menon"],
  ["youtube", "https://youtube.example/@smallbigthings"],
  ["instagram", "https://instagram.example/ira.menon"],
  ["website", "https://iramenon.example"],
  ["threads", "https://threads.example/@ira.menon"],
  ["telegram", "https://t.example/scaleladder"],
];

export const SKILLS = ["Systems Thinking", "Regenerative Agriculture", "Water & Sanitation", "Climate Modelling", "Open Data", "Service Design", "Community Building", "Policy Design", "Public Speaking", "Data Storytelling", "Grant Writing", "Facilitation"];

export const SHORT_LINKS: [string, string][] = [
  ["scales", "/ira/books/scales_of_living"],
  ["seedkits", "/b/bindu_foundation"],
  ["ladder", "/c/scale_ladder"],
  ["summit", "/e/seed_to_planet_summit"],
];

export const CALENDAR: [string, number, number][] = [
  ["Seed to Planet Summit: opening keynote", 14, 2],
  ["Community office hours", 3, 1],
  ["Podcast recording: Small Big Things", 5, 1],
  ["Panel: Open data for food security", 21, 2],
  ["Seed library workshop", 9, 3],
  ["Book launch, Kochi", 30, 2],
];

// ---------- posts ----------
// Scale thread: one post per scale, replying to the previous one (a real thread).
export const THREAD_INTRO = "A dot is where every scale begins. Thread 🧵 on the seven scales of living, from a single seed to the whole planet, and what matters to live at each. #ScaleLadder #SystemsThinking";
export const THREAD_POSTS: string[] = [
  "1/ The Seed (10⁻³ m). A seed holds a food system in a grain. If we lose the seed, we lose the harvest, the soil life and the culture around it. Keep seeds alive, share them freely. #SeedLibrary",
  "2/ The Body (1 m). Sleep, movement and calm are the base layer of everything else. A tired person can't fix a city. Start with eight hours and a walk. #Health",
  "3/ The Home (10 m). Water, shelter and energy. A bucket of greywater reused on a balcony garden changes a household's water bill and a kid's view of waste. #WaterLoop",
  "4/ The Street (10³ m). Neighbours are infrastructure. A ward that composts together, watches out for each other and shares tools is safer and cleaner. #WardCompost",
  "5/ The City (10⁵ m). Air, transport and clean water are shared, and shared things need shared data. Measure what matters, publish it, then fix it. #CleanAir",
  "6/ The Nation (10⁶ m). Food security, energy and education are decided by policy, and policy is only as good as its data. Open data is public infrastructure. #OpenData",
  "7/ The Planet (10⁷ m). Climate, oceans, biodiversity. The largest scale is the sum of every smaller one. Every seed, home, street and city is part of the answer. #Planet",
  "And back to the dot. Every scale starts small. What is the smallest thing you can do this week that matters at the scale you care about? ⭕",
];

export const POSTS: string[] = [
  "Morning on the backwaters. Sixty seed varieties dried, labelled and back in the library. Small work, long horizon 🌱 #SeedLibrary",
  "Reminder that a compost bin in one ward diverted 4.2 tonnes of kitchen waste in a year. The maths at the street scale is surprisingly encouraging. #WardCompost",
  "Sensors on rooftops, kids reading the numbers, a councillor reading the report. That's how air data becomes a decision. #CleanAir",
  "Hot take: we don't have an information problem in climate, we have an ownership problem. Community-owned data changes who gets listened to. #OpenData",
  "Teaching a class of eight-year-olds to measure the water they use in a day. They found 62 litres of waste before lunch. #WaterLoop",
  "The Scale Ladder in one line: whatever you're fixing, ask what it looks like one scale down and one scale up. It's the best debugging tool I know. #SystemsThinking",
  "A sleepy town, one seed library, 300 varieties of rice, pulses and millet. Culture is stored in seeds too. #Food",
  "Grant writing tip nobody tells you: describe the change at three scales (household, community, region). Reviewers relax when they see the ladder. #Nonprofit",
  "Speaking at the Seed to Planet Summit next month. If you work on food, water, air, health or learning at any scale, come join us 👇 #SeedToPlanet",
  "Why we publish our failures: the pilot in Ward 12 didn't work, and the postmortem helped four other cities avoid the same mistake. #OpenPractice",
  "New dataset drop: 18 months of crop prices from 900 markets, cleaned and documented. CC-BY. Use it, break it, tell us what's wrong. #OpenData",
  "A walk is a systems-thinking tool. You notice the drain, the tree, the school and the bus stop all in one line. Go for one today. #Health",
  "Three years ago this was a spreadsheet. Today it's 40 cities. The lesson: make the first version so small it's embarrassing. #Startups",
  "Reading list for anyone curious about complex systems: start with the small and concrete. Big ideas land better with a seed in your hand. #Books",
  "Clean water is not a product. It's a relationship between a household, a pipe, a utility and a rule. Design all four. #Water",
  "If you're new here: I post about soil, water, air, food, health and learning. Sometimes a poem. Mostly questions. Say hi 👋",
  "The best meeting I attended this year had six people, a whiteboard and a tray of chai. The second-best had 600 and a stage. Both mattered. #Community",
  "Every 'planetary' problem has a doorstep version. Find the doorstep version and start there. #Planet",
  "I'm learning Malayalam recipes from my grandmother's notebook and digitising them for our seed library kits. Culture and biodiversity travel together. #Food",
  "Thank you to the 300+ volunteers who counted, weighed, tested and wrote things down this year. Data is love in spreadsheet form ❤️ #Gratitude",
  "Systems thinking is not about complicated diagrams. It's about asking 'and then what happens?' one more time than is comfortable. #SystemsThinking",
  "The tallest tree started as a seed the size of your fingernail. Keep planting. 🌳",
  "Open question: what's the smallest unit of a city you could measure well? A street? A lane? A house? We're building a lane-level ledger. #CleanAir",
  "Shoutout to every teacher who turned a science class into a field trip. That's where the next generation of scientists is made. #Learning",
  "Today's science communication challenge: explain the carbon cycle using only kitchen objects. Post your best attempt 👇 #Learning",
  "Deadline reminder: seed kit requests for the coming season close Friday. Details at Bindu Foundation. #SeedLibrary",
  "We tested a low-cost sensor against a reference monitor for 90 days. Median error 8%. Full write-up and code linked below. #OpenSource",
  "Something I want more of in the world: pilots that are honest about scaling. What worked at 100 homes rarely works at 100,000 without redesign.",
  "Being part of a planetary story doesn't require being on a stage. It requires showing up for your street on a Saturday. #Community",
  "One lesson from the field: the best data is collected by people who care about the answer. Design for care, not just compliance.",
];

// Polls: [question, options, days open]
export const POLLS: { body: string; options: string[] }[] = [
  { body: "Which scale do you spend most of your working time at? #ScaleLadder", options: ["The Seed / Body", "Home / Street", "City", "Nation / Planet"] },
  { body: "What matters most to live, in your own life right now?", options: ["Clean air", "Clean water", "Good food", "Sleep and health", "Learning"] },
  { body: "Should cities publish street-level air data by default?", options: ["Yes, always", "Yes, with privacy checks", "Only aggregated", "No"] },
  { body: "How do you want to help this season? #SeedLibrary", options: ["Volunteer time", "Share seeds", "Fund seed kits", "Spread the word"] },
  { body: "Best way to learn systems thinking?", options: ["Books", "Courses", "Field projects", "Community groups"] },
];

// Questions (postType = question): [question, answers]
export const QUESTIONS: { body: string; answers: string[] }[] = [
  { body: "How do you start a neighbourhood seed library with almost no budget? #SeedLibrary", answers: ["Start with a shelf in a community hall and 20 jars. Ask five neighbours for their favourite seeds and write down the stories.", "Partner with a local school. Kids love collecting and labelling seeds, and parents follow.", "Set simple rules: take what you need, return seeds from your best plants, keep notes."] },
  { body: "What is the smallest useful air-quality sensor setup for a school? #CleanAir", answers: ["One sensor on the roof, one in a classroom, plus a simple weekly chart the students update by hand.", "Calibrate against a reference monitor once and share the correction factors."] },
  { body: "Any good resources to teach kids the water cycle at home? #Learning", answers: ["A kettle, a cold plate and a window. Evaporation and condensation in five minutes.", "Track a puddle for a day. It tells the whole story."] },
  { body: "How do you keep volunteers motivated for years, not weeks? #Community", answers: ["Give real responsibility early and celebrate the small wins publicly.", "Share the data back to them. People stay when they see the change they made."] },
];

export const REPLIES_TO_IRA = [
  "This is such a clear way to think about it. Thank you for sharing.",
  "Love the ladder framing. Sending this to my team.",
  "We tried something similar in our ward and it worked. Happy to share notes.",
  "Beautifully put. The small things really do add up.",
  "Would love to volunteer. How do we get involved?",
  "This is why open data matters. Thank you for making it public.",
  "Adding this to my classroom lesson plan next week 🙏",
  "Great thread. The last line gave me goosebumps.",
  "Do you have a template for the seed kit? Our school would like to try.",
  "Congratulations on the milestone! Well deserved.",
  "The honesty about the failed pilot is what makes this credible.",
  "Following for more like this. Please keep posting!",
];
export const IRA_REPLY_BACKS = ["Thank you so much! 🌱", "Happy to share, message me and I'll send it over.", "That means a lot, thank you.", "Would love that. Let's talk!", "Appreciate you reading this 🙏", "Great point, thanks for adding it."];

export const DM_LINES: string[][] = [
  ["Hi Ira, I teach at a school in {city}. Would love to run the seed library programme with my class. Where do I begin?", "Hi {a}! Wonderful. I'll send you the starter kit guide and connect you with a school that already does it.", "That would be amazing, thank you!"],
  ["Hello! I read Scales of Living and it changed how I plan my projects. Do you run workshops?", "Thank you, {a}! Yes, there's a Seed to Planet Summit soon and smaller workshops through Bindu Foundation. I'll share details."],
  ["Hi Ira, I'm a data analyst and would like to volunteer for the Open Grain Commons. Any open issues I can pick up?", "Hi {a}, yes! The repo has a 'good first issue' label. Happy to onboard you on a call this week.", "Perfect, I'll take a look tonight."],
  ["Namaste Ira, could you review my grant application for a composting programme?", "Hi {a}. Happy to. Send it over and I'll comment on the scale logic and the metrics.", "Thank you so much, sending it now."],
  ["Hi, would you consider speaking at our college festival about climate careers?", "Hi {a}, thank you for the invitation! Send me the dates and audience size and I'll check my calendar."],
  ["Loved the podcast episode on the city scale. Can you recommend readings on urban air quality?", "Thanks {a}! I'll drop a short reading list in the community wiki this week."],
  ["Hello! We'd like to feature Bindu Foundation in our newsletter. Who should we speak with?", "Hi {a}, thanks! Please email the communications team and mention the Scale Ladder programme."],
  ["Hi Ira, our ward wants to start composting. How did you handle the first three months?", "Great question, {a}. Start with 20 households, one drop point and a weekly meet-up. I'll share our playbook.", "Thank you, that's very helpful."],
  ["Just wanted to say thank you. The seed kit my daughter got last month is her favourite thing right now 🌱", "That made my day, {a}. Send a photo of the first sprout!"],
  ["Hi Ira, can I interview you for my student podcast about careers in sustainability?", "Hi {a}, I'd be glad to. Let's find a slot next week."],
  ["Hello, we run a small NGO in {city}. Could we collaborate on an air sensor pilot?", "Hi {a}, absolutely. Let's set up a call and I'll share the pilot checklist."],
  ["Hi Ira, do you have advice for someone moving from design into climate work?", "Hi {a}! Start with a local project and learn the data. Systems design skills transfer really well. Happy to chat.", "Thank you, that gives me a lot of confidence."],
];
