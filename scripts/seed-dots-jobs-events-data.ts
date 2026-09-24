// Static content for scripts/seed-dots-jobs-events.ts — job postings per fictional business,
// and events hosted by seeded communities, businesses and dots. Original filler for seed data.
// Salaries are USD (the jobs board renders a "$" prefix): yearly for full-time/contract,
// entry-level figures scaled to Indian pay.

export type JobT = { title: string; type: "full_time" | "part_time" | "contract" | "internship"; description: string; remote: boolean; min: number; max: number; fit: RegExp; open?: boolean };

export const JOBS: Record<string, JobT[]> = {
  masala_lane_cafe: [
    { title: "Head Barista", type: "full_time", description: "Lead our espresso and chai bar, train new baristas and keep quality consistent. 3+ years in a busy café.", remote: false, min: 3000, max: 4200, fit: /Chef|Food|Baker|Culinary/i },
    { title: "Weekend Kitchen Assistant", type: "part_time", description: "Prep and line support on Saturdays and Sundays. Training provided.", remote: false, min: 1500, max: 2000, fit: /Student|Chef|Food/i },
    { title: "Social Media Intern", type: "internship", description: "Help us photograph the menu and run our Instagram. Great for a student who loves food content.", remote: false, min: 600, max: 900, fit: /Student|Marketing|Photograph|Content/i },
  ],
  pranayama_studio: [
    { title: "Yoga Instructor", type: "part_time", description: "Lead morning and evening group classes. Certified instructors with 2+ years of teaching experience.", remote: false, min: 2400, max: 3600, fit: /Yoga|Fitness|Wellness|Coach/i },
    { title: "Front Desk & Community Manager", type: "full_time", description: "Welcome members, manage bookings and run our community events.", remote: false, min: 3000, max: 4000, fit: /Marketing|Wellness|Manager/i },
    { title: "Strength Coach", type: "contract", description: "Lead small-group strength classes three evenings a week.", remote: false, min: 3600, max: 5400, fit: /Strength|Fitness|Coach|Athlete/i },
  ],
  kaagaz_print_design: [
    { title: "Graphic Designer", type: "full_time", description: "Design logos, packaging and menus for small businesses. Strong portfolio and print knowledge required.", remote: false, min: 4000, max: 6500, fit: /Designer|Design|Illustrator|Artist|Visual/i },
    { title: "Print Production Assistant", type: "full_time", description: "Coordinate print jobs, proofs and delivery timelines.", remote: false, min: 2400, max: 3200, fit: /Marketing|Manager|Design/i },
    { title: "Freelance Illustrator", type: "contract", description: "Project-based illustration for packaging and brochures.", remote: true, min: 3000, max: 6000, fit: /Illustrator|Artist|Painter|Digital Artist/i },
  ],
  tarang_music_academy: [
    { title: "Hindustani Vocal Teacher", type: "part_time", description: "Teach evening vocal batches for children and adults. Performance experience preferred.", remote: false, min: 2400, max: 3600, fit: /Music|Singer|Teacher/i },
    { title: "Tabla Instructor", type: "part_time", description: "Foundation and intermediate tabla classes, with monthly recitals.", remote: false, min: 2400, max: 3600, fit: /Music|Musician|Teacher/i },
    { title: "Admissions & Events Coordinator", type: "full_time", description: "Handle enquiries, admissions and our annual recital logistics.", remote: false, min: 2600, max: 3400, fit: /Marketing|Manager|Teacher/i },
  ],
  lens_and_loom: [
    { title: "Wedding Photographer", type: "contract", description: "Shoot weddings on weekends. Your own gear and a strong portfolio of candid work.", remote: false, min: 4500, max: 9000, fit: /Photograph|Visual Storyteller/i },
    { title: "Video Editor", type: "full_time", description: "Edit wedding highlights and brand films. Premiere or DaVinci required.", remote: true, min: 4000, max: 7000, fit: /Video Editor|Film|Cinematograph|Documentary/i },
    { title: "Studio Assistant", type: "internship", description: "Assist on shoots, manage gear and back up footage.", remote: false, min: 600, max: 1000, fit: /Student|Photograph|Film/i },
  ],
  nirmaan_tech_labs: [
    { title: "Frontend Engineer", type: "full_time", description: "Build fast, accessible React interfaces for startup clients. TypeScript, testing and design sense required.", remote: true, min: 14000, max: 26000, fit: /Engineer|Developer|Design/i },
    { title: "DevOps Engineer", type: "full_time", description: "Own CI/CD, observability and cloud costs for our client projects.", remote: true, min: 16000, max: 30000, fit: /Engineer|Developer|Data/i },
    { title: "Product Designer", type: "contract", description: "Design end-to-end flows for MVPs with a small team of engineers.", remote: true, min: 9000, max: 18000, fit: /Designer|Design|UX/i },
    { title: "Engineering Intern", type: "internship", description: "Six-month internship on real client work with a mentor.", remote: true, min: 900, max: 1500, fit: /Student|Engineer|Developer|Intern/i },
  ],
  sahayak_tax_accounts: [
    { title: "Accounts Executive", type: "full_time", description: "Bookkeeping, GST return preparation and reconciliation for small business clients.", remote: false, min: 3000, max: 4500, fit: /Accountant|Tax|Financial|Finance/i },
    { title: "Article Assistant (CA Intern)", type: "internship", description: "Three-year articleship with hands-on audit and tax exposure.", remote: false, min: 700, max: 1000, fit: /Student|Accountant|Finance/i },
  ],
  vidya_path_tutors: [
    { title: "Maths Teacher (Class 9-12)", type: "part_time", description: "Evening batches with weekly tests and doubt-clearing. B.Ed or equivalent preferred.", remote: false, min: 2200, max: 3400, fit: /Teacher|Educator|Professor|Maths/i },
    { title: "Science Tutor", type: "part_time", description: "Physics and chemistry for classes 9 to 12.", remote: false, min: 2200, max: 3400, fit: /Teacher|Educator|Professor|Student/i },
    { title: "Online English Tutor", type: "contract", description: "Spoken English classes for students across the country, on video.", remote: true, min: 1800, max: 3000, fit: /Teacher|Writer|Educator|Editor/i },
  ],
  grihasetu_realty: [
    { title: "Real Estate Advisor", type: "full_time", description: "Guide buyers and renters through shortlisting, negotiation and paperwork. Commission on top of base.", remote: false, min: 3000, max: 6000, fit: /Marketing|Manager|Founder|Finance/i },
    { title: "Property Content Executive", type: "part_time", description: "Photograph properties and write listings.", remote: false, min: 1500, max: 2400, fit: /Photograph|Writer|Marketing|Content/i },
    { title: "Legal & Paperwork Associate", type: "contract", description: "Assist with agreements, registrations and verification.", remote: false, min: 2500, max: 4000, fit: /Accountant|Tax|Finance|Analyst/i },
  ],
  green_thumb_nursery: [
    { title: "Nursery Assistant", type: "full_time", description: "Care for plants, help customers and manage stock.", remote: false, min: 1800, max: 2400, fit: /Student|Teacher|Food|Wellness/i },
    { title: "E-commerce Executive", type: "part_time", description: "List plants online, manage orders and photos.", remote: true, min: 1500, max: 2400, fit: /Marketing|Photograph|Content|Student/i },
  ],
  asha_family_clinic: [
    { title: "General Practitioner", type: "full_time", description: "Consult patients of all ages in a friendly family clinic. MBBS with valid registration.", remote: false, min: 9000, max: 16000, fit: /Physician|Doctor|Practitioner|Paediatrician/i },
    { title: "Paediatric Nurse", type: "full_time", description: "Support child health check-ups and vaccination days.", remote: false, min: 3000, max: 4500, fit: /Doctor|Physician|Wellness|Student/i },
    { title: "Medical Records Assistant", type: "part_time", description: "Maintain digital patient records with confidentiality.", remote: false, min: 1500, max: 2200, fit: /Student|Data|Analyst/i },
  ],
  saarthi_cares: [
    { title: "Programme Coordinator", type: "full_time", description: "Run our evening classes, health camps and volunteer schedule across the city.", remote: false, min: 3000, max: 4500, fit: /Teacher|Educator|Manager|Writer|Journalist/i },
    { title: "Volunteer Teacher (Evenings)", type: "part_time", description: "Teach maths, science or English to children for two evenings a week. A small stipend is provided.", remote: false, min: 600, max: 900, fit: /Teacher|Student|Educator|Professor/i },
    { title: "Communications Intern", type: "internship", description: "Write stories, photograph events and run our social channels.", remote: true, min: 500, max: 800, fit: /Student|Writer|Journalist|Marketing|Photograph/i },
  ],
  glow_and_grace: [
    { title: "Hair Stylist", type: "full_time", description: "Cuts, colour and styling. 2+ years of salon experience.", remote: false, min: 2400, max: 4000, fit: /Wellness|Artist|Design/i },
    { title: "Skin Therapist", type: "full_time", description: "Facials and skin care treatments with trained hands.", remote: false, min: 2400, max: 3800, fit: /Wellness|Doctor|Artist/i },
    { title: "Front Desk Executive", type: "part_time", description: "Appointments, billing and customer care.", remote: false, min: 1500, max: 2200, fit: /Marketing|Student|Manager/i },
  ],
};

