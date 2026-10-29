/*
 * The screen: load an export, pick an applicant, preview, save as PDF.
 * Everything lives in memory for this tab only — closing it clears it all.
 */

const state = {
  file: "",
  applicants: [],
  map: null,
  selected: -1,
  view: "app",
  includeCred: false,
  filter: "all",
  query: "",
};

const $ = (sel) => document.querySelector(sel);

async function loadFile(file) {
  if (!file) return;
  showError("");
  try {
    const rows = await readSpreadsheet(file);
    const { applicants, map } = buildApplicants(rows);
    if (!applicants.length) throw new Error("The export has headings but no responses yet.");
    // Newest first, the way the team works through them.
    applicants.sort((x, y) => String(y.meta.completed || "").localeCompare(String(x.meta.completed || "")) || y.index - x.index);
    Object.assign(state, { file: file.name, applicants, map, selected: 0, view: "app", filter: "all", query: "" });
    $("#search").value = "";
    render();
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong reading that file.");
  }
}

function showError(msg) {
  const el = $("#error");
  el.textContent = msg;
  el.hidden = !msg;
}

function visibleApplicants() {
  const q = state.query.trim().toLowerCase();
  return state.applicants.filter((app) => {
    if (state.filter === "cred" && !needsCredentialing(app.answers)) return false;
    if (!q) return true;
    const a = app.answers;
    return [applicantName(app), a.email, a.path, a.dcName, a.pcName].join(" ").toLowerCase().includes(q);
  });
}

function render() {
  const loaded = state.applicants.length > 0;
  $("#empty").hidden = loaded;
  $("#workspace").hidden = !loaded;
  $("#file-chip").hidden = !loaded;
  $("#clear").hidden = !loaded;
  if (!loaded) return;

  $("#file-name").textContent = state.file;
  const credCount = state.applicants.filter((x) => needsCredentialing(x.answers)).length;
  $("#count-all").textContent = state.applicants.length;
  $("#count-cred").textContent = credCount;
  document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter)));

  renderList();
  renderPreview();
  renderColumnCheck();
}

function renderList() {
  const list = visibleApplicants();
  const ul = $("#list");
  if (!list.length) {
    ul.innerHTML = `<li class="list-empty">No applicants match.</li>`;
    return;
  }
  ul.innerHTML = list
    .map((app) => {
      const a = app.answers;
      const cred = needsCredentialing(a);
      const when = app.meta.completed ? fmtDate(app.meta.completed, { short: true }) : "";
      return `
        <li>
          <button class="row${app.index === state.selected ? " is-active" : ""}" data-index="${app.index}">
            <span class="row-name">${esc(applicantName(app))}</span>
            <span class="row-sub">${esc(a.path || "—")}${when ? ` · ${esc(when)}` : ""}</span>
            ${cred ? '<span class="badge badge-ember">Needs credentialing</span>' : /^yes/i.test(a.creds || "") ? '<span class="badge badge-blue">AG credentialed</span>' : ""}
          </button>
        </li>`;
    })
    .join("");
}

function current() {
  return state.applicants.find((x) => x.index === state.selected) || null;
}

function renderPreview() {
  const app = current();
  const paper = $("#paper");
  if (!app) {
    paper.innerHTML = "";
    return;
  }
  const cred = needsCredentialing(app.answers);
  if (!cred && state.view === "cred") state.view = "app";

  $("#tab-cred").disabled = !cred;
  $("#tab-cred").title = cred ? "" : "Only for applicants who answered “No” to holding AG credentials";
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.view)));
  $("#include-cred-wrap").hidden = !(cred && state.view === "app");
  $("#include-cred").checked = state.includeCred;

  $("#save-label").textContent = state.view === "cred" ? "Save credentialing packet as PDF" : "Save application as PDF";
  $("#cred-note").hidden = !(cred && state.view === "app");

  // Running footer on every printed page, e.g. "CONFIDENTIAL · Jordan Avery · Credentialing Pre-Application".
  const footer = `${state.view === "cred" ? "CONFIDENTIAL · " : ""}${applicantName(app)} · ${docKind()}`;
  $("#page-style").textContent = `@page { @bottom-left { content: "${footer.replace(/["\\\n]/g, "")}"; } }`;

  paper.classList.toggle("is-cred", state.view === "cred");
  paper.innerHTML = state.view === "cred" ? renderCredPacket(app) : renderApplication(app, { includeCred: state.includeCred });
}

function renderColumnCheck() {
  const m = state.map;
  const total = QUESTIONS.length;
  const el = $("#colcheck");
  const ok = m.matched === total && !m.unmatched.length;
  el.innerHTML = `
    <details>
      <summary><span class="cc-dot ${ok ? "ok" : "warn"}"></span>${m.matched} of ${total} questions found in this file</summary>
      <div class="cc-body">
        ${ok ? "<p>Every column lined up with a question on the application.</p>" : ""}
        ${m.matched < total ? `<p><strong>Not in this file:</strong> ${QUESTIONS.filter((q) => !Object.values(m.byCol).includes(q)).map((q) => `Q${q.n}`).join(", ")}. If the form was edited, older exports may not have these.</p>` : ""}
        ${m.unmatched.length ? `<p><strong>Columns that didn't match a question</strong> (printed under “Additional Responses”):</p><ul>${m.unmatched.map((u) => `<li>${esc(u.header)}</li>`).join("")}</ul>` : ""}
      </div>
    </details>`;
}

function docKind() {
  return state.view === "cred" ? "Credentialing Pre-Application" : "OCMN Planter Application";
}

function savePdf() {
  const app = current();
  if (!app) return;
  const kind = docKind();
  const title = document.title;
  document.title = fileName(app, kind);
  window.addEventListener("afterprint", () => (document.title = title), { once: true });
  window.print();
}

function clearAll() {
  Object.assign(state, { file: "", applicants: [], map: null, selected: -1 });
  $("#paper").innerHTML = "";
  $("#list").innerHTML = "";
  $("#file-input").value = "";
  render();
}

/* ---------- wiring ---------- */

function init() {
  $("#file-input").addEventListener("change", (e) => loadFile(e.target.files[0]));
  document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => $("#file-input").click()));

  let depth = 0;
  window.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; document.body.classList.add("is-dragging"); });
  window.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; document.body.classList.remove("is-dragging"); } });
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    document.body.classList.remove("is-dragging");
    loadFile(e.dataTransfer.files[0]);
  });

  $("#list").addEventListener("click", (e) => {
    const row = e.target.closest("[data-index]");
    if (!row) return;
    state.selected = Number(row.dataset.index);
    renderList();
    renderPreview();
    $("#preview").scrollTop = 0;
  });

  $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => { state.filter = b.dataset.filter; render(); }),
  );
  document.querySelectorAll("[data-view]").forEach((b) =>
    b.addEventListener("click", () => { state.view = b.dataset.view; renderPreview(); $("#preview").scrollTop = 0; }),
  );
  $("#include-cred").addEventListener("change", (e) => { state.includeCred = e.target.checked; renderPreview(); });
  $("#save").addEventListener("click", savePdf);
  $("#clear").addEventListener("click", clearAll);
  $("#download").hidden = !/^https?:$/.test(location.protocol);

  render();
}

init();
