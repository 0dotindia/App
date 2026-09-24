// Static content for scripts/seed-dots-content.ts — written content: articles, newsletter
// issues, books and wiki pages. Everything is original filler written for seed data.
import type { RoleKey } from "./seed-dots-data";

export type ArticleFormat = "article" | "tutorial" | "note";
// [title, subtitle, format, tags, intro, points, closing]
export type ArticleT = readonly [string, string, ArticleFormat, readonly string[], string, readonly string[], string];

export function articleBody(format: ArticleFormat, intro: string, points: readonly string[], closing: string): string {
  if (format === "tutorial") return `${intro}\n\n## Steps\n\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\n${closing}`;
  if (format === "note") return `${intro}\n\n${points.map((p) => `- ${p}`).join("\n")}\n\n${closing}`;
  return `${intro}\n\n## Key ideas\n\n${points.map((p) => `- ${p}`).join("\n")}\n\n${closing}`;
}

export const ARTICLES: Record<RoleKey, ArticleT[]> = {
  swe: [
    ["Why Your Cron Jobs Deserve a Queue", "A small change that removed most of our 3am pages.", "article", ["backend", "reliability"], "Cron is great until a job runs twice, silently fails or overlaps with itself. We moved our scheduled work to a queue and the pager got quieter.", ["Retries with backoff replace hand-written loops", "Visibility: you can see what is waiting, running and stuck", "Idempotency keys make double runs harmless"], "Start with your most important job, not all of them."],
    ["Writing a Useful README in 10 Minutes", "If someone can't run your project quickly, it isn't finished.", "tutorial", ["opensource", "documentation"], "A README is the front door of a project. Here is the smallest version that still gets people running.", ["State what the project does in one sentence", "Show the exact commands to install and run it", "List the three most common errors and their fixes", "Link to contributing notes and the licence"], "Update it whenever the setup changes, not when someone complains."],
    ["Code Review Notes I Keep Coming Back To", "Questions beat commands, and small PRs beat clever ones.", "note", ["career", "codereview"], "A few habits that have made reviews faster and friendlier for me.", ["Ask a question before suggesting a rewrite", "Review the tests first; they tell you the intent", "Approve with comments when the risk is low", "Keep pull requests under 400 lines"], "Reviews are a conversation, not a gate."],
  ],
  design: [
    ["Designing Forms People Finish", "Small changes that cut form abandonment.", "article", ["ux", "forms"], "Most forms fail because they ask too much, too early. Here is what consistently helps.", ["One question per screen on mobile", "Explain why you need sensitive data", "Show progress and let people go back"], "Test with five real users before you polish anything."],
    ["A Practical Colour Palette in 15 Minutes", "Pick colours that pass accessibility checks the first time.", "tutorial", ["color", "accessibility"], "You do not need ten shades. You need a few that work together and pass contrast checks.", ["Choose one brand hue and one neutral", "Generate a light and dark shade of each", "Check every text and background pair for contrast", "Save them as named tokens"], "Tokens keep the palette consistent when the team grows."],
    ["Notes from Watching People Use My Design", "What five usability sessions taught me.", "note", ["research", "ux"], "I watched five people use a screen I was proud of. It was humbling.", ["People skip instructions, always", "Icons without labels get misread", "A calm empty state reduces support requests"], "Watching beats guessing every single time."],
  ],
  pm: [
    ["How I Write a One-Page PRD", "Short documents get read. Long ones get skimmed.", "article", ["product", "planning"], "A PRD's job is to align a team, not to impress it. One page is enough for most changes.", ["Problem and who has it", "What success looks like, with a number", "What we are explicitly not doing"], "If it doesn't fit on one page, the scope is probably too big."],
    ["Running a Lightweight Discovery Sprint", "Five days to validate a bet before building it.", "tutorial", ["product", "discovery"], "Before a big build, spend a week learning whether the problem is real.", ["Write the riskiest assumption on a whiteboard", "Interview five target users", "Prototype the smallest test", "Decide: build, change or drop"], "The goal is a decision, not a document."],
    ["Metrics I Actually Look At Every Week", "A short list that cuts through dashboards.", "note", ["metrics", "product"], "Dashboards are noisy. These are the numbers I check before anything else.", ["Activation rate for new users", "Week-4 retention", "Time to first value", "Support tickets per 100 users"], "If a metric never changes a decision, remove it."],
  ],
  data: [
    ["Cleaning Messy CSVs Without Losing Your Mind", "A repeatable approach for the unglamorous 80%.", "tutorial", ["data", "python"], "Most analysis time goes into cleaning. A repeatable checklist saves hours.", ["Detect the encoding and delimiter first", "Profile columns: types, nulls, duplicates", "Fix issues in code, never by hand in a spreadsheet", "Save the cleaned file plus a change log"], "Reproducible cleaning is half the value of any analysis."],
    ["When a Simple Model Beats a Fancy One", "A baseline should be the first thing you build.", "article", ["machinelearning", "modeling"], "A good baseline tells you if a complex model is worth its cost.", ["Start with a naive forecast or logistic regression", "Measure the same metric for every model", "Only add complexity when the gain is clear"], "Explainable and boring often wins in production."],
    ["Notes on Explaining Models to Non-Technical Teams", "Trust comes from clarity, not accuracy alone.", "note", ["communication", "data"], "The best model is useless if nobody trusts it.", ["Start with the decision the model supports", "Show examples, not equations", "Be upfront about where it fails"], "Say what you don't know. It builds credibility."],
  ],
  founder: [
    ["What I Learned From My First 10 Customers", "Nothing scalable, everything valuable.", "article", ["startup", "sales"], "Our first ten customers came from personal calls and community groups. They taught us more than any market report.", ["Talk to them every week in the first months", "Charge early, even a small amount", "Write down exactly why each one said yes"], "Do things that don't scale until you understand the customer."],
    ["A Simple 90-Day Pilot Playbook", "How we turned pilots into paying customers.", "tutorial", ["b2b", "startup"], "A pilot should have a start, an end and a clear success measure.", ["Agree on one measurable outcome up front", "Set weekly check-ins with the sponsor", "Share results in a one-page summary", "Ask for the paid plan on day 85"], "A pilot without an end date is free consulting."],
    ["Founder Notes: Hiring Slowly", "A slow no beats a fast yes.", "note", ["hiring", "startup"], "Every hiring mistake I made started with urgency.", ["Write the outcome of the role before the job post", "Use a paid work sample", "Check references you did not get from the candidate"], "The right person is worth the wait."],
  ],
  photo: [
    ["Shooting Street Photography in Bright Midday Light", "Harsh sun can be your friend.", "tutorial", ["photography", "street"], "Midday light is harsh, but it also makes strong shadows and shapes.", ["Expose for the highlights and let shadows fall", "Look for doorways and bright patches of light", "Wait for a subject to step into the frame", "Convert to black and white if colour is distracting"], "Practise in one street until you know it well."],
    ["Why I Shoot with One Lens for a Year", "Constraints make better photographers.", "article", ["gear", "photography"], "I put a 35mm lens on my camera and left the rest at home.", ["You learn to move your feet", "You see the world in one field of view", "Your portfolio becomes more consistent"], "You don't need more gear. You need more frames."],
    ["Notes on Photographing Strangers Respectfully", "A few habits for portraits in public.", "note", ["portraits", "ethics"], "Photographing people is a relationship, even a brief one.", ["Smile and ask before the shot when you can", "Show them the photo afterwards", "Share prints with the people you shoot"], "A short conversation often gives you a better portrait."],
  ],
  writer: [
    ["How I Edit a First Draft", "Three passes, three different jobs.", "article", ["writing", "editing"], "Editing in one pass never works for me. I split it up.", ["Structure first: does the order make sense?", "Sentences next: cut every needless word", "Sound last: read it aloud"], "Take a day off between passes."],
    ["A Daily Writing Habit That Survived Two Months", "The rules that made it stick.", "tutorial", ["habit", "writing"], "A daily practice only works if it is small enough to survive a bad day.", ["Write at the same time every day", "Set a floor of 200 words", "Never edit during the session", "Track it on a paper calendar"], "The habit matters more than the quality, at least at the start."],
    ["Notes from Reporting in Small Towns", "What big cities forget to ask.", "note", ["journalism", "reporting"], "Small-town stories rarely trend but they matter.", ["Spend the first hour listening, not asking", "Return to say thank you", "Check names and spellings twice"], "People remember how you treated them."],
  ],
  food: [
    ["Getting Dosa Batter to Ferment in Winter", "Small tricks that actually work.", "tutorial", ["cooking", "southindian"], "Cold kitchens slow fermentation. These fixes have never failed me.", ["Grind the batter slightly thicker", "Add a spoon of poha or cooked rice", "Keep the bowl in a switched-off oven with the light on", "Wait 10 to 14 hours, not 8"], "Salt after fermentation if your kitchen is very cold."],
    ["Why Every Home Needs One Great Kadhi Recipe", "A comfort dish and a lesson in patience.", "article", ["recipes", "homecooking"], "Kadhi looks simple and is surprisingly hard to get right. Patience is the whole technique.", ["Use properly sour curd", "Whisk the besan in before heating", "Simmer for at least 30 minutes"], "Serve it with hot rice and a spoon of ghee."],
    ["Notes on Baking in a Hot Kitchen", "Working with 35°C weather.", "note", ["baking", "tips"], "Summer changes everything about dough and butter.", ["Use cold water and chill your flour", "Shorten bulk fermentation", "Bake early in the morning"], "Adjust the method, not the recipe."],
  ],
  fitness: [
    ["A 10-Minute Mobility Routine for Desk Workers", "Do it between meetings.", "tutorial", ["fitness", "mobility"], "Sitting for hours tightens hips and shoulders. This short routine helps.", ["Cat-cow, 10 slow rounds", "90/90 hip switches, 8 per side", "Thoracic rotations, 8 per side", "Standing hamstring hinge, 10 reps"], "Consistency beats intensity every time."],
    ["Why Beginners Should Master the Bodyweight Squat First", "Strong foundations, healthy knees.", "article", ["strength", "beginners"], "Before adding weight, learn to move well.", ["Keep the chest tall and heels down", "Go only as deep as you can control", "Build to 3 sets of 12 before adding load"], "Progress slowly and you'll progress for years."],
    ["Notes on Building an Early Morning Habit", "It's a routine, not motivation.", "note", ["habits", "fitness"], "Waking early is about the night before.", ["Lay out clothes the night before", "Sleep at a fixed time", "Start with a short session"], "Boring routines work."],
  ],
  music: [
    ["Slow Practice: The Riyaz Technique That Works", "Speed comes from accuracy.", "article", ["music", "practice"], "Fast, sloppy runs build sloppy habits. Slow practice builds skill.", ["Sing or play at half speed with a drone", "Record yourself and listen back", "Increase tempo only when clean three times"], "Twenty focused minutes beat two careless hours."],
    ["Recording Vocals at Home on a Budget", "Quiet room, one mic, good habits.", "tutorial", ["recording", "vocals"], "You don't need a studio for a clean vocal recording.", ["Pick the quietest room and soften the walls", "Place the mic a hand's width from your mouth", "Record with headphones to avoid bleed", "Do three takes and comp the best"], "Good performance beats expensive gear."],
    ["Notes on Playing with New Musicians", "How to make a first jam go well.", "note", ["collaboration", "jam"], "First jams can be awkward. These help.", ["Agree on key and tempo first", "Leave space for everyone", "Listen more than you play"], "Say thank you at the end."],
  ],
  doctor: [
    ["Simple Habits That Protect Your Heart", "Small changes with big effects.", "article", ["health", "prevention"], "Most heart disease is preventable. Everyday choices matter more than we think. This is general information, not medical advice.", ["Walk 30 minutes on most days", "Cut back on salt and sugary drinks", "Get blood pressure checked yearly"], "See a doctor for advice specific to you."],
    ["What to Expect at a Child's Vaccination Visit", "A guide for nervous parents.", "tutorial", ["parenting", "children"], "Vaccination visits are quick, but preparing helps.", ["Carry the vaccination card and previous records", "Feed your child before the visit", "Stay for 20 minutes afterwards", "Note any fever and call if it lasts"], "Ask questions. That is what we are there for."],
    ["Notes on Communicating with Patients", "Listening is the first treatment.", "note", ["medicine", "communication"], "The best doctors I know listen first.", ["Let the patient finish their story", "Explain in plain language", "Repeat back the plan"], "Clarity builds trust."],
  ],
  teacher: [
    ["Making Maths Less Scary", "Activities that build confidence.", "article", ["education", "maths"], "Many students fear maths because they fear being wrong. We can change that.", ["Celebrate wrong answers as useful information", "Use real objects before symbols", "End every class with a puzzle"], "Confidence grows from small wins."],
    ["A Five-Minute Question of the Day Routine", "Start class with thinking.", "tutorial", ["classroom", "teaching"], "One good question wakes a class up.", ["Write a question on the board before students arrive", "Give two minutes of silent thinking", "Ask pairs to share their answer", "Reveal and discuss the reasoning"], "The reasoning matters more than the answer."],
    ["Notes on Calm Exam Preparation", "For students and parents.", "note", ["exams", "students"], "Exam stress is real, and small routines help.", ["Solve one timed past paper every week", "Sleep well the night before", "Take short breaks every 45 minutes"], "Steady effort beats last-minute panic."],
  ],
  finance: [
    ["Old vs New Tax Regime: How to Compare", "A method, not advice.", "tutorial", ["tax", "personalfinance"], "Choosing between regimes depends on your deductions. Here is how to compare them yourself. This is educational only.", ["List your yearly income and eligible deductions", "Compute tax under each regime", "Compare the totals", "Revisit every year"], "When in doubt, check with a qualified professional."],
    ["Why an Emergency Fund Comes First", "Boring, correct.", "article", ["saving", "personalfinance"], "Investing before saving for emergencies can force you to sell at the wrong time.", ["Aim for six months of essential expenses", "Keep it in a safe, liquid account", "Top it up before increasing investments"], "Peace of mind is a return too."],
    ["Notes on Keeping Books for a Small Business", "Habits that make tax time easier.", "note", ["business", "accounting"], "Good books are a habit, not a project.", ["Record every transaction weekly", "Keep bills and invoices in one folder", "Reconcile the bank statement monthly"], "Future you will be grateful."],
  ],
  film: [
    ["Editing Rhythm: When to Cut", "A short guide for short films.", "article", ["film", "editing"], "The best cuts are felt, not noticed.", ["Cut on action to hide the edit", "Let quiet moments breathe", "Use sound to bridge scenes"], "Watch your edit with the sound off, then with your eyes closed."],
    ["Shooting a Short Film with a Three-Person Crew", "Plan tightly, shoot lightly.", "tutorial", ["filmmaking", "production"], "Small crews can make great films with good planning.", ["Write a shot list for every scene", "Scout locations at the same time of day", "Record clean sound first, always", "Back up footage before leaving set"], "Constraints create style."],
    ["Notes on Lighting with a Single Window", "Natural light is enough.", "note", ["lighting", "cinematography"], "One window and a reflector can look cinematic.", ["Place the subject at 45 degrees to the window", "Use white card to fill shadows", "Close other light sources"], "Learn to see light before buying it."],
  ],
  student: [
    ["How I Prepared for Campus Placements", "What worked over six months.", "article", ["career", "placements"], "Placement preparation felt overwhelming until I broke it into small weekly goals.", ["One DSA topic a week with practice problems", "Mock interviews with friends every Sunday", "Build one project you can explain deeply"], "Consistency matters more than intensity."],
    ["Setting Up a Simple Web Project from Scratch", "For your first portfolio site.", "tutorial", ["webdev", "beginners"], "You can have a real site online this weekend.", ["Create a folder and an index.html file", "Add a stylesheet and a few sections", "Push the folder to a Git repository", "Deploy it with a free static host"], "Ship it, then improve it."],
    ["Notes on Studying in Groups", "When it helps and when it doesn't.", "note", ["study", "students"], "Group study works if it has a structure.", ["Assign one topic per person to teach", "Set a timer", "Finish with a mini quiz"], "Small groups of three or four work best."],
  ],
  art: [
    ["Ink Every Day: What 31 Drawings Taught Me", "A practice log.", "article", ["art", "illustration"], "I drew with ink every day for a month. Here is what changed.", ["Commitment beats talent", "Mistakes become style", "Themes emerge after two weeks"], "Draw before you feel ready."],
    ["Watercolour Basics: Getting Your First Wash Right", "Water, pigment and patience.", "tutorial", ["watercolour", "painting"], "A smooth wash is the foundation of watercolour painting.", ["Tape the paper down on a board", "Wet the paper evenly", "Load the brush and paint in overlapping strokes", "Let it dry flat, without touching"], "Patience is the whole technique."],
    ["Notes on Finding Your Style", "You already have one.", "note", ["art", "creativity"], "Style comes from repeated choices.", ["Collect your last 30 pieces and look for patterns", "Notice which ones felt easy", "Do more of that"], "Your style is what you can't stop doing."],
  ],
  marketing: [
    ["Launching a D2C Product in 30 Days", "A simple go-to-market outline.", "article", ["marketing", "startup"], "A first launch needs focus more than budget.", ["Pick one customer and one channel", "Write three messages and test them", "Collect testimonials from the first ten buyers"], "Learn fast, spend slowly."],
    ["Finding Your Brand Voice in an Afternoon", "A workshop you can run alone.", "tutorial", ["branding", "content"], "A brand voice is how you sound when you are at your best.", ["List five words you want people to say about you", "Write one sentence in that voice", "Rewrite an old post the same way", "Save examples of do and don't"], "Consistency builds recognition."],
    ["Notes on Growing a Newsletter", "Ten experiments, three winners.", "note", ["newsletter", "growth"], "What actually moved the needle.", ["A clear promise on the signup page", "One useful lead magnet", "Shoutouts with similar creators"], "Growth follows usefulness."],
  ],
  sports: [
    ["Why Match Practice Beats Endless Nets", "Train the way you'll play.", "article", ["cricket", "coaching"], "Skill under pressure is its own skill.", ["Simulate match situations in practice", "Set targets for every net session", "Review footage together"], "Fewer nets, more decisions."],
    ["A Simple Warm-Up for Young Cricketers", "Ten minutes to prevent injuries.", "tutorial", ["cricket", "fitness"], "Warm-ups prevent injuries and prepare the mind.", ["Light jog for 3 minutes", "Dynamic stretches for legs and shoulders", "Throwing progression in pairs", "A few high-intensity sprints"], "Make it a habit, not an option."],
    ["Notes on Being a Good Team Player", "It isn't about the scorecard.", "note", ["teamwork", "sports"], "Teams win through small acts.", ["Back up every throw", "Encourage the youngest player", "Accept decisions gracefully"], "Culture beats talent."],
  ],
};

