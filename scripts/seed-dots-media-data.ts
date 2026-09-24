// Static content for scripts/seed-dots-content.ts — courses, podcasts, livestreams and
// downloadable files. Text-only lessons: protected uploads live in Vercel Blob, so no
// video/audio files can be seeded locally. Everything is original filler for seed data.
import type { RoleKey } from "./seed-dots-data";

export type CourseT = { title: string; description: string; price: number; modules: [string, [string, string][]][] };

export const COURSES: Partial<Record<RoleKey, CourseT[]>> = {
  swe: [
    { title: "Backend Basics with Node", description: "Build and deploy a small REST API from scratch. Ideal for self-taught developers.", price: 1999, modules: [
      ["Getting Started", [["Project setup", "Create the project, install dependencies and run your first route."], ["Routing and handlers", "Define routes, parse input and return JSON with proper status codes."], ["Validation", "Reject bad input early with schema validation."]]],
      ["Persistence", [["Connecting a database", "Connect to Postgres and run your first query."], ["Migrations", "Change your schema safely over time."], ["Testing the API", "Write integration tests that run in seconds."]]],
    ] },
    { title: "System Design for Interviews", description: "A structured way to approach system design questions without memorising diagrams.", price: 2499, modules: [
      ["Foundations", [["Requirements first", "Clarify scope, users and scale before drawing anything."], ["Estimation", "Back-of-envelope numbers that guide design."]]],
      ["Patterns", [["Caching", "Where to cache, and how to invalidate."], ["Queues and async work", "Decouple slow work from user requests."], ["Sharding basics", "When and how to split data."]]],
    ] },
  ],
  data: [
    { title: "Data Analysis with Python", description: "From messy CSV to clear insight using pandas and plotting.", price: 1799, modules: [
      ["Cleaning Data", [["Profiling a dataset", "Types, nulls and duplicates in five minutes."], ["Fixing common problems", "Encodings, dates and inconsistent categories."]]],
      ["Analysis and Plots", [["Grouping and summarising", "Answer real questions with groupby."], ["Plotting well", "Charts that communicate instead of decorate."], ["Sharing your work", "Notebooks that others can rerun."]]],
    ] },
    { title: "Machine Learning: Baselines First", description: "A practical course on building simple, honest models.", price: 2299, modules: [
      ["The Baseline Habit", [["Why baselines matter", "A simple model tells you if complexity pays off."], ["Train, validate, test", "Split your data without leaking information."]]],
      ["Improving Models", [["Feature ideas", "Adding signal without overfitting."], ["Explaining results", "Tell stakeholders what the model does and doesn't do."]]],
    ] },
  ],
  teacher: [
    { title: "Maths Made Friendly", description: "Activities and explanations that help students who think they are bad at maths.", price: 799, modules: [
      ["Building Confidence", [["Mistakes are data", "Turn wrong answers into learning moments."], ["Concrete before abstract", "Use objects and drawings first."]]],
      ["Core Topics", [["Fractions you can see", "Fold, cut and compare."], ["Algebra as a story", "Introduce variables through puzzles."], ["Geometry outdoors", "Measure your surroundings."]]],
    ] },
    { title: "Running a Calm Classroom", description: "Routines and habits for a focused, respectful class.", price: 999, modules: [
      ["Routines", [["Entry and exit", "Simple rituals that set the tone."], ["Transitions", "Moving between activities without losing time."]]],
      ["Relationships", [["Feedback that helps", "Specific, kind and actionable."], ["Talking to parents", "Build a partnership."]]],
    ] },
  ],
  fitness: [
    { title: "Desk Worker Mobility", description: "Six weeks of short daily routines for stiff necks, shoulders and hips.", price: 599, modules: [
      ["Neck and Shoulders", [["Posture check", "Three ways to notice how you sit."], ["Shoulder release", "A two-minute routine you can do at your desk."]]],
      ["Hips and Back", [["Hip openers", "Gentle movements for tight hips."], ["Back strength basics", "Strengthen what supports your spine."]]],
    ] },
    { title: "Beginner Strength 101", description: "A progressive plan for people new to strength training.", price: 1299, modules: [
      ["Movement Basics", [["The squat", "Depth, stance and cues."], ["The hinge", "Learning the deadlift pattern safely."]]],
      ["Programming", [["Sets, reps and rest", "A simple structure that works."], ["Tracking progress", "Log your training and progress steadily."]]],
    ] },
  ],
  design: [{ title: "UX Fundamentals", description: "Research, structure and usability basics for new designers.", price: 1499, modules: [
    ["Understanding Users", [["Interviews", "Ask better questions."], ["Usability tests", "Watch five people, learn a lot."]]],
    ["Designing Solutions", [["Information architecture", "Organise content so people find it."], ["Wireframes to prototypes", "Test ideas cheaply."]]],
  ] }],
  pm: [{ title: "Product Management Essentials", description: "Discovery, prioritisation and delivery for new product managers.", price: 1999, modules: [
    ["Discovery", [["Finding real problems", "Talk to customers before writing specs."], ["Sizing opportunities", "Estimate impact with simple numbers."]]],
    ["Delivery", [["Writing a one-page PRD", "Keep it short and useful."], ["Working with engineers", "Build trust and clarity."]]],
  ] }],
  finance: [{ title: "Personal Finance 101 (India)", description: "Budgeting, saving, insurance and tax basics. Educational only, not advice.", price: 499, modules: [
    ["Money Basics", [["Reading your payslip", "Understand every line."], ["Building a budget", "A simple monthly system."]]],
    ["Protecting Yourself", [["Emergency funds", "How much and where."], ["Insurance basics", "What to consider before buying."], ["Tax basics", "Regimes and deductions in plain language."]]],
  ] }],
  food: [{ title: "Everyday Indian Cooking", description: "Master the fundamentals behind hundreds of home recipes.", price: 899, modules: [
    ["Foundations", [["The tadka", "Tempering with confidence."], ["Masala building", "Onion, tomato and spice balance."]]],
    ["Everyday Dishes", [["Dals", "Four dals, one technique."], ["Sabzis", "Dry and gravy vegetables."], ["Breads", "Rotis, parathas and soft dough."]]],
  ] }],
  photo: [{ title: "Photography Fundamentals", description: "Exposure, composition and light for beginners.", price: 1299, modules: [
    ["Exposure", [["Aperture, shutter, ISO", "The three settings explained simply."], ["Reading histograms", "Trust the numbers, not the screen."]]],
    ["Composition", [["Framing and layers", "Add depth to your photos."], ["Finding light", "Notice light before subjects."]]],
  ] }],
  music: [{ title: "Vocal Foundations", description: "Breath, pitch and practice for new singers.", price: 999, modules: [
    ["Breath and Voice", [["Breathing", "Support and posture."], ["Warm-ups", "A ten-minute routine."]]],
    ["Practice", [["Riyaz with a drone", "Pitch through slow work."], ["Recording yourself", "Hear what you can't hear while singing."]]],
  ] }],
  writer: [{ title: "Writing Clearly", description: "Editing habits that make any writing better.", price: 699, modules: [
    ["Sentences", [["Cutting the unnecessary", "Every word must earn its place."], ["Strong verbs", "Replace adjectives with action."]]],
    ["Structure", [["Openings", "Start where the reader needs you."], ["Endings", "Land the point and stop."]]],
  ] }],
  marketing: [{ title: "Marketing for Small Businesses", description: "Practical marketing without a big budget.", price: 1199, modules: [
    ["Foundations", [["Who is your customer?", "Define one person clearly."], ["Your message", "Say it in one sentence."]]],
    ["Channels", [["WhatsApp and local reach", "Where small businesses win."], ["Content that sells", "Stories and proof."]]],
  ] }],
  film: [{ title: "Filmmaking with a Small Crew", description: "Plan, shoot and edit a short film with three people.", price: 1599, modules: [
    ["Pre-production", [["Story and shot lists", "Plan every scene."], ["Locations and permits", "Scouting and paperwork."]]],
    ["Production and Edit", [["Sound first", "Record clean audio."], ["Editing rhythm", "Where to cut."]]],
  ] }],
};

