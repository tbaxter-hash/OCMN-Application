/*
 * The OCMN Planter Application (Microsoft Forms), question for question.
 *
 * `n` is the number Forms shows; `q` is the question title exactly as it
 * appears as a column header in the Forms Excel export. Columns are matched
 * to questions by title, so a reordered form still lines up.
 *
 * Sections marked `cred: true` are the AG credentialing pre-application.
 * When an applicant answers "No" to Q43 those sections are lifted out of the
 * main application and printed as a separate, confidential packet for the
 * Ohio Ministry Network credentialing department.
 *
 * Types: text (short answer), long (paragraph), choice (one option),
 * multi (checkboxes), date, number.
 */

const SECTIONS = [
  {
    id: "personal",
    title: "Personal Information",
    questions: [
      { n: 1, key: "firstName", q: "First Name", t: "text" },
      { n: 2, key: "lastName", q: "Last Name", t: "text" },
      { n: 3, key: "email", q: "Email", t: "text" },
      { n: 4, key: "address", q: "What is your home address?", t: "text" },
      { n: 5, key: "phone", q: "Phone Number", t: "text" },
      { n: 6, key: "path", q: "Are you a...", t: "choice" },
      { n: 7, key: "marital", q: "Marital Status", t: "choice" },
      { n: 8, key: "spouse", q: "Spouse Name & Contact", t: "text" },
      { n: 9, key: "kids", q: "Do you have children?", t: "choice" },
      { n: 10, key: "kidNames", q: "List their names", t: "text" },
    ],
  },
  {
    id: "support",
    title: "Personal Support",
    questions: [
      { n: 11, key: "hasParent", q: "Do you have a Parent Church?", t: "choice" },
      { n: 12, key: "parentWho", q: "Who is your Parent Church?", t: "text" },
      { n: 13, key: "parentEmail", q: "What is their email?", t: "text" },
    ],
  },
  {
    id: "dinner",
    title: "Dinner Church Application",
    questions: [
      { n: 14, key: "dcParent", q: "Parent church name", t: "text" },
      { n: 15, key: "dcName", q: "Dinner Church Name", t: "text" },
      { n: 16, key: "dcLocation", q: "Location Address", t: "text" },
      { n: 17, key: "dcDays", q: "What days of the week will you meet?", t: "multi" },
      { n: 18, key: "dcTeam", q: "Size of Launch Team", t: "text" },
      { n: 19, key: "dcContext", q: "Describe the context of your Dinner Church", t: "long" },
      { n: 20, key: "dcLook", q: "What will your Dinner Church look like?", t: "long" },
      { n: 21, key: "dcTeams", q: "How will you build teams for your Dinner Church?", t: "long" },
      { n: 22, key: "dcPromote", q: "How will you promote your Dinner Church?", t: "long" },
      { n: 23, key: "dcBudget", q: "Monthly Budget", t: "long" },
      { n: 24, key: "dcMomentum", q: "How will you sustain momentum?", t: "long" },
      { n: 25, key: "dcProgress", q: "How will you define progress & positive presence in the community?", t: "long" },
    ],
  },
  {
    id: "calling",
    title: "Calling",
    questions: [
      { n: 26, key: "whyCalled", q: "Describe to us why you feel God is calling you to plant a church:", t: "long" },
      { n: 27, key: "burden", q: "Do you have a burden for a certain people group or community? Please explain:", t: "long" },
      { n: 28, key: "whyNow", q: "Why do you believe now is the right time to plant a church.", t: "long" },
      { n: 29, key: "mentors", q: "Who are the spiritual mentors in your life, and how are they confirming your calling to plant?", t: "long" },
      { n: 30, key: "spouseFeel", q: "If you are married, how does your spouse feel about church planting?", t: "long" },
    ],
  },
  {
    id: "experience",
    title: "Ministry Preparation & Experience",
    questions: [
      { n: 31, key: "education", q: "Please list your educational background including including theological training, discipleship / leadership programs and non-ministry degrees or skills:", t: "long" },
      { n: 32, key: "attend", q: "Where do you currently attend church and how long have you been attending?*", t: "long" },
      { n: 33, key: "leadPastor", q: "Please share the name and contact info for the lead pastor of the church you attend:", t: "long" },
      { n: 34, key: "serveNow", q: "Do you currently serve in an official ministry position? (please list both staff and volunteer roles)", t: "long" },
      { n: 35, key: "served", q: "Ministry Experience - Please list the churches / ministries you've served in previously including the role/title.", t: "long" },
      { n: 36, key: "discipled", q: "Have you personally led someone to Jesus and discipled them? Please share about your experience.", t: "long" },
    ],
  },
  {
    id: "references",
    title: "References",
    layout: "references",
    questions: [
      { n: 37, key: "ref1", q: "1st Reference - Pastor/spiritual mentor", t: "text", role: "Pastor / spiritual mentor" },
      { n: 38, key: "ref1Email", q: "1st Reference - email", t: "text" },
      { n: 39, key: "ref2", q: "2nd Reference - Fellow minister", t: "text", role: "Fellow minister" },
      { n: 40, key: "ref2Email", q: "2nd Reference - Email", t: "text" },
      { n: 41, key: "ref3", q: "3rd Reference - Friend", t: "text", role: "Friend" },
      { n: 42, key: "ref3Email", q: "3rd Reference Email", t: "text" },
    ],
  },
  {
    id: "credentials",
    title: "Credentials",
    questions: [
      { n: 43, key: "creds", q: "Do you hold credentials with the Assemblies of God?", t: "choice" },
      { n: 44, key: "credProcess", q: "If you do not hold credentials with the Assemblies of God, are you in the process of obtaining them?", t: "choice" },
      { n: 45, key: "credAware", q: "Every church planter with OCMN is required to have, or be in the process of obtaining, credentials with the Assemblies of God. Are you aware of this?", t: "choice" },
    ],
  },
  {
    id: "demographic",
    title: "Demographic Information",
    cred: true,
    questions: [
      { n: 46, key: "dob", q: "Date of Birth", t: "date" },
      { n: 47, key: "sex", q: "Biological Sex", t: "choice" },
      { n: 48, key: "conversion", q: "Approximate Date of Conversion", t: "text" },
      { n: 49, key: "citizen", q: "Are you a US Citizen", t: "choice" },
      { n: 50, key: "finCommit", q: "Do you understand the financial commitment of a ministerial credential with the Assemblies of God including Network tithes and General Council dues?", t: "choice" },
      { n: 51, key: "abstain", q: "Do you understand that as a minister of the Assemblies of God you are to abstain from alcohol, tobacco or other smoking, gambling, pornography, recreational or illegal drug usage, or any sinful behaviors specifically prohibited by Scripture?", t: "choice" },
    ],
  },
  {
    id: "ministerial",
    title: "Ministerial History",
    cred: true,
    questions: [
      { n: 52, key: "churchCity", q: "Church Name and City", t: "text" },
      { n: 53, key: "pastorInformed", q: "Have you informed your lead pastor that you are pursuing credentials?", t: "choice" },
      { n: 54, key: "involvement", q: "Please describe your current church ministry involvement.", t: "long" },
      { n: 55, key: "otherCreds", q: "Do you currently hold/have you ever held ministerial credentials with another organization or denomination?", t: "choice" },
      { n: 56, key: "leadPastorEver", q: "Have you ever served as a lead pastor?", t: "choice" },
      { n: 57, key: "yrsFull", q: "How many years (if any) have you served in full-time vocational ministry?", t: "number" },
      { n: 58, key: "yrsPart", q: "How many years (if any) have you served in part-time vocational ministry?", t: "number" },
      { n: 59, key: "yrsSpouse", q: "How many years (if any) have you been married to a spouse in full-time ministry?", t: "number" },
      { n: 60, key: "pastInvolvement", q: "Please provide a brief description of your past ministry involvement. (optional)", t: "long" },
    ],
  },
  {
    id: "marital",
    title: "Marital History",
    cred: true,
    questions: [
      { n: 61, key: "married", q: "Are you currently married?", t: "choice" },
      { n: 62, key: "prevMarried", q: "Have you or your spouse (if applicable) ever been previously married?", t: "choice" },
    ],
  },
  {
    id: "divorce",
    title: "Divorce History",
    cred: true,
    questions: [
      { n: 63, key: "formerLiving", q: "Is your former spouse(s) still living?", t: "multi" },
      { n: 64, key: "christianYou", q: "Were you a Christian at the time of your divorce(s)?", t: "multi" },
      { n: 65, key: "christianFormer", q: "Was your former spouse(s) a Christian at the time of your divorce?", t: "multi" },
      { n: 66, key: "unfaithful", q: "Do you have reason to believe that there was marital unfaithfulness on the part of your former spouse?", t: "multi" },
      { n: 67, key: "violence", q: "Was the divorce due to domestic violence by a spouse to a spouse or child?", t: "multi" },
      { n: 68, key: "annulment", q: "Were there grounds for ecclesiastical annulment in your previous marriage?", t: "multi" },
      { n: 69, key: "divorceNotes", q: "Additional comments regarding the nature of your divorce(s).", t: "long" },
    ],
  },
  {
    id: "credit",
    title: "Credit History",
    cred: true,
    questions: [
      { n: 70, key: "bankruptcy", q: "Have you ever filed for bankruptcy?", t: "choice" },
      { n: 71, key: "accountsCurrent", q: "Are all your credit accounts (bills, loans, mortgages, credit cards) current and payments up to date?", t: "choice" },
      { n: 72, key: "creditNotes", q: "Additional Comments Regarding Credit History", t: "long" },
    ],
  },
  {
    id: "criminal",
    title: "Criminal History",
    cred: true,
    questions: [
      { n: 73, key: "convicted", q: "Have you been convicted of a crime (misdemeanor or felony)?", t: "choice" },
      { n: 74, key: "misconduct", q: "Have you ever been accused of, investigated for, or engaged in any sexual misconduct involving a minor or adult, including but not limited to child molestation, indecent liberties with a child, sexual harassment, rape, child pornography, sexual contact with a counselee, or sexual or non-sexual violence such as child abuse, assault, battery, murder, or kidnapping?", t: "choice" },
      { n: 75, key: "criminalNotes", q: "If yes to the above questions, briefly provide a description of the charge(s) and/or allegations.", t: "long" },
    ],
  },
  {
    id: "lifestyle",
    title: "Lifestyle Issues",
    cred: true,
    questions: [
      { n: 76, key: "sexualConduct", q: "In the last seven years (or since your conversion, if less than seven years ago) have you had sexual contact/activity outside of biblically defined marriage (such as incest, adultery, homosexual activity, etc.), or been engaged in or involved in pornography?", t: "choice" },
      { n: 77, key: "habits", q: "Over the past 24 months, have you struggled with any issues or life-controlling habits that would hinder your ability to meet the leadership qualifications outlined in 1 Timothy 3:1-7 and Titus 1:5-9?", t: "choice" },
      { n: 78, key: "lifestyleNotes", q: "Additional Comments Regarding Lifestyle Issues", t: "long" },
    ],
  },
  {
    id: "education",
    title: "Educational History",
    cred: true,
    questions: [
      { n: 79, key: "globalU", q: "Have you taken classes through Global University/Berean School of the Bible?", t: "choice" },
      { n: 80, key: "osom", q: "Have you taken classes through Ohio School of Ministry (OSOM)?", t: "choice" },
      { n: 81, key: "agCollege", q: "Did you attend an AG college, university or District School of Ministry (other than OSOM)?", t: "choice" },
      { n: 82, key: "nonAgCollege", q: "Have you taken ministerial, Bible, or theology courses at a non-AG Bible college or university?", t: "choice" },
      { n: 83, key: "transcripts", q: "Have you already had your transcripts from any ministerial training noted above sent to credentialing@ohioministry.net?", t: "choice" },
    ],
  },
  {
    id: "financial",
    title: "Financial Information",
    questions: [
      { n: 84, key: "debt", q: "What is your approximate indebtedness? *Not including housing and transportation", t: "text" },
      { n: 85, key: "debtExplain", q: "Please explain:", t: "long" },
    ],
  },
  {
    id: "parent",
    title: "Parent Church Application",
    questions: [
      { n: 86, key: "pcName", q: "What is the name of your church?", t: "text" },
      { n: 87, key: "pcPrevious", q: "Have you parented a church previously? If yes, please list the name of the church(es).", t: "long" },
      { n: 88, key: "pcCommunity", q: "What community(s) are you targeting to plant in?", t: "long" },
      { n: 89, key: "pcPastor", q: "Who will be the planing Pastor?", t: "text" },
      { n: 90, key: "pcLaunch", q: "Do you have a launch date?", t: "text" },
      { n: 91, key: "pcModel", q: "Church Model Type:", t: "choice" },
      { n: 92, key: "pcStrategy", q: "Church Planting Strategy", t: "choice" },
      { n: 93, key: "pcCharter", q: "Do you plan on chartering the new church with the Assemblies of God?", t: "choice" },
      { n: 94, key: "pcCohort", q: "Have you previously participated in the Parent Church Cohort?", t: "choice" },
    ],
  },
];

