// Assembles the single, self-contained HTML file the team opens from their desktop.
// Fonts, logos, styles and scripts are all inlined so the page never touches the network.
//
//   node tools/application-printer/build.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p));
const dataUri = (p, type) => `data:${type};base64,${read(p).toString("base64")}`;

const fonts = `
@font-face { font-family: "Archivo"; font-style: normal; font-weight: 400 900; font-display: block;
  src: url(${dataUri("assets/archivo.woff2", "font/woff2")}) format("woff2"); }
@font-face { font-family: "Playfair Display"; font-style: italic; font-weight: 400 500; font-display: block;
  src: url(${dataUri("assets/playfair-italic.woff2", "font/woff2")}) format("woff2"); }`;

const scripts = ["schema.js", "reader.js", "render.js", "app.js"]
  .map((f) => `// ---- ${f} ----\n${read(join("src", f)).toString()}`)
  .join("\n");

const tokens = {
  FONTS: fonts,
  STYLES: read("src/styles.css").toString(),
  SCRIPTS: scripts,
  LOGO: dataUri("assets/logo-lockup-black.png", "image/png"),
  EMBLEM: dataUri("assets/emblem-black-900.png", "image/png"),
  EMBLEM_WHITE: dataUri("assets/emblem-white.png", "image/png"),
};

// Function replacer so `$&`-style sequences in the inlined code are left alone.
const html = read("src/index.html")
  .toString()
  .replace(/\{\{(\w+)\}\}/g, (m, key) => (key in tokens ? tokens[key] : m));

const out = join(here, "dist", "OCMN Application Printer.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Built ${out} (${Math.round(html.length / 1024)} KB)`);

// A zip of the same file, so a download link saves it instead of opening it in the browser.
const zipOut = join(here, "dist", "OCMN Application Printer.zip");
writeFileSync(zipOut, zip("OCMN Application Printer.html", Buffer.from(html)));
console.log(`Built ${zipOut}`);

// Minimal single-file zip (stored, no compression).
function zip(name, data) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;

  const fname = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(0x21, 12); // 1980-01-01, fixed so rebuilds are byte-identical
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fname.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fname.length, 28);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fname.length, 12);
  end.writeUInt32LE(local.length + fname.length + data.length, 16);

  return Buffer.concat([local, fname, data, central, fname, end]);
}