export type PodcastT = { title: string; description: string; episodes: [string, string, number][] };
export const PODCASTS: Partial<Record<RoleKey, PodcastT>> = {
  music: { title: "Riyaz Radio", description: "Conversations with musicians about practice, performance and staying inspired.", episodes: [["Starting late: learning music as an adult", "Three guests share how they began in their thirties.", 1820], ["The tanpura and the ear", "Why a drone changes how you hear pitch.", 1500], ["Playing live for the first time", "Nerves, mistakes and what we learnt.", 2010], ["Gear I'd skip", "An honest gear chat.", 1390]] },
  writer: { title: "The Writer's Hour", description: "Writers and editors on craft, habit and getting words down.", episodes: [["Editing your own work", "A workshop on the three-pass edit.", 1700], ["Reporting from small towns", "Stories that don't trend.", 2100], ["A daily writing habit", "What survives the bad days.", 1450]] },
  founder: { title: "Katta Conversations", description: "Indian founders on the honest side of building companies.", episodes: [["Our first ten customers", "How we found them.", 2300], ["When to hire", "And when not to.", 1900], ["Surviving a payroll scare", "Cash management and calm.", 2200], ["Building in a small city", "The upside of not being in a hub.", 1750]] },
  food: { title: "Desi Kitchen Radio", description: "Home cooks, chefs and food writers on regional cooking.", episodes: [["Kadhi and patience", "A recipe conversation.", 1500], ["Baking in hot kitchens", "Tips and tricks.", 1650], ["Street food ethics", "How to eat safely and responsibly.", 1800]] },
  doctor: { title: "Ask Your Doctor", description: "Plain-language health talks. General information, not medical advice.", episodes: [["Monsoon health basics", "Water, mosquitoes and fevers.", 1400], ["Children and vaccinations", "Answers to common questions.", 1700], ["Sleep and health", "Habits that help.", 1550]] },
  fitness: { title: "Sunrise Strength Podcast", description: "Coaches talk mobility, strength and building habits that last.", episodes: [["Starting strength at 40", "A beginner's guide.", 1600], ["The morning routine myth", "What actually matters.", 1300], ["Recovery and sleep", "Where the progress happens.", 1750]] },
  film: { title: "Frame by Frame", description: "Independent filmmakers on making films with very little.", episodes: [["Shooting on a shoestring", "Making one location count.", 2000], ["Sound matters most", "Why audiences forgive bad picture but not bad audio.", 1650], ["Festival strategy", "Choosing where to submit.", 1900]] },
  sports: { title: "The Nets Podcast", description: "Coaches and players on skill, pressure and team culture.", episodes: [["Match practice vs nets", "What actually improves you.", 1700], ["Coaching children", "Patience and play.", 1850], ["Life after the game", "Careers in sports.", 1950]] },
  teacher: { title: "Classroom Conversations", description: "Teachers share ideas that work in real classrooms.", episodes: [["Making maths friendly", "Confidence first.", 1600], ["Exam stress", "Advice for students and parents.", 1500], ["The question of the day", "Starting class with thinking.", 1350]] },
  pm: { title: "Product Chai Podcast", description: "Product people on tradeoffs, roadmaps and saying no.", episodes: [["Writing a one-page PRD", "Short documents that get read.", 1500], ["Metrics that matter", "Dashboards versus decisions.", 1700], ["Saying no gracefully", "Keep the relationship, decline the feature.", 1400]] },
  finance: { title: "Rupee Talk", description: "Educational conversations about money in India. Not investment advice.", episodes: [["Your first salary", "What to do with it.", 1650], ["Old vs new tax regime", "How to compare.", 1900], ["Emergency funds", "How much and where.", 1400]] },
};

