// OCMN Planter Application — question schema, branching rules, and copy.
// Ported from the design handoff's questions.js (kept verbatim; typed for this codebase).
//
// Field shapes used by every question object:
//   id   unique key; also the answer key
//   t    'text' | 'long' | 'radio' | 'multi' | 'scale' | 'note'
//   l    label (the question as shown)
//   h    optional hint shown under the label
//   req  1 = required
//   o    options array (radio / multi)
//   it   HTML input type for t:'text'  ('email' | 'tel' | 'date' | 'number')
//   ph   placeholder
//   low  / high  end labels for t:'scale' (a 1-5 rating)
//   w    visibility predicate: (answers) => boolean. Omit = always shown.
//
// Step objects: { id, group, label, eyebrow, title, intro, notice?, w?, qs: [] }
//   group   sidebar grouping header
//   label   sidebar item text
//   w       step-level visibility predicate

import type { Answers, Path, Step } from "./types";

export const STORAGE_KEY = "ocmn-planter-app-v1";

export const PATHS: Path[] = [
  { id: "planter", title: "Church Planter", desc: "Planting a new church in Ohio." },
  { id: "dinner", title: "Dinner Church Planter", desc: "A table-based gathering around a meal." },
  { id: "parent", title: "Parent Church", desc: "A church sending out a plant or campus." },
];

export const CRED_PROCESS: string[] = [
  "I’ve interviewed and I’m awaiting Network Presbytery approval",
  "I’ve submitted my transcripts for review",
  "I’m completing coursework through Global University, OSOM, or SEU",
  "I’ve connected with the Network Secretary’s office about New Credentials Orientation",
  "Not yet — but I’d like to begin",
  "No, and I’m not pursuing credentials right now",
];

export function needsCred(a: Answers): boolean {
  return a.creds === "No";
}

export function notParent(a: Answers): boolean {
  return a.path !== "parent";
}