// [subject, blurb, three bullets]
export type IssueT = readonly [string, string, readonly [string, string, string]];
export const NEWSLETTERS: Partial<Record<RoleKey, { name: string; issues: IssueT[] }>> = {
  writer: { name: "The Editor's Desk", issues: [
    ["Issue 1: Cut the first paragraph", "The most useful edit I know is deleting your opening.", ["Read your draft without the first paragraph", "Ask what the reader actually needs first", "Keep only the sentence that earns its place"]],
    ["Issue 2: Verbs over adjectives", "Strong verbs do the work of three adjectives.", ["Circle every 'very' and 'really'", "Replace weak verbs with one specific verb", "Read the result aloud"]],
    ["Issue 3: Interviewing for stories", "Better questions get better quotes.", ["Ask 'what happened next?'", "Stay quiet longer than feels comfortable", "Follow the surprising answer"]],
  ] },
  founder: { name: "Founder Diaries", issues: [
    ["Month 6: The first hire", "What I wish I had known before hiring number one.", ["Define the outcome, not the role", "Do a paid trial project", "Write down what you will not do"]],
    ["Month 7: Cash is a story", "Runway math and what it means for your decisions.", ["Track weekly, not monthly", "Know your default-alive date", "Keep six months of buffer sooner"]],
    ["Month 8: Saying no to customers", "Not every customer request is a roadmap item.", ["Track requests, count them", "Say 'not now' clearly", "Build for the pattern, not the loudest voice"]],
  ] },
  finance: { name: "Rupee Notes", issues: [
    ["This month: understanding advance tax", "A plain-language walkthrough (educational only).", ["Who needs to pay it", "The four instalment dates", "How to estimate your liability"]],
    ["This month: choosing an emergency fund", "Where to keep money you can't afford to lose.", ["Liquid and safe beats high-yield", "Automate the top-ups", "Separate it from your daily account"]],
    ["This month: a simple budget", "The 50-30-20 rule, adapted for Indian households.", ["Needs, wants, savings", "Adjust for rent and family support", "Review after three months"]],
  ] },
  marketing: { name: "Growth Journal", issues: [
    ["Issue 1: One channel is enough", "Why focus beats spread.", ["Pick the channel where your customers already are", "Test for four weeks", "Double down or drop"]],
    ["Issue 2: Writing headlines that get clicked", "Clarity first, cleverness second.", ["Say what the reader gets", "Add a number or timeframe", "Test two versions"]],
    ["Issue 3: Customer stories that sell", "The structure that works every time.", ["Before, during, after", "One clear result", "A quote in the customer's words"]],
  ] },
  pm: { name: "Product Chai Weekly", issues: [
    ["Week 12: Saying no gracefully", "How to decline a feature and keep the relationship.", ["Acknowledge the problem behind the request", "Share the tradeoff", "Offer an alternative"]],
    ["Week 13: Roadmaps that survive contact", "Outcome-based roadmaps in one page.", ["Themes, not features", "Confidence levels", "Review monthly"]],
    ["Week 14: Talking to customers", "Five interview questions I always use.", ["Tell me about the last time you...", "What did you try before?", "What would make it easier?"]],
  ] },
  data: { name: "Small Data Notes", issues: [
    ["Note 1: Start with a baseline", "Your first model should be embarrassingly simple.", ["Predict the mean or last value", "Measure it properly", "Beat it or stop"]],
    ["Note 2: Plots before models", "Ten minutes of plotting saves days.", ["Histogram every numeric column", "Scatter the target against features", "Look for weirdness"]],
    ["Note 3: Reproducibility", "Make your work re-runnable.", ["Pin versions", "Seed randomness", "Save the data version"]],
  ] },
  food: { name: "Desi Kitchen Notes", issues: [
    ["Monsoon comfort food", "What I'm cooking when it rains.", ["Kadhi pakora with hot rice", "Ginger tea with jaggery", "Roasted corn with lime and chaat masala"]],
    ["Winter batters and doughs", "Fermentation in cold weather.", ["Keep it warm", "Give it time", "Adjust salt late"]],
    ["A pantry for busy weeks", "Ten ingredients that make quick meals.", ["Roasted besan", "Frozen peas and paneer", "Ready tempering spices"]],
  ] },
  fitness: { name: "Sunrise Notes", issues: [
    ["Week 1: Show up", "Consistency is a skill you can practise.", ["Set a tiny goal", "Same time daily", "Track it"]],
    ["Week 2: Sleep as training", "Recovery is where progress happens.", ["Fixed bedtime", "Dim lights at night", "No screens in bed"]],
    ["Week 3: Mobility snacks", "Two-minute movement breaks.", ["Hip openers", "Shoulder rolls", "Neck stretches"]],
  ] },
  photo: { name: "Frames & Stories", issues: [
    ["Frame 1: Light before subject", "Notice light first.", ["Walk your street at different times", "Note where light pools", "Return with a camera"]],
    ["Frame 2: The edit is the photograph", "Selecting is half the craft.", ["Cull hard", "Sequence your best ten", "Sit with them for a week"]],
    ["Frame 3: Monsoon shooting", "Protect your gear, embrace the mood.", ["Carry a rain cover", "Look for reflections", "Shoot at blue hour"]],
  ] },
  music: { name: "Riyaz Log", issues: [
    ["Log 1: Twenty minutes daily", "Small and steady wins.", ["Fixed time", "One focus per session", "Record on Sundays"]],
    ["Log 2: Learning from recordings", "Listen actively.", ["Transcribe one phrase", "Sing along slowly", "Note the ornaments"]],
    ["Log 3: Playing live", "Preparing for your first gig.", ["Rehearse the set in order", "Plan transitions", "Warm up your voice"]],
  ] },
  teacher: { name: "Classroom Notes", issues: [
    ["Note 1: Starting class well", "The first five minutes decide the tone.", ["Greet at the door", "Board question ready", "Silent thinking time"]],
    ["Note 2: Feedback that helps", "Comment on the work, not the student.", ["One strength", "One next step", "Ask them to try again"]],
    ["Note 3: Parent meetings", "Make them a partnership.", ["Start with something positive", "Share one concrete plan", "Follow up in two weeks"]],
  ] },
  doctor: { name: "Ask Your Doctor", issues: [
    ["Issue 1: Monsoon health basics", "General information, not medical advice.", ["Boil or filter drinking water", "Avoid stagnant water near home", "See a doctor for persistent fever"]],
    ["Issue 2: Sleep and health", "Why seven hours matters.", ["Fixed schedule", "Limit caffeine after noon", "Cool, dark room"]],
    ["Issue 3: Screen time for children", "Practical limits.", ["No screens at meals", "Fixed daily window", "Encourage outdoor play"]],
  ] },
};

