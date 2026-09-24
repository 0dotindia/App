// Static content for scripts/seed-dots-monetization.ts — membership tiers, digital products,
// bookable services and fundraising campaigns. Original filler for seed data.
import type { RoleKey } from "./seed-dots-data";

export type TierPerks = readonly [string, string, string]; // tier 1, 2, 3 perks
export const TIER_PERKS: Partial<Record<RoleKey, TierPerks>> = {
  swe: ["early access to my tutorials and code notes", "monthly code-review Q&A", "one 30 minute mentoring call a quarter"],
  design: ["behind-the-scenes design breakdowns", "monthly portfolio feedback thread", "a personal design review each quarter"],
  pm: ["my PRD templates and product teardowns", "monthly product Q&A", "a private roadmap review each quarter"],
  data: ["notebooks and datasets before they're public", "monthly office hours", "one project review a quarter"],
  founder: ["candid monthly founder notes", "a private community of founders", "a quarterly one-on-one"],
  photo: ["full-resolution photos and edit notes", "monthly photo critique thread", "an annual print of my choice"],
  writer: ["early access to essays and drafts", "monthly writing prompts and feedback", "a personal edit of one piece a year"],
  food: ["members-only recipes and video notes", "monthly live cook-along", "a signed recipe card set every year"],
  fitness: ["weekly workout plans", "monthly live class and Q&A", "a personalised plan review each quarter"],
  music: ["unreleased demos and practice recordings", "monthly live jam", "a private lesson each quarter"],
  doctor: ["ad-free health explainers", "monthly live Q&A (general information only)", "early access to health guides"],
  teacher: ["all my worksheets and lesson plans", "monthly teacher meetup", "a curriculum review each term"],
  finance: ["monthly money notes (educational)", "live Q&A during tax season", "an annual money-basics workshop"],
  film: ["behind-the-scenes footage and edit breakdowns", "monthly film club screening", "credit as a supporter in my next short"],
  art: ["process videos and sketchbook scans", "monthly drawing session", "an original small artwork every year"],
  marketing: ["campaign teardowns and templates", "monthly marketing Q&A", "a quarterly growth review"],
  sports: ["training drills and match analysis", "monthly live coaching Q&A", "a quarterly game-plan review"],
};
export const TIER_NAMES = ["Supporter", "Insider", "Patron"] as const;

// [title, description, price USD]
export type ProductT = readonly [string, string, number];
export const PRODUCTS: Partial<Record<RoleKey, ProductT[]>> = {
  swe: [["Backend Interview Handbook", "60 pages of patterns, questions and worked answers.", 15], ["Production Checklist Pack", "Checklists for launching, monitoring and rollbacks.", 9]],
  design: [["UI Kit for Indian Apps", "120 components with light and dark themes.", 29], ["Portfolio Case Study Template", "A structure that hiring managers actually read.", 12]],
  pm: [["PRD Template Bundle", "Six ready-to-use product documents.", 14], ["Roadmap Workshop Kit", "Slides and worksheets for a half-day workshop.", 25]],
  data: [["Pandas Cheat Sheets", "Ten one-page references for daily analysis.", 8], ["Forecasting Notebook Pack", "Six notebooks with datasets and explanations.", 19]],
  founder: [["Pilot Programme Playbook", "Templates for running enterprise pilots.", 24], ["Fundraising Notes 2026", "What actually mattered in our seed round.", 19]],
  photo: [["Lightroom Presets: Monsoon", "12 presets for rainy-day photography.", 12], ["Street Photography Field Guide", "A practical PDF with exercises.", 10]],
  writer: [["The Editing Workbook", "Exercises to sharpen your own writing.", 11], ["Feature Pitch Templates", "Pitch letters that got commissioned.", 9]],
  food: [["Regional Thali Cookbook", "60 recipes from 12 states.", 14], ["Sourdough Masala Guide", "A step-by-step guide for Indian kitchens.", 8]],
  fitness: [["4-Week Mobility Programme", "Daily routines with video links.", 12], ["Beginner Strength Plan", "12 weeks of progressive training.", 18]],
  music: [["Riyaz Practice Loops", "Tanpura and tabla loops in 24 ragas.", 9], ["Songwriting Starter Pack", "Chord charts and lyric prompts.", 10]],
  doctor: [["Parent's Health Handbook", "Plain-language guidance for common childhood illnesses (general information).", 12]],
  teacher: [["Maths Activity Book (Class 6-8)", "40 printable activities.", 10], ["Question of the Day Cards", "180 discussion prompts.", 7]],
  finance: [["Budget Planner Spreadsheet", "Monthly and yearly planners.", 6], ["Tax Regime Comparison Sheet", "Compare regimes in minutes. Educational only.", 9]],
  film: [["Short Film Production Bible", "Templates for budgets, schedules and releases.", 22], ["Sound Design Sample Pack", "150 ambient and foley clips.", 15]],
  art: [["Ink Brush Pack (Digital)", "24 brushes for illustration.", 12], ["Watercolour Basics Guide", "Illustrated PDF for beginners.", 8]],
  marketing: [["30-Day Content Calendar", "A ready calendar with hooks.", 9], ["Brand Voice Workbook", "Find and document your voice.", 14]],
  sports: [["Junior Cricket Drills Book", "50 drills with diagrams.", 11]],
};

