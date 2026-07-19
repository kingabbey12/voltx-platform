# The Today Screen
## The Morning Briefing

**Status:** Canonical screen specification, first of its layer. Governed by the five immutable documents: [Manifesto](../PRODUCT_EXPERIENCE_MANIFESTO.md) · [First Day](../NORTH_STAR_EXPERIENCE.md) · [One-Year Story](../ONE_YEAR_STORY.md) · [Visual DNA](../VISUAL_DNA.md) · [Architecture](../PRODUCT_ARCHITECTURE.md). Desktop first. No mock data — this document specifies structure, behavior, and reasoning, not content.

This document preserves its own deletion passes (§Reduction), because the final screen is only trustworthy if the removals are visible.

---

## The Governing Insight

Every failed home screen in business software fails the same way: it is a *control room* — panels, widgets, charts, counters — a room that assumes the user's job is to monitor. The Architecture forbids this: Today holds the brief, the held work, at most one question, and refuses a fourth thing. The One-Year Story tells us what Today must feel like: *a few calm sentences beside her coffee, written by someone who stayed late on her behalf.*

So the design position is this:

**Today is not a screen with content on it. Today is a document — a dated letter from the company to its owner, some of whose sentences can act.**

Everything below follows from that sentence.

---

## The Composition

One centered reading column — ~68 characters (~680px) — on the warm canvas, inside the product's stable frame (the three quiet places and the you-corner, which this spec inherits from the Architecture and does not restate). No sidebar content, no second column, no panels. The page, top to bottom:

1. **The date** — the letter's dateline
2. **The brief** — set prose; the company speaking; ends with the one question when one exists
3. **The held work** — sentences that can act; the envelopes on the desk
4. **The reply line** — the Ask field, resting at the letter's end

Vertical rhythm (from the fixed scale, Visual DNA §4): 64 above the dateline; 16 dateline → brief; 16 between paragraphs; 48 brief → held work; 8 between held rows; 64 held work → reply line; generous end-of-page space below.

That is the entire screen. Its inevitability argument: a morning briefing, in every century before software, was a dated page of sentences from a trusted aide, with the things requiring signature clipped beneath it, and the aide waiting for instructions. Voltx's Today is exactly that — nothing added.

---

## Component 1 — The Date

**What it is.** One line: the full date, set small and quiet. 13px, weight 400, secondary text tone. Sentence case. Nothing else on the line.

**Why it exists.** A briefing without a date is a feed. The dateline declares Today's contract: this page is *finished daily* (Architecture §3) — it belongs to this morning, will not scroll into history, and will be replaced whole tomorrow. It is also the ritual anchor: the One-Year Story's brief is a *morning* object, and the dateline is what makes returning to it feel like a ritual rather than a check-in.

**Why nothing sits beside it.** No greeting ("Good morning, Amara") — deleted in Pass 1; warmth belongs in the prose voice, not in a template's mail-merge hello, which reads as performed intimacy by week two. No weather, no clock, no logo. The manifesto's Deletion Test: none of them, removed, would hurt.

**Animation.** None. It is print.

**Empty / loaded.** Identical in all states — the date exists even on day one.

---

## Component 2 — The Brief

