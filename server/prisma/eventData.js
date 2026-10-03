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
 *   day, venue and time slot (from "VENUES  REVISED 2.docx"); technical-event
 *   coordinators and venues from "SENIOR TECHNICAL LIST VENUE REVISED 1.docx".
 *
 * NOT CONFIRMED - no source document has these yet; the numbers below are
 * working values so cart clash-detection and checkout keep functioning.
 * Replace them (here, or in the admin Events tab) once finalised:
 *   maxSeats, and junior times and venues.
 *
 * FEES (organisers, 29 Sep 2026): ₹100 PER PERSON for every senior event
 * (a team pays members × ₹100); Hack Nexus is a flat ₹1000 per team
 * (feePerTeam); combo passes are ₹200 per person. Junior events are free -
 * registration only collects the student's details. Senior team sizes follow
 * the organisers' combo sheet.
 *   Venue is left null (shows "TBA") wherever it isn't known.
 *
 * Senior non-technical descriptions and rounds are from "NTE overall
 * description.pdf". Prompt Arena's description was written for the main
 * site and is marked "TODO: confirm" there too.
 */

// Symposium days, in IST.
const DAY_DATES = { 1: "2026-10-08", 2: "2026-10-09" };
const at = (day, hh, mm = 0) =>
  new Date(`${DAY_DATES[day]}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`);

const phone = (n) => (n ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : "");
const staff = (name, n) => ({ name, role: "Staff Coordinator", phone: phone(n) });
const student = (name, n) => ({ name, role: "Student Coordinator", phone: phone(n) });

