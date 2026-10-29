# OCMN Application Printer

A single HTML file that turns the Microsoft Forms export of the **OCMN – Planter
Application** into polished, OCMN-branded PDFs — one per applicant.

**Get it:** [download the zip](https://github.com/tbaxter-hash/OCMN-Application/raw/claude/keen-brown-pcqunp/tools/application-printer/dist/OCMN%20Application%20Printer.zip),
unzip it, and put `OCMN Application Printer.html` on your desktop. Double-click it and it
opens in your browser (Chrome or Edge recommended). It runs entirely on your computer and
works without internet — this is also the file to send anyone else who needs it.

1. In Microsoft Forms, open the Planter Application › **Responses** › **Open results in
   Excel**, and save the `.xlsx` file.
2. Drop that file on the page.
3. Pick an applicant and press **Save application as PDF**. In the print window choose
   **Save as PDF** (and turn off *Headers and footers* under *More settings*).

## Credentialing packets

If an applicant answers **No** to *Do you hold credentials with the Assemblies of God?*
(Q43), every answer they give after that in the credentialing sections — Demographic,
Ministerial, Marital, Divorce, Credit, Criminal and Lifestyle history, and Educational
history (Q44–Q83) — is taken out of their main application and printed as a separate,
confidential **Credentialing Pre-Application** to send to the Ohio Ministry Network
credentialing department. The sidebar's *Needs credentialing* filter lists those
applicants. A toggle puts the credentialing answers back into the full application if
you need everything in one document.

## Privacy

Applicant information never leaves the computer. The page reads the spreadsheet inside
the browser, keeps nothing after the tab is closed, and carries a Content-Security-Policy
that blocks every network request — fonts and logos are embedded in the file. No AI
service or server is involved.

## Changing it

The question list lives in `src/schema.js` (columns are matched to questions by their
title, so a reordered form still works; columns that don't match print under
"Additional Responses"). After editing anything in `src/`, rebuild the single file:

```bash
node tools/application-printer/build.mjs
```

Fonts: Archivo and Playfair Display, both under the SIL Open Font License.