**What it is.** The company speaking: a handful of short paragraphs of set prose. 16px, weight 400, line-height 1.5, primary text tone. No headline above it (deleted — Pass 1), no card around it (it is not an object; it is the page itself), no bullet points by default (this is a voice, not a list — the AI's one voice, Manifesto §5).

Entities the brief mentions — a customer, a deal, an order — are doors: quietly styled links (no underline at rest; weight 500; underline on hover/focus) that open the record in Company. Any claim or number carries the drawer one gesture away (Visual DNA §13), revealed as a quiet affordance on hover/focus of the sentence — invisible at rest.

**The one question lives here** — merged in Pass 2. When the day holds a genuine question (the Architecture's maximum of one), it is the brief's final paragraph, in the same voice, followed by its answers as inline actions: 13px, weight 500 text buttons — the recommended answer first, carrying the accent (the Volt = intent, Visual DNA §9), alternatives in secondary tone beside it. Answering resolves the paragraph in place; the brief closes with a short acknowledgment. No modal, no separate "decision card" — a good aide asks in the flow of the briefing, not from a separate form.

**Why it exists.** The brief *is* Today's reason to exist: the work coming to the owner (Manifesto §6), the overnight ledger compressed to the few sentences worth attention (One-Year Story: "hundreds of judgments, zero noise").

**Why nothing sits beside it.** No charts (a chart is an answer; answers live behind questions — Architecture §4; when a trend matters, the brief *says* the trend in a sentence, with the drawer holding the numbers). No KPI row (numbers appearing daily without a question become wallpaper, and wallpaper trains blindness). No "view all activity" link (the ledger lives in Promises, where accountability lives; Today does not advertise other rooms).

**How it follows the manifesto.** One voice; earn every notification (the brief is the *alternative* to notification); complexity absorbed (the night's work, invisible); typography *is* the interface — this component is nearly pure type.

**What animates.** On the first open of the morning, the brief streams in at reading rhythm — the texture of thought (Visual DNA §13), the product's one daily moment of visible aliveness. Every subsequent visit that day: instantly still, fully set, like print. A resolved question crossfades to its acknowledgment (≤200ms).

**What remains still.** Everything, after arrival. Numbers appear at final value — never counting up (Architecture §15).

**Spacing / type.** 16 between paragraphs; 68ch measure; 16/1.5/400; links 500.

**Interaction.** Read; click a door; answer the question inline; open a drawer from any claim. Nothing else. The brief cannot be configured, rearranged, or dismissed — it can only be *read*, and it learns from what is lingered on and what is skipped (One-Year Story: "nobody set these preferences"), silently.

**Empty state (nothing happened).** The brief is one sentence long, in voice, to the effect of *nothing needs you — all promises on track.* Never apologetic, never decorated. The short brief is the product's proudest artifact: the signal that never lies (One-Year Story). Silence rendered as one calm sentence *is* the loaded state, minimal case.

**Empty state (day one).** Per Architecture §6, the first morning's brief is the First Day's opening: one line of introduction and one question — *tell me about your business* — flowing straight into the reply line below. Today and Ask are the same surface on day one; this composition makes that literal: a letter whose entire body is its opening question.

**AI behavior.** Composed once, before the owner arrives; ordered by consequence, not chronology; personalized by observed reading, never by asked configuration; strictly one question maximum — if the system believes two things need judgment, it chooses, because choosing is its job; never mentions handled routine work except where trust is still young (that texture falls away — Architecture §13).

---

## Component 3 — The Held Work

**What it is.** Beneath the brief, after 48px of separating quiet: the envelopes. Each held item is **one row: one sentence** — what was prepared and for whom — followed by a single action. 14px sentence, weight 400; the action a 13px/500 text button carrying the accent, named by its true verb (*Send*, *Apply*, *Book* — never "Approve," never "OK"; Visual DNA §23). The row is the door (Visual DNA §18): clicking anywhere except the verb opens the full prepared work for inspection — there is no separate "Open" button (deleted, Pass 3). Rows carry the product-wide held-state treatment (Visual DNA §13): hairline border, radius 8, surface one step above canvas — the *only* bordered objects on the page, which is exactly why they read as objects: things exist here, waiting, distinct from the prose around them. No shadow (they rest — they do not float).

Undo, after release, appears as a quiet inline affordance for a short interval — reversibility physically present (Manifesto §5), then gone.

**Why it exists.** Held work is the trust engine of the entire product — the First Day's turning point ("it waits") and the One-Year Story's widening circle both happen *here*, on this component, more than anywhere else in Voltx. It must therefore be the most honest surface we make: unmistakably ready, unmistakably not yet released.

**Why nothing sits beside it.** No section header ("Held work" — deleted Pass 1; a bordered row following prose needs no announcement). No count badge (the rows are their own count; a number would add anxiety, not information). No "approve all" (judgment is the one thing that is the owner's — Manifesto §2 division of labor; bulk trust is granted in Promises by widening the agreement, never spent here as a reflex).

**What animates.** Release: the verb confirms (≤140ms), the row resolves out (~200ms, ease-in), remaining rows settle up (~200ms); at commitment, the future haptic/sound vocabulary attaches here (Visual DNA §26–27). Arrival of *new* held work during the day: it is simply present on next glance — held work never announces itself in motion (it is an envelope on a desk, not a hand waving).

**What remains still.** Everything at rest. The held state does not pulse, glow, or breathe. Its tension is compositional, not animated.

**Spacing.** 8 between rows; 12 vertical / 16 horizontal padding within (professional density — Visual DNA §4).

**Empty state.** The component does not render. No "no items — great job! 🎉" (Visual DNA §14). Absence of envelopes is the desk, clear.

**Loaded state.** Rows ordered by consequence (most significant judgment first), not by arrival time. The list is short by design: within the agreement's boundaries work completes without holding, so this list asymptotically approaches the exceptional (Architecture §13).

**AI behavior.** Every sentence names its subject and its consequence plainly — the row alone must be judgeable in the common case; opening the door is for verification, not comprehension. What crosses a boundary is held; what doesn't, isn't; the boundary is never blurred for engagement's sake.

---

## Component 4 — The Reply Line

**What it is.** At the letter's end, after 64px: a single quiet line — the Ask field at rest. One hairline-bordered field, radius 8, canvas-toned, one placeholder in voice (three words or fewer). 16px input. Focus brings the full command surface to it (Architecture: Ask, ambient); ⌘K summons the same surface from anywhere, so this is not Ask's *location* — it is Ask's *courtesy appearance* on the home page, the way the home button lived on the iPhone's face.

**Why it exists.** A briefing from an aide ends with the aide waiting. A letter invites a reply. Day one, this field is nearly the entire product (Architecture §6); year one, it is the standing evidence that the talking is the operating. Deleting it was attempted in Pass 3 and refused — its removal broke the day-one collapse *and* the letter metaphor's closing line. It is the one element restored with full conviction.

**Why nothing sits beside it.** No suggestion chips ("Try asking…") — the brief above *is* the context; prompts would be the product performing its own capability (Manifesto §5: never chatty). No microphone/attachment buttonry at rest — the field accepts whatever arrives (drag, paste, speech per platform); affordances surface on focus, not before.

**Animation.** Focus transition ≤140ms. At rest: perfectly still. The cursor breathes only once engaged (the texture of thought belongs to conversation, not to an idle field).

**Empty / loaded.** Identical — the reply line does not change with the day's contents. It is the one constant of the page.

**AI behavior.** Receives anything: question, instruction, correction, file. Responds in place (the conversation unfolds from the field, on Today, without navigation) or routes to the record it concerns — whichever serves the intent; the user never pre-decides "where" a thought goes (Manifesto §2: users don't carry context).

---

## Reduction

**Inventory before deletion (10):** greeting · date · section headers (×2) · brief · KPI strip (proposed in sketch, included here for honesty) · one-question card · held rows with Open + verb + count badge · presence indicator ("Voltx is working…") · reply line with suggestion chips.

**Pass 1 — delete 30%.** Removed: **greeting** (performed intimacy; the voice carries warmth), **both section headers** (composition self-evidences; headers are the crutch of layouts that failed to speak), **KPI strip** (numbers without questions are wallpaper; answers live one Ask away — Architecture §4), **presence indicator** (silence is the signal; ambient "working…" is anxiety rendered in pixels — the ledger in Promises holds the truth for whoever seeks it), **count badge** (a number beside a visible list is a badge, and badges are banned — Visual DNA §17).
*Check for loss:* none. Nothing restored.

**Pass 2 — delete again.** Removed: **the one-question card** — merged into the brief as its final paragraph (a separate card made the question a widget; in the brief it is a sentence from an aide, which is what it was). Removed: **held-work card anatomy** — demoted from cards (identity line + essence + action bar) to single-sentence rows; the card claimed more objecthood than a held sentence needs. Removed: **suggestion chips** on the reply line.
*Check for loss:* question response affordances survived (inline actions); held-work inspectability survived (row as door). Nothing restored.

**Pass 3 — delete to the bone.** Attempted: **the date** — refused; without it, Today is a feed, and the daily-completion contract loses its printed proof. Attempted: **the reply line** — refused; it breaks day one and the letter's grammar (restored with conviction — see Component 4). Attempted and kept: **the "Open" button on held rows** — successfully deleted; the row itself is the door, one verb remains.
*Result:* four elements. A further pass finds each defended by an immutable document. **The reduction stops from proof, not fatigue.**

**Final composition:** the date · the brief (question included) · the held sentences (one verb each) · the reply line.

A letter: dateline, body, enclosures, and a place to write back.

---

## "If Jony Ive asked why every pixel exists, could you answer every one?"

Walk it:

- **The dateline** — because a briefing that isn't dated is a feed, and this product swore an enemy of feeds. It is the printed proof that Today completes.
- **Every sentence of the brief** — because the manifesto's deepest promise is that the company comes to the owner as language, in one voice; each sentence is there because the system judged it worth attention, and each carries its receipt one gesture beneath.
- **The hairline around each held row** — because it is the visual boundary between *prepared* and *released* — the single line on which all delegation trust rests. It is the most meaningful border in the product; it is also nearly the only one on the page.
- **The one verb per row** — because judgment is the owner's job and the verb is its exact size: consequence, named plainly, one tap.
- **The accent on that verb and on a recommended answer** — because the Volt means intent, spent nowhere else on this page, which is why it can mean it.
- **The reply line** — because the entire product is the conversation, and a letter ends by inviting one.
- **The space** — the 48s and 64s — because calm is the luxury (the manifesto's own words), and this page is where calm is delivered daily or not at all.

Yes — every pixel answers. The screen contains four things, three of which are made of type, and the fourth is a place to type. Nothing further can be removed without breaking a promise made in the immutable documents: remove the date and Today becomes a feed; remove the brief and the work stops coming to the owner; remove the held rows and trust has no engine; remove the reply line and the product loses its voice on its own home page.

The control room is gone. What remains is what a morning with a great chief of staff has always been:

**A date. A briefing. The things needing a signature. And "what would you like me to do?"**