// `sections` are extra titled lists ({ title, items }); the event page shows
// a paragraph whose first line ends in ":" as a subheading.
function rulebook({ rounds = [], rules = [], judging = [], sections = [] }) {
  const parts = [];
  if (rounds.length) parts.push(rounds.map((r, i) => `${i + 1}. ${r.text ? `${r.title} — ${r.text}` : r.title}`).join("\n"));
  if (rules.length) parts.push(rules.map((r) => `• ${r}`).join("\n"));
  if (judging.length) parts.push(`Judged on: ${judging.join(", ")}.`);
  for (const s of sections) parts.push(`${s.title}:\n${s.items.map((i) => `• ${i}`).join("\n")}`);
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
      student("Ms. Supriya P", "8939302988"),
      student("Ms. Laavanya Muthukumar", "9025442826"),
      student("Mr. Sivasuriyanath S", "8825908483"),
    ],
    when: [1, [10, 0], [15, 30]], fee: 100, maxSeats: 40, team: [1, 4],
  },
  {
    name: "Hack Nexus",
    track: "Hackathon",
    category: "technical",
    day: 1,
    venue: "CAR Lab & Garuda Lab (finals: Watson Lab)",
    description:
      "A high-energy technical challenge where participants turn ideas into working solutions. Teams identify a real-world problem, brainstorm innovative approaches, and build a functional prototype using technology, coding, and creativity within a limited time. Whether it is an app, website, AI solution, automation tool, or any other technology-driven idea — build something meaningful and impactful. Shortlisted teams return on Day 2 for the finalist round.",
    rules: {
      rounds: [
        { title: "Hackathon", text: "October 8, 2026 (Day 1), 9:30 AM – 7:30 PM in CAR Lab & Garuda Lab. Build your prototype." },
        { title: "Finalist round", text: "October 9, 2026 (Day 2), 9:30 AM – 2:00 PM in Watson Lab, for shortlisted teams only." },
      ],
      judging: ["Innovation", "Technical implementation", "Functionality", "Problem-solving approach", "Presentation"],
    },
    coordinators: [
      staff("Dr. F. Antony Xavier Bronson", "9841302602"),
      staff("Dr. M. Anand", "9600686861"),
      student("Mr. Sudeep Krishna", "9176327870"),
      student("Mr. Kishore Kumar", "9499971978"),
      student("Mr. Sriram", "9363352887"),
    ],
    // Day 1 is the hackathon; Day 2 (9:30-2:00, Watson Lab) is the finalist
    // round for shortlisted teams only, so it isn't part of the booked slot.
    when: [1, [9, 30], [19, 30]], fee: 1000, feePerTeam: true, maxSeats: 60, team: [3, 3],
    // Registered on its own website (the Hack Nexus app, served under
    // /hacknexus on this site), not in this portal's cart.
    externalRegistration: true,
    registrationUrl: "/hacknexus/",
  },
  {
    name: "Crypt Clash",
    track: "Capture the Flag",
    category: "technical",
    day: 2,
    venue: "Garuda Lab",
    // Description, rules and team size from "TECHASTRA crypt clash.pdf".
    description:
      "A three-hour inter-college Capture the Flag (CTF) cybersecurity challenge. Teams apply cybersecurity concepts through problem solving, logical reasoning, digital investigation and technical analysis, solving challenges across selected domains and submitting valid flags on the CTF platform. It rewards practical skills, analytical thinking, teamwork, time management and responsible use of security tools.",
    rules: {
      rules: [
        "Teams must have 2–3 registered members. Only registered participants may compete.",
        "Use only the targets and infrastructure the organisers provide.",
        "Do not attack the CTF platform, other teams, or any system outside the scope.",
        "No DoS attacks, disruption, credential theft, or attempts to compromise other teams.",
        "Do not share flags, solutions or credentials with other teams.",
        "Use tools and external resources only as the organisers allow.",
        "Stick to the announced time limits and any rules given for specific challenges.",
        "Cheating or misconduct may lead to penalties or disqualification.",
      ],
      sections: [
        {
          title: "Scoring",
          items: [
            "First-blood bonus for the first valid submission.",
            "Hints may reduce the points available.",
            "Final ranking is based on total score.",
            "Flag format: cry{example_flag}",
          ],
        },
        {
          title: "Before the event",
          items: [
            "Create your CTF account with the email ID you used to register.",
            "One member creates the team; the others join it with the team code.",
            "Install your Linux OS and CTF tools.",
            "Log in beforehand to check that your account works.",
            "Join the official WhatsApp group for updates.",
          ],
        },
        {
          title: "Bring",
          items: [
            "Your own laptop, charger and a Wi-Fi adapter if needed.",
            "Linux (Kali or Ubuntu) with CTF tools installed before the event.",
            "Your college ID card.",
            "Be at the venue before 8:45 AM.",
          ],
        },
        {
          title: "Prizes",
          items: [
            "Participation certificates for all participants.",
            "Winner: certificate and cash prize.",
            "Runner-up: certificate and cash prize.",
          ],
        },
      ],
    },
    coordinators: [
      staff("Ms. Ruth Rubavathy", "7702957580"),
      staff("Mr. Sambhav", "9862963711"),
      student("Mr. Sathyanarayanan", "7200493725"),
      student("Ms. Mamathi", "9150733457"),
      student("Mr. Sabarinathan P", "9361232667"),
    ],
    when: [2, [9, 30], [12, 30]], fee: 100, maxSeats: 50, team: [2, 3],
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
      staff("Ms. S. Divya", "9080791858"),
      staff("Mr. Ajay", "9400225351"),
      student("Ms. Pavni Ahuja", "9345495489"),
      student("Mr. Geetkumar B", "9514773056"),
      student("Ms. Mohana Priya B", "8270633107"),
    ],
    when: [2, [9, 30], [11, 30]], fee: 100, maxSeats: 100, team: [2, 2],
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
      staff("Mr. P. Sudarsan", "9790780562"),
      student("Mr. Sanjai P A", "9487826286"),
      student("Ms. Kavitha G", "6382401242"),
      student("Mr. Yashvinthan M"),
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
      staff("Ms. Chinchu Nair", "9176544377"),
      student("Mr. Mohamed Farhan Siddiqui", "9344971806"),
      student("Mr. Jeeva Ganesh", "7639710845"),
      student("Mr. Shafin", "7010354922"),
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
      staff("Ms. Menaga", "9500958682"),
      staff("Ms. Magna", "9444524844"),
      student("Ms. Roso", "8015253342"),
      student("Mr. Jeevan", "9884994951"),
      student("Ms. J N Tanya Miriam", "9551028258"),
    ],
    when: [1, [12, 0], [14, 0]], fee: 100, maxSeats: 40, team: [3, 3],
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
      student("Ms. Mithila", "9941821475"),
      student("Ms. Abinaya", "9566574288"),
      student("Mr. Srikanthan", "8438293668"),
    ],
    when: [1, [14, 0], [16, 0]], fee: 100, maxSeats: 50, team: [1, 1],
  },

  // ---------------------------------------------------------------
  // NON-TECHNICAL (8) - day and venue confirmed; student coordinators'
  // numbers from "SNTE Coordinators.pdf" (staff numbers not yet given).
  // Descriptions and rounds from "NTE overall description.pdf".
  // ---------------------------------------------------------------
  {
    name: "Rhythm Riot",
    track: "Music Guessing Game",
    category: "non_technical",
    day: 1,
    venue: "CAD Lab",
    description:
      "A music-based guessing game where players listen, observe and analyse the given clues to identify the correct song. As the rounds progress, the clues become less direct, making the game more challenging, engaging and entertaining.",
    rules: {
      rounds: [
        { title: "Can you recognise the tune?" },
        { title: "Can you connect the clues?" },
        { title: "Can you complete the missing lyrics?" },
      ],
    },
    coordinators: [
      staff("Dr. M. Sujitha", "9176628345"),
      staff("Dr. M. Nisha", "9042006686"),
      student("Mr. Aldrin", "7550249271"),
      student("Ms. Dharani Rajan", "8610555944"),
      student("Ms. Nandika Hegde N", "9943007783"),
    ],
    when: [1, [14, 0], [16, 0]], fee: 100, maxSeats: 60, team: [3, 3],
  },
  {
    name: "Hidden Frames",
    track: "Visual Puzzle Hunt",
    category: "non_technical",
    day: 1,
    venue: "CAD Lab & VOC 201",
    description: "Look closer. Spot what is concealed in every frame and piece together the picture before anyone else does.",
    coordinators: [staff("Mrs. G. Priyanka", "8072937403"), student("Mr. Dhevanathan R", "6383429727"), student("Mr. Sham Prasad", "9043595650"), student("Mr. Rithvick Sree", "7397449938")],
    when: [1, [9, 30], [11, 30]], fee: 100, maxSeats: 100, team: [3, 3],
  },
  {
    name: "Verbal Combat",
    track: "Debate",
    category: "non_technical",
    day: 1,
    venue: "VOC 410",
    description:
      "A debate-based competition where players think critically, build strong arguments and defend their opinions on given topics. As the rounds progress, the topics become more challenging and the time to respond gets shorter, testing confidence, knowledge and quick thinking.",
    rules: {
      rounds: [
        { title: "Can you build your argument?" },
        { title: "Can you defend your stand?" },
        { title: "Tie-breaker round (if needed)" },
      ],
    },
    coordinators: [staff("Dr. K. K. Rekha", "9841246265"), student("Ms. Kanishkaa R", "9884014565"), student("Ms. Lavanya R", "6369497230"), student("Mr. Shelton Paul Christopher", "7094508258")],
    when: [1, [14, 15], [16, 15]], fee: 100, maxSeats: 40, team: [1, 1],
  },
  {
    name: "Blitz Hunt",
    track: "Treasure Hunt",
    category: "non_technical",
    day: 1,
    venue: "VOC 407",
    description:
      "An exciting, fast-paced treasure hunt where teams use observation, logical thinking, teamwork and problem-solving to uncover a series of hidden clues. Each clue leads to the next challenge, testing how quickly you can decode clues, connect information, think outside the box and decide under time pressure. Only the team that follows the trail and reaches the final destination first claims victory.",
    rules: {
      rounds: [
        { title: "The First Clue Hunt and ticket to the Finale" },
        { title: "The Upside Down" },
      ],
    },
    coordinators: [staff("Mrs. E. Nalini", "9176497770"), student("Ms. Lathika", "8122690763"), student("Mr. Gopi Shankar", "8939496446"), student("Mr. Sai Jeevan N", "8778592427")],
    when: [1, [14, 15], [16, 15]], fee: 100, maxSeats: 90, team: [3, 3],
  },
  {
    name: "Plot Twist",
    track: "Team Challenge",
    category: "non_technical",
    day: 1,
    venue: "VOC 415",
    description:
      "A team event that tests creativity, teamwork, quick thinking, communication and the ability to adapt to the unexpected. Teams of 3 complete a task in each of 3 rounds within a time limit and set rules — but at any point the host may introduce surprise twists and conditions, forcing teams to change strategy on the spot.",
    rules: {
      rounds: [
        { title: "Cup and Ball Challenge" },
        { title: "Clue Chaos" },
        { title: "Twist Tower" },
      ],
    },
    coordinators: [staff("Dr. B. Raja", "8754363789"), staff("Mr. Mohan", "9445761267"), student("Ms. Harshini", "7042613974"), student("Ms. Subiksha", "8838741574"), student("Ms. Jayashree", "6369719262")],
    when: [1, [9, 30], [11, 30]], fee: 100, maxSeats: 50, team: [3, 3],
  },
  {
    name: "Team Feud",
    track: "Survey Guessing Game",
    category: "non_technical",
    day: 1,
    venue: "Hi-Tech Lab",
    description:
      "A survey-based guessing game. Players think like the crowd, analyse the questions and predict the most popular answers from a survey. As the rounds progress, the questions get more challenging, making the game competitive, interactive and entertaining.",
    rules: {
      rounds: [
        { title: "What did the crowd say?" },
        { title: "Can you steal the points?" },
      ],
    },
    coordinators: [
      staff("Dr. M. Manikandan", "9840291680"),
      staff("Mr. M. Umamahesh", "9790948948"),
      student("Ms. Subhashini M", "9677184868"),
      student("Mr. Guru Prasath", "7904186779"),
      student("Mr. Venkatesh", "9110348446"),
    ],
    when: [1, [12, 0], [14, 0]], fee: 100, maxSeats: 60, team: [3, 3],
  },
  {
    name: "Cap Chaos",
    track: "Fun Games",
    category: "non_technical",
    day: 1,
    venue: "VOC 413",
    description:
      "A fun, fast-paced challenge where players think quickly, react to unexpected situations and complete creative tasks under pressure. As the rounds progress, the challenges become more unpredictable, testing spontaneity, teamwork and the ability to handle chaos.",
    rules: {
      rounds: [
        { title: "Can you guess the movie?" },
        { title: "Can you handle the twist?" },
        { title: "Can you guess the song?" },
      ],
    },
    coordinators: [staff("Mrs. M. Kanagapriya", "9176818964"), student("Ms. Sonali", "9790574852"), student("Ms. Harini Sri", "6385554331"), student("Mr. Kumaresan", "6381090465")],
    when: [1, [12, 0], [14, 0]], fee: 100, maxSeats: 100, team: [3, 3],
  },
  {
    name: "Clash Squad E-Sports",
    track: "Free Fire & BGMI E-Sports",
    category: "non_technical",
    day: 2,
    venue: "CAD Lab",
    // Individual event, ₹50 per person (changed 2026-10-02; was teams of 4
    // at ₹100 per person, Free Fire only).
    description:
      "A competitive e-sports tournament covering both Free Fire and BGMI. This is an individual event - register on your own; teams are formed at random on the event day. Players face off in room matches in an elimination format where every match matters and one mistake can send you out. Make smart tactical decisions to defeat your opponents and advance to the next round.",
    rules: {
      rules: [
        "Games: Free Fire and BGMI.",
        "Individual event - register on your own.",
        "Teams are formed at random on the event day.",
        "Room matches.",
        "Format: knockout / elimination — defeat your opponents to advance to the next round.",
      ],
    },
    coordinators: [staff("Dr. S. Mohandoss", "9884974422"), student("Mr. Hamdan Arabi", "8122276912"), student("Mr. Lakshmikanth", "6374786721"), student("Mr. Praveen", "6307563967")],
    when: [2, [9, 30], [14, 0]], fee: 50, maxSeats: 80, team: [1, 1],
  },

  // ===============================================================
  // JUNIOR TECHASTRA (school students) - descriptions, rounds, rules,
  // judging and team sizes from "Junior techastra'26 all event
  // details.docx" (2026-09-26); coordinators from "JUNIOR TECHASTRA
  // COORDINATOR LIST UPDATED LIST FINAL.docx". All on Day 2 (9 Oct) and
  // free (fee 0). Times and seats are still working values, except
  // Actventure's 20-team cap.
  // ===============================================================
  {
    level: "junior",
    name: "Byte Rush",
    track: "Quiz Challenge",
    category: "technical",
    day: 2,
    venue: "Hi-Tech Lab",
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
    coordinators: [staff("Mr. M. Uma Mahesh", "9790948948"), student("Mr. Arya Venkata Sai", "9703288071"), student("Mr. Sunil Reddy", "9581513594"), student("Mr. S. Dhanush", "9150739030")],
    when: [2, [10, 0], [11, 0]], fee: 0, maxSeats: 60, team: [2, 2],
  },
  {
    level: "junior",
    name: "Prompt Wars",
    track: "AI Image Recreation Challenge",
    category: "technical",
    day: 2,
    venue: "Network Lab",
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
    coordinators: [staff("Dr. S. Akila", "9941615902"), staff("Mr. L. Magnus Jesrus", "9840513775"), student("Ms. Nandhitha L", "6383937832"), student("Ms. Dharshini K", "9080495122"), student("Mr. Bharathi V")],
    when: [2, [11, 0], [12, 0]], fee: 0, maxSeats: 45, team: [2, 2],
  },
  {
    level: "junior",
    name: "Vision Forge",
    track: "Imagine the Future",
    category: "technical",
    day: 2,
    venue: "VOC 404 & VOC 406",
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
    coordinators: [staff("Mr. E. Murali", "9444558197"), staff("Mrs. G. S. Ashitha", "8939168215"), student("Ms. S. M. Pooja", "7200376899"), student("Ms. B. Nisha", "8122608126"), student("Ms. J. Kavya", "7845515045")],
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
    coordinators: [staff("Mrs. Ruth Rubavathy", "7702957580"), student("Mr. Aravind Kumar", "8940807776"), student("Mr. Aravind Krishan", "9344858132"), student("Ms. G. Lekha Sri", "8681831760")],
    when: [2, [12, 0], [13, 0]], fee: 0, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "TRACE//X",
    track: "Crack the Cyber Case",
    category: "technical",
    day: 2,
    venue: "Communication Lab",
    description:
      "An unplugged cybersecurity case-solving challenge for school students. Each team receives a physical “Top Secret” dossier with a unique cyber-crime scenario and must analyse the evidence to identify what happened, the root cause and how it could be prevented — no computers or internet needed.",
    rules: {
      rounds: [
        { title: "Investigation", text: "30 minutes to study the dossier and evidence and write the findings and proposed solutions on the official answer sheet. Multiple approaches may be written." },
      ],
      rules: [
        "Each team must consist of 3 registered members.",
        "Every team gets a different case scenario (e.g. phishing, weak passwords, rogue Wi-Fi, malware).",
        "Sealed clue envelopes are available if a team is stuck, but each one carries negative marking (−2, −5 or −10).",
        "Mobile phones, smartwatches and internet searches are strictly prohibited.",
        "Don’t share clues, solutions or answers with other teams.",
        "Ties are broken by submission time — the team that submits earlier ranks higher.",
        "Cheating or malpractice may lead to penalties or disqualification; the judges’ decision is final.",
      ],
      judging: ["Accuracy of the root cause", "Evidence spotted", "Solutions proposed", "Clue deductions", "Rule compliance"],
    },
    coordinators: [staff("Ms. G. Priyanka", "8072937403"), student("Mr. Gokul Krishan S R", "6385132601"), student("Mr. Gowtham Pandian", "8122739807"), student("Mr. Bavanan S", "7708009302")],
    when: [2, [13, 0], [14, 0]], fee: 0, maxSeats: 40, team: [3, 3],
  },
  {
    level: "junior",
    name: "Mind Merge",
    track: "Connections",
    category: "non_technical",
    day: 2,
    venue: "IBM Lab",
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
    coordinators: [staff("Mr. J. R. Jayavelu", "9940268573"), staff("Dr. K. K. Rekha", "9841246265"), student("Ms. Lalitha", "7904294376"), student("Mr. Linga Munishwar", "6374052798"), student("Ms. Mythreya", "8939121925")],
    when: [2, [10, 0], [11, 0]], fee: 0, maxSeats: 45, team: [3, 3],
  },
  {
    level: "junior",
    name: "Whatzit?",
    track: "Guess It!",
    category: "non_technical",
    day: 2,
    venue: "IBM Lab",
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
    coordinators: [staff("Mrs. Vidhyalakshmi", "9176627897"), staff("Mrs. S. Amutha", "7550108982"), student("Mr. Ferlin Jose", "6381524624"), student("Mr. Siva Sankar", "7810070834"), student("Mr. Dhaya T", "7305431403")],
    when: [2, [12, 0], [13, 0]], fee: 0, maxSeats: 40, team: [2, 2],
  },
  {
    level: "junior",
    name: "Actventure",
    track: "Create · Perform · Convince",
    category: "non_technical",
    day: 2,
    venue: "VOC 415 & VOC 416",
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
    coordinators: [staff("Mr. P. Sudarsan", "9790780562"), staff("Mr. P. Jayakrishnan", "9884766568"), student("Mr. Pavan", "8807059054"), student("Mr. Kevin Adithya", "9384860454"), student("Ms. Lavanya A", "8148206146")],
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
    coordinators: [staff("Dr. M. Manikandan", "9840291680"), staff("Dr. M. Anand", "9600686861"), student("Mr. Rubesh Kumar R", "9025036748"), student("Mr. Abhishek", "9491535251"), student("Mr. Abdul Basith", "9962765727")],
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
    coordinators: [staff("Mr. Saravanan Elumalai", "9176667009"), staff("Mrs. K. Menaga", "9500958682"), student("Mr. Vignesh A", "9994463241"), student("Mr. Vallarasu", "7904529336"), student("Mr. Kiran Sankar R")],
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
    coordinators: [staff("Mrs. S. Divya", "9080791858"), staff("Mrs. P. Papitha", "7397410083"), student("Ms. Lilly Priya", "7358669187"), student("Mr. Benil Josuva", "6374771339"), student("Mr. Padmanaban E")],
    when: [2, [13, 0], [14, 0]], fee: 0, maxSeats: 50, team: [1, 1],
  },
];

