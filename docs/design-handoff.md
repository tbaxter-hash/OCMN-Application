# Handoff: OCMN Planter Application

## Overview

A multi-step church-planting application for the **Ohio Church Multiplication Network
(OCMN)**, replacing a 94-question Microsoft Form. An applicant picks one of three paths on
a welcome screen, then works through only the sections that apply to them, with progress
saved as they go and a review-everything step before submitting.

The redesign does four things the original didn't:

1. **Branches on applicant type** up front (Church Planter / Dinner Church / Parent
   Church) — nobody sees another path's questions.
2. **Gates the ~40-question AG credentialing block** behind a single question ("Do you
   hold credentials with the Assemblies of God?"). Answering *Yes* removes seven whole
   sections.
3. **Adds a Readiness assessment** (competency self-rating, launch/funding plan, and a
   candid section on conflict, rhythms, and family cost) modeled on the dimensions common
   to established planter-assessment processes.
4. **Consolidates duplicates** from the original form — merged repeated marital/church
   questions, grouped reference name+email pairs, collapsed four education yes/nos into
   one checklist.

Net effect: 94 questions for everyone becomes ~60 for a credentialed planter and ~40 for
a parent church.

## About the Design Files

**The files in this bundle are design references created in HTML — a prototype showing
intended look and behavior, not production code to copy directly.**

`design-reference.html` is a self-contained prototype built for a design tool. It is a
single file with inline styles and a small custom runtime. Do not try to lift its markup
into your app. The task is to **recreate this design in the target codebase's environment**
(React, Vue, Rails, Django, whatever exists) using that codebase's established patterns,
component library, and form handling. If no codebase exists yet, choose an appropriate
stack and implement there.

`questions.js` is different — **that file is meant to be used directly.** It is a plain ES
module holding the entire question schema, branching predicates, and final copy, extracted
verbatim from the prototype. Port it to your language of choice or import it as-is.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and copy are final and follow the OCMN
design system. Recreate the UI faithfully using your codebase's existing components where
they exist; the exact token values are listed under Design Tokens below.

## Critical gap: the prototype has no backend

The prototype saves answers to `localStorage` under the key `ocmn-planter-app-v1` and its
"Submit application" button only advances to a thank-you screen. **Nothing is transmitted
anywhere.** A production build needs, at minimum:

- Persistence server-side, keyed to an applicant, so someone can finish on another device
  days later. This is the requirement that forces real accounts (magic-link email sign-in
  is sufficient and lowest-friction for this audience).
- A submission endpoint, and notification to the OCMN team.
- **Access control on the credentialing sections.** The UI promises the applicant that
  "The Ohio Ministry Network credentialing team, and only that team, reads these answers."
  Honor that promise in the data model — the divorce, criminal, credit, and lifestyle
  answers should be readable by a narrower role than the rest of the application, and
  ideally encrypted at rest.
- Reference emails: the confirmation screen tells applicants "Your three references will
  hear from us directly." Either build that or change the copy.

## Screens / Views

### 1. Welcome

**Purpose:** Explain the application, state what OCMN looks for, and capture applicant
type — the single answer that determines everything downstream.

**Layout:** Centered container, `max-width: 1180px`, `min-height: 100vh`, vertically
centered as a flex column with `gap: clamp(20px, 4vh, 48px)`. Padding
`clamp(20px, 3.5vh, 40px) 28px clamp(24px, 4vh, 48px)`.

The whole screen is designed to fit a laptop viewport with no scrolling — type, logo, and
spacing are sized in `vh`-based `clamp()`. On viewports under 700px tall the
"answers save as you go" line (`#ocmn-savenote`) is hidden via media query to reclaim space.

Two columns in a wrapping flex row, `gap: clamp(28px, 4vw, 56px)`, `align-items: center`:

**Left column** (`flex: 1 1 460px`):
- Logo lockup `assets/logo-lockup-black.png`, `height: clamp(40px, 7.5vh, 78px)`
- Pill label: "Planter *Application*" — 2px `--ink-900` border, `--radius-pill`, 13px/800.
  The word "Application" is Playfair Display italic 500. An ember sparkle SVG (21×21,
  `--ember-500`, 2.2 stroke) overlaps its top-right corner at `margin: -7px 0 0 -7px`.
- H1: "You have a dream." / "*We can help.*" — `clamp(34px, 5.6vh, 62px)`, weight 900,
  `line-height: 1.0`, `letter-spacing: -0.03em`. Second line Playfair Display italic 400.
- Body paragraph, `clamp(15px, 1.9vh, 18px)`, `--ink-600`, `max-width: 30em`
- Save-note paragraph, `clamp(13px, 1.6vh, 15px)`, `--ink-500` (id `ocmn-savenote`)
- "What we look for" block (id `ocmn-lookfor`), separated by a 1px `--ink-200` top border.
  Eyebrow 12px/800, `0.09em` tracking, uppercase, `--ink-500`. Then a
  `repeat(auto-fit, minmax(230px, 1fr))` grid, `gap: clamp(10px, 1.6vh, 18px) 26px`, of
  four two-line entries — blue label above, description below:

  | Label | Description |
  | --- | --- |
  | Affiliation | Assemblies of God churches, led by Assemblies of God ministers. |
  | Education | Solid Bible literacy and sound theology. |
  | Experience | You've led ministries and built teams. |
  | Ability | Assessment shows entrepreneurial and leadership strength. |

  Labels are 12.5px/900 `--blue-600`; descriptions 13.5px/1.45 `--ink-600`.
- Closing line: "Not credentialed with the Assemblies of God yet? Not a problem — we'll
  walk you through it right inside this application." 13.5px `--ink-500`.

**Right column** (`flex: 1 1 360px`): a card — `--paper-0` fill, 1px `--ink-200` border,
`--radius-lg` (16px), `--shadow-md`, padding `clamp(16px, 3vh, 30px) clamp(20px, 2vw, 28px)`.
- Heading "Which best describes you?" `clamp(19px, 2.5vh, 22px)`/900
- Sub "We'll only ask the questions that fit your path." 14px `--ink-500`
- Three option rows, `gap: clamp(7px, 1.2vh, 12px)`, each `padding: clamp(10px, 2vh, 18px) 20px`,
  `border-radius: 14px`, 1.5px `--ink-200` border on `--paper-0`. Title 16.5px/900 with a
  right-aligned `→`; description 13.5px `--ink-500`. Hover lifts `translateY(-2px)`.
  Selected state inverts to `--ink-900` fill with white text.

  | Path id | Title | Description |
  | --- | --- | --- |
  | `planter` | Church Planter | Planting a new church in Ohio. |
  | `dinner` | Dinner Church Planter | A table-based gathering around a meal. |
  | `parent` | Parent Church | A church sending out a plant or campus. |

- If saved progress exists: a divider, then the applicant's first name and save timestamp
  on the left, and a black pill "Resume" button on the right.

Clicking a path sets `answers.path` and moves straight to the form at step 0.

### 2. Form (the main view)

Two columns filling the viewport.

**Sidebar** — `flex: 0 1 292px`, `min-width: 260px`, `--paper-0` background, 1px
`--ink-200` right border, padding `26px 22px 40px`, flex column with `gap: 26px`.

- Emblem `assets/emblem-black-900.png` at 48px + "OCMN / Planter Application" wordmark.
  Clicking returns to the welcome screen.
- **Progress**: eyebrow "PROGRESS" with the percentage right-aligned; a 6px `--ink-100`
  track with a `--blue-600` fill, `transition: width 260ms ease`; below it "N of M
  answered" in 12.5px `--ink-400`.
- **Section nav**, grouped. Each group header is a 5px `--ember-500` dot plus an 11.5px/800
  uppercase `--ink-400` label with `0.09em` tracking. Each item is a row with a 17px status
  dot and a 13.5px label:
  - *complete* — filled `--blue-600` circle with a white `✓`
  - *current* — filled `--blue-600` circle, no glyph; row background `--ink-100`, label
    `--ink-900`/800
  - *incomplete* — empty circle with a 1.5px `--ink-300` border; label `--ink-600`/600

  Every item is clickable and jumps to that step.
- Footer: help text with a `mailto:ocmn@ohioministry.net` link and the phone number
  (614) 396-0700.

**Main panel** — `flex: 1 1 560px`, content capped at `max-width: 720px`, padding
`44px 34px 40px`.

- Eyebrow pill (`--ink-100` fill, 11.5px/800 uppercase) plus "Step N of M" in `--ink-400`
- H2 step title, `clamp(28px, 4vw, 40px)`, weight 900, `letter-spacing: -0.028em`
- Intro paragraph, 16px/1.6, `--ink-600`, `max-width: 34em`
- Optional **notice** callout: `--ember-100` fill, 1px `--ember-300` border, 4px
  `--ember-500` left border, `border-radius: 14px`, text 14px `--ember-700`
- Questions in a `gap: 30px` grid, each animating in with `ocmnFadeUp`
  (opacity 0→1, `translateY(10px)`→0, 260ms, ease-out)

**Sticky footer bar** — `position: sticky; bottom: 0`, `rgba(247,244,238,.92)` with
`backdrop-filter: blur(8px)`, 1px `--ink-200` top border, padding `16px 34px`. Contains a
"← Back" text button, a status line (save confirmation, or the count of answers still
needed), an optional "Skip for now" outline pill, and the primary blue "Continue" pill.

### 3. Question types

All labels are 16px/800, `--ink-900`, with a `--blue-600` asterisk when required. Hints sit
below at 13.5px `--ink-500`, `max-width: 40em`. Invalid fields swap their border to
`--danger-600` and show "We need this one before you continue." in 13px/700 `--danger-600`.

| Type | Rendering |
| --- | --- |
| `text` | Single input, `max-width: 30em`, padding `13px 15px`, 15.5px, 1.5px `--ink-200` border, `border-radius: 12px`. Honors `it` for `email`/`tel`/`date`/`number`. |
| `long` | Textarea, 4 rows, `min-height: 118px`, `border-radius: 14px`, resize vertical, with a live word count below in 12px `--ink-400`. |
| `radio` | Stacked cards, `gap: 9px`, `max-width: 40em`, padding `13px 16px`, `border-radius: 13px`. A 19px circular mark on the left. Selected: `--blue-50` fill, `--blue-600` border, filled mark with a `•`, label weight 800. |
| `multi` | Same as radio but the mark is a 6px-radius square with a `✓`, and selections toggle. |
| `scale` | A row of five equal-width buttons (1–5), `gap: 8px`, padding `13px 4px`, `border-radius: 12px`. Selected fills `--blue-600` with white text. Below, the `low` and `high` end labels at 12.5px `--ink-500`, justified to opposite ends. |
| `note` | Not a field — an explanatory block. `--paper-0` fill, 3px `--ember-500` left border, `border-radius: 0 12px 12px 0`, padding `18px 20px`, text 14.5px/1.65 `--ink-700`. |

### 4. Review & submit

The final step. One card per section (`--paper-0`, 1px `--ink-200`, `border-radius: 16px`,
padding `20px 22px`), each showing the section name, a status badge, an "Edit" link that
jumps to that step, and every question as a label/value row (40% / 60% split, separated by
1px `--ink-100` top borders).

- Badge complete: `--success-100` background, `--success-600` text, reads "Complete"
- Badge incomplete: `--warning-100` / `--warning-600`, reads "N left"
- Unanswered values render as "Not answered yet" in `--ink-400`
- Values longer than 120 characters truncate with an ellipsis; labels truncate at 58

If anything required is outstanding **anywhere in the application**, a `--warning-100`
banner appears above the cards — "A few answers are still needed — N in all." — with a
black "Take me there" pill that jumps to the first incomplete step. The primary button
reads "Finish the last N" and is inert until the count reaches zero; only then does it
read "Submit application" and proceed.

### 5. Confirmation

Centered, `max-width: 620px`. Emblem at 96px, then the pill label "Application *received*"
with its sparkle, then an H2 "No one goes it alone." at `clamp(32px, 5vw, 50px)`. Two
paragraphs personalized with the applicant's first name and email, promising contact within
five business days. Two pill buttons: black "Back to start", outlined "Explore OCMN"
(links to https://www.ohiocmn.com/).

## Interactions & Behavior

**Navigation.** Steps are a flat ordered list filtered by each step's `w` predicate against
the current answers, so the visible sequence changes as the applicant types. "Step N of M"
and the sidebar both reflect the *filtered* list. Sidebar items jump anywhere, forward or
back — nothing is locked.

**Validation is soft mid-form, hard at submit.** Pressing Continue with required fields
empty marks them and shows the count in the footer bar; pressing Continue *again* moves on
anyway, and a "Skip for now" button appears as the explicit escape hatch. This is
deliberate — the application is long and people need to move past a question they have to
look up. The review step is where it becomes binding: submission is blocked until every
required, currently-visible question is answered.

**Autosave.** Every keystroke and selection writes the full answer object to storage and
updates the footer to "Saved {timestamp}". On load, if saved answers exist, the welcome
screen offers Resume.

**Progress** counts every currently-visible non-note question as the denominator and every
non-empty answer as the numerator. Because visibility is dynamic, the denominator moves —
answering "Yes" to holding credentials drops the total substantially. This is intentional
and reads as reassuring.

**Scroll.** Every step change resets scroll to top.

**Responsive.** Both columns are flex items with `flex-wrap: wrap`, so the sidebar drops
above the content on narrow viewports. The welcome screen's two columns stack.

## State Management

```
answers: Record<string, string | string[] | number>   // keyed by question id
screen:  'welcome' | 'form' | 'done'
idx:     number                 // index into the *filtered* step list
showErr: boolean                // reveal validation on the current step
forced:  boolean                // Continue pressed once with errors → allow skip
saveNote: string                // "Saved Mar 4, 2:15 PM"
```

Derived per render, never stored: the filtered step list, the missing-required list for
each step, the answered/total counts, and the outstanding count across all steps.

Two predicates drive nearly all branching, and both are exported from `questions.js`:

```js
needsCred  = a => a.creds === 'No'      // gates 7 credentialing steps
notParent  = a => a.path !== 'parent'   // hides planter-only steps from parent churches
```

## Structure

21 steps, 122 questions defined; a given applicant sees a subset.

| Group | Steps | Shown to |
| --- | --- | --- |
| About you | Your details, Your family | everyone |
| Your calling | The call | planter, dinner |
| Your calling | Your vision | parent only |
| Your plan | Dinner church plan | dinner only |
| Your plan | Parent church plan | parent only |
| Readiness | Self-assessment, Launch plan, You & your family | planter, dinner |
| Preparation | Experience, References | everyone |
| Credentials | AG credentials | everyone |
| Credentials | Background basics, Ministerial history, Marital history, Credit & background, Lifestyle, Training & transcripts | only if `creds === 'No'` |
| Credentials | Previous marriage | only if `creds === 'No'` **and** `prevMarried === 'Yes'` |
| Finances | Finances | planter, dinner |
| Finish | Review & submit | everyone |

Question-level `w` predicates handle finer cases — spouse questions appear only when
`marital === 'Married'`, children's names only when `kids === 'Yes'`, the criminal-detail
textarea only when a prior answer was "Yes".

## Design Tokens

From the OCMN design system. Load its token stylesheets rather than hardcoding these.

**Ink & paper**
```
--ink-900  #111110    --ink-100  (hairline fills)
--ink-800  --ink-700  --ink-600  --ink-500  --ink-400  --ink-300  --ink-200
--paper-50 #f7f4ee    --paper-0  (card white)
```

**Brand blue** — primary actions, progress, selection, links
```
--blue-700  --blue-600 #2049b4  --blue-500  --blue-100  --blue-50 #eef3fe
```

**Ember** — warm accent, used sparingly for sparkles, notices, and group dots
```
--ember-700 #b85a1d  --ember-600 #d97528  --ember-500 #ea8a3c
--ember-300 #f3c08a  --ember-100 #fae7d2
```

**Semantic** — `--success-100/600`, `--warning-100/600`, `--danger-600`

Ignite Red (`--red-600 #e5251b`) is deliberately **not** used here — it belongs to the
cohort-portal sub-brand and would read as an error state in a form.

**Type** — Archivo for everything structural; Playfair Display italic for single accent
words only. Headline weight 900 with `-0.02em` to `-0.03em` tracking and ~1.0 leading.

**Radius** — `--radius-pill: 999px` (buttons, labels, tags); `--radius-lg: 16px` (cards);
12–14px for inputs and option rows.

**Shadow** — `--shadow-sm` / `--shadow-md`, soft and warm-tinted. `--shadow-focus` is a 3px
`--blue-200` ring, applied on input focus alongside a `--blue-500` border.

**Motion** — 140–260ms, ease-out, no bounce. Cards lift 2–3px on hover; buttons darken.

## Assets

Real OCMN brand files, included in `assets/`:

- `logo-lockup-black.png` — full horizontal lockup, used on the welcome screen
- `emblem-black-900.png` — Ohio silhouette with the four-petal seed cutout; sidebar and
  confirmation
- `emblem-white.png` — reverse, for dark backgrounds

Clear space of one petal-width; never below 28px tall. The sparkle is drawn inline as SVG
(an 8-point asterisk: two straight strokes plus two diagonals, round caps) — not an image
file.

No photography is used in this design. The OCMN design system calls for warm documentary
photography, and the welcome screen is the natural place for it if the team supplies images.

## Files

| File | What it is |
| --- | --- |
| `design-reference.html` | The full working prototype. Open in any browser. Self-contained. |
| `questions.js` | **Use this directly.** All 21 steps, 122 questions, branching predicates, and final copy, as a plain ES module. |
| `assets/` | The three brand image files referenced above. |

## Suggested first steps in Claude Code

1. Read `questions.js` first — it is the actual specification, and everything else in this
   README describes how to present it.
2. Open `design-reference.html` in a browser and click through both a credentialed planter
   and a non-credentialed one to see how much the form changes.
3. Decide the persistence model before building UI. Whether an applicant can return on
   another device is the fork in the road: browser-only storage is an afternoon,
   accounts plus server-side drafts is the real project.
4. Build the question renderer as one component driven by the `t` field, not 122 hand-written
   fields.