export const LIVESTREAMS: Partial<Record<RoleKey, [string, string]>> = {
  swe: ["Live code review: refactoring a legacy module", "Ask me anything: backend careers"],
  design: ["Live critique: your landing pages", "Designing an onboarding flow, start to finish"],
  data: ["Live analysis: forecasting mandi prices", "Q&A: getting your first data job"],
  founder: ["AMA: first year of building a startup", "Pitch practice night"],
  photo: ["Live edit: a monsoon street set", "Photo walk debrief"],
  fitness: ["Live class: 30-minute morning mobility", "Beginner strength Q&A"],
  music: ["Live riyaz: Raag Yaman", "Open mic: bring your song"],
  food: ["Live cooking: kadhi with all the tips", "Baking Q&A: hot kitchens"],
  finance: ["Live Q&A: filing your ITR (educational)", "Money basics workshop"],
  teacher: ["Live class: fractions you can see", "Teachers' hangout"],
  marketing: ["Live teardown: five small business websites", "Newsletter growth Q&A"],
  writer: ["Live edit: your first paragraphs", "Writing sprint: 45 minutes together"],
};

export type FileT = { title: string; description: string; filename: string; mime: string; content: string };
export const FILES: Partial<Record<RoleKey, FileT>> = {
  swe: { title: "Code Review Checklist", description: "A one-page checklist I use for pull requests.", filename: "code-review-checklist.md", mime: "text/markdown", content: "# Code Review Checklist\n\n- [ ] Does the change do what the description says?\n- [ ] Are there tests for new behaviour?\n- [ ] Any risky migrations or locking operations?\n- [ ] Are errors handled and logged?\n- [ ] Is the change small enough to review in 20 minutes?\n" },
  data: { title: "Sample Sales Dataset", description: "A small, clean CSV for practising pandas.", filename: "sample-sales.csv", mime: "text/csv", content: "date,region,product,units,revenue\n2026-01-05,North,Notebook,120,7200\n2026-01-06,South,Notebook,90,5400\n2026-01-06,West,Pen,300,3000\n2026-01-07,East,Pen,210,2100\n2026-01-08,North,Bag,40,16000\n2026-01-09,South,Bag,35,14000\n" },
  design: { title: "Accessibility Quick Checks", description: "Ten checks before you hand off a design.", filename: "accessibility-quick-checks.md", mime: "text/markdown", content: "# Accessibility Quick Checks\n\n1. Text contrast meets 4.5:1\n2. Touch targets are at least 44px\n3. Focus states are visible\n4. Colour is never the only signal\n5. Every image has a text alternative\n" },
  pm: { title: "One-Page PRD Template", description: "The template I use for most product changes.", filename: "one-page-prd.md", mime: "text/markdown", content: "# One-Page PRD\n\n## Problem\nWho has it, and how do we know?\n\n## Success\nThe number that tells us it worked.\n\n## Solution\nThe smallest thing that could work.\n\n## Not doing\nWhat we're explicitly leaving out.\n" },
  finance: { title: "Monthly Budget Template", description: "A simple budget you can copy into any spreadsheet.", filename: "monthly-budget.csv", mime: "text/csv", content: "category,planned,actual\nRent,20000,\nGroceries,8000,\nTransport,3000,\nUtilities,2500,\nSavings,10000,\nFun,4000,\n" },
  fitness: { title: "4-Week Beginner Plan", description: "A gentle plan for building a routine.", filename: "beginner-plan.md", mime: "text/markdown", content: "# 4-Week Beginner Plan\n\n## Weeks 1-2\nThree 20 minute sessions: bodyweight squats, push-ups on knees, planks.\n\n## Weeks 3-4\nThree 30 minute sessions: add lunges and a short walk.\n\nRest days matter. Sleep well.\n" },
  food: { title: "Pantry Essentials Card", description: "Ten ingredients for quick Indian meals.", filename: "pantry-essentials.md", mime: "text/markdown", content: "# Pantry Essentials\n\n- Toor dal\n- Rice\n- Atta\n- Mustard and cumin seeds\n- Turmeric, chilli powder, coriander powder\n- Ghee\n- Curd\n- Onions, tomatoes, ginger, garlic\n" },
  teacher: { title: "Question of the Day Bank", description: "Thirty starter questions for maths class.", filename: "question-of-the-day.md", mime: "text/markdown", content: "# Question of the Day\n\n1. Is zero even or odd? Why?\n2. Can a shape have area but no perimeter?\n3. What's the biggest number you can make with these digits?\n4. Is half of a half the same as a quarter?\n5. Which is bigger: 0.5 or 0.05? Prove it.\n" },
  marketing: { title: "30-Day Content Calendar", description: "A starter calendar for small brands.", filename: "content-calendar.csv", mime: "text/csv", content: "day,theme,format\n1,Introduce yourself,Post\n2,Customer story,Post\n3,Behind the scenes,Reel\n4,Tip of the week,Post\n5,FAQ,Story\n" },
  writer: { title: "Writing Prompts (50)", description: "Short prompts to get you unstuck.", filename: "writing-prompts.md", mime: "text/markdown", content: "# Writing Prompts\n\n1. The last train you missed.\n2. A conversation you overheard.\n3. Your grandmother's kitchen.\n4. A door that never opened.\n5. The first day of monsoon.\n" },
  photo: { title: "Street Photography Shot List", description: "Ideas for your next photo walk.", filename: "street-shot-list.md", mime: "text/markdown", content: "# Street Shot List\n\n- A doorway with light\n- Reflections after rain\n- Hands at work\n- A shop sign\n- A moment between two people\n" },
  music: { title: "Weekly Riyaz Planner", description: "A printable practice planner.", filename: "riyaz-planner.md", mime: "text/markdown", content: "# Weekly Riyaz Planner\n\n| Day | Focus | Minutes |\n|-----|-------|---------|\n| Mon | Sargam | 20 |\n| Tue | Alankars | 20 |\n| Wed | Raag | 30 |\n| Thu | Rhythm | 20 |\n| Fri | Repertoire | 30 |\n| Sat | Record | 20 |\n" },
};