// Books: match roles, title, description, chapters [title, body]
export type BookT = { roles: RoleKey[]; slug: string; title: string; description: string; chapters: [string, string][] };
export const BOOKS: BookT[] = [
  { roles: ["writer"], slug: "small_town_diaries", title: "Small Town Diaries", description: "Twelve reported stories from towns that rarely make national news.", chapters: [["The Last Cinema", "The single-screen cinema of a quiet town has shown a film every evening for sixty years. This is the story of the man who still sells the tickets."], ["A Market Before Dawn", "Fruit sellers arrive at three in the morning. By six, the market is gone. We followed one family through a single day."], ["The Bus That Runs Late", "A single bus connects a village to the district hospital. Its delays shape every family's decisions."], ["Letters from the Post Office", "In an age of messaging, the post office still carries something no app can: proof that someone waited."]] },
  { roles: ["food"], slug: "the_home_cooks_handbook", title: "The Home Cook's Handbook", description: "Everyday Indian cooking, explained simply.", chapters: [["Setting Up Your Kitchen", "A few good pans, a sharp knife and a tadka pan are enough. This chapter covers the essentials and what you can skip."], ["Mastering the Tadka", "Tempering is the heart of Indian cooking. Learn the order, the timing and the smells that tell you when to stop."], ["Dals for Every Day", "From the simplest toor dal to festive versions, here is a rotation that never feels boring."], ["Baking in Indian Kitchens", "Working with humid, hot kitchens, pressure cooker ovens and limited equipment."]] },
  { roles: ["teacher"], slug: "maths_without_fear", title: "Maths Without Fear", description: "Classroom-tested activities for confident learners.", chapters: [["Why We Fear Maths", "Fear usually starts with a single embarrassing moment. The first step is making mistakes safe."], ["Numbers You Can Touch", "Using objects, beads and paper folding to make ideas concrete."], ["Puzzles as Practice", "Short puzzles that build pattern sense without feeling like homework."]] },
  { roles: ["finance"], slug: "money_basics_india", title: "Money Basics for First-Time Earners", description: "A plain-language guide to budgeting, tax and saving. Educational only.", chapters: [["Your First Salary", "Understanding your payslip, deductions and what is really yours to spend."], ["Budgeting Without Boredom", "A simple system you can maintain without a spreadsheet obsession."], ["Emergency Funds and Insurance", "The two things to sort out before anything else."], ["Tax Basics", "Regimes, deductions and how to file without panic."]] },
  { roles: ["fitness"], slug: "desk_body_reset", title: "Desk Body Reset", description: "A six-week programme for people who sit all day.", chapters: [["Week 1: Notice", "Awareness of posture and tightness, with three simple checks."], ["Week 2: Hips", "Opening the hips with gentle daily work."], ["Week 3: Shoulders and Neck", "Reducing tension from screens and phones."], ["Week 4 to 6: Strength", "Building strength so the gains last."]] },
  { roles: ["swe", "data"], slug: "pragmatic_backend_notes", title: "Pragmatic Backend Notes", description: "Field notes on building reliable services with small teams.", chapters: [["Boring Technology Wins", "Choose what you can debug at 3am. The exciting parts should be in your product, not your stack."], ["Queues and Retries", "A short tour of failure and how to design for it."], ["Observability on a Budget", "Logs, metrics and traces you'll actually use."], ["Shipping Safely", "Migrations, feature flags and rollbacks."]] },
  { roles: ["photo", "film"], slug: "seeing_in_light", title: "Seeing in Light", description: "A visual guide to reading and shaping light.", chapters: [["Quality of Light", "Hard, soft, direct and reflected: how each looks and when to use it."], ["Golden Hour and Beyond", "Why the best light is short-lived, and what to shoot at other times."], ["Lighting Portraits at Home", "One window, one reflector and a patient subject."]] },
  { roles: ["music"], slug: "riyaz_a_practice_guide", title: "Riyaz: A Practice Guide", description: "Structuring daily practice for singers and instrumentalists.", chapters: [["Building the Habit", "Starting small and staying consistent."], ["Slow Work", "Why slow practice with a drone makes fast playing possible."], ["Listening and Recording", "Using recordings to spot what you can't hear while playing."]] },
  { roles: ["founder", "marketing"], slug: "first_thousand_customers", title: "The First Thousand Customers", description: "Lessons from early-stage startups in India.", chapters: [["The First Ten", "Personal outreach and community, not ads."], ["Pricing Conversations", "How to ask for money without apologising."], ["Building a Repeatable Channel", "From lucky sales to a system."], ["Hiring Your First Salesperson", "Timing, profile and expectations."]] },
  { roles: ["doctor"], slug: "the_patient_conversation", title: "The Patient Conversation", description: "Communicating clearly in short consultations.", chapters: [["Listening First", "Why the first two minutes matter most."], ["Explaining in Plain Language", "Replacing jargon without losing accuracy."], ["Closing the Loop", "Checking understanding and agreeing on next steps."]] },
];

