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
