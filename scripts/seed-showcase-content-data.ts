// Content data for the showcase account: one project, essay, book chapter, lesson, podcast episode
// and newsletter issue per scale (see SCALES in seed-showcase-data.ts), plus extras. Fictional.

export type ScaleContent = {
  project: { slug: string; title: string; summary: string; body: string; highlights: string[]; skills: string[]; links: [string, string][] };
  essay: { title: string; subtitle: string; tags: string[]; intro: string; points: [string, string, string]; closing: string };
  chapter: [string, string];
  lesson: [string, string];
  episode: [string, string, number];
  issue: [string, string, [string, string, string]];
};

const list = (b: string[]) => b.map((x) => `- ${x}`).join("\n");
export const projectBody = (intro: string, highlights: string[]) => `${intro}\n\n## Impact\n\n${list(highlights)}\n\n## How it works\n\nThe project is run by volunteers and community partners, documented in the open, and designed so any neighbourhood can copy it with a small starter kit.`;

export const CONTENT: ScaleContent[] = [
  {
    project: { slug: "seed_vault_kitchen", title: "Seed Vault Kitchen", summary: "A community seed library keeping 300 heirloom varieties alive, with recipes attached.", body: "Every seed is stored with its story: where it grew, who saved it, and what it tastes like.", highlights: ["312 varieties saved", "41 neighbourhood libraries", "9,800 seed packets shared", "Recipe cards for every variety"], skills: ["Regenerative Agriculture", "Community Building"], links: [["Seed library kit", "https://kit.bindu-foundation.example/seed-library"], ["Variety catalogue", "https://data.bindu-foundation.example/varieties"]] },
    essay: { title: "The Seed Is the Smallest Food System", subtitle: "Why the tiniest scale is where resilience begins.", tags: ["seeds", "food", "biodiversity"], intro: "A seed carries a whole food system in a grain: genetics, soil relationships, culture and taste. When we lose seed diversity we lose all of that at once.", points: ["Seed libraries make diversity local and free", "Recipes and stories keep varieties in use", "Sharing beats storing: a seed unused is a seed at risk"], closing: "Start with one jar and one neighbour." },
    chapter: ["The Seed: Food Begins Here", "A single grain of rice holds ten thousand years of selection, culture and knowledge. In this chapter we follow one seed from a farmer's hand to a neighbourhood library and back to the field, and learn what it means to keep a food system alive at its smallest scale."],
    lesson: ["The seed as a system", "A seed is genetics, soil life and human culture in one package. Map the relationships around one seed you know: who grows it, who eats it, who stores it, and what would break if it vanished."],
    episode: ["The Seed: Keeping Food Alive", "How one shelf of jars became a network of 41 seed libraries.", 2010],
    issue: ["Issue 1: Start with a jar", "The smallest scale asks for the smallest first step.", ["Collect five seed varieties from neighbours", "Write the story on each label", "Share your first packet this week"]],
  },
  {
    project: { slug: "sleep_commons", title: "Sleep Commons", summary: "An open sleep-hygiene toolkit used in schools, workplaces and community centres.", body: "Sleep is the base layer of health, learning and mood, and it is free to improve.", highlights: ["120 schools and workplaces", "Toolkit in 6 languages", "Average sleep up 42 minutes in pilots", "Free posters and lesson plans"], skills: ["Public Speaking", "Data Storytelling"], links: [["Toolkit", "https://kit.bindu-foundation.example/sleep"], ["Pilot results", "https://data.bindu-foundation.example/sleep"]] },
    essay: { title: "Sleep Is Infrastructure", subtitle: "A tired person can't fix a city.", tags: ["health", "sleep", "wellbeing"], intro: "We treat sleep as a personal habit, but it is also public infrastructure. Learning, safety and mood all depend on it.", points: ["Fixed wake-up time beats a fixed bedtime", "Light and temperature matter more than gadgets", "Schools and workplaces can make sleep easier"], closing: "Protect eight hours before you optimise anything else." },
    chapter: ["The Body: The Base Layer", "Before we can care for a home, a street or a planet, we must care for the person doing the caring. This chapter lays out the essentials of sleep, movement and calm as the base layer of every scale above it."],
    lesson: ["The body as the base layer", "List the three habits that most affect your ability to help others: sleep, movement and calm. Rate each from one to five and pick one small change for this week."],
    episode: ["The Body: Sleep, Movement, Calm", "A conversation about the base layer of every other scale.", 1780],
    issue: ["Issue 2: Protect your sleep", "Nothing upstream works if the person is exhausted.", ["Fix your wake-up time", "Dim lights after sunset", "Keep the bedroom cool and quiet"]],
  },
  {
    project: { slug: "one_bucket_water_loop", title: "One-Bucket Home Water Loop", summary: "Simple greywater reuse for balconies and small gardens, built from a single bucket.", body: "A bucket, a filter and a hose can turn kitchen greywater into a small garden's supply.", highlights: ["1,200 homes", "31% less freshwater use", "Cost per home under $12", "Tested for safety across three monsoons"], skills: ["Water & Sanitation", "Service Design"], links: [["Build guide", "https://kit.bindu-foundation.example/water-loop"], ["Study", "https://data.bindu-foundation.example/water-loop"]] },
    essay: { title: "A Bucket of Water, a Household of Change", subtitle: "Small water loops change how families think about waste.", tags: ["water", "home", "sustainability"], intro: "Most of our water is used once and thrown away. A bucket-scale loop shows a family how much they use, and what could be reused.", points: ["Measure first: most homes overestimate", "Reuse where quality allows: plants, floors, flushing", "Make it visible so kids can see the loop"], closing: "Start by measuring one day of water." },
    chapter: ["The Home: Water, Shelter, Energy", "A home is where the essentials become personal: the tap, the roof and the switch. Here we look at how a household can shrink its footprint while improving comfort and cost."],
    lesson: ["Measuring a household loop", "Track the water, energy and waste of your home for one day. Draw arrows for what comes in and what goes out, then circle the loops that could close."],
    episode: ["The Home: One Bucket at a Time", "A practical tour of the water loop and what families learn from it.", 1890],
    issue: ["Issue 3: Measure one day of water", "You can't improve what you never count.", ["Read the meter morning and night", "Note each use on a sticky note", "Find the one you could reuse"]],
  },
  {
    project: { slug: "ward_compost_network", title: "Ward Compost Network", summary: "Neighbourhood composting that diverted 4.2 tonnes of kitchen waste per ward per year.", body: "A drop-point, a weekly meet-up and a shared bin turn waste into soil and neighbours into a community.", highlights: ["38 wards", "4.2 tonnes per ward per year", "Soil sold back to gardeners", "Two-year outcomes published"], skills: ["Community Building", "Facilitation"], links: [["Playbook", "https://kit.bindu-foundation.example/ward-compost"], ["Outcome study", "https://data.bindu-foundation.example/ward-compost"]] },
    essay: { title: "Neighbours Are Infrastructure", subtitle: "What a compost bin taught us about community.", tags: ["community", "waste", "neighbourhood"], intro: "The street is the scale where trust is built. A shared bin needs a schedule, a rule and a few people who show up.", points: ["Start with 20 households and one drop-point", "Make the outcomes visible every week", "Celebrate the people who show up"], closing: "A clean street is a social achievement first." },
    chapter: ["The Street: Neighbours Are Infrastructure", "Between the home and the city lies the street, where waste, safety and belonging are decided. This chapter shows how small groups of neighbours build shared systems that outlast any programme."],
    lesson: ["Mapping your street", "Walk your street and list the shared things: light, water, waste, safety, play. For each, note who looks after it today and what would help."],
    episode: ["The Street: A Ward That Composts Together", "The people behind 38 neighbourhood compost networks.", 2100],
    issue: ["Issue 4: Twenty households", "Start small enough to succeed.", ["Pick one drop-point", "Set a weekly time", "Publish the weight every Sunday"]],
  },
  {
    project: { slug: "city_air_ledger", title: "City Air Ledger", summary: "A citizen sensor network publishing street-level air quality for 40 cities.", body: "Low-cost sensors, calibrated against reference monitors, owned and maintained by the neighbourhoods they serve.", highlights: ["1,900 sensors", "40 cities", "Median error 8% vs reference monitors", "Cited in 6 municipal decisions"], skills: ["Open Data", "Climate Modelling", "Policy Design"], links: [["Live map", "https://air.bindu-foundation.example"], ["Firmware and dashboard", "https://github.example/ira-menon/city-air-ledger"]] },
    essay: { title: "Measure What Matters, Publish It, Then Fix It", subtitle: "How community air data becomes a decision.", tags: ["air", "cities", "opendata"], intro: "Air is shared, so data about air must be shared. Community sensors can complement regulatory monitors when they are calibrated and open.", points: ["Calibrate against a reference monitor before trusting", "Publish raw data and methods", "Take the data to the meeting where decisions happen"], closing: "Data changes things when it reaches the right room." },
    chapter: ["The City: Air, Movement, Water", "A city is a machine for sharing: air, roads, pipes. Shared systems need shared data. Here we look at how citizen measurement and municipal action can meet in the middle."],
    lesson: ["Community measurement", "Choose one shared thing in your city (air, noise, water, heat). Sketch how a group of citizens could measure it reliably with a low-cost tool and a calibration step."],
    episode: ["The City: Air Data for Everyone", "How 1,900 sensors changed six city decisions.", 2250],
    issue: ["Issue 5: Calibrate before you trust", "Cheap sensors are only useful if you know their error.", ["Compare against a reference monitor", "Publish your correction factors", "Report uncertainty, not just a number"]],
  },
  {
    project: { slug: "open_grain_commons", title: "Open Grain Commons", summary: "An open national dataset of crop prices, yields and storage, used by farmers, researchers and policymakers.", body: "Food security is a data problem as much as a farming problem. Open, well-documented data lets everyone see the same picture.", highlights: ["900 markets tracked", "18 months of prices, CC-BY", "Used by 14 state agencies", "Best Open Dataset award"], skills: ["Open Data", "Policy Design", "Data Storytelling"], links: [["Dataset", "https://data.bindu-foundation.example/grain"], ["Pipelines", "https://github.example/ira-menon/open-grain-commons"]] },
    essay: { title: "Open Data Is Food-Security Infrastructure", subtitle: "Why national datasets should be public goods.", tags: ["opendata", "foodsecurity", "policy"], intro: "Decisions about food, energy and education are only as good as the data they rest on. Open data makes the evidence visible to everyone.", points: ["Document everything: units, sources, gaps", "Version datasets like software", "Build with users, not for them"], closing: "Public data is public infrastructure." },
    chapter: ["The Nation: Food, Energy, Learning", "At national scale, the essentials are shaped by policy, and policy by data. This chapter looks at how open datasets and public institutions can support food security, clean energy and universal learning."],
    lesson: ["Reading a national dataset", "Pick a public dataset about food, energy or education. Write down what it measures, what it leaves out and one decision it could inform."],
    episode: ["The Nation: Data for Food Security", "What 900 markets can tell a country.", 2400],
    issue: ["Issue 6: Documentation is a feature", "Undocumented data is unusable data.", ["Write down every unit and source", "List known gaps honestly", "Version your dataset"]],
  },
  {
    project: { slug: "planet_health_index", title: "Planetary Health Index", summary: "Open indicators that connect local measurements to planetary health, from soil to oceans.", body: "A transparent index built from community, city and national datasets, designed so local work can be seen in the global picture.", highlights: ["31 indicators", "Built from 5 open datasets", "Used in 3 university courses", "2,210 stars, 190 contributors"], skills: ["Systems Thinking", "Climate Modelling", "Open Data"], links: [["Index", "https://index.bindu-foundation.example"], ["Repository", "https://github.example/ira-menon/planet-health-index"]] },
    essay: { title: "The Planet Is the Sum of Every Doorstep", subtitle: "Why the largest scale needs the smallest actions.", tags: ["climate", "planet", "systemsthinking"], intro: "Planetary problems have doorstep versions. Climate is a sum of homes, streets and cities. Find your doorstep version and start there.", points: ["Every scale is part of the answer", "Connect local data to global indicators", "Celebrate contributions at every scale"], closing: "The tallest tree started as a seed." },
    chapter: ["The Planet: The Sum of Everything", "The planet is not somewhere else: it is the sum of every seed, body, home, street, city and nation. This chapter closes the ladder and returns to the dot where every scale begins."],
    lesson: ["From doorstep to planet", "Pick one planetary problem and find its doorstep version. Then trace the chain up: home, street, city, nation, planet. Where could your action connect?"],
    episode: ["The Planet: Starting at the Doorstep", "A conversation on connecting local action to global outcomes.", 2500],
    issue: ["Issue 7: The doorstep version", "Every planetary problem has one.", ["Name the big problem", "Find its smallest version near you", "Do one thing about it this week"]],
  },
];