// [title, description, price USD, minutes]
export type ServiceT = readonly [string, string, number, number];
export const SERVICES: Partial<Record<RoleKey, ServiceT[]>> = {
  swe: [["Code Review Session", "A live review of your project with actionable notes.", 40, 60], ["Career Mentoring Call", "Plan your next move in tech.", 30, 45]],
  design: [["Portfolio Review", "Detailed feedback on your portfolio.", 35, 45], ["UX Audit (one flow)", "An audit of one user flow with recommendations.", 90, 90]],
  pm: [["PM Career Coaching", "Interview prep and career planning.", 45, 60]],
  data: [["Data Project Review", "Review of your analysis or model.", 40, 60], ["Learn Pandas 1:1", "Hands-on tutoring.", 25, 60]],
  founder: [["Founder Office Hours", "Talk through a decision with someone who's been there.", 50, 45]],
  photo: [["Portrait Session", "A relaxed 90 minute portrait shoot.", 80, 90], ["Photo Edit Review", "Feedback on 10 of your photos.", 20, 30]],
  writer: [["Manuscript Feedback", "Detailed notes on up to 3,000 words.", 45, 60], ["Pitch Coaching", "Sharpen your feature pitch.", 30, 30]],
  food: [["Private Cooking Lesson", "Learn a regional menu in your own kitchen (online).", 35, 90]],
  fitness: [["Personal Training Session", "Personalised training, in person or on video.", 25, 60], ["Mobility Assessment", "Assess and plan your mobility routine.", 20, 45]],
  music: [["Vocal Lesson", "One-to-one vocal training.", 20, 60], ["Tabla Lesson", "Foundations and taals.", 20, 60]],
  doctor: [["Health Talk for Groups", "A 45 minute community talk (general information).", 60, 45]],
  teacher: [["Maths Tutoring", "One-to-one tutoring for classes 6-12.", 15, 60], ["Exam Prep Session", "Structured board exam preparation.", 18, 60]],
  finance: [["Tax Filing Consultation", "Walk through your ITR with a professional.", 30, 45], ["Budget Makeover", "Build a budget that works.", 25, 45]],
  film: [["Edit Review", "Feedback on your rough cut.", 40, 60]],
  art: [["Illustration Mentoring", "Improve your drawing with guided practice.", 25, 60]],
  marketing: [["Brand Strategy Session", "Clarify your positioning.", 50, 60], ["Content Plan Review", "Feedback on your content calendar.", 30, 45]],
  sports: [["Batting Clinic", "Technique work for club cricketers.", 20, 60]],
};

export const PLATFORM = {
  tiers: [["Supporter", 3, "Support the 0dot team and get early product notes."], ["Insider", 8, "Everything in Supporter, plus a monthly Q&A with the team."], ["Patron", 25, "Everything in Insider, plus a seat in our quarterly roadmap review."]] as [string, number, string][],
  products: [["0dot Creator Handbook", "How to set up your profile, portfolio and monetization on 0dot.", 9], ["Profile Launch Kit", "Templates for a bio, portfolio and first posts.", 6]] as [string, string, number][],
};

export const CAMPAIGNS: { owner: "user" | "business"; match: string; title: string; description: string; goal: number | null; days: number }[] = [
  { owner: "business", match: "saarthi_cares", title: "Books for 500 Children", description: "Help us put a book in the hands of 500 children this year, with a reading corner in each of our classrooms.", goal: 2500, days: 60 },
  { owner: "business", match: "saarthi_cares", title: "Monsoon Health Camp Fund", description: "Volunteer doctors, medicines and transport for our monsoon health camps.", goal: 1500, days: 30 },
  { owner: "business", match: "asha_family_clinic", title: "Free Check-ups for Senior Citizens", description: "Sponsor annual health check-ups for seniors who can't afford them.", goal: 1000, days: 45 },
  { owner: "user", match: "film", title: "Fund My Next Short Film", description: "A 15-minute story about the last tram in the city. Your support pays for the crew, sound and festival submissions.", goal: 3000, days: 50 },
  { owner: "user", match: "music", title: "Record My First Album", description: "Six songs, one live-room session and a lot of chai. Help me get it recorded and pressed.", goal: 1800, days: 40 },
  { owner: "user", match: "teacher", title: "Classroom Library Project", description: "Books and shelves for a village classroom.", goal: 800, days: 25 },
  { owner: "user", match: "student", title: "Send Our Team to the National Hackathon", description: "Travel and registration for our college team's national hackathon final.", goal: 700, days: 20 },
  { owner: "user", match: "photo", title: "Ghats at Dawn: Photo Book", description: "Print a 96-page photo book from my six-week series.", goal: 2000, days: 55 },
  { owner: "user", match: "fitness", title: "Free Community Yoga in the Park", description: "Mats, sound system and a small stipend for volunteer instructors.", goal: null, days: 90 },
];

export const DONATION_MESSAGES = ["Happy to support this 🙏", "Wishing you all the best!", "Small contribution, big hopes.", "Keep going!", "For a good cause.", "", "", ""];
export const TIP_NOTES = ["Loved your latest post!", "Thanks for the tutorial 🙏", "Coffee on me ☕", "Keep creating!", "Your work inspires me.", "", "", ""];
export const BOOKING_NOTES = ["Looking forward to it!", "Please share a short agenda beforehand.", "I'd like to focus on the basics.", "", "", ""];