/**
 * Each event's WhatsApp group (organisers, 3 Oct 2026). Shared only with the
 * event's approved participants - approval email and dashboard - never in
 * the public events list. Invite links only (tracking query removed).
 */
const WHATSAPP_GROUPS = {
  "Code Rescue": "https://chat.whatsapp.com/KeynkmoQrYG2zgrvtWv4SX",
  "Pen Your Vision": "https://chat.whatsapp.com/GwAMWDzTCUo7CZWjhbHNjT",
  "Trial of Truth": "https://chat.whatsapp.com/KTb0kZGsTiQ837se55G8dl",
  "Cap Chaos": "https://chat.whatsapp.com/GZavvAJcLWT9iNKWtGwgYg",
  "Verbal Combat": "https://chat.whatsapp.com/KdaEfwghJ3d24JPrqw5wVm",
  "Hidden Frames": "https://chat.whatsapp.com/CYxT1CQ1c4q0x4t5y98XMQ",
  "Blitz Hunt": "https://chat.whatsapp.com/EZYIDxt12OA3Odgl8n1ZEu",
  "Plot Twist": "https://chat.whatsapp.com/GHPHg42wWku70d7NGmZlpS",
  "Clash Squad E-Sports": "https://chat.whatsapp.com/KvESqt3hIHN2bHmgmVNAxD",
  "Team Feud": "https://chat.whatsapp.com/H7OX9x7HO5qIP08UiB0Hmt",
  "Rhythm Riot": "https://chat.whatsapp.com/LYLaOqZ7Urr98ueAWRBZiR",
  "Prompt Arena": "https://chat.whatsapp.com/LOZTTg5PWlHDtKcieTOVvO",
  "Pixel Protocol": "https://chat.whatsapp.com/EkOVaR1GDX19IxQyQCzKUi",
};

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
      feePerTeam: !!e.feePerTeam,
      externalRegistration: !!e.externalRegistration,
      // Only when set here, so re-seeding keeps a link entered in Admin → Events.
      ...(e.registrationUrl ? { registrationUrl: e.registrationUrl } : {}),
      // Likewise: only when listed above, so a group link set in Admin → Events stays.
      ...(WHATSAPP_GROUPS[e.name] ? { whatsappUrl: WHATSAPP_GROUPS[e.name] } : {}),
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
// aren't in any combo. Registration fee: ₹200 per person (x team size).
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
    events: ["Byte Rush", "Seekret", "Whatzit?"],
    description:
      "Think · Express · Explore — Byte Rush (10–11 AM), Seekret (11 AM–12 PM) and Whatzit? (12–1 PM), back to back on Day 2.",
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
    events: ["Mind Merge", "Actventure", "TRACE//X"],
    description:
      "Trace · Solve · Connect — Mind Merge (10–11 AM), Actventure (11 AM–12 PM) and TRACE//X (1–2 PM) on Day 2.",
  },
  {
    name: "Junior Combo 4",
    level: "junior",
    price: 0,
    events: ["Cipher Quest", "Stack N' Dash"],
    description: "Decode · Build · Win — Cipher Quest (12–1 PM) and Stack N’ Dash (1–2 PM), back to back on Day 2.",
  },
];

module.exports = { buildEvents, COMBOS, COMBO_PRICE, WHATSAPP_GROUPS };