export const EXTRA_ARTICLES: { title: string; subtitle: string; format: "article" | "tutorial" | "note"; tags: string[]; intro: string; points: string[]; closing: string }[] = [
  { title: "How to Run a Ward Compost Pilot in 90 Days", subtitle: "A practical playbook from 38 wards.", format: "tutorial", tags: ["community", "waste", "playbook"], intro: "A ward compost pilot doesn't need funding. It needs a place, a schedule and neighbours who care.", points: ["Recruit 20 households and one drop-point host", "Choose a weekly collection time and stick to it", "Weigh and publish the amount each week", "Hold a 90-day review and decide together", "Share the results with the ward councillor"], closing: "Small, regular and visible beats big and occasional." },
  { title: "Field Notes: Ten Things I've Measured This Year", subtitle: "Numbers from soil to sky.", format: "note", tags: ["data", "fieldnotes", "measurement"], intro: "A running list of measurements that changed my mind.", points: ["A backyard bin: 1.8 kg of kitchen waste per household per week", "A rooftop sensor: 40% higher PM2.5 at 7am than at 2pm", "A balcony garden: 22 litres of greywater reused a week", "A seed library: 60 packets borrowed in the first month", "A class of 8-year-olds: 62 litres of avoidable waste before lunch"], closing: "Measure it and it becomes discussable." },
  { title: "Why Systems Thinking Is a Practice, Not a Diagram", subtitle: "The habit of asking 'and then what?'", format: "article", tags: ["systemsthinking", "practice"], intro: "The best systems thinkers I know are curious and humble, and their diagrams are usually messy.", points: ["Ask 'and then what happens?' once more than is comfortable", "Look one scale up and one scale down", "Prefer small experiments to grand models"], closing: "The practice is the point." },
  { title: "Writing Grants That Reviewers Remember", subtitle: "Describe the change at three scales.", format: "article", tags: ["grants", "nonprofit"], intro: "Reviewers read hundreds of proposals. The ones they remember make the change visible at more than one scale.", points: ["Show the household-level change", "Show the community-level change", "Show the region-level change and how you'll measure it"], closing: "The ladder helps reviewers relax." },
];

