/*
 * Builds the two printable documents for an applicant:
 *   renderApplication — the full planter application for the OCMN team
 *   renderCredPacket  — the confidential credentialing pre-application,
 *                       for applicants without AG credentials
 */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* Formats "2026-10-12" or "2026-10-12 14:05" without shifting time zones. */
function fmtDate(v, { time = false, short = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(v || "");
  if (!m) return v || "";
  const month = MONTHS[Number(m[2]) - 1];
  let out = `${short ? month.slice(0, 3) : month} ${Number(m[3])}, ${m[1]}`;
  if (time && m[4]) {
    const h = Number(m[4]);
    out += ` · ${((h + 11) % 12) + 1}:${m[5]} ${h < 12 ? "AM" : "PM"}`;
  }
  return out;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return fmtDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
}

function applicantName(app) {
  const a = app.answers;
  const name = [a.firstName, a.lastName].filter(Boolean).join(" ");
  return name || app.meta.respondentName || `Response ${app.meta.id || app.index + 1}`;
}

function fileName(app, kind) {
  const a = app.answers;
  const who = a.lastName ? `${a.lastName}, ${a.firstName || ""}`.trim().replace(/,$/, "") : applicantName(app);
  return `${kind} – ${who}`.replace(/[\\/:*?"<>|]+/g, "");
}

function pathLabel(app) {
  return app.answers.path || "Applicant";
}

function multiValues(v) {
  return String(v).split(";").map((x) => x.trim()).filter(Boolean);
}

function displayValue(q, v) {
  if (q.t === "date") return fmtDate(v);
  return v;
}

function paragraphs(v) {
  return String(v)
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/* ---------- building blocks ---------- */

const SPARKLE =
  '<svg class="sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1"/></svg>';

function isShort(q, v) {
  return q.t !== "long" && q.t !== "multi" && String(v).length <= 90 && !String(v).includes("\n");
}

function renderAnswer(q, v) {
  if (q.t === "multi") {
    return `<div class="chips">${multiValues(v).map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>`;
  }
  if (q.t === "long" || String(v).length > 90 || String(v).includes("\n")) {
    return `<div class="prose">${paragraphs(v)}</div>`;
  }
  return `<div class="value">${esc(displayValue(q, v))}</div>`;
}

function renderQuestions(questions, answers) {
  const answered = questions.filter((q) => answers[q.key]);
  let html = "";
  let grid = [];
  const flush = () => {
    if (grid.length) html += `<div class="field-grid">${grid.join("")}</div>`;
    grid = [];
  };
  for (const q of answered) {
    const v = answers[q.key];
    const label = `<div class="q"><span class="qn">Q${q.n}</span>${esc(q.q.replace(/\*$/, ""))}</div>`;
    if (isShort(q, v)) {
      grid.push(`<div class="field">${label}${renderAnswer(q, v)}</div>`);
    } else {
      flush();
      html += `<div class="block">${label}${renderAnswer(q, v)}</div>`;
    }
  }
  flush();
  return html;
}

function renderReferences(section, answers) {
  const refs = [];
  const qs = section.questions;
  for (let i = 0; i < qs.length; i += 2) {
    const nameQ = qs[i];
    const emailQ = qs[i + 1];
    const name = answers[nameQ.key];
    const email = answers[emailQ.key];
    if (!name && !email) continue;
    refs.push(`
      <div class="ref">
        <div class="ref-role">${esc(nameQ.role)}</div>
        <div class="ref-name">${esc(name || "—")}</div>
        <div class="ref-email">${esc(email || "No email given")}</div>
      </div>`);
  }
  return refs.length ? `<div class="refs">${refs.join("")}</div>` : "";
}

function sectionHasAnswers(section, answers) {
  return section.questions.some((q) => answers[q.key]);
}

function renderSection(section, answers, num, { confidential = false } = {}) {
  const body = section.layout === "references" ? renderReferences(section, answers) : renderQuestions(section.questions, answers);
  if (!body) return "";
  return `
    <section class="sec">
      <header class="sec-head">
        <span class="sec-num">${String(num).padStart(2, "0")}</span>
        <h2>${esc(section.title)}</h2>
        ${confidential ? '<span class="tag tag-dark">Confidential</span>' : ""}
      </header>
      ${body}
    </section>`;
}

function renderReview(items, title) {
  if (!items.length) return "";
  const icon = { alert: "!", warn: "!", info: "i" };
  return `
    <div class="review">
      <div class="review-title">${esc(title)}</div>
      <ul>
        ${items.map((r) => `<li class="lvl-${r.level}"><span class="dot">${icon[r.level]}</span><span>${esc(r.text)}</span></li>`).join("")}
      </ul>
    </div>`;
}

function glance(items) {
  const cells = items.filter(([, v]) => v);
  return `<div class="glance">${cells
    .map(([k, v, sub]) => `<div class="g"><div class="g-k">${esc(k)}</div><div class="g-v">${esc(v)}</div>${sub ? `<div class="g-s">${esc(sub)}</div>` : ""}</div>`)
    .join("")}</div>`;
}

function contactLine(a) {
  return [a.email, a.phone, a.address].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("");
}

function receivedLine(app) {
  const parts = [];
  if (app.meta.id) parts.push(`Response #${esc(app.meta.id)}`);
  if (app.meta.completed) parts.push(`Received ${esc(fmtDate(app.meta.completed, { time: true, short: true }))}`);
  return parts.join(" · ");
}

function signoff(lines) {
  return `
    <div class="signoff">
      ${lines.map((l) => `<div class="sig"><div class="sig-line"></div><div class="sig-label">${esc(l)}</div></div>`).join("")}
    </div>`;
}

/* ---------- the full application ---------- */

function renderApplication(app, { includeCred = false } = {}) {
  const a = app.answers;
  const needsCred = needsCredentialing(a);
  const credSections = SECTIONS.filter((s) => s.cred && sectionHasAnswers(s, a));

  const parentChurch = a.parentWho || a.dcParent || "";
  const credStatus = /^yes/i.test(a.creds || "")
    ? ["Credentialed", "Holds AG credentials"]
    : needsCred
      ? ["Not credentialed", a.credProcess || "Credentialing packet prepared"]
      : [a.creds || "", ""];

  const review = REVIEW_RULES.filter((r) => !r.cred && r.when(a));

  let num = 0;
  let sections = "";
  let credPlaced = false;
  for (const s of SECTIONS) {
    if (s.cred) {
      if (!credSections.includes(s)) continue;
      if (includeCred) {
        sections += renderSection(s, a, ++num, { confidential: true });
      } else if (!credPlaced) {
        credPlaced = true;
        const count = credSections.reduce((n, cs) => n + cs.questions.filter((q) => a[q.key]).length, 0);
        sections += `
          <section class="sec">
            <header class="sec-head"><span class="sec-num">${String(++num).padStart(2, "0")}</span><h2>Credentialing Pre-Application</h2></header>
            <div class="separated">
              <div class="separated-icon">${LOCK_SVG}</div>
              <div>
                <div class="separated-title">Held separately for the credentialing department</div>
                <p>${esc(applicantName(app))} does not hold Assemblies of God credentials. Their ${count} answers to the credentialing questions
                (${credSections.map((cs) => esc(cs.title)).join(", ")}) are printed in a separate, confidential
                <em>Credentialing Pre-Application</em> for the Ohio Ministry Network credentialing department and are not included here.</p>
              </div>
            </div>
          </section>`;
      }
      continue;
    }
    if (!sectionHasAnswers(s, a)) continue;
    sections += renderSection(s, a, ++num);
  }

  if (app.extra.length) {
    sections += `
      <section class="sec">
        <header class="sec-head"><span class="sec-num">${String(++num).padStart(2, "0")}</span><h2>Additional Responses</h2></header>
        ${app.extra.map((x) => `<div class="block"><div class="q">${esc(x.header)}</div><div class="prose">${paragraphs(x.value)}</div></div>`).join("")}
      </section>`;
  }

  return `
    <article class="doc">
      <header class="doc-top">
        <img class="doc-logo" src="${ASSETS.logo}" alt="Ohio Church Multiplication Network">
        <div class="doc-meta">
          <div class="eyebrow">Planter Application</div>
          <div>${receivedLine(app)}</div>
        </div>
      </header>

      <div class="title-block">
        <div class="pill">${esc(pathLabel(app))}${SPARKLE}</div>
        <h1>${esc(applicantName(app))}</h1>
        <div class="subtitle">Church Planting <span class="accent">Application</span></div>
        <div class="contact">${contactLine(a)}</div>
      </div>

      ${glance([
        ["Applying as", a.path],
        ["Marital status", a.marital, a.spouse],
        ["Children", a.kids, a.kidNames],
        ["Parent church", a.hasParent === "No" && !parentChurch ? "None yet" : parentChurch, a.parentEmail],
        ["AG credentials", credStatus[0], credStatus[1]],
        ["Dinner church", a.dcName, a.dcLocation],
        ["Church", a.pcName, a.pcCommunity && a.pcCommunity.length < 60 ? a.pcCommunity : ""],
      ])}

      ${renderReview(review, "For follow-up")}

      ${sections}

      <section class="sec office">
        <header class="sec-head"><h2>Office Use</h2></header>
        ${signoff(["Reviewed by", "Date", "Next step"])}
      </section>

      <footer class="doc-foot">
        Prepared ${esc(today())} from the OCMN Planter Application (Microsoft Forms).
        Ohio Church Multiplication Network · ocmn@ohioministry.net · (614) 396-0700
      </footer>
    </article>`;
}

/* ---------- the credentialing packet ---------- */

function renderCredPacket(app) {
  const a = app.answers;
  const review = REVIEW_RULES.filter((r) => r.cred && r.when(a));
  const credStatus = SECTIONS.find((s) => s.id === "credentials");

  let num = 0;
  let sections = renderSection(credStatus, a, ++num);
  for (const s of SECTIONS) {
    if (!s.cred || !sectionHasAnswers(s, a)) continue;
    sections += renderSection(s, a, ++num);
  }

  return `
    <article class="doc doc-cred">
      <header class="cred-band">
        <img src="${ASSETS.emblemWhite}" alt="">
        <div class="cred-band-org">Ohio Church Multiplication Network<span>Referral to the Ohio Ministry Network</span></div>
        <div class="cred-band-tag">Confidential<span>Credentialing Department</span></div>
      </header>

      <div class="title-block">
        <div class="pill">Credentialing Referral${SPARKLE}</div>
        <h1>${esc(applicantName(app))}</h1>
        <div class="subtitle">Credentialing <span class="accent">Pre-Application</span></div>
        <div class="contact">${contactLine(a)}</div>
      </div>

      <p class="lede">
        ${esc(applicantName(app))} applied to plant with the Ohio Church Multiplication Network as a
        <strong>${esc(pathLabel(app))}</strong> and does not currently hold credentials with the Assemblies of God.
        Their answers to the credentialing pre-application are below. ${receivedLine(app) ? `(${receivedLine(app)}.)` : ""}
      </p>

      ${glance([
        ["Date of birth", fmtDate(a.dob)],
        ["Biological sex", a.sex],
        ["US citizen", a.citizen],
        ["Date of conversion", a.conversion],
        ["Current church", a.churchCity],
        ["Currently married", a.married || a.marital],
      ])}

      ${renderReview(review, "Items for the credentialing team")}

      ${sections}

      <section class="sec office">
        <header class="sec-head"><h2>Credentialing Office Use</h2></header>
        ${signoff(["Received by", "Date", "Assigned to"])}
      </section>

      <footer class="doc-foot">
        Confidential. Prepared ${esc(today())} by the Ohio Church Multiplication Network for the Ohio Ministry Network
        credentialing team (credentialing@ohioministry.net). Please handle, store and dispose of this document accordingly.
      </footer>
    </article>`;
}

const LOCK_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
