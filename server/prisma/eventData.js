/**
 * Techastra '26 events - Senior (college students) and Junior (school
 * students).
 *
 * CONFIRMED - from "Techastra '26 List.docx", "JUNIOR TECHASTRA EVENTS
 * LIST.docx" and the main site's techastra-web/src/data/events.js:
 *   name, level, category, track (tagline), description, rounds/rules/
 *   judging (rulebook), coordinator names (+ phone numbers for senior
 *   technical events), junior team sizes, and for senior non-technical
 *   events the day and venue.
 *
 * NOT CONFIRMED - no source document has these yet; the numbers below are
 * working values so cart clash-detection and checkout keep functioning.
 * Replace them (here, or in the admin Events tab) once finalised:
 *   start/end times, fee, maxSeats, senior team sizes, and the date of
 *   every senior technical and every junior event (assumed Day 1). Venue is left null (shows "TBA")
 *   wherever it isn't known.
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
      student("Laavanya Muthukumar", "9025442826"),
      student("Supriya P", "8939302988"),
    ],
    when: [1, [9, 0], [11, 0]], fee: 100, maxSeats: 40, team: [1, 1],
  },
  {
    name: "Hack Nexus",
    track: "Hackathon",
    category: "technical",
    description:
      "A high-energy technical challenge where participants turn ideas into working solutions. Teams identify a real-world problem, brainstorm innovative approaches, and build a functional prototype using technology, coding, and creativity within a limited time. Whether it is an app, website, AI solution, automation tool, or any other technology-driven idea — build something meaningful and impactful.",
    rules: { judging: ["Innovation", "Technical implementation", "Functionality", "Problem-solving approach", "Presentation"] },
    coordinators: [
      staff("Dr. F. Antony Xavier Bronson", "9841302602"),
      staff("Dr. M. Anand", "9600686861"),
      student("Kishore Kumar", "9499971978"),
      student("Sudeep Krishna", "9176327870"),
    ],
    when: [1, [9, 0], [17, 0]], fee: 300, maxSeats: 60, team: [2, 4],
  },
  {
    name: "Crypt Clash",
    track: "Capture the Flag",
    category: "technical",
    description:
      "A technical cybersecurity challenge where participants solve problems across web security, cryptography, digital forensics, reverse engineering, and logical problem-solving. Investigate clues, crack challenges, and uncover hidden flags to earn points and climb the leaderboard. Decode. Investigate. Exploit. Capture the Flag.",
    coordinators: [
      staff("Mrs. Ruth Rubavathy", "7702957580"),
      staff("Mr. Sambhav"),
      student("Sathyanarayanan", "7200493725"),
      student("Saisree S", "6380338094"),
    ],
    when: [1, [10, 0], [12, 0]], fee: 120, maxSeats: 50, team: [1, 2],
  },
  {
    name: "Trial of Truth",
    track: "Courtroom Showdown",
    category: "technical",
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
      student("Pavni Ahuja", "9345495489"),
      student("Geetkumar", "9514773056"),
    ],
    when: [1, [10, 15], [12, 0]], fee: 50, maxSeats: 100, team: [2, 2],
  },
  {
    name: "Code Rescue",
    track: "Debugging Challenge",
    category: "technical",
    description:
      "A fast-paced debugging challenge where participants must find, understand, and fix hidden bugs in code. From syntax errors and logical flaws to unexpected runtime issues, race against the clock to restore broken programs and make them work correctly. Find the Bug. Fix the Code. Rescue the Program.",
    rules: { judging: ["Accuracy", "Speed", "Debugging skills", "Problem-solving ability"] },
    coordinators: [
      staff("Dr. G. Senthilvelan", "9840466300"),
      staff("Mrs. Anu", "9841138462"),
      student("Sanjai P A", "9487826286"),
      student("Kavitha G", "6382401242"),
    ],
    when: [1, [13, 0], [15, 0]], fee: 100, maxSeats: 60, team: [1, 1],
  },
  {
    name: "Pixel Protocol",
    track: "Design Wars",
    category: "technical",
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
      student("Mohamed Farhan Siddiqui", "9344971806"),
      student("Jeeva Ganesh", "7639710845"),
    ],
    // The source documents call this a team event.
    when: [1, [13, 0], [15, 0]], fee: 120, maxSeats: 50, team: [2, 3],
  },
  {
    name: "Forensic Alibi",
    track: "Crime-Solving Investigation",
    category: "technical",
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
      student("Roso", "8015253342"),
      student("Jeevan", "9884994951"),
    ],
    when: [1, [9, 30], [11, 30]], fee: 150, maxSeats: 40, team: [2, 3],
  },
  {
    name: "Prompt Arena",
    track: "AI Prompt Engineering",
    category: "technical",
    description:
      "A battle of words and wits with generative AI. Craft precise, creative prompts to get AI models to produce the best possible output for each challenge — the sharpest prompt engineer takes the arena.",
    coordinators: [
      staff("Mr. M. Arun", "9600652291"),
      student("Mithila Krishna", "9941821475"),
      student("Abinaya", "9566574288"),
    ],
    when: [1, [15, 0], [17, 0]], fee: 100, maxSeats: 50, team: [1, 1],
  },

  // ---------------------------------------------------------------
  // NON-TECHNICAL (8) - day and venue confirmed; no phone numbers yet
  // ---------------------------------------------------------------
  {
    name: "Rhythm Riot",
    track: "Music & Dance",
    category: "non_technical",
    day: 1,
    venue: "Lab",
    description: "Bring the beat and own the floor. A high-energy showcase of rhythm, movement and stage presence.",
    coordinators: [
      staff("Dr. M. Sujitha"),
      staff("Dr. M. Nisha"),
      student("Aldrin"),
      student("Dharani Rajan"),
      student("Nandika Hegde N"),
    ],
    when: [1, [14, 0], [16, 0]], fee: 80, maxSeats: 60, team: [1, 8],
  },
  {
    name: "Hidden Frames",
    track: "Visual Puzzle Hunt",
    category: "non_technical",
    day: 2,
    venue: "Lab",
    description: "Look closer. Spot what is concealed in every frame and piece together the picture before anyone else does.",
    coordinators: [staff("Mrs. G. Priyanka"), student("Dhevanathan R"), student("Sham Prasad"), student("Rithvick Sree")],
    when: [2, [11, 0], [12, 30]], fee: 50, maxSeats: 100, team: [2, 4],
  },
  {
    name: "Verbal Combat",
    track: "Debate & Wordplay",
    category: "non_technical",
    day: 1,
    venue: "Classroom",
    description: "Words are your weapons. Argue, counter and persuade your way through rapid-fire rounds of spoken combat.",
    coordinators: [staff("Dr. K. K. Rekha"), student("Kanishkaa R"), student("Lavanya R"), student("Shelton Paul Christopher")],
    when: [1, [10, 0], [12, 0]], fee: 80, maxSeats: 40, team: [1, 2],
  },
  {
    name: "Blitz Hunt",
    track: "Treasure Hunt",
    category: "non_technical",
    day: 1,
    venue: "2 Classrooms",
    description: "Follow the clues, beat the clock. A lightning-fast hunt that rewards sharp minds and quick feet.",
    coordinators: [staff("Mrs. E. Nalini"), student("Lathika"), student("Gopi Shankar"), student("Sai Jeevan N")],
    when: [1, [11, 0], [13, 0]], fee: 60, maxSeats: 90, team: [3, 5],
  },
  {
    name: "Plot Twist",
    track: "Storytelling",
    category: "non_technical",
    day: 1,
    venue: "Classroom",
    description: "Just when you think you know the ending — it changes. Think on your feet and spin the story your way.",
    coordinators: [staff("Dr. B. Raja"), staff("Mr. Mohan"), student("Harshini"), student("Subiksha"), student("Jayashree")],
    when: [1, [13, 30], [15, 30]], fee: 90, maxSeats: 50, team: [2, 5],
  },
  {
    name: "Team Feud",
    track: "Team Quiz Game",
    category: "non_technical",
    day: 1,
    venue: "Lab",
    description: "Guess what the crowd thinks. Teams face off to match the most popular answers and claim the board.",
    coordinators: [
      staff("Dr. M. Manikandan"),
      staff("Mr. M. Umamahesh"),
      student("Subhashini M"),
      student("Guru Prasath"),
      student("Venkatesh"),
    ],
    when: [1, [13, 0], [14, 30]], fee: 70, maxSeats: 60, team: [4, 6],
  },
  {
    name: "Cap Chaos",
    track: "Fun Games",
    category: "non_technical",
    day: 1,
    venue: "Classroom",
    description: "Quick thinking, quicker hands. A whirlwind of playful challenges where anything can happen.",
    coordinators: [staff("Mrs. M. Kanagapriya"), student("Sonali"), student("Harini"), student("Kumaresan")],
    when: [1, [9, 0], [15, 0]], fee: 40, maxSeats: 100, team: [1, 1],
  },
  {
    name: "Clash Squad E-Sports",
    track: "E-Sports Tournament",
    category: "non_technical",
    day: 2,
    venue: "2 Classrooms",
    description:
      "Squad up and drop in. A competitive e-sports showdown where strategy, reflexes and teamwork decide the last squad standing.",
    coordinators: [staff("Dr. S. Mohandoss"), student("Sravan Kumar"), student("Lakshmikanth"), student("Guru K")],
    when: [2, [10, 0], [16, 0]], fee: 200, maxSeats: 80, team: [4, 4],
  },

  // ===============================================================
  // JUNIOR TECHASTRA (school students) - from JUNIOR TECHASTRA EVENTS
  // LIST.docx. Team sizes are confirmed; no dates, venues, fees or
  // coordinator phone numbers yet.
  // ===============================================================
  {
    level: "junior",
    name: "Byte Rush",
    track: "Quiz Challenge",
    category: "technical",
    description:
      "An exciting quiz competition for school students covering General Knowledge, Subject Knowledge, Science & Technology, Logic, Creativity, and challenging questions — in MCQ, True/False, Visual, Identify, Puzzle and other formats.",
    rules: {
      rounds: [
        { title: "Round 1", text: "A 30-minute quiz for all participants. The highest scorers are selected for the next round." },
        { title: "Round 2", text: "Selected participants compete in a shorter and more challenging quiz. The winner is decided on performance in this final round." },
      ],
      rules: [
        "+1 mark for each correct answer, no negative marking.",
        "Mobile phones, smartwatches and external assistance are not allowed.",
        "Any malpractice will result in disqualification.",
        "In case of a tie, a tie-breaker round will be conducted.",
        "The judges' decision will be final and binding.",
      ],
    },
    coordinators: [staff("Mr. M. Uma Mahesh"), student("Arya Venkata Sai"), student("Sunil Reddy"), student("Dharanirajan B")],
    when: [1, [9, 30], [10, 30]], fee: 50, maxSeats: 60, team: [2, 2],
  },
  {
    level: "junior",
    name: "Prompt Wars",
    track: "AI Image Recreation Challenge",
    category: "technical",
    description:
      "A creative AI-based competition where teams recreate given images using effective AI prompts. A creative image is displayed for 30–60 seconds; after it is hidden, teams write a prompt to recreate it using any AI image-generation tool. Multiple reference images are shown during the event.",
    rules: {
      rules: [
        "Observe and remember objects, layout, colours, characters and other details.",
        "Any AI image-generation tool may be used; suggestions provided if required.",
        "Teams must work independently without copying prompts or results.",
        "Duration: approximately 30–45 minutes, including multiple image challenges.",
      ],
      judging: ["Visual similarity", "Accuracy", "Creativity", "Prompt effectiveness"],
    },
    coordinators: [staff("Dr. S. Akila"), staff("Mr. L. Magnus Jesrus"), student("J Kavya"), student("Dharshini")],
    when: [1, [11, 0], [12, 0]], fee: 50, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Vision Forge",
    track: "Imagine the Future",
    category: "technical",
    description:
      "A creative innovation challenge where students transform simple materials into an innovative model on the theme “Imagine the Future” — a creative idea, useful invention, or solution to a real-world problem in areas like future technology, smart cities, healthcare, education, transportation, environment, or safety.",
    rules: {
      rounds: [
        { title: "Build", text: "30 minutes to design and build a model using only the 4–5 basic craft materials provided." },
        { title: "Present", text: "2–3 minutes to explain what you created, the problem it solves, how it works, and why it matters for the future." },
      ],
      rules: ["Only the provided materials may be used.", "No additional construction is allowed after time ends."],
      judging: ["Creativity", "Innovation", "Theme relevance", "Effective use of materials", "Practicality", "Problem-solving", "Presentation"],
    },
    coordinators: [staff("Mr. E. Murali"), staff("Mrs. G. S. Ashitha"), student("S. M. Pooja"), student("B. Nisha")],
    when: [1, [13, 0], [14, 0]], fee: 50, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Cipher Quest",
    track: "Decode the Hidden Secret",
    category: "technical",
    description:
      "A thrilling puzzle-based event where teams uncover and decode hidden information using clues and logical challenges. Tests logical thinking, observation, teamwork, speed and accuracy.",
    rules: {
      rounds: [
        { title: "The Quest", text: "Solve riddles, number patterns, visual puzzles, codes and clues to unlock a hidden message in 30 minutes. The fastest, best-performing teams qualify." },
        { title: "Cipher Showdown", text: "A harder secret message — ciphers, QR codes, symbols or logic clues — to crack in just 5–7 minutes." },
      ],
      rules: [
        "Teams must work independently and must not share clues or answers.",
        "The team that decodes the final message correctly in the shortest time wins.",
      ],
    },
    coordinators: [staff("Mrs. Ruth Rubavathy"), student("Aravind Kumar"), student("Aravind Krishan"), student("Sneka V S")],
    when: [1, [14, 30], [15, 30]], fee: 50, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "TRACE//X",
    track: "Crack the Cyber Case",
    category: "technical",
    description:
      "A time-limited cybersecurity case-solving challenge. Each team receives a unique cyber-crime scenario and must analyse what happened, the possible causes, the clues, and suitable solutions — documented on an answer sheet.",
    rules: {
      rules: [
        "Every team gets a different case scenario.",
        "Multiple possible approaches may be written.",
        "Optional clues are available, with negative marking (−2, −5 or −10).",
        "Solving without clues earns the highest score.",
        "Duration: 30 minutes.",
      ],
    },
    coordinators: [staff("Ms. G. Priyanka"), student("Nandhitha L"), student("Mythreya")],
    when: [1, [10, 45], [11, 30]], fee: 50, maxSeats: 40, team: [4, 4],
  },
  {
    level: "junior",
    name: "Mind Merge",
    track: "Connections",
    category: "non_technical",
    description:
      "A fast-paced connection challenge. Teams are shown two images, objects, symbols, words or clues that share a common connection leading to a particular answer — find as many as you can.",
    rules: {
      rounds: [
        { title: "Connection Challenge", text: "1 minute to identify as many connections as possible. Top teams are shortlisted." },
        { title: "Mind Rush", text: "A faster, harder round with only 30 seconds." },
      ],
      rules: ["Teams must not reveal or discuss answers with other teams."],
      judging: ["Correct connections", "Speed"],
    },
    coordinators: [staff("Mr. J. R. Jayavelu"), staff("Dr. K. K. Rekha"), student("Lalitha"), student("Linga Munishwar")],
    when: [1, [9, 30], [10, 15]], fee: 50, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Whatzit?",
    track: "Guess It!",
    category: "non_technical",
    description:
      "A fun guessing game — identify gadgets, symbols, objects, logos, tools and icons, sometimes zoomed-in, partially hidden or seen from unusual angles.",
    rules: {
      rules: [
        "Limited time to discuss and submit each answer.",
        "Correct answers earn points, with bonus points for quick responses.",
        "No mobile phones or external assistance.",
      ],
    },
    coordinators: [staff("Mrs. Vidhyalakshmi"), staff("Mrs. S. Amutha"), student("Ferlin Jose"), student("Siva Sankar")],
    when: [1, [10, 30], [11, 15]], fee: 50, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "Actventure",
    track: "Advertise It!",
    category: "non_technical",
    description:
      "A creative advertising challenge. Each team gets a random product on the spot and must perform a live advertisement — a skit, dialogue, slogan, jingle or sales pitch — highlighting its features, uses and unique selling point.",
    rules: {
      rules: ["Short preparation time before presenting.", "Advertisements must be appropriate and respectful."],
      judging: ["Creativity", "Presentation", "Communication", "Teamwork", "Originality", "Convincing power"],
    },
    coordinators: [staff("Mr. P. Sudarsan"), staff("Mr. P. Jayakrishnan"), student("Pavan"), student("Kevin Adithya"), student("Lavanya A")],
    when: [1, [12, 15], [13, 0]], fee: 50, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Seekret",
    track: "Feel It, Recreate It, Tell It!",
    category: "non_technical",
    description:
      "A mystery-box challenge. One teammate is the “Seeker”, the other the “Creator”. Identify hidden objects by touch, recreate them, and weave them into a story.",
    rules: {
      rounds: [
        { title: "Feel & Identify", text: "The Seeker identifies objects in the mystery box by touch alone in 1–2 minutes and communicates them to the Creator." },
        { title: "Recreate", text: "The Creator recreates or represents the objects using the available materials." },
        { title: "Secret Story", text: "The team presents a creative story connecting all the objects in about 2 minutes." },
      ],
      rules: ["No looking inside the mystery box.", "No outside assistance.", "About 5–10 minutes per team."],
      judging: ["Identification accuracy", "Communication", "Creativity", "Teamwork", "Recreation quality", "Story originality", "Presentation"],
    },
    coordinators: [staff("Dr. M. Manikandan"), student("Rubesh"), student("Abinesh"), student("Hementh S")],
    when: [1, [14, 0], [15, 0]], fee: 50, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "Huntify",
    track: "Think, Arrange & React",
    category: "non_technical",
    description:
      "A fast-paced individual challenge testing observation, concentration, memory, quick thinking and reaction speed.",
    rules: {
      rounds: [
        { title: "Word Arrange", text: "Rearrange a mixed-up set of letters/words into the exact correct order within 1 minute." },
        { title: "Listen & React", text: "Numbers are called out with actions assigned to some (e.g. 1 = “OK”, 5 = “GO AWAY”). Respond correctly as the sequence speeds up — mistakes may eliminate you." },
      ],
      rules: ["Overall duration: approximately 30 minutes."],
      judging: ["Accuracy", "Response speed", "Concentration", "Memory"],
    },
    // Not in the coordinator table yet.
    coordinators: [],
    when: [1, [11, 30], [12, 0]], fee: 50, maxSeats: 50, team: [1, 1],
  },
  {
    level: "junior",
    name: "Stack N' Dash",
    track: "The Ultimate Multitask Challenge",
    category: "non_technical",
    description:
      "Two tasks at once: build a cup tower while keeping a balloon in the air (or another coordination task) — without stopping either.",
    rules: {
      rules: [
        "Penalties for dropping the balloon/object or incorrect stacking.",
        "No help from others.",
        "Fastest participant to complete both tasks with fewest mistakes wins.",
      ],
      judging: ["Speed", "Correct completion of both tasks"],
    },
    // Not in the coordinator table yet.
    coordinators: [],
    when: [1, [15, 30], [16, 0]], fee: 50, maxSeats: 50, team: [1, 1],
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
      endTime: at(d, eh, em),
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

module.exports = { buildEvents };
