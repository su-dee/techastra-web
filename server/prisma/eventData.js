/**
 * Techastra '26 events - Senior (college students) and Junior (school
 * students).
 *
 * CONFIRMED - from "Techastra '26 List.docx", "JUNIOR TECHASTRA EVENTS
 * LIST.docx", "Junior techastra'26 all event details.docx" (junior rules,
 * formats and team sizes) and the main site's techastra-web/src/data/events.js:
 *   name, level, category, track (tagline), description, rounds/rules/
 *   judging (rulebook), coordinator names (+ phone numbers for senior
 *   technical events), junior team sizes, and for ALL senior events the
 *   day, venue and time slot (from "VENUES  REVISED 2.docx").
 *
 * NOT CONFIRMED - no source document has these yet; the numbers below are
 * working values so cart clash-detection and checkout keep functioning.
 * Replace them (here, or in the admin Events tab) once finalised:
 *   maxSeats, and junior times and venues.
 *
 * FEES (organisers, 28 Sep 2026): individual ₹100, team of 2 or 3 ₹200,
 * team of 4 ₹250, Hack Nexus ₹1000, combo pass ₹200. Junior events are free -
 * registration only collects the student's details. Senior team sizes follow
 * the organisers' combo sheet.
 *   Venue is left null (shows "TBA") wherever it isn't known.
 *
 * Descriptions for Prompt Arena and all non-technical events were written
 * for the main site and are marked "TODO: confirm" there too.
 */