// Profile wiki: pages keyed by role; second page is a child of the first.
export const WIKI: Partial<Record<RoleKey, { root: [string, string]; child: [string, string] }>> = {
  swe: { root: ["Dev Environment Setup", "This page documents how I set up a new machine.\n\n- Shell, editor and Git configuration\n- Language runtimes managed with a version manager\n- Dotfiles kept in a Git repository"], child: ["Debugging Checklist", "When something breaks:\n\n1. Reproduce it reliably\n2. Read the error message twice\n3. Bisect recent changes\n4. Write a test that fails"] },
  data: { root: ["Analysis Checklist", "Steps I follow for any analysis:\n\n- Define the question and the decision it supports\n- Profile the data\n- Build a baseline\n- Communicate uncertainty"], child: ["Glossary of Metrics", "Definitions I use with stakeholders: precision, recall, MAPE and calibration, each in plain language."] },
  design: { root: ["Design Principles", "Principles I return to:\n\n- Clarity over cleverness\n- Accessible by default\n- Fewer choices, better defaults"], child: ["Accessibility Checklist", "Contrast, keyboard access, focus order, touch target sizes and screen reader labels."] },
  pm: { root: ["Product Playbook", "How I work: discovery, prioritisation, delivery and review.\n\nEach stage has a template and a set of questions."], child: ["Interview Questions", "The questions I use in customer interviews, grouped by goal."] },
  fitness: { root: ["Training Principles", "Progressive overload, recovery and consistency. Notes on how I plan a week for clients."], child: ["Warm-Up Library", "Five warm-ups for different sessions: mobility, lower body, upper body, cardio and yoga."] },
  food: { root: ["Pantry Basics", "The ingredients I never run out of, and what they're used for."], child: ["Substitutions", "Common substitutions when you're missing something, with notes on how they change the dish."] },
  finance: { root: ["Personal Finance Basics", "Educational notes on budgeting, saving, insurance and tax. Not investment advice."], child: ["Document Checklist", "Documents to keep for tax filing and how long to retain them."] },
  teacher: { root: ["Classroom Routines", "Routines that keep a class running smoothly: entry, transitions, questioning and exit."], child: ["Question Bank", "Open-ended questions for maths and science that start good discussions."] },
  photo: { root: ["Photography Basics", "Exposure, composition and light, explained simply with examples."], child: ["Gear Notes", "What I carry and why, with honest notes on what I'd skip."] },
  music: { root: ["Practice Framework", "A weekly framework for balanced practice: technique, repertoire, listening and improvisation."], child: ["Raga Notes", "Short notes on the ragas I'm learning: notes, mood and time of day."] },
};