export const COVER_NOTES = [
  "Hi! I'm excited about this opening. My background lines up well with the role and I'd love to talk more.",
  "Hello team, I've followed your work for a while and would be delighted to contribute. Happy to share more on request.",
  "I'm applying because this is exactly the kind of work I enjoy. My profile has a summary of what I've done.",
  "Namaste! I'd love the chance to be part of your team. I'm available to start within a month.",
  "I believe my experience is a good fit and I'm keen to learn more about the team and expectations.",
  "Please consider my application. I've attached my profile resume and I'm happy to do a small task if helpful.",
];

export type EventT = {
  slug: string;
  title: string;
  description: string;
  host: { kind: "community" | "business" | "user" | "platform"; key: string };
  format: "in_person" | "virtual" | "hybrid";
  day: number; // days from today (negative = past)
  hour: number; // start hour in IST
  hours: number; // duration
  capacity: number | null;
  tickets: [string, number | null, number | null][]; // name, price INR (null = free), total
  visibility?: "public" | "attendees_only" | "host_only";
  status?: "published" | "draft" | "cancelled";
  fit: RegExp;
  size: [number, number]; // RSVPs
};

const md = (intro: string, points: string[]) => `${intro}\n\n## What to expect\n\n${points.map((p) => `- ${p}`).join("\n")}`;