export const WIKI_FIELD_GUIDE = {
  root: ["Scale Ladder Field Guide", "A working guide to the seven scales of living: what matters at each one, how to measure it, and what to do first. Each page below covers one scale."],
  glossary: ["Glossary", "**Scale**: the size at which a system operates. **Doorstep version**: the smallest version of a large problem near you. **Loop**: a flow that returns to its start (water, waste, nutrients). **Commons**: something shared and cared for by a community."],
  pageBody: (name: string, size: string, matters: string) => `**${name}** (${size}). What matters to live here: ${matters}.\n\n## Start here\n\n- Notice what is already working\n- Measure one thing for a week\n- Share what you learn with one neighbour\n\n## Go deeper\n\nSee the matching chapter in the book *Scales of Living* and the lesson in the course.`,
};

export const COURSES = [
  { title: "Systems Thinking from Seed to Planet", description: "A seven-scale course on seeing and shaping the systems that keep us alive, with a field project at every scale.", price: 49, moduleScales: [[0, 1], [2, 3], [4, 5], [6]] as number[][] },
  { title: "Community Data Practice", description: "How to collect, clean, publish and use community data ethically and effectively.", price: 79, modules: [["Collecting Data", [["Design a measurement", "Choose what to measure, how often and who will do it."], ["Calibrate and check", "Compare against a reference and record the error."]]], ["Publishing Data", [["Document it", "Units, sources, gaps and licence."], ["Share it well", "Formats, dashboards and stories."]]], ["Using Data", [["Take it to the decision", "Find the room where the decision happens."], ["Close the loop", "Report what changed because of the data."]]]] as [string, [string, string][]][] },
];