export const COMMUNITY_WIKI: { slug: string; pages: [string, string][] }[] = [
  { slug: "desi_devs", pages: [["Getting Started", "Welcome to Desi Devs! Introduce yourself in the weekly thread, read the rules and share what you're building."], ["Learning Resources", "A community-curated list of free courses, books and tutorials for backend, frontend and data."]] },
  { slug: "chai_and_lens", pages: [["Photo Walk Guide", "How we run photo walks: meeting points, safety, etiquette and how to share results."], ["Critique Guidelines", "Constructive critique means saying what works first, then one improvement at a time."]] },
  { slug: "desi_kitchen_diaries", pages: [["How to Post a Recipe", "Include ingredients, method, timing and a photo. Credit where you learnt it."], ["Kitchen Terms Glossary", "Tadka, bhunao, dum and more: a short glossary for new cooks."]] },
  { slug: "sunrise_yoga_strength", pages: [["Beginner Routine", "A safe starting routine: 10 minutes of mobility, 10 of strength, 5 of breathing."]] },
  { slug: "campus_connect", pages: [["Internship Guide", "How to find, apply for and make the most of an internship."], ["Study Group Handbook", "Starting and running a study group that lasts."]] },
];

export const CHAT_LINES = [
  "Hello from my city! 👋", "Can you hear me?", "Loving this topic!", "Great point 👏", "Could you share the slides afterwards?", "Namaste everyone 🙏",
  "This is super helpful", "Joining late, what did I miss?", "Thanks for doing this!", "Question: how long did that take you?", "Amazing explanation", "See you at the next one!",
];
export const ARTICLE_COMMENTS = [
  "Really useful, thanks for writing this up.", "Bookmarked to try this weekend.", "This matches my experience exactly.", "Clear and practical. More like this please!",
  "I disagree slightly on the second point, but a solid read overall.", "Shared with my team.", "Thank you, this cleared up something I've been unsure about.", "Would love a follow-up going deeper on this.",
];
