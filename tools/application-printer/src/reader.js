/*
 * Reads a Microsoft Forms export (.xlsx or .csv) entirely in the browser.
 *
 * An .xlsx is a zip of XML files. Rather than ship a spreadsheet library,
 * this unzips with the browser's built-in DecompressionStream and reads the
 * first worksheet directly — no code from anywhere else, no network.
 */

async function readSpreadsheet(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xls")) {
    throw new Error("That's an older .xls file. In Excel, choose File › Save As › Excel Workbook (.xlsx), then try again.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("That file doesn't look like an Excel workbook. Use the .xlsx you downloaded from Microsoft Forms.");
  }
  return readXlsx(bytes);
}

/* ---------- zip ---------- */

async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("The workbook appears to be damaged (no zip directory found).");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const entries = {};
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const entryName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    entries[entryName] = { method, compSize, localOffset };
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return async (entryName) => {
    const e = entries[entryName];
    if (!e) return null;
    const lh = e.localOffset;
    const start = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);
    const data = bytes.subarray(start, start + e.compSize);
    if (e.method === 0) return decoder.decode(data);
    if (e.method !== 8) throw new Error("The workbook uses an unsupported compression method.");
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
  };
}

/* ---------- xlsx ---------- */

function xml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function all(node, tag) {
  return Array.from(node.getElementsByTagNameNS("*", tag));
}

function attr(node, name) {
  return node.getAttribute(name) ?? node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", name.replace(/^r:/, ""));
}

async function readXlsx(bytes) {
  const read = await unzip(bytes);

  // Locate the first worksheet through the workbook's relationships.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = all(xml(wb), "sheet")[0];
    const rid = first && attr(first, "r:id");
    const rel = all(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid);
    if (rel) {
      const target = rel.getAttribute("Target");
      sheetPath = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    }
  }

  const shared = [];
  const ss = await read("xl/sharedStrings.xml");
  if (ss) {
    for (const si of all(xml(ss), "si")) {
      // Rich text splits a string into runs; phonetic runs (rPh) are not part of the value.
      shared.push(all(si, "t").filter((t) => t.parentNode.localName !== "rPh").map((t) => t.textContent).join(""));
    }
  }

  const dateStyles = await readDateStyles(await read("xl/styles.xml"));

  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Couldn't find a worksheet in that workbook.");

  const rows = [];
  for (const row of all(xml(sheet), "row")) {
    const out = [];
    let col = 0;
    for (const c of all(row, "c")) {
      const ref = c.getAttribute("r");
      if (ref) col = colIndex(ref);
      const type = c.getAttribute("t");
      const v = all(c, "v")[0];
      let value = "";
      if (type === "s") value = shared[Number(v?.textContent)] ?? "";
      else if (type === "inlineStr") value = all(c, "t").map((t) => t.textContent).join("");
      else if (type === "b") value = v?.textContent === "1" ? "TRUE" : "FALSE";
      else if (v) {
        value = v.textContent;
        if (type !== "str" && type !== "e" && dateStyles.has(Number(c.getAttribute("s") || 0))) {
          value = serialToDate(Number(value));
        }
      }
      out[col] = value;
      col++;
    }
    rows.push(Array.from(out, (x) => x ?? ""));
  }
  return rows;
}

function colIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function readDateStyles(stylesXml) {
  const dates = new Set();
  if (!stylesXml) return dates;
  const doc = xml(stylesXml);
  const custom = {};
  for (const f of all(doc, "numFmt")) custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode");
  const isDateFmt = (id) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true;
    const code = custom[id];
    if (!code) return false;
    const bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    return /[dmyhs]/i.test(bare) && !/^[#0.,%\s]*$/.test(bare);
  };
  const xfs = all(doc, "cellXfs")[0];
  if (xfs) {
    all(xfs, "xf").forEach((xf, i) => {
      if (isDateFmt(Number(xf.getAttribute("numFmtId")))) dates.add(i);
    });
  }
  return dates;
}

/* Excel stores dates as days since 1899-12-30. Returned as an ISO-ish string. */
function serialToDate(serial) {
  if (!isFinite(serial)) return String(serial);
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  const iso = d.toISOString();
  return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
}

/* ---------- csv ---------- */

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- columns → questions ---------- */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(norm(s).split(" ").filter((w) => w.length > 1));
}

function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / (A.size + B.size - hit);
}

/*
 * Pairs each header with a question. Exact (normalized) titles win; then
 * titles with a numeric suffix Forms adds to duplicates ("Email2"); then the
 * closest wording above a threshold, so small edits to a question's text
 * in Forms don't drop its answers.
 */
function mapColumns(headers) {
  const meta = {};
  let firstQuestion = 0;
  for (let i = 0; i < Math.min(headers.length, 8); i++) {
    const key = META_COLUMNS[norm(headers[i])];
    // Stop at the first repeat so the form's own "Email" question isn't taken as metadata.
    if (!key || key in meta) break;
    meta[key] = i;
    firstQuestion = i + 1;
  }

  const byCol = {};
  const used = new Set();
  const candidates = [];
  for (let c = firstQuestion; c < headers.length; c++) {
    const h = norm(headers[c]);
    if (!h) continue;
    for (const q of QUESTIONS) {
      const qn = norm(q.q);
      let score = 0;
      if (h === qn) score = 3;
      else if (h.replace(/ ?\d+$/, "") === qn) score = 2.5;
      else if (h.length > 24 && (h.startsWith(qn) || qn.startsWith(h))) score = 2;
      else {
        const s = similarity(h, qn);
        if (s >= 0.6) score = 1 + s;
      }
      if (score) candidates.push({ c, q, score, order: Math.abs(q.n - (c - firstQuestion + 1)) });
    }
  }
  candidates.sort((x, y) => y.score - x.score || x.order - y.order);
  for (const { c, q } of candidates) {
    if (byCol[c] || used.has(q.key)) continue;
    byCol[c] = q;
    used.add(q.key);
  }

  const unmatched = [];
  for (let c = firstQuestion; c < headers.length; c++) {
    if (!byCol[c] && norm(headers[c])) unmatched.push({ c, header: String(headers[c]).trim() });
  }
  return { meta, byCol, unmatched, matched: used.size };
}

function buildApplicants(rows) {
  const headerRow = rows.findIndex((r) => r.some((x) => String(x).trim()));
  if (headerRow < 0) throw new Error("That spreadsheet is empty.");
  const headers = rows[headerRow];
  const map = mapColumns(headers);
  if (map.matched < 5) {
    throw new Error("This doesn't look like the OCMN Planter Application export — none of the column headings match the application's questions.");
  }

  const applicants = [];
  for (const row of rows.slice(headerRow + 1)) {
    if (!row.some((x) => String(x).trim())) continue;
    const answers = {};
    const meta = {};
    for (const [key, c] of Object.entries(map.meta)) meta[key] = clean(row[c]);
    for (const [c, q] of Object.entries(map.byCol)) {
      const v = clean(row[c]);
      if (v) answers[q.key] = v;
    }
    const extra = map.unmatched
      .map(({ c, header }) => ({ header, value: clean(row[c]) }))
      .filter((x) => x.value);
    applicants.push({ meta, answers, extra, index: applicants.length });
  }
  return { applicants, map, headers };
}

function clean(v) {
  return String(v ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
