# OCMN Planter Application

A multi-step church-planting application for the Ohio Church Multiplication Network
(OCMN). Applicants pick one of three paths (Church Planter / Dinner Church Planter /
Parent Church) on a welcome screen, then work through only the sections that apply,
with progress saved as they go and a review-everything step before submitting.

Built with Next.js (App Router) and TypeScript. See `docs/design-handoff.md` for the
full design spec this implementation was built from.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current state

- **Question schema**: `src/lib/questions.ts` — 21 steps, 122 questions, ported
  verbatim from the design handoff's `questions.js`, with the same branching
  predicates (`needsCred`, `notParent`).
- **Persistence**: browser `localStorage` only, under the key `ocmn-planter-app-v1`.
  There is no backend yet — nothing is transmitted anywhere on submit.
- **Screens**: Welcome, Form (sidebar + question steps), Review & submit,
  Confirmation — in `src/components/`.

## Budget planner (`/budget`)

A simple financial plan for church planters, built from the OCMN Church Budget
Template (Profit and Loss Budget Overview). Each line takes two numbers — a one-time
launch amount and a typical month — and the planner works out year-one totals.

- **Generosity first**: 3% Heart for Ohio (Ohio Ministry Network) and missions giving
  (AG World & U.S. Missions, 3% by default) are figured automatically as a percentage
  of income — all income by default, or tithes & offerings only.
- **Health check**: live best-practice checks (monthly balance, launch funding,
  reserve, payroll share, local-giving self-support, insurance, background checks,
  CMN matching-fund cap).
- **Best practices** from CMN and national church-planting sources, with links.
- **Download Excel** builds a formatted workbook (`src/lib/budgetWorkbook.ts`, using
  ExcelJS): a Summary tab, one tab per year for three years with live formulas
  (generosity rates, totals, carried-over cash balance, local-giving coverage), and a
  Best Practices tab.
- **Submit to OCMN** opens an email to ocmn@ohioministry.net for the planter to attach
  the downloaded file to — there is no upload yet.
- **Open saved plan** loads a downloaded workbook back into the planner (a hidden
  `PlannerData` tab holds the plan; amounts and rates edited on the first year's tab
  in Excel are picked up too), so a plan can be edited on another computer.
- **Print PDF** prints the plan (or saves it as a PDF from the print dialog).
- Print with pastor and two advisory-committee signature lines.
- Schema, math, and checks live in `src/lib/budget.ts`; saved in `localStorage`
  under `ocmn-budget-planner-v1`.

## Explainer videos

Two spots play a Cloudflare Stream video via a modal (`src/components/VideoModal.tsx`,
`VideoButton.tsx`): a "Watch: Welcome to OCMN" button on the welcome screen, and a
"Watch the explainer" card that appears on the AG credentials step once someone answers
that they don't hold credentials yet, explaining what the pre-application involves.

Both video IDs are blank in `src/lib/videos.ts` — until they're filled in, the modal
shows a "video coming soon" placeholder instead of a broken embed. See that file's
comments for exactly what to paste in once the videos are uploaded to Cloudflare Stream.

## Known gaps (see `docs/design-handoff.md` for detail)

A production build still needs, at minimum:

- Server-side persistence keyed to an applicant (so someone can resume on another
  device), most simply via magic-link email accounts.
- A real submission endpoint and notification to the OCMN team.
- Role-gated (and ideally encrypted) access to the AG credentialing answers —
  the UI promises these are seen only by the credentialing team.
- Actually emailing the three references, or changing the copy that promises it.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint

## Pop-out photo studio (`/pop-out`)

Turns photos into "3D" pop-out images: the photo sits in a fixed rounded frame and the
person steps out of it (head above the top edge, arms past the sides, feet below).
Built for the image card at the bottom of the Church Hub sidebar, so every image made
with the same settings drops into the same spot.

- **Drop, paste or choose photos** (several at once). Each is processed in the browser —
  nothing is uploaded. Person detection uses Google MediaPipe segmentation models
  (`src/lib/popout/segment.ts`); edges are refined with a guided filter. The MediaPipe
  WebAssembly runtime is copied from `node_modules` to `public/mediapipe/` by
  `tools/copy-mediapipe-wasm.mjs` before `dev`/`build`; the models (~16 MB, plus ~3 MB for
  "People + objects") download from Google's model bucket on first use.
- **Image area** (frame size, corner rounding, room above/below/sides) is shared by all
  photos and saved in `localStorage`. Presets: Church Hub sidebar card (default), wide
  banner, landscape card.
- **Per photo**: drag to move the photo behind the fixed frame, zoom, choose which edges
  the person may break through, Erase/Restore brushes (with undo) to clean up the
  cut-out, and "People + objects" to also pick up pets, furniture and plants.
- **Download PNG** (transparent background by default) at frame size plus overhang,
  e.g. 1312 × 1112 for the sidebar card. "Code for your web page" gives the HTML that
  positions the PNG so its frame fills the designated area. "On your page" shows a live
  mock of the sidebar in light and dark.
- Rendering lives in `src/lib/popout/render.ts`; the UI in `src/components/PopOutStudio.tsx`.