export const EVENTS: EventT[] = [
  // ---- community events ----
  { slug: "desi_devs_hack_night", title: "Desi Devs Weekend Hack Night", description: md("Bring a project (or an idea) and hack alongside other engineers for an evening. Pizza and chai included.", ["Two-hour focused build session", "Lightning demos at the end", "Find teammates for your next side project"]), host: { kind: "community", key: "desi_devs" }, format: "hybrid", day: 6, hour: 18, hours: 3, capacity: 60, tickets: [["General admission", null, 60]], fit: /Engineer|Developer|Data/i, size: [18, 30] },
  { slug: "desi_devs_system_design_study", title: "System Design Study Group: Caching", description: md("A guided session on caching patterns and invalidation, with a mock interview at the end.", ["Patterns and pitfalls", "Group whiteboarding", "Q&A"]), host: { kind: "community", key: "desi_devs" }, format: "virtual", day: -12, hour: 20, hours: 2, capacity: null, tickets: [], fit: /Engineer|Developer|Student/i, size: [15, 28] },
  { slug: "product_chai_roadmap_clinic", title: "Product Chai: Roadmap Clinic", description: md("Bring your roadmap and get friendly, honest feedback from fellow PMs and designers.", ["Groups of four", "One roadmap per group", "Templates shared afterwards"]), host: { kind: "community", key: "product_chai" }, format: "virtual", day: 9, hour: 19, hours: 2, capacity: 40, tickets: [["Free entry", null, 40]], fit: /Product|Design|PM/i, size: [12, 24] },
  { slug: "chai_lens_photo_walk_ghats", title: "Sunday Sunrise Photo Walk", description: md("A relaxed photo walk starting at first light, ending with chai and photo swaps.", ["Beginner friendly", "Bring any camera", "Meeting point shared after RSVP"]), host: { kind: "community", key: "chai_and_lens" }, format: "in_person", day: 4, hour: 6, hours: 3, capacity: 25, tickets: [["Walk pass", null, 25]], fit: /Photograph|Filmmaker|Visual|Cinematograph/i, size: [14, 24] },
  { slug: "chai_lens_print_swap", title: "Print Swap & Critique Evening", description: md("Bring three prints and swap feedback with fellow photographers.", ["Gentle critique format", "Frame your favourite", "Light snacks"]), host: { kind: "community", key: "chai_and_lens" }, format: "in_person", day: -20, hour: 18, hours: 2, capacity: 30, tickets: [["Entry", 100, 30]], fit: /Photograph|Filmmaker|Artist/i, size: [12, 22] },
  { slug: "lekhak_circle_open_mic", title: "Lekhak Circle Reading Night", description: md("Read your work aloud to a supportive audience. Five-minute slots.", ["Prose and poetry", "Feedback circle", "Open to first-time readers"]), host: { kind: "community", key: "lekhak_circle" }, format: "hybrid", day: 11, hour: 19, hours: 2, capacity: 50, tickets: [["General admission", null, 50]], fit: /Writer|Journalist|Editor|Columnist/i, size: [10, 20] },
  { slug: "kitchen_diaries_dosa_class", title: "Dosa Masterclass (Live Online)", description: md("Learn to ferment, spread and flip the perfect dosa, including winter fermentation tricks.", ["Batter ratios", "Pan care", "Chutney basics"]), host: { kind: "community", key: "desi_kitchen_diaries" }, format: "virtual", day: 8, hour: 11, hours: 2, capacity: 100, tickets: [["Live class", 199, 100]], fit: /Chef|Food|Baker|Culinary/i, size: [16, 30] },
  { slug: "sunrise_yoga_park_session", title: "Sunrise Yoga in the Park", description: md("A free community yoga session for all levels. Bring a mat and water.", ["45-minute flow", "Breathing practice", "Chai after"]), host: { kind: "community", key: "sunrise_yoga_strength" }, format: "in_person", day: 2, hour: 6, hours: 2, capacity: 60, tickets: [["Free entry", null, 60]], fit: /Fitness|Yoga|Strength|Wellness|Coach/i, size: [14, 26] },
  { slug: "cricket_adda_gully_cup", title: "Cricket Adda Gully Cup", description: md("A friendly six-a-side tournament. Bring your team or join one on the day.", ["Tennis-ball cricket", "Teams of six", "Trophy and bragging rights"]), host: { kind: "community", key: "cricket_adda" }, format: "in_person", day: 14, hour: 7, hours: 8, capacity: 96, tickets: [["Team entry", 600, 16]], fit: /Cricket|Athlete|Sports|Kabaddi|Coach/i, size: [22, 40] },
  { slug: "startup_katta_founders_chai", title: "Founders' Chai Katta", description: md("An informal evening for founders and early team members to swap stories and intros.", ["Two short talks", "Open networking", "No pitches, please"]), host: { kind: "community", key: "startup_katta" }, format: "in_person", day: -6, hour: 18, hours: 3, capacity: 45, tickets: [["Entry", 250, 45]], fit: /Founder|Marketing|Growth|CEO/i, size: [14, 26] },
  { slug: "rupee_wise_tax_season_qa", title: "Tax Season Q&A (Educational)", description: md("Ask general questions about filing and deductions. Educational only, not advice.", ["Old vs new regime basics", "Documents to keep", "Common mistakes"]), host: { kind: "community", key: "rupee_wise" }, format: "virtual", day: 7, hour: 20, hours: 1, capacity: null, tickets: [], fit: /Accountant|Financial|Investment|Tax|Finance/i, size: [12, 26] },
  { slug: "sur_taal_open_mic", title: "Sur aur Taal Open Mic", description: md("Sing, play or just listen. Sign up for a slot on arrival.", ["Acoustic set", "Ten-minute slots", "Sound provided"]), host: { kind: "community", key: "sur_aur_taal" }, format: "in_person", day: 12, hour: 19, hours: 3, capacity: 80, tickets: [["Entry", 150, 80]], fit: /Music|Singer|Producer/i, size: [14, 24] },
  { slug: "campus_internship_qa", title: "Internship Q&A with Seniors", description: md("Seniors share how they landed internships and what they'd do differently.", ["Resume tips", "Interview prep", "Open Q&A"]), host: { kind: "community", key: "campus_connect" }, format: "virtual", day: 5, hour: 18, hours: 2, capacity: null, tickets: [], fit: /Student|Teacher|Professor|Intern/i, size: [20, 36] },
  { slug: "indie_cinema_screening", title: "Indie Cinema Club Screening Night", description: md("We watch one short film together and discuss it over chai.", ["Screening followed by discussion", "Director Q&A when available"]), host: { kind: "community", key: "indie_cinema_club" }, format: "hybrid", day: -9, hour: 19, hours: 3, capacity: 40, tickets: [["Entry", 120, 40]], fit: /Film|Cinematograph|Video|Documentary/i, size: [12, 22] },
  { slug: "doodle_desk_sketch_jam", title: "Doodle Desk Sketch Jam", description: md("Sketch together from a shared prompt list, then post your favourite.", ["Prompts drawn from a hat", "All mediums welcome", "Timed rounds"]), host: { kind: "community", key: "doodle_desk" }, format: "virtual", day: 3, hour: 17, hours: 2, capacity: 100, tickets: [["Free entry", null, 100]], fit: /Illustrator|Artist|Painter|Designer/i, size: [12, 24] },
  // ---- business events ----
  { slug: "masala_lane_board_game_night", title: "Board Game Night at Masala Lane", description: md("Bring a friend and play from our shelf while sipping on kulhad chai.", ["50+ board games", "Chai and snacks menu", "Prizes for the friendliest table"]), host: { kind: "business", key: "masala_lane_cafe" }, format: "in_person", day: 5, hour: 19, hours: 4, capacity: 50, tickets: [["Table for 4", 400, 12]], fit: /Student|Chef|Food|Marketing/i, size: [14, 26] },
  { slug: "pranayama_mobility_workshop", title: "Desk Body Mobility Workshop", description: md("A two-hour workshop for people who sit all day. Learn simple routines you can do anywhere.", ["Posture assessment", "Hip and shoulder mobility", "Take-home plan"]), host: { kind: "business", key: "pranayama_studio" }, format: "in_person", day: 10, hour: 10, hours: 2, capacity: 20, tickets: [["Early bird", 499, 8], ["Standard", 699, 12]], fit: /Fitness|Wellness|Engineer|Developer|Designer/i, size: [10, 18] },
  { slug: "tarang_annual_recital", title: "Tarang Annual Student Recital", description: md("Our students perform Hindustani vocal, tabla and guitar pieces. Free entry, all are welcome.", ["Students of all ages", "Chief guest performance", "Refreshments"]), host: { kind: "business", key: "tarang_music_academy" }, format: "in_person", day: 13, hour: 17, hours: 3, capacity: 150, tickets: [["Free entry", null, 150]], fit: /Music|Singer|Teacher/i, size: [20, 38] },
  { slug: "nirmaan_open_house", title: "Nirmaan Engineering Open House", description: md("Meet our team, see how we build products and ask us anything about engineering careers.", ["Team introductions", "Live demo of a recent build", "Open Q&A"]), host: { kind: "business", key: "nirmaan_tech_labs" }, format: "hybrid", day: 16, hour: 17, hours: 2, capacity: 70, tickets: [["Free entry", null, 70]], fit: /Engineer|Developer|Designer|Student/i, size: [16, 30] },
  { slug: "green_thumb_balcony_workshop", title: "Balcony Gardening Workshop", description: md("Set up a low-maintenance balcony garden. Plants and pots included for each attendee.", ["Choosing the right plants", "Soil and watering basics", "Take home a starter kit"]), host: { kind: "business", key: "green_thumb_nursery" }, format: "in_person", day: -15, hour: 10, hours: 3, capacity: 20, tickets: [["Workshop + kit", 799, 20]], fit: /Teacher|Food|Wellness|Student/i, size: [10, 18] },
  { slug: "asha_clinic_health_talk", title: "Family Health Talk: Monsoon Care", description: md("A short talk by our physicians on staying healthy during the monsoon. General information, not medical advice.", ["Common monsoon illnesses", "Prevention tips", "Q&A"]), host: { kind: "business", key: "asha_family_clinic" }, format: "hybrid", day: 9, hour: 17, hours: 1, capacity: 80, tickets: [["Free entry", null, 80]], fit: /Doctor|Physician|Teacher|Wellness/i, size: [14, 28] },
  { slug: "saarthi_book_drive_day", title: "Saarthi Book Drive Day", description: md("Donate gently used children's books and help us set up classroom reading corners.", ["Drop-off from 10am", "Volunteers welcome", "Tea for donors"]), host: { kind: "business", key: "saarthi_cares" }, format: "in_person", day: 8, hour: 10, hours: 6, capacity: null, tickets: [["Volunteer / donor", null, null]], fit: /Teacher|Student|Writer|Educator|Doctor/i, size: [16, 30] },
  { slug: "lens_loom_portrait_day", title: "Portrait Day at Lens & Loom", description: md("Book a 20-minute mini portrait session with our team. Five edited photos included.", ["Limited slots", "Natural light studio", "Edited photos in 3 days"]), host: { kind: "business", key: "lens_and_loom" }, format: "in_person", day: 15, hour: 11, hours: 6, capacity: 18, tickets: [["Mini session", 999, 18]], fit: /Marketing|Founder|Designer|Artist/i, size: [8, 16] },
  { slug: "kaagaz_print_talk", title: "Print & Packaging 101 (Live Online)", description: md("A practical talk on preparing files for print and choosing paper for small business packaging.", ["File setup", "Paper and finishes", "Common mistakes"]), host: { kind: "business", key: "kaagaz_print_design" }, format: "virtual", day: -4, hour: 17, hours: 1, capacity: 100, tickets: [["Free entry", null, 100]], fit: /Marketing|Designer|Illustrator|Founder/i, size: [12, 22] },
  // ---- events hosted by individual dots ----
  { slug: "film_short_screening_tram", title: "Last Tram: Screening & Q&A", description: md("A screening of a 12-minute short film shot on the city's last tram line, followed by a Q&A with the crew.", ["Screening", "Crew Q&A", "Tea and snacks"]), host: { kind: "user", key: "film" }, format: "in_person", day: 10, hour: 18, hours: 2, capacity: 60, tickets: [["Entry", 150, 60]], fit: /Film|Cinematograph|Video|Photograph/i, size: [12, 24] },
  { slug: "writer_editing_workshop", title: "Edit Your First Draft: Live Workshop", description: md("A hands-on workshop on the three-pass editing method, with live edits of volunteers' paragraphs.", ["Structure, sentences, sound", "Live edits", "Recording shared"]), host: { kind: "user", key: "writer" }, format: "virtual", day: 6, hour: 19, hours: 2, capacity: 50, tickets: [["Workshop", 299, 50]], fit: /Writer|Journalist|Editor|Student/i, size: [12, 24] },
  { slug: "fitness_beginner_strength_class", title: "Beginner Strength Class (Live)", description: md("A live 45-minute class introducing the squat, hinge and push. No equipment needed.", ["Form cues", "Progressions", "Q&A"]), host: { kind: "user", key: "fitness" }, format: "virtual", day: 3, hour: 7, hours: 1, capacity: 100, tickets: [["Class pass", 99, 100]], fit: /Fitness|Wellness|Student|Engineer/i, size: [14, 28] },
  { slug: "finance_money_basics_webinar", title: "Money Basics for First Jobs (Educational)", description: md("A webinar on budgeting, emergency funds and tax basics for people starting their first job. Educational only.", ["Reading your payslip", "Emergency fund basics", "Q&A"]), host: { kind: "user", key: "finance" }, format: "virtual", day: -8, hour: 20, hours: 1, capacity: null, tickets: [], fit: /Finance|Accountant|Student|Engineer/i, size: [16, 30] },
  { slug: "music_riyaz_masterclass", title: "Riyaz Masterclass: Slow Practice", description: md("A live masterclass on structuring daily practice with a drone and a metronome.", ["Slow practice method", "Live demonstration", "Q&A"]), host: { kind: "user", key: "music" }, format: "virtual", day: 12, hour: 18, hours: 2, capacity: 60, tickets: [["Masterclass", 249, 60]], fit: /Music|Singer|Student|Teacher/i, size: [10, 22] },
  { slug: "teacher_maths_fun_day", title: "Maths Fun Day for Kids", description: md("A morning of puzzles and games that make maths friendly for children aged 8 to 13.", ["Puzzle stations", "Team games", "Certificates for everyone"]), host: { kind: "user", key: "teacher" }, format: "in_person", day: 18, hour: 10, hours: 4, capacity: 40, tickets: [["Child entry", 200, 40]], fit: /Teacher|Educator|Professor|Student/i, size: [8, 18] },
  { slug: "photo_street_walk_old_city", title: "Old City Street Photography Walk", description: md("A guided street photography walk through the old city lanes. Bring a camera or phone.", ["Composition and light", "Approaching strangers respectfully", "Photo review over chai"]), host: { kind: "user", key: "photo" }, format: "in_person", day: 7, hour: 7, hours: 3, capacity: 15, tickets: [["Walk ticket", 499, 15]], fit: /Photograph|Filmmaker|Student|Artist/i, size: [10, 15] },
  { slug: "pm_interview_prep_session", title: "PM Interview Prep Session", description: md("A mock interview session with feedback for aspiring product managers.", ["Product sense and metrics", "Live mock interviews", "Feedback sheet"]), host: { kind: "user", key: "pm" }, format: "virtual", day: -18, hour: 19, hours: 2, capacity: 30, tickets: [["Session", 299, 30]], fit: /Product|Student|Design|Marketing/i, size: [10, 20] },
  // ---- platform (@dot) ----
  { slug: "zero_dot_community_meetup", title: "0dot Community Meetup", description: md("Meet the 0dot team and fellow dots. Share what you're building and what you'd like to see next.", ["Roadmap peek", "Community spotlight", "Open Q&A"]), host: { kind: "platform", key: "welcome_hall" }, format: "virtual", day: 7, hour: 19, hours: 1, capacity: null, tickets: [], fit: /./, size: [40, 70] },
  { slug: "zero_dot_creator_office_hours", title: "Creator Office Hours", description: md("Ask about profiles, portfolios, memberships and payouts. We'll answer live.", ["Monetization walkthrough", "Portfolio tips", "Live Q&A"]), host: { kind: "platform", key: "user" }, format: "virtual", day: 2, hour: 18, hours: 1, capacity: 200, tickets: [["Free entry", null, 200]], fit: /Writer|Music|Film|Photograph|Fitness|Food|Teacher|Founder/i, size: [24, 46] },
  // ---- drafts and cancellations ----
  { slug: "desi_devs_rust_night_draft", title: "Rust for Backend Devs (Draft)", description: md("A draft session on adopting Rust in backend services.", ["Outline in progress"]), host: { kind: "community", key: "desi_devs" }, format: "virtual", day: 25, hour: 19, hours: 2, capacity: 50, tickets: [], visibility: "host_only", status: "draft", fit: /Engineer/i, size: [0, 0] },
  { slug: "cricket_adda_rained_out", title: "Cricket Adda Monsoon League Finals", description: md("The finals were cancelled because of heavy rain. We'll announce a new date soon.", ["Cancelled due to weather"]), host: { kind: "community", key: "cricket_adda" }, format: "in_person", day: -3, hour: 8, hours: 6, capacity: 60, tickets: [["Entry", 100, 60]], status: "cancelled", fit: /Cricket|Athlete|Sports/i, size: [10, 18] },
  { slug: "founders_circle_dinner", title: "Founders Circle Dinner", description: md("A private dinner for members of the Founders Circle. Chatham House rule applies.", ["Invite only", "Off the record"]), host: { kind: "community", key: "founders_circle" }, format: "in_person", day: 20, hour: 20, hours: 3, capacity: 12, tickets: [["Seat", null, 12]], visibility: "attendees_only", fit: /Founder|CEO|CTO/i, size: [6, 10] },
];

export const EVENT_CITY_COORDS: Record<string, [number, number]> = {
  Bengaluru: [12.9716, 77.5946], Pune: [18.5204, 73.8567], Delhi: [28.6139, 77.209], Kolkata: [22.5726, 88.3639], Mumbai: [19.076, 72.8777], Hyderabad: [17.385, 78.4867],
  Ahmedabad: [23.0225, 72.5714], Nashik: [19.9975, 73.7898], Gurugram: [28.4595, 77.0266], Mysuru: [12.2958, 76.6394], Kochi: [9.9312, 76.2673], Lucknow: [26.8467, 80.9462],
  Jaipur: [26.9124, 75.7873], Chennai: [13.0827, 80.2707], Noida: [28.5355, 77.391], Chandigarh: [30.7333, 76.7794], Indore: [22.7196, 75.8577], Kolkata2: [22.5726, 88.3639],
};

export const VENUES = ["Community Hall", "Co-working Space", "Riverside Garden", "Arts Centre", "Old Library Courtyard", "Terrace Café", "Sports Ground", "Convention Room"];