export const LIVESTREAMS: [string, number][] = [
  ["Live: Building a seed library from scratch", -40],
  ["Live Q&A: Community air sensors, calibration and policy", -21],
  ["Live workshop: Draw your own Scale Ladder", -8],
  ["Live: Seed to Planet Summit preview and Q&A", 6],
];

export const FILES = [
  { title: "Scale Ladder Worksheet", description: "A one-page worksheet for mapping any problem across the seven scales.", filename: "scale-ladder-worksheet.md", mime: "text/markdown", content: "# Scale Ladder Worksheet\n\nProblem: ______\n\n| Scale | What it looks like here | One small action |\n|-------|--------------------------|-------------------|\n| Seed | | |\n| Body | | |\n| Home | | |\n| Street | | |\n| City | | |\n| Nation | | |\n| Planet | | |\n\nAsk: what happens one scale down, and one scale up?\n" },
  { title: "Community Measurement Log (CSV)", description: "A simple log template for any community measurement project.", filename: "measurement-log.csv", mime: "text/csv", content: "date,location,measurement,value,unit,recorded_by,notes\n2026-01-05,Ward 12,PM2.5,64,ug/m3,volunteer_1,morning\n2026-01-05,Ward 12,kitchen waste,1.8,kg,household_7,weekly\n2026-01-06,School yard,water use,62,litres,class_5,avoidable waste\n" },
  { title: "Seed Library Starter Guide", description: "Everything you need to start a neighbourhood seed library.", filename: "seed-library-starter.md", mime: "text/markdown", content: "# Seed Library Starter Guide\n\n1. Find a shelf in a community hall\n2. Collect 20 jars and labels\n3. Ask five neighbours for seeds and stories\n4. Write simple rules: take what you need, return seeds from your best plants\n5. Host a launch swap on a Saturday\n" },
];

