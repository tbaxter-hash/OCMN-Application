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