export const STEPS: Step[] = [
  {
    id: "you",
    group: "About you",
    label: "Your details",
    eyebrow: "About you",
    title: "Let’s start with you",
    intro: "The basics, so we know who we’re talking to and how to reach you.",
    qs: [
      { id: "first", t: "text", l: "First name", req: 1, ph: "Jordan" },
      { id: "last", t: "text", l: "Last name", req: 1, ph: "Whitfield" },
      { id: "email", t: "text", it: "email", l: "Email", req: 1, ph: "you@email.com" },
      { id: "phone", t: "text", it: "tel", l: "Phone number", req: 1, ph: "(614) 555-0142" },
      { id: "address", t: "text", l: "Home address", req: 1, ph: "Street, city, ZIP" },
    ],
  },
  {
    id: "family",
    group: "About you",
    label: "Your family",
    eyebrow: "About you",
    title: "Who’s walking this out with you?",
    intro: "Planting is a family calling. We want to know the people closest to it.",
    qs: [
      { id: "marital", t: "radio", l: "Marital status", req: 1, o: ["Married", "Single"] },
      { id: "spouse", t: "text", l: "Spouse’s name", req: 1, ph: "Full name", w: (a) => a.marital === "Married" },
      { id: "spouseContact", t: "text", l: "Spouse’s email or phone", req: 1, w: (a) => a.marital === "Married" },
      {
        id: "spouseHeart",
        t: "long",
        l: "How does your spouse feel about church planting?",
        h: "In their words, if you can. We’ll ask them too.",
        req: 1,
        w: (a) => a.marital === "Married",
      },
      { id: "kids", t: "radio", l: "Do you have children?", req: 1, o: ["Yes", "No"] },
      { id: "kidNames", t: "text", l: "Their names and ages", req: 1, ph: "Ada (7), Sam (4)", w: (a) => a.kids === "Yes" },
    ],
  },
  {
    id: "calling",
    group: "Your calling",
    label: "The call",
    eyebrow: "Your calling",
    w: notParent,
    title: "Tell us about the call",
    intro: "Take your time here. This is the part of the application we read most closely.",
    qs: [
      { id: "why", t: "long", l: "Why do you believe God is calling you to plant a church?", req: 1, ph: "Tell us the story — when it started, and how it has grown." },
      { id: "people", t: "long", l: "Is there a particular community or people group you carry a burden for?", h: "A city, a neighborhood, a culture, a generation — tell us who and why.", req: 1 },
      { id: "timing", t: "long", l: "Why is now the right time?", req: 1 },
      { id: "mentors", t: "long", l: "Who are the spiritual mentors in your life, and how are they confirming this call?", req: 1 },
    ],
  },
  {
    id: "vision",
    group: "Your calling",
    label: "Your vision",
    eyebrow: "Your calling",
    w: (a) => a.path === "parent",
    title: "Why send a church out?",
    intro: "Help us understand the heart behind your church multiplying.",
    qs: [
      { id: "why", t: "long", l: "Why is your church ready to parent a new church?", req: 1 },
      { id: "people", t: "long", l: "What community are you sending into, and why that one?", req: 1 },
      { id: "mentors", t: "long", l: "Who on your leadership team is championing this, and how is your board involved?", req: 1 },
    ],
  },
  {
    id: "plan-dinner",
    group: "Your plan",
    label: "Dinner church plan",
    eyebrow: "Your plan",
    w: (a) => a.path === "dinner",
    title: "Your dinner church",
    intro: "The practical shape of the table you’re setting.",
    notice: "Have your rough budget and a little community information handy — this is the longest stretch of the application, and your work saves as you go.",
    qs: [
      { id: "dcParent", t: "text", l: "Parent church name", req: 1 },
      { id: "dcName", t: "text", l: "Dinner church name", req: 1 },
      { id: "dcAddress", t: "text", l: "Where will you meet?", h: "Venue name and address, if you have one.", req: 1 },
      { id: "dcDays", t: "multi", l: "Which days will you gather?", req: 1, o: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
      { id: "dcTeam", t: "text", it: "number", l: "How many people are on your launch team?", req: 1, ph: "12" },
      { id: "dcContext", t: "long", l: "Describe the community you’ll be serving", h: "Demographics, community type, what life looks like there.", req: 1 },
      { id: "dcFlow", t: "long", l: "What will a night look like?", h: "The flow — activities, service, ministry elements.", req: 1 },
      { id: "dcTeams", t: "long", l: "How will you build your teams?", h: "Cooking, serving, greeting, table hosts, setup and cleanup.", req: 1 },
      { id: "dcPromo", t: "long", l: "How will people hear about it?", h: "Signage, fliers, social, word of mouth, local partners.", req: 1 },
      { id: "dcBudget", t: "long", l: "Sketch your monthly budget", h: "Expected guests, food, paper products and utensils, venue, appliances, equipment, tables and chairs, promotion.", req: 1 },
      { id: "dcMomentum", t: "long", l: "How will you sustain momentum and know you’re making a difference?", h: "How you’ll energize people, debrief your team, evaluate progress, and see the community change.", req: 1 },
    ],
  },
  {
    id: "plan-parent",
    group: "Your plan",
    label: "Parent church plan",
    eyebrow: "Your plan",
    w: (a) => a.path === "parent",
    title: "Your parent church plan",
    intro: "What you’re sending, where, and with whom.",
    qs: [
      { id: "pcName", t: "text", l: "Name of your church", req: 1 },
      { id: "pcPrior", t: "long", l: "Have you parented a church before?", h: "If yes, list the church or churches.", req: 1 },
      { id: "pcTarget", t: "text", l: "What community are you targeting?", req: 1 },
      { id: "pcPastor", t: "text", l: "Who will be the planting pastor?", req: 1 },
      { id: "pcDate", t: "text", l: "Do you have a launch date in mind?", ph: 'Fall 2027, or "not yet"', req: 1 },
      { id: "pcModel", t: "radio", l: "Church model", req: 1, o: ["Urban", "Suburban", "Rural", "International", "Micro", "Dinner", "Not sure yet"] },
      { id: "pcStrategy", t: "radio", l: "Planting strategy", req: 1, o: ["Multi-site", "Hybrid", "Stand-alone new church", "Not sure yet"] },
      { id: "pcCharter", t: "radio", l: "Do you plan to charter the new church with the Assemblies of God?", req: 1, o: ["Yes", "No"] },
      { id: "pcCohort", t: "radio", l: "Have you been through the Parent Church Cohort?", req: 1, o: ["Yes, I’ve completed it", "Not yet — sign me up", "No, I’d like more information"] },
    ],
  },
  {
    id: "readiness",
    group: "Readiness",
    label: "Self-assessment",
    eyebrow: "Readiness",
    w: notParent,
    title: "Where are you strong?",
    intro: "Assessment networks look for a consistent set of planter competencies. Rate yourself honestly — nobody scores high on all of them, and knowing your low numbers is how we build the right team around you.",
    notice: "There are no right answers here. This shapes your coaching and your assessment, not your odds.",
    qs: [
      { id: "cVision", t: "scale", l: "Visionizing — I can see a preferred future clearly and put it into words others follow", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cOwnership", t: "scale", l: "Creating ownership — people take my vision on as their own and give money, time, and leadership to it", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cUnchurched", t: "scale", l: "Reaching the unchurched — I build genuine friendships with people far from God", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cTeam", t: "scale", l: "Developing leaders — I recruit, train, and release other people into real responsibility", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cResilience", t: "scale", l: "Resilience — I keep going through setbacks, criticism, and slow seasons", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cSelfStart", t: "scale", l: "Self-starting — I set my own agenda and follow through without anyone managing me", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cFundraise", t: "scale", l: "Fundraising — I can ask people and churches for money without flinching", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "cCoachable", t: "scale", l: "Coachability — I invite hard feedback and actually change in response to it", req: 1, low: "Not yet a strength", high: "One of my strongest gifts" },
      { id: "strengths", t: "long", l: "Which two of those are your real strengths, and where’s the evidence?", h: "Point to something you’ve actually done, not how you feel about it.", req: 1 },
      { id: "gaps", t: "long", l: "Which is your weakest, and who will cover it?", h: "Name a person or a plan.", req: 1 },
      { id: "assessed", t: "radio", l: "Have you been through a formal planter assessment before?", h: "ARK, Stadia Discovery, Acts 29, Exponential, a district assessment center, or similar.", req: 1, o: ["No, not yet", "Yes — and I was recommended", "Yes — with recommendations to work on first", "I’m in the middle of one now"] },
    ],
  },
  {
    id: "launch",
    group: "Readiness",
    label: "Launch plan",
    eyebrow: "Readiness",
    w: notParent,
    title: "The plan and the money",
    intro: "Nothing here has to be final. We want to see how you think about people, funding, and time.",
    qs: [
      { id: "lWhere", t: "text", l: "What city or neighborhood are you planting in?", req: 1, ph: "Community, and the ZIP if you know it" },
      { id: "lWhen", t: "text", l: "When do you hope to launch public gatherings?", req: 1, ph: 'Spring 2028, or "still discerning"' },
      { id: "lExegesis", t: "long", l: "What have you learned about that community by being in it?", h: "Who lives there, what they’re carrying, who’s already ministering there, and what you’ve learned from actual conversations — not census data.", req: 1 },
      { id: "lWhyNeeded", t: "long", l: "Why does this community need another church?", h: "Be specific about who isn’t being reached today.", req: 1 },
      { id: "lTeam", t: "text", it: "number", l: "How many adults have already verbally committed to your launch team?", req: 1, ph: "0" },
      { id: "lTeamWho", t: "long", l: "Who are they, and how will you find the rest?", h: "Family, people from your current church, people already in the community, a residency team.", req: 1 },
      { id: "lBudget", t: "text", l: "What do you think the first 24 months will cost?", req: 1, ph: "$210,000" },
      { id: "lFunding", t: "multi", l: "Where will that money come from?", h: "Check every source you’re counting on.", req: 1, o: ["Parent or sending church", "Partner churches I’ll recruit", "OCMN / Network support", "Individual monthly partners", "My own savings", "Bivocational income (mine or my spouse’s)", "Grants", "Not sure yet"] },
      { id: "lRaised", t: "text", l: "How much have you personally raised so far — for anything?", h: "Missions trips and ministry budgets count. If the answer is nothing yet, say so.", req: 1, ph: "$0" },
      { id: "lIncome", t: "radio", l: "How will your family be provided for in year one?", req: 1, o: ["Full salary from the plant", "Partial salary plus outside work", "Fully bivocational — no salary from the plant", "Spouse’s income covers us", "Still working this out"] },
      { id: "lDisciple", t: "long", l: "How will people become disciples in this church, not just attenders?", h: "The actual pathway — groups, one-on-one, teams, tables.", req: 1 },
      { id: "lMultiply", t: "radio", l: "Is planting another church part of your plan from the beginning?", req: 1, o: ["Yes — it’s in the DNA and the timeline", "Yes, eventually, but not planned yet", "I want to grow one healthy church first", "I haven’t thought about it"] },
      { id: "lHealth12", t: "long", l: "Twelve months after launch, how will you know it’s healthy?", h: "Name the two or three things you’d actually count.", req: 1 },
    ],
  },
  {
    id: "resilience",
    group: "Readiness",
    label: "You & your family",
    eyebrow: "Readiness",
    w: notParent,
    title: "The cost, honestly",
    intro: "More plants end over a planter’s health, marriage, or isolation than over strategy. We ask because we intend to help you carry it.",
    qs: [
      { id: "rConflict", t: "long", l: "Tell us about your last significant conflict in ministry and how it ended", h: "What your part in it was, and whether the relationship is intact today.", req: 1 },
      { id: "rCriticism", t: "long", l: "What’s the hardest criticism you’ve received, and what did you do with it?", req: 1 },
      { id: "rHardest", t: "long", l: "What has been the hardest season of your life, and how did you come through it?", req: 1 },
      { id: "rRhythms", t: "long", l: "What are your current spiritual and physical rhythms?", h: "Prayer, scripture, sabbath, sleep, exercise, counseling — what’s actually happening in a normal week.", req: 1 },
      { id: "rAccount", t: "text", l: "Who can tell you something you don’t want to hear?", h: "Name them and how often you talk.", req: 1 },
      { id: "rCounsel", t: "radio", l: "Have you or your spouse ever worked with a counselor?", h: "A yes is a good sign to us, not a concern.", req: 1, o: ["Yes, and we would again", "Yes, in the past", "No, but we’re open to it", "No"] },
      { id: "rFamilyCost", t: "long", l: "What will this cost your family, and what have they said about it?", h: "Time, money, moving, your kids’ schools and friendships.", req: 1, w: (a) => a.marital === "Married" || a.kids === "Yes" },
      { id: "rSpouseRole", t: "radio", l: "What role does your spouse want in the plant?", req: 1, o: ["Co-leading with me", "Leading one specific area", "Supportive, but not in a ministry role", "Still figuring it out"], w: (a) => a.marital === "Married" },
      { id: "rSpouseWilling", t: "radio", l: "Is your spouse willing to attend assessment and cohort with you?", h: "Most assessment processes, including ours, ask both spouses to participate.", req: 1, o: ["Yes", "Probably — we need to talk about the dates", "No"], w: (a) => a.marital === "Married" },
      { id: "rQuit", t: "long", l: "What would make you walk away from this?", req: 1 },
      { id: "rHelp", t: "multi", l: "What do you most want from OCMN?", h: "Check up to three.", req: 1, o: ["A coach", "Assessment", "A planter cohort and peers", "Funding", "Help fundraising", "Help finding partner churches", "Credentialing help", "Marriage and family care", "Administrative and legal setup", "Someone to pray with"] },
    ],
  },
  {
    id: "ministry",
    group: "Preparation",
    label: "Experience",
    eyebrow: "Preparation",
    title: "Your ministry preparation",
    intro: "Where you’ve served, what you’ve learned, and who you’re under right now.",
    qs: [
      { id: "education", t: "long", l: "Your educational background", h: "Theological training, discipleship or leadership programs, and any non-ministry degrees or trades.", req: 1 },
      { id: "homeChurch", t: "text", l: "Your home church and city", req: 1, ph: "Church name, City" },
      { id: "homeYears", t: "text", l: "How long have you been there?", req: 1, ph: "4 years" },
      { id: "leadPastor", t: "text", l: "Your lead pastor’s name and contact info", req: 1 },
      { id: "role", t: "long", l: "What do you do at your church today?", h: "Staff and volunteer roles both count.", req: 1 },
      { id: "history", t: "long", l: "Churches and ministries you’ve served before", h: "Include your role or title in each.", req: 1 },
      { id: "disciple", t: "long", l: "Tell us about someone you’ve led to Jesus and discipled", req: 1 },
    ],
  },
  {
    id: "refs",
    group: "Preparation",
    label: "References",
    eyebrow: "Preparation",
    title: "Three people who know you",
    intro: "People who can speak to your call — into ministry, and into planting. We’ll contact them directly.",
    qs: [
      { id: "ref1", t: "text", l: "Pastor or spiritual mentor", req: 1, ph: "Name" },
      { id: "ref1e", t: "text", it: "email", l: "Their email", req: 1 },
      { id: "ref2", t: "text", l: "A fellow minister", req: 1, ph: "Name" },
      { id: "ref2e", t: "text", it: "email", l: "Their email", req: 1 },
      { id: "ref3", t: "text", l: "A friend", req: 1, ph: "Name" },
      { id: "ref3e", t: "text", it: "email", l: "Their email", req: 1 },
    ],
  },
  {
    id: "creds",
    group: "Credentials",
    label: "AG credentials",
    eyebrow: "Credentials",
    title: "Assemblies of God credentials",
    intro: "Every OCMN planter holds credentials with the Assemblies of God, or is on the way to them. Dinner church is the exception, and campus pastors may hold local church credentials.",
    qs: [
      { id: "creds", t: "radio", l: "Do you hold credentials with the Assemblies of God?", req: 1, o: ["Yes", "No"] },
      { id: "credProcess", t: "radio", l: "Are you already in the process?", req: 1, o: CRED_PROCESS, w: needsCred },
      {
        id: "credNote",
        t: "note",
        l: "Because you’re not credentialed yet, the next few sections are the AG pre-application. It covers your background and history — the same ground the credentialing team would cover with you in person. Answering \"yes\" to any of it rarely disqualifies anyone; it just means we ask a few more questions. The Ohio Ministry Network credentialing team, and only that team, reads these answers.",
        w: needsCred,
      },
      { id: "credAck", t: "radio", l: "Ready to keep going?", req: 1, o: ["Yes, let’s continue", "I’d like someone to call me first"], w: needsCred },
    ],
  },
  {
    id: "cred-basics",
    group: "Credentials",
    label: "Background basics",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "A little of your background",
    intro: "This helps the credentialing team map a process that fits you.",
    notice: "Josh Willaford, our Leader Development Director, explains the pre-application in a short video at youtube.com/watch?v=jFBZIbl8Vx0.",
    qs: [
      { id: "dob", t: "text", it: "date", l: "Date of birth", req: 1 },
      { id: "sex", t: "radio", l: "Biological sex", req: 1, o: ["Male", "Female"] },
      { id: "conversion", t: "text", l: "About when did you come to Christ?", ph: "Spring 2009", req: 1 },
      { id: "citizen", t: "radio", l: "Are you a U.S. citizen?", req: 1, o: ["Yes", "No"] },
      { id: "finances-ack", t: "radio", l: "Do you understand the financial commitment of an AG credential, including Network tithes and General Council dues?", h: 'Details at ohioministry.net/credentials under "Financial Requirements".', req: 1, o: ["Yes", "No", "I’d like someone to walk me through it"] },
      { id: "conduct-ack", t: "radio", l: "As an AG minister you’re asked to abstain from alcohol, tobacco, gambling, pornography, and recreational or illegal drug use. Do you understand this?", req: 1, o: ["Yes", "No", "I’d like someone to explain what this means"] },
    ],
  },
  {
    id: "cred-history",
    group: "Credentials",
    label: "Ministerial history",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "Your ministerial history",
    intro: "A few specifics the credentialing team needs on record.",
    qs: [
      { id: "toldPastor", t: "radio", l: "Does your lead pastor know you’re pursuing credentials?", req: 1, o: ["Yes", "No", "I am the lead pastor"] },
      { id: "otherCreds", t: "radio", l: "Do you hold, or have you ever held, credentials with another organization or denomination?", h: "General Council bylaws usually require those to be resigned first. If you’d like yours reviewed for an exception, say so below.", req: 1, o: ["No", "Yes", "Yes — please review mine for an exception"] },
      { id: "wasLead", t: "radio", l: "Have you ever served as a lead pastor?", req: 1, o: ["Yes", "No"] },
      { id: "yrsFull", t: "text", it: "number", l: "Years in full-time vocational ministry", ph: "0", req: 1 },
      { id: "yrsPart", t: "text", it: "number", l: "Years in part-time vocational ministry", ph: "0", req: 1 },
      { id: "yrsSpouse", t: "text", it: "number", l: "Years married to a spouse in full-time ministry", ph: "0", w: (a) => a.marital === "Married" },
      { id: "pastDesc", t: "long", l: "Anything else about your past ministry involvement?", h: "Optional." },
    ],
  },
  {
    id: "cred-marital",
    group: "Credentials",
    label: "Marital history",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "Marital history",
    intro: "Two questions, then we’ll only go further if it applies to you.",
    qs: [{ id: "prevMarried", t: "radio", l: "Have you or your spouse ever been previously married?", req: 1, o: ["No", "Yes"] }],
  },
  {
    id: "cred-divorce",
    group: "Credentials",
    label: "Previous marriage",
    eyebrow: "AG pre-application",
    w: (a) => needsCred(a) && a.prevMarried === "Yes",
    title: "About the previous marriage",
    intro: "We know these questions are hard to answer. A divorce in your history is not an automatic disqualification — it means a bit of extra review, and we’ll contact you with next steps once we’ve read what you share.",
    notice: "A recognition of the previous marriage is required for both the applicant and their current spouse. Only the credentialing team sees these answers.",
    qs: [
      { id: "dLiving", t: "radio", l: "Is your former spouse still living?", o: ["Yes", "No"] },
      { id: "dYouChristian", t: "radio", l: "Were you a Christian at the time of the divorce?", o: ["Yes", "No"] },
      { id: "dThemChristian", t: "radio", l: "Was your former spouse a Christian at the time?", o: ["Yes", "No"] },
      { id: "dUnfaithful", t: "radio", l: "Do you have reason to believe there was marital unfaithfulness on your former spouse’s part?", o: ["Yes", "No"] },
      { id: "dViolence", t: "radio", l: "Was the divorce due to domestic violence toward a spouse or child?", o: ["Yes", "No"] },
      { id: "dAnnul", t: "radio", l: "Were there grounds for ecclesiastical annulment?", h: "The bylaws require clear evidence of deception, fraud, or other conditions unknown at the time of marriage that prevented a valid marriage union (Article VII, Section 2.k).", o: ["Yes", "No", "Maybe — can someone talk with me about this?"] },
      { id: "dNotes", t: "long", l: "Anything you’d like us to understand about the nature of the divorce?", h: "Optional." },
    ],
  },
  {
    id: "cred-checks",
    group: "Credentials",
    label: "Credit & background",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "Credit and background",
    intro: "A background and credit check is part of the process. If something here concerns you, please don’t let it stop you — the credentialing team’s job is to help you through it.",
    notice: "A short video explains the background and credit check: youtube.com/watch?v=GONxnsI5FO4",
    qs: [
      { id: "bankrupt", t: "radio", l: "Have you ever filed for bankruptcy?", req: 1, o: ["No", "Yes"] },
      { id: "accountsCurrent", t: "radio", l: "Are your accounts — bills, loans, mortgage, credit cards — current and up to date?", h: "General Council policy asks that all accounts be current to be considered.", req: 1, o: ["Yes", "No"] },
      { id: "creditNotes", t: "long", l: "Anything about your credit history we should know?", h: "Optional." },
      { id: "convicted", t: "radio", l: "Have you ever been convicted of a crime, misdemeanor or felony?", req: 1, o: ["No", "Yes"] },
      { id: "misconduct", t: "radio", l: "Have you ever been accused of, investigated for, or engaged in any sexual misconduct involving a minor or adult, or any violence such as child abuse, assault, battery, murder, or kidnapping?", req: 1, o: ["No", "Yes"] },
      { id: "criminalNotes", t: "long", l: "If you answered yes to either, briefly describe the charge or allegation", h: "We’ll follow up about court documentation.", w: (a) => a.convicted === "Yes" || a.misconduct === "Yes" },
    ],
  },
  {
    id: "cred-lifestyle",
    group: "Credentials",
    label: "Lifestyle",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "Lifestyle questions",
    intro: 'These are quoted from the General Council credentials application. Answering "yes" doesn’t disqualify you — it means a few more questions in the process. We handle these with great care and keep them as confidential as possible. Our hope is that you walk through this in the healthiest way possible.',
    qs: [
      { id: "ls1", t: "radio", l: "In the last seven years — or since your conversion, if that was more recent — have you had sexual contact or activity outside of biblically defined marriage, or been involved in pornography?", req: 1, o: ["No", "Yes"] },
      { id: "ls2", t: "radio", l: "In the past 24 months, have you struggled with any life-controlling habits that would hinder the leadership qualifications of 1 Timothy 3:1-7 and Titus 1:5-9?", req: 1, o: ["No", "Yes"] },
      { id: "lsNotes", t: "long", l: "Anything you’d like to add?", h: "Optional." },
    ],
  },
  {
    id: "cred-edu",
    group: "Credentials",
    label: "Training & transcripts",
    eyebrow: "AG pre-application",
    w: needsCred,
    title: "Ministerial training",
    intro: "Tell us where you’ve studied so a transcript review can be started.",
    qs: [
      { id: "eduWhere", t: "multi", l: "Where have you taken ministerial, Bible, or theology courses?", h: "Check all that apply.", o: ["Global University / Berean School of the Bible", "Ohio School of Ministry (OSOM)", "Another AG college, university, or District School of Ministry", "A non-AG Bible college or university", "None of these yet"] },
      { id: "transcripts", t: "radio", l: "Have your transcripts been sent to credentialing@ohioministry.net?", h: "The sooner we have them, the sooner a transcript review can happen. Additional coursework is sometimes required.", req: 1, o: ["Yes", "They’re on the way", "Not yet"] },
    ],
  },
  {
    id: "finances",
    group: "Finances",
    label: "Finances",
    eyebrow: "Finances",
    w: notParent,
    title: "Financial health",
    intro: "Planting is an entrepreneurial risk, and it asks for good stewardship of both personal and church finances. This is not a test — it helps us know how to support you.",
    qs: [
      { id: "debt", t: "text", l: "Approximate total indebtedness", h: "Not counting housing or transportation.", req: 1, ph: "$18,000" },
      { id: "debtNotes", t: "long", l: "Tell us a little about it", h: "What it is, and your plan for it.", req: 1 },
    ],
  },
  {
    id: "review",
    group: "Finish",
    label: "Review & submit",
    eyebrow: "Finish",
    title: "One last look",
    intro: "Check anything you want to change, then send it our way.",
    qs: [],
  },
];