export const FORM = {
  title: "Community Needs Survey",
  description: "Help us understand what matters most to live in your neighbourhood. Takes two minutes and is anonymous in reports.",
  fields: [
    { label: "Which scale do you care about most?", type: "choice", required: true, options: ["Seed / soil", "Body / health", "Home", "Street", "City", "Nation", "Planet"], description: "" },
    { label: "What matters most to live in your neighbourhood?", type: "choice", required: true, options: ["Clean air", "Clean water", "Good food", "Health services", "Learning", "Safety", "Green space"], description: "" },
    { label: "How would you rate your neighbourhood's air quality?", type: "rating", required: false, options: [], description: "1 = poor, 5 = excellent" },
    { label: "Tell us about one thing you'd like to fix", type: "text", required: false, options: [], description: "" },
    { label: "When could you attend a community meeting?", type: "date", required: false, options: [], description: "" },
  ],
  answers: ["Please fix the drain near the school.", "Would love more shade trees on our lane.", "Water pressure drops every evening.", "A weekly farmers' market would be wonderful.", "Waste collection is irregular after the rains.", "Safer crossings for children.", "More community events for elders."],
};

export const COMMENTS = [
  "This is one of the clearest explanations I've read. Thank you.", "Bookmarked for my next workshop.", "Beautifully framed. The ladder idea is powerful.",
  "We're trying this in our ward and it works.", "Great to see the data published openly.", "Sharing with my class tomorrow.", "The last line stayed with me.",
  "Practical and inspiring. More please!", "How do you handle calibration at scale?", "Thank you for documenting the failures too.",
];