const QUESTIONS = SECTIONS.flatMap((s) => s.questions.map((q) => ({ ...q, section: s })));

/* Columns Forms adds ahead of the questions in every export. */
const META_COLUMNS = {
  id: "id",
  "start time": "started",
  "completion time": "completed",
  email: "respondentEmail",
  name: "respondentName",
  "last modified time": "modified",
};

/* An applicant who answered "No" to Q43 gets a credentialing packet. */
const needsCredentialing = (a) => /^no\b/i.test(a.creds || "");

/*
 * Items the reader should look at, worded as plain restatements of the
 * applicant's answers. `cred` items appear only in the credentialing packet.
 */
const REVIEW_RULES = [
  { when: (a) => needsCredentialing(a), level: "info", text: "Does not hold Assemblies of God credentials — credentialing packet prepared for the credentialing department." },
  { when: (a) => /not interested/i.test(a.credProcess || ""), level: "warn", text: "Not interested in pursuing AG credentials at this time (Q44)." },
  { when: (a) => /^no/i.test(a.credAware || ""), level: "warn", text: "Was not aware of the AG credential requirement for OCMN planters (Q45)." },
  { when: (a) => /^no/i.test(a.pcCharter || ""), level: "warn", text: "Does not plan to charter the new church with the Assemblies of God (Q93)." },
  { when: (a) => /sign me up/i.test(a.pcCohort || ""), level: "info", text: "Asked to be signed up for the Parent Church Cohort (Q94)." },
  { when: (a) => /more information/i.test(a.pcCohort || ""), level: "info", text: "Would like more information about the Parent Church Cohort (Q94)." },

  { cred: true, when: (a) => /^no, but/i.test(a.credProcess || ""), level: "info", text: "Would like to begin the credentialing process (Q44)." },
  { cred: true, when: (a) => /^no/i.test(a.citizen || ""), level: "warn", text: "Not a US citizen (Q49)." },
  { cred: true, when: (a) => /^no/i.test(a.finCommit || ""), level: "warn", text: "Does not yet understand the financial commitment of a credential (Q50)." },
  { cred: true, when: (a) => /^no/i.test(a.abstain || ""), level: "warn", text: "Answered “No” on the abstinence standard (Q51)." },
  { cred: true, when: (a) => /follow up/i.test(a.abstain || ""), level: "info", text: "Requested a follow-up conversation about the abstinence standard (Q51)." },
  { cred: true, when: (a) => /^no/i.test(a.pastorInformed || ""), level: "info", text: "Has not yet informed their lead pastor about pursuing credentials (Q53)." },
  { cred: true, when: (a) => /^yes/i.test(a.otherCreds || ""), level: "warn", text: "Holds or has held credentials with another organization (Q55)." },
  { cred: true, when: (a) => /review/i.test(a.otherCreds || ""), level: "info", text: "Requested a review of a present credential for a possible exception (Q55)." },
  { cred: true, when: (a) => /^yes/i.test(a.prevMarried || ""), level: "warn", text: "Applicant or spouse previously married — additional review required (Q62–69)." },
  { cred: true, when: (a) => /maybe/i.test(a.annulment || ""), level: "info", text: "Asked to be contacted about possible grounds for annulment (Q68)." },
  { cred: true, when: (a) => /^yes/i.test(a.bankruptcy || ""), level: "warn", text: "Has filed for bankruptcy (Q70)." },
  { cred: true, when: (a) => /^no/i.test(a.accountsCurrent || ""), level: "warn", text: "Credit accounts are not all current (Q71)." },
  { cred: true, when: (a) => /^yes/i.test(a.convicted || ""), level: "alert", text: "Answered “Yes” to a criminal conviction (Q73)." },
  { cred: true, when: (a) => /^yes/i.test(a.misconduct || ""), level: "alert", text: "Answered “Yes” to the misconduct question (Q74)." },
  { cred: true, when: (a) => /^yes/i.test(a.sexualConduct || ""), level: "alert", text: "Answered “Yes” on the lifestyle question (Q76)." },
  { cred: true, when: (a) => /^yes/i.test(a.habits || ""), level: "warn", text: "Answered “Yes” on life-controlling habits (Q77)." },
  { cred: true, when: (a) => /^no/i.test(a.transcripts || ""), level: "info", text: "Transcripts have not been sent to credentialing@ohioministry.net (Q83)." },
  { cred: true, when: (a) => /on the way/i.test(a.transcripts || ""), level: "info", text: "Transcripts are on the way (Q83)." },
];