// Symposium days, in IST.
const DAY_DATES = { 1: "2026-10-08", 2: "2026-10-09" };
const at = (day, hh, mm = 0) =>
  new Date(`${DAY_DATES[day]}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);

const phone = (n) => (n ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : "");
const staff = (name, n) => ({ name, role: "Staff Coordinator", phone: phone(n) });
const student = (name, n) => ({ name, role: "Student Coordinator", phone: phone(n) });

function rulebook({ rounds = [], rules = [], judging = [] }) {
  const parts = [];
  if (rounds.length) parts.push(rounds.map((r, i) => `${i + 1}. ${r.title} — ${r.text}`).join("\n"));
  if (rules.length) parts.push(rules.map((r) => `• ${r}`).join("\n"));
  if (judging.length) parts.push(`Judged on: ${judging.join(", ")}.`);
  return parts.length ? parts.join("\n\n") : null;
}

// `level` defaults to senior. `day` is only set where the organisers have
// fixed it; `when` is the
// (unconfirmed) slot used for startTime/endTime.
const EVENTS = [
  // ---------------------------------------------------------------
  // TECHNICAL (8) - staff/student coordinators with phone numbers
  // ---------------------------------------------------------------
  {
    name: "Pen Your Vision",
    track: "Paper Presentation",
    category: "technical",
    day: 1,
    venue: "DAA Lab",
    description:
      "A platform for participants to present innovative ideas and research on technology and emerging fields. Research. Present. Defend. Innovate.",
    rules: {
      rounds: [
        { title: "Presentation", text: "Select a technical topic, prepare a presentation, and present your research before a panel of judges within the given time limit." },
        { title: "Q&A", text: "A short Q&A session follows, where judges evaluate your understanding and ideas." },
      ],
      judging: ["Content", "Technical knowledge", "Originality", "Presentation skills", "Clarity", "Ability to answer questions"],
    },
    coordinators: [
      staff("Dr. V. B. Ganapathy", "9444954043"),
      staff("Dr. Jayaprakash", "9443919169"),
      student("Ms. Laavanya Muthukumar", "9025442826"),
      student("Ms. Supriya P", "8939302988"),
    ],
    when: [1, [9, 30], [16, 0]], fee: 100, maxSeats: 40, team: [1, 1],
  },
  {
    name: "Hack Nexus",
    track: "Hackathon",
    category: "technical",
    day: 1,
    venue: "CAR Lab & Garuda Lab (finals: Garuda Lab)",
    description:
      "A high-energy technical challenge where participants turn ideas into working solutions. Teams identify a real-world problem, brainstorm innovative approaches, and build a functional prototype using technology, coding, and creativity within a limited time. Whether it is an app, website, AI solution, automation tool, or any other technology-driven idea — build something meaningful and impactful. Shortlisted teams return on Day 2 for the finalist round.",
    rules: {
      rounds: [
        { title: "Hackathon", text: "October 8, 2026 (Day 1), 9:30 AM – 7:30 PM in CAR Lab & Garuda Lab. Build your prototype." },
        { title: "Finalist round", text: "October 9, 2026 (Day 2), 9:30 AM – 2:00 PM in Garuda Lab, for shortlisted teams only." },
      ],
      judging: ["Innovation", "Technical implementation", "Functionality", "Problem-solving approach", "Presentation"],
    },
    coordinators: [
      staff("Dr. F. Antony Xavier Bronson", "9841302602"),
      staff("Dr. M. Anand", "9600686861"),
      student("Mr. Kishore Kumar", "9499971978"),
      student("Mr. Sudeep Krishna", "9176327870"),
    ],
    // Day 1 is the hackathon; Day 2 (9:30-2:00, Garuda Lab) is the finalist
    // round for shortlisted teams only, so it isn't part of the booked slot.
    when: [1, [9, 30], [19, 30]], fee: 1000, maxSeats: 60, team: [2, 4],
  },
  {
    name: "Crypt Clash",
    track: "Capture the Flag",
    category: "technical",
    day: 2,
    venue: "C Programming Lab",
    description:
      "A technical cybersecurity challenge where participants solve problems across web security, cryptography, digital forensics, reverse engineering, and logical problem-solving. Investigate clues, crack challenges, and uncover hidden flags to earn points and climb the leaderboard. Decode. Investigate. Exploit. Capture the Flag.",
    coordinators: [
      staff("Mrs. Ruth Rubavathy", "7702957580"),
      staff("Mr. Sambhav"),
      student("Mr. Sathyanarayanan", "7200493725"),
      student("Ms. Saisree S", "6380338094"),
    ],
    when: [2, [9, 30], [16, 0]], fee: 200, maxSeats: 50, team: [1, 2],
  },
  {
    name: "Trial of Truth",
    track: "Courtroom Showdown",
    category: "technical",
    day: 2,
    venue: "VOC 201",
    description: "A 3-round courtroom showdown where teams defend opposing conclusions as evidence changes live.",
    rules: {
      rounds: [
        { title: "The Setup", text: "Review evidence and present opening arguments." },
        { title: "The Twist", text: "New evidence, cross-examination, and Objection Cards challenge both sides." },
        { title: "Final Showdown", text: "Deliver closing arguments; the audience votes and judges announce the verdict." },
      ],
      judging: ["Evidence", "Accuracy", "Persuasion", "Rebuttals"],
    },
    coordinators: [
      staff("Mrs. S. Divya", "9080791858"),
      staff("Mr. Ajay", "9400225351"),
      student("Ms. Pavni Ahuja", "9345495489"),
      student("Mr. Geetkumar", "9514773056"),
    ],
    when: [2, [9, 30], [14, 0]], fee: 200, maxSeats: 100, team: [2, 2],
  },
  {
    name: "Code Rescue",
    track: "Debugging Challenge",
    category: "technical",
    day: 1,
    venue: "IBM Lab",
    description:
      "A fast-paced debugging challenge where participants must find, understand, and fix hidden bugs in code. From syntax errors and logical flaws to unexpected runtime issues, race against the clock to restore broken programs and make them work correctly. Find the Bug. Fix the Code. Rescue the Program.",
    rules: { judging: ["Accuracy", "Speed", "Debugging skills", "Problem-solving ability"] },
    coordinators: [
      staff("Dr. G. Senthilvelan", "9840466300"),
      staff("Mrs. Anu", "9841138462"),
      student("Mr. Sanjai P A", "9487826286"),
      student("Ms. Kavitha G", "6382401242"),
    ],
    when: [1, [9, 30], [11, 30]], fee: 100, maxSeats: 60, team: [1, 1],
  },
  {
    name: "Pixel Protocol",
    track: "Design Wars",
    category: "technical",
    day: 1,
    venue: "Network Lab",
    description: "A two-round creative challenge where teams transform a given brand brief into a complete visual identity.",
    rules: {
      rounds: [
        { title: "Logo Rush", text: "Design a bold, simple logo within 25 minutes, using a maximum of two colours and ensuring it works in black & white." },
        { title: "Poster Power-Up", text: "Using the same logo, create a promotional poster within 30 minutes, focusing on visual hierarchy, creativity, and brand impact." },
      ],
      judging: ["Originality", "Clarity", "Visual impact", "Logo–poster integration", "Effective use of time"],
    },
    coordinators: [
      staff("Mrs. Chinchu Nair", "9176544377"),
      student("Mr. Mohamed Farhan Siddiqui", "9344971806"),
      student("Mr. Jeeva Ganesh", "7639710845"),
    ],
    // Individual per the organisers' combo sheet (28 Sep 2026).
    when: [1, [12, 0], [14, 0]], fee: 100, maxSeats: 50, team: [1, 1],
  },
  {
    name: "Forensic Alibi",
    track: "Crime-Solving Investigation",
    category: "technical",
    day: 1,
    venue: "C Programming Lab & VOC 414",
    description:
      "A crime-solving game where players work as a team to uncover what really happened using clues, digital information, and physical evidence.",
    rules: {
      rounds: [
        { title: "Round 1", text: "Suspect clues, messages, locations, and timings are given. Identify the alibi that does not match." },
        { title: "Round 2", text: "Analyse different evidence and identify what is real, fake, or misleading." },
        { title: "Round 3", text: "A crime scene is created at the venue. Study the clues, connect the evidence, and solve the case." },
      ],
    },
    coordinators: [
      staff("Mrs. Menaga", "9500958682"),
      staff("Mrs. Magna", "9444524844"),
      student("Ms. Roso", "8015253342"),
      student("Mr. Jeevan", "9884994951"),
    ],
    when: [1, [10, 0], [13, 0]], fee: 250, maxSeats: 40, team: [4, 4],
  },
  {
    name: "Prompt Arena",
    track: "AI Prompt Engineering",
    category: "technical",
    day: 1,
    venue: "IBM Lab",
    description:
      "A battle of words and wits with generative AI. Craft precise, creative prompts to get AI models to produce the best possible output for each challenge — the sharpest prompt engineer takes the arena.",
    coordinators: [
      staff("Mr. M. Arun", "9600652291"),
      student("Ms. Mithila Krishna", "9941821475"),
      student("Ms. Abinaya", "9566574288"),
    ],
    when: [1, [14, 15], [16, 15]], fee: 100, maxSeats: 50, team: [1, 1],
  },

  // ---------------------------------------------------------------
  // NON-TECHNICAL (8) - day and venue confirmed; no phone numbers yet
  // ---------------------------------------------------------------
  {
    name: "Rhythm Riot",
    track: "Music & Dance",
    category: "non_technical",
    day: 1,
    venue: "CAD Lab",
    description: "Bring the beat and own the floor. A high-energy showcase of rhythm, movement and stage presence.",
    coordinators: [
      staff("Dr. M. Sujitha"),
      staff("Dr. M. Nisha"),
      student("Mr. Aldrin"),
      student("Ms. Dharani Rajan"),
      student("Ms. Nandika Hegde N"),
    ],
    when: [1, [14, 0], [16, 0]], fee: 200, maxSeats: 60, team: [3, 3],
  },
  {
    name: "Hidden Frames",
    track: "Visual Puzzle Hunt",
    category: "non_technical",
    day: 1,
    venue: "CAD Lab & VOC 201",
    description: "Look closer. Spot what is concealed in every frame and piece together the picture before anyone else does.",
    coordinators: [staff("Mrs. G. Priyanka"), student("Mr. Dhevanathan R"), student("Mr. Sham Prasad"), student("Mr. Rithvick Sree")],
    when: [1, [9, 30], [11, 30]], fee: 200, maxSeats: 100, team: [2, 2],
  },
  {
    name: "Verbal Combat",
    track: "Debate & Wordplay",
    category: "non_technical",
    day: 1,
    venue: "VOC 410",
    description: "Words are your weapons. Argue, counter and persuade your way through rapid-fire rounds of spoken combat.",
    coordinators: [staff("Dr. K. K. Rekha"), student("Ms. Kanishkaa R"), student("Ms. Lavanya R"), student("Mr. Shelton Paul Christopher")],
    when: [1, [14, 15], [16, 15]], fee: 100, maxSeats: 40, team: [1, 1],
  },
  {
    name: "Blitz Hunt",
    track: "Treasure Hunt",
    category: "non_technical",
    day: 1,
    venue: "VOC 407",
    description: "Follow the clues, beat the clock. A lightning-fast hunt that rewards sharp minds and quick feet.",
    coordinators: [staff("Mrs. E. Nalini"), student("Ms. Lathika"), student("Mr. Gopi Shankar"), student("Mr. Sai Jeevan N")],
    when: [1, [14, 15], [16, 15]], fee: 200, maxSeats: 90, team: [3, 3],
  },
  {
    name: "Plot Twist",
    track: "Storytelling",
    category: "non_technical",
    day: 1,
    venue: "VOC 415",
    description: "Just when you think you know the ending — it changes. Think on your feet and spin the story your way.",
    coordinators: [staff("Dr. B. Raja"), staff("Mr. Mohan"), student("Ms. Harshini"), student("Ms. Subiksha"), student("Ms. Jayashree")],
    when: [1, [9, 30], [11, 30]], fee: 200, maxSeats: 50, team: [3, 3],
  },
  {
    name: "Team Feud",
    track: "Team Quiz Game",
    category: "non_technical",
    day: 1,
    venue: "Hi-Tech Lab",
    description: "Guess what the crowd thinks. Teams face off to match the most popular answers and claim the board.",
    coordinators: [
      staff("Dr. M. Manikandan"),
      staff("Mr. M. Umamahesh"),
      student("Ms. Subhashini M"),
      student("Mr. Guru Prasath"),
      student("Mr. Venkatesh"),
    ],
    when: [1, [12, 0], [14, 0]], fee: 200, maxSeats: 60, team: [3, 3],
  },
  {
    name: "Cap Chaos",
    track: "Fun Games",
    category: "non_technical",
    day: 1,
    venue: "VOC 413",
    description: "Quick thinking, quicker hands. A whirlwind of playful challenges where anything can happen.",
    coordinators: [staff("Mrs. M. Kanagapriya"), student("Ms. Sonali"), student("Ms. Harini"), student("Mr. Kumaresan")],
    when: [1, [12, 0], [14, 0]], fee: 200, maxSeats: 100, team: [3, 3],
  },
  {
    name: "Clash Squad E-Sports",
    track: "E-Sports Tournament",
    category: "non_technical",
    day: 2,
    venue: "CAD Lab",
    description:
      "Squad up and drop in. A competitive e-sports showdown where strategy, reflexes and teamwork decide the last squad standing.",
    coordinators: [staff("Dr. S. Mohandoss"), student("Mr. Sravan Kumar"), student("Mr. Lakshmikanth"), student("Mr. Guru K")],
    when: [2, [9, 30], [14, 0]], fee: 250, maxSeats: 80, team: [4, 4],
  },

  // ===============================================================
  // JUNIOR TECHASTRA (school students) - descriptions, rounds, rules,
  // judging and team sizes from "Junior techastra'26 all event
  // details.docx" (2026-09-26). All on Day 2 and free (fee 0). Times and
  // seats are still working values, except Actventure's 20-team cap.
  // ===============================================================
  {
    level: "junior",
    name: "Byte Rush",
    track: "Quiz Challenge",
    category: "technical",
    day: 2,
    venue: "CAD Lab",
    description:
      "An exciting quiz competition for school students covering General Knowledge, Subject Knowledge, Science & Technology, Logic, Creativity and challenging questions — in MCQ, True/False, Visual, Identify, Puzzle and other interesting formats. Round 1 is a 30-minute quiz for everyone; the top scorers move on to a shorter, tougher final round that decides the winner.",
    rules: {
      rounds: [
        { title: "Round 1", text: "A 30-minute quiz for all participants. The highest scorers are selected for the next round." },
        { title: "Round 2", text: "Selected participants compete in a shorter and more challenging quiz. The final winner is decided on performance in this round." },
      ],
      rules: [
        "Each team consists of 2 students.",
        "+1 mark for each correct answer. There is no negative marking.",
        "Mobile phones, smartwatches and external assistance are not allowed.",
        "Don’t share answers with other teams.",
        "Any malpractice will result in disqualification.",
        "In case of a tie, a tie-breaker round will be conducted.",
        "The judges’ decision is final and binding.",
      ],
    },
    coordinators: [staff("Mr. M. Uma Mahesh"), student("Mr. Arya Venkata Sai"), student("Mr. Sunil Reddy"), student("Mr. Dharanirajan B")],
    when: [2, [10, 0], [11, 0]], fee: 0, maxSeats: 60, team: [2, 2],
  },
  {
    level: "junior",
    name: "Prompt Wars",
    track: "AI Image Recreation Challenge",
    category: "technical",
    day: 2,
    venue: "Communication Lab",
    description:
      "An AI generation challenge testing memory and prompt engineering. Teams are shown a reference image for 60 seconds and must observe and remember it. Once it is hidden, they craft a prompt to recreate the image on a specified AI platform. The team with the highest overall score wins.",
    rules: {
      rules: [
        "Only 2 students are allowed per team.",
        "The reference image is displayed for 60 seconds; participants must not obtain or view it after it has been hidden.",
        "Teams create a prompt to recreate the hidden image using the specified AI platform. Multiple reference images may be given during the competition.",
        "Each challenge must be completed within the announced time limit; only images submitted in time are evaluated.",
        "Teams must work independently and must not copy or share prompts, images, results or ideas with other teams.",
        "Mobile phones, smartwatches and unauthorised external assistance are strictly prohibited.",
        "Copying, malpractice or unfair assistance may result in disqualification.",
        "In case of a tie, the organisers may conduct a tie-breaker challenge.",
        "The judges’ decision on scoring and qualification is final and binding.",
      ],
      judging: ["Visual similarity", "Accuracy", "Creativity", "Prompt effectiveness"],
    },
    coordinators: [staff("Dr. S. Akila"), staff("Mr. L. Magnus Jesrus"), student("Ms. J Kavya"), student("Ms. Dharshini")],
    when: [2, [11, 0], [12, 0]], fee: 0, maxSeats: 45, team: [2, 2],
  },
  {
    level: "junior",
    name: "Vision Forge",
    track: "Imagine the Future",
    category: "technical",
    day: 2,
    venue: "VOC 415 & VOC 416",
    description:
      "A creative innovation challenge where students turn simple craft materials into an innovative model on the theme “Imagine the Future” — an idea that solves a real-world problem in areas such as future technology, smart cities, healthcare, education, transportation, environment, safety or daily life.",
    rules: {
      rounds: [
        { title: "Build", text: "60 minutes to design and build the model using the 8–9 basic craft materials provided by the organisers. No construction or changes are allowed after time ends." },
        { title: "Present", text: "2–3 minutes to explain to the judges what the model is, the problem it addresses, how it works and how it can be useful in the future." },
      ],
      rules: [
        "Each team consists of 3 students; all members must take part in designing, building and presenting.",
        "Only the materials provided may be used, unless the organisers announce otherwise.",
        "The model must be made during the event — nothing may be prepared in advance.",
        "The quality of the idea and creative use of materials matter more than the size or complexity of the model.",
        "Don’t copy another team’s model or concept, or damage another team’s work — this may lead to disqualification.",
        "Leave your workspace clean after the activity.",
      ],
      judging: ["Creativity & innovation", "Theme relevance", "Effective use of materials", "Practicality / problem-solving", "Presentation"],
    },
    coordinators: [staff("Mr. E. Murali"), staff("Mrs. G. S. Ashitha"), student("Ms. S. M. Pooja"), student("Ms. B. Nisha")],
    when: [2, [10, 0], [13, 0]], fee: 0, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Cipher Quest",
    track: "Decode the Hidden Secret",
    category: "technical",
    day: 2,
    venue: "CAR Lab",
    description:
      "An interactive puzzle game for students of Classes 6 to 9. Teams solve 25 sequential locks — each one opens only when the previous lock is solved — using observation, logic, patterns, basic maths, alphabet knowledge and simple decoding. Cybersecurity is the theme and story; no prior cybersecurity knowledge is needed.",
    rules: {
      rounds: [
        { title: "The Quest", text: "One round of 25 sequential locks/questions, with a 30-minute time limit. Solve as many locks as possible, in order." },
      ],
      rules: [
        "Each team consists of 2 participants who solve the puzzles together.",
        "Locks must be solved in order; the next lock opens only after the current one is solved correctly.",
        "No skipping — once a team moves on, the previous lock cannot be reopened.",
        "The team that completes the most locks wins; if tied, the shorter completion time ranks higher.",
        "Sharing answers, bypassing locks, modifying the game or manipulating the timer or results is strictly prohibited.",
        "Don’t refresh, modify or tamper with the game unless the coordinator instructs you to.",
        "Report any technical issue to the coordinator immediately; the coordinator’s decision is final.",
      ],
    },
    coordinators: [staff("Mrs. Ruth Rubavathy"), student("Mr. Aravind Kumar"), student("Mr. Aravind Krishan"), student("Ms. Sneka V S")],
    when: [2, [12, 0], [13, 0]], fee: 0, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "TRACE//X",
    track: "Crack the Cyber Case",
    category: "technical",
    day: 2,
    venue: "Hi-Tech Lab",
    description:
      "An unplugged cybersecurity case-solving challenge for school students. Each team receives a physical “Top Secret” dossier with a unique cyber-crime scenario and must analyse the evidence to identify what happened, the root cause and how it could be prevented — no computers or internet needed.",
    rules: {
      rounds: [
        { title: "Investigation", text: "30 minutes to study the dossier and evidence and write the findings and proposed solutions on the official answer sheet. Multiple approaches may be written." },
      ],
      rules: [
        "Each team must consist of 4 registered members.",
        "Every team gets a different case scenario (e.g. phishing, weak passwords, rogue Wi-Fi, malware).",
        "Sealed clue envelopes are available if a team is stuck, but each one carries negative marking (−2, −5 or −10).",
        "Mobile phones, smartwatches and internet searches are strictly prohibited.",
        "Don’t share clues, solutions or answers with other teams.",
        "Ties are broken by submission time — the team that submits earlier ranks higher.",
        "Cheating or malpractice may lead to penalties or disqualification; the judges’ decision is final.",
      ],
      judging: ["Accuracy of the root cause", "Evidence spotted", "Solutions proposed", "Clue deductions", "Rule compliance"],
    },
    coordinators: [staff("Ms. G. Priyanka"), student("Ms. Nandhitha L"), student("Ms. Mythreya")],
    when: [2, [13, 0], [14, 0]], fee: 0, maxSeats: 40, team: [4, 4],
  },
  {
    level: "junior",
    name: "Mind Merge",
    track: "Connections",
    category: "non_technical",
    day: 2,
    venue: "DAA Lab",
    description:
      "A fast-paced connection challenge that tests observation, logical thinking, creativity, teamwork and quick responses. Teams are shown images, objects, symbols, words or clues and must find the common connection and give the answer it leads to before time runs out.",
    rules: {
      rounds: [
        { title: "Connection Challenge", text: "Each team gets 1 minute to identify as many correct connections as possible. The top-performing teams are shortlisted." },
        { title: "Mind Rush", text: "Shortlisted teams face a faster, more challenging round — 30 seconds to identify as many connections as possible." },
      ],
      rules: [
        "Each team consists of 3 students.",
        "Points are awarded for every correct connection; speed and accuracy are also considered.",
        "Don’t discuss or reveal answers to other teams.",
        "No mobile phones, smart devices or outside assistance.",
        "Don’t shout answers before your team has discussed them, unless the coordinators say so.",
        "No answers after the time limit has ended.",
        "Respect the coordinators, judges and other teams.",
      ],
      judging: ["Correct connections", "Speed", "Accuracy"],
    },
    coordinators: [staff("Mr. J. R. Jayavelu"), staff("Dr. K. K. Rekha"), student("Ms. Lalitha"), student("Mr. Linga Munishwar")],
    when: [2, [10, 0], [11, 0]], fee: 0, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Whatzit?",
    track: "Guess It!",
    category: "non_technical",
    day: 2,
    venue: "C Programming Lab",
    description:
      "A fast-paced visual guessing game that tests observation, general awareness and quick thinking. Teams identify gadgets, logos, symbols, objects, tools and icons — some zoomed in, partially hidden, blurred or shown from unusual angles — within the time limit.",
    rules: {
      rules: [
        "Each team consists of 2 participants.",
        "Every question has a fixed time limit; answer before time runs out.",
        "Correct answers earn points (with possible bonus points for quick responses); incorrect answers earn none.",
        "A submitted answer cannot be changed unless the coordinator permits.",
        "Phones, smartwatches, laptops, the internet and AI tools are strictly prohibited.",
        "No help from other teams or the audience, and no sharing answers.",
        "Don’t photograph or record the questions.",
        "Unfair means, cheating or disturbing others may lead to disqualification.",
        "Teams with equal scores play a tie-breaker; in any dispute the coordinators’/judges’ decision is final.",
      ],
      judging: ["Correct answers", "Speed"],
    },
    coordinators: [staff("Mrs. Vidhyalakshmi"), staff("Mrs. S. Amutha"), student("Mr. Ferlin Jose"), student("Mr. Siva Sankar")],
    when: [2, [12, 0], [13, 0]], fee: 0, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "Actventure",
    track: "Create · Perform · Convince",
    category: "non_technical",
    day: 2,
    venue: "VOC 406",
    description:
      "A live performance event that tests creativity, originality and teamwork. Each team is given a product or service and must write, plan and perform a live advertisement for it in a maximum of 3 minutes, closing with a memorable slogan, tagline or punchline.",
    rules: {
      rules: [
        "Each team consists of 3 participants, and all members must perform.",
        "Create and perform an advertisement for the product/service assigned to your team.",
        "Maximum 3 minutes per team; overtime may be penalised.",
        "A total of 20 teams will compete.",
        "Present your own idea — copying another team’s concept is not allowed.",
        "Dangerous props or unsafe activities are strictly prohibited.",
        "No offensive, abusive or inappropriate content.",
        "No outsiders assisting on or off stage.",
        "End your act with a strong slogan, tagline or punchline.",
        "The judges’ decision is final and binding.",
      ],
      judging: ["Originality", "Presentation", "Teamwork", "Impact"],
    },
    coordinators: [staff("Mr. P. Sudarsan"), staff("Mr. P. Jayakrishnan"), student("Mr. Pavan"), student("Mr. Kevin Adithya"), student("Ms. Lavanya A")],
    when: [2, [11, 0], [12, 0]], fee: 0, maxSeats: 20, team: [3, 3],
  },
  {
    level: "junior",
    name: "Seekret",
    track: "Feel It, Find It, Create It!",
    category: "non_technical",
    day: 2,
    venue: "VOC 403",
    description:
      "A mystery-box challenge that tests touch, observation, imagination and creativity. A large box hides many small objects. Teams first identify objects by touch alone, then connect them into a meaningful story presented to the judges.",
    rules: {
      rounds: [
        { title: "Mystery Hunt", text: "Touch and feel the objects without looking and identify as many as possible. Points for each correctly identified object." },
        { title: "Secret Story", text: "Identify 5–8 hidden objects by touch, then connect all of them into a meaningful story, concept or creative scenario and present it to the judges." },
      ],
      rules: [
        "Each team consists of 2 students.",
        "No looking inside the mystery box.",
        "Mobile phones, smartwatches and external assistance are not allowed.",
        "Don’t share identified objects with other teams.",
        "Looking inside the box or receiving outside help results in disqualification.",
        "No negative marking.",
        "In case of a tie, an additional mystery-object round is conducted.",
        "The judges’ decision is final and binding.",
      ],
      judging: ["Identification accuracy", "Creativity", "Imagination", "Logical connection", "Storytelling", "Presentation"],
    },
    coordinators: [staff("Dr. M. Manikandan"), student("Mr. Rubesh"), student("Mr. Abinesh"), student("Mr. Hementh S")],
    when: [2, [11, 0], [12, 0]], fee: 0, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "Huntify",
    track: "Observation, Memory & Reaction",
    category: "non_technical",
    day: 2,
    venue: "VOC 413",
    description:
      "A fast-paced individual challenge that tests observation, concentration, memory, quick thinking and reaction speed across two rounds — think accurately and react quickly under time pressure.",
    rules: {
      rounds: [
        { title: "Word Arrange", text: "2 minutes (120 seconds) to arrange mixed-up letters or words on a card into the exact correct order. Only correctly completed tasks qualify; completion time and accuracy may be used for shortlisting." },
        { title: "Listen & React", text: "For shortlisted participants. Selected numbers are assigned words or actions — remember them and respond quickly whenever your number appears. The sequence gets faster; wrong, missed or late responses may mean a penalty or elimination." },
      ],
      rules: [
        "Individual event — one student participates at a time.",
        "Report to the venue before the scheduled start time and carry your student ID if asked.",
        "All participants must attend the rules briefing before the event.",
        "Start only on the official “START” signal and stop immediately at “TIME UP”.",
        "Don’t copy from or take help from other participants.",
        "Exact Round 2 scoring and elimination criteria are announced before the round; the judges’ decision is final.",
      ],
      judging: ["Accuracy", "Completion time", "Response speed", "Memory"],
    },
    // Not in the coordinator table yet.
    coordinators: [],
    when: [2, [10, 0], [11, 0]], fee: 0, maxSeats: 50, team: [1, 1],
  },
  {
    level: "junior",
    name: "Stack N' Dash",
    track: "The Ultimate Multitask Challenge",
    category: "non_technical",
    day: 2,
    venue: "VOC 407",
    description:
      "A fun, fast-paced multitasking challenge. Stack the given cups into the required tower while balancing a ball on the top cup — and at the same time keep a balloon in the air by tapping it. The fastest to finish both tasks with the fewest mistakes wins.",
    rules: {
      rules: [
        "Individual event — 1 participant at a time.",
        "Both tasks must be done simultaneously, without stopping either, until the cup stack with the ball is complete.",
        "Start only on the organiser’s signal; timing runs until both tasks are completed.",
        "If the balloon touches the ground, a +5 second penalty is added.",
        "If the ball falls, it must be placed back on the top cup before continuing; rebuild the stack if it falls.",
        "Don’t hold or support the ball with your hand, head, feet or any object, and don’t throw or knock the cups.",
        "No help from other participants or the audience; stay inside your playing area.",
        "In case of a tie, participants play the Cup and Straw Challenge.",
        "The organiser’s decision on timing, penalties and completion is final.",
      ],
      judging: ["Completion time", "Fewest mistakes"],
    },
    // Not in the coordinator table yet.
    coordinators: [],
    when: [2, [13, 0], [14, 0]], fee: 0, maxSeats: 50, team: [1, 1],
  },
];

/** Event rows in the shape prisma.event.create() expects. */
function buildEvents() {
  return EVENTS.map((e) => {
    const [d, [sh, sm], [eh, em]] = e.when;
    const [minTeamSize, maxTeamSize] = e.team;
    return {
      name: e.name,
      level: e.level || "senior",
      description: e.description,
      track: e.track,
      category: e.category,
      day: e.day ?? null,
      startTime: at(d, sh, sm),
      endTime: at(e.endDay ?? d, eh, em),
      fee: e.fee,
      maxSeats: e.maxSeats,
      isTeamEvent: maxTeamSize > 1,
      minTeamSize,
      maxTeamSize,
      venue: e.venue ?? null,
      rulebook: rulebook(e.rules || {}),
      coordinatorContacts: e.coordinators,
    };
  });
}

// Senior combo passes - organisers' Day 1 combo sheet (combo.jpeg,
// combo1.jpeg, 28 Sep 2026). Events in a combo sit in back-to-back Day 1 slots
// so they never clash. Hack Nexus and Pen Your Vision are full-day events and
// aren't in any combo. Registration fee: ₹200 per combo pass.
const COMBO_PRICE = 200;
const COMBOS = [
  {
    name: "Combo 1",
    events: ["Hidden Frames", "Team Feud", "Prompt Arena"],
    description:
      "Spot what's hidden in Hidden Frames, out-guess the crowd in Team Feud, then take on AI in Prompt Arena — three back-to-back events on Day 1.",
  },
  {
    name: "Combo 2",
    events: ["Code Rescue", "Cap Chaos", "Verbal Combat"],
    description:
      "Debug against the clock in Code Rescue, have fun in Cap Chaos, then argue your way through Verbal Combat — three back-to-back events on Day 1.",
  },
  {
    name: "Combo 3",
    events: ["Plot Twist", "Pixel Protocol", "Blitz Hunt"],
    description:
      "Spin a story in Plot Twist, design a brand in Pixel Protocol, then race the clues in Blitz Hunt — three back-to-back events on Day 1.",
  },
  {
    name: "Combo 4",
    events: ["Forensic Alibi", "Rhythm Riot"],
    description:
      "Crack the case in Forensic Alibi, then own the floor in Rhythm Riot — two back-to-back events on Day 1.",
  },

  // Junior Techastra combos - "Junior techastra combo poster.png". All on
  // Day 2 (9 Oct) in back-to-back hourly slots; registration is free, and
  // school students register individually (teams are formed at the venue).
  // Vision Forge (10 AM - 1 PM) is a standalone event, not in any combo.
  {
    name: "Junior Combo 1",
    level: "junior",
    price: 0,
    events: ["Byte Rush", "Actventure", "Whatzit?"],
    description:
      "Think · Express · Explore — Byte Rush (10–11 AM), Actventure (11 AM–12 PM) and Whatzit? (12–1 PM), back to back on Day 2.",
  },
  {
    name: "Junior Combo 2",
    level: "junior",
    price: 0,
    events: ["Huntify", "Prompt Wars", "Stack N' Dash"],
    description:
      "Create · Hunt · Race — Huntify (10–11 AM), Prompt Wars (11 AM–12 PM) and Stack N’ Dash (1–2 PM) on Day 2.",
  },
  {
    name: "Junior Combo 3",
    level: "junior",
    price: 0,
    events: ["Mind Merge", "Seekret", "TRACE//X"],
    description:
      "Trace · Solve · Connect — Mind Merge (10–11 AM), Seekret (11 AM–12 PM) and TRACE//X (1–2 PM) on Day 2.",
  },
  {
    name: "Junior Combo 4",
    level: "junior",
    price: 0,
    events: ["Cipher Quest", "Stack N' Dash"],
    description: "Decode · Build · Win — Cipher Quest (12–1 PM) and Stack N’ Dash (1–2 PM), back to back on Day 2.",
  },
];

module.exports = { buildEvents, COMBOS, COMBO_PRICE };
