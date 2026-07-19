# The Record Page
## The Canonical Second Screen

**Status:** Canonical screen specification. Governed by the seven documents: [Manifesto](../PRODUCT_EXPERIENCE_MANIFESTO.md) · [First Day](../NORTH_STAR_EXPERIENCE.md) · [One-Year Story](../ONE_YEAR_STORY.md) · [Visual DNA](../VISUAL_DNA.md) · [Architecture](../PRODUCT_ARCHITECTURE.md) · [TODAY.md](TODAY.md) · [TODAY_SPEC.md](TODAY_SPEC.md). Every entity in Voltx — customer, supplier, employee, deal, project, machine, document — opens into this one page anatomy. There is no "customer page" versus "deal page"; there is *the record*, wearing different facts.

This document preserves its own deletion passes (§Reduction), the paper test, and the teaching test.

---

## The Governing Insight

Every record page in the history of business software is a filing cabinet wearing a screen: a form of fields at the top, tabs of modules below, and the truth scattered across all of them. The form answers "what did someone once type?" — never "what do we know?"

The Architecture already gave the answer: *every record is a door, and every door opens onto its own conversation.* The One-Year Story gave the texture: records that "grow denser with self-recorded history," a file where *"the summary she would have asked for is already the first thing she sees."*

So the design position:

**A record is a dossier kept by someone who never sleeps — a written understanding, a fact sheet in the margin, a chronology, and a place to talk. The page does not display the record. The page *is* the record, and the record is alive.**

One page answers one question — *what do we know about this?* — in the order a great chief of staff would answer it: here is what it means, here are the specifics, here is what's ahead and what happened, and I'm listening.

---

## The Composition

Same geometry as Today — the 680px reading column on the warm canvas, inside the stable frame. One geometry across the product is how the product stays learnable without being taught. Top to bottom, after reduction, **five elements**:

1. **The identity** — name and one honest line
2. **The understanding** — prose: what this record means, kept current
3. **The facts** — the structured spine, in the margin
4. **The timeline** — what's ahead, then what happened
5. **The reply line** — the same field as Today, now about *this*

At ≥1280, the facts sit as a quiet margin column to the right of the understanding (240 wide, 32 gap — margin notes in a well-made book). Below 1280 and on mobile, they become a block between understanding and timeline. Everything else is the single column.

Vertical rhythm: 64 top → identity → 24 → understanding (16 between paragraphs) → 48 → timeline (16 between entries, 32 between month groups) → 64 → reply line. All from the fixed scale.

---

## 1 · Layout

One column, one focal object (Visual DNA §2): the understanding. The facts margin is the only secondary surface, and it is deferential — smaller type, tertiary labels, no border, no background. No tabs (depth unfolds inline, in place). No cards (nothing here is a manipulable object except held work, which keeps its one product-wide treatment when it appears in the timeline's "ahead" segment). No toolbar (actions are sentences; the page has no buttons above the fold except the verbs the content itself carries).

The page scrolls as one document. Position in the scroll *is* position in time: meaning at the top, specifics beside it, the future just below, the past descending, and the conversation always at hand.

## 2 · Typography

- **Name:** 20/28, weight 600, ink, letter-spacing −0.01em. The largest type in the product (Visual DNA scale ends at 30; records don't shout).
- **The one line:** 14/20, 400, ink-2 — what this is, in voice ("Boutique hotel in Victoria Island — customer for three years").
- **Understanding:** 16/24, 400, ink — identical to Today's brief. Doors at 500. Same receipt affordance on hover.
- **Facts:** labels 12/16, 400, ink-3; values 14/20, 400, ink, `tabular-nums`; monospace for identifiers (Visual DNA §5).
- **Timeline:** entries 14/20, 400, ink; dates 13/16, 400, ink-3, tabular, right-set in a fixed 88px gutter so months scan like a ledger; month labels 12/16, 500, ink-3.
- **Reply line:** identical to Today's spec, placeholder in context ("Ask about Hotel Marlin" — ≤4 words).

## 3 · Record Identity

The identity is text, not chrome: the name, and beneath it one line that says what this thing *is and where it stands* — written by Voltx, current, and honest ("Supplier since 2019 — two open orders, one overdue"). No avatar, no logo, no status pill, no badge row. State is a *sentence*, because a sentence can carry nuance a pill cannot, and because pills breed (Reduction, pass 1). If the state is genuinely semantic — something overdue, something failing — the sentence carries the semantic color on the few words that earn it, paired with plain language (Visual DNA §9: never color alone).

## 4 · The Timeline

One merged chronology of everything real: messages, orders, payments, repairs, notes, conversations, imported history — each entry **one sentence in the product's voice**, with its date in the gutter and its receipt one hover away. No icons per entry type (deleted — pass 2: eleven tiny icons made the history a rebus; the sentence already says what kind of thing it was). No per-source styling (a call and an email and an invoice are all just *things that happened*).

**The timeline begins with what's ahead.** Two or three future items at most — the scheduled visit, the promised follow-up — set identically to history but dated forward; when something ahead requires judgment, it appears as the one held-work row treatment from TODAY_SPEC §3.3, verb and all. Then the past, newest first, grouped by month after the first dozen entries. Old history compresses: months collapse to a single summarizing line ("March — four orders, one repair, nothing unusual") that unfolds in place when wanted. Progressive disclosure without tabs.

## 5 · The AI Conversation

There is no chat panel. **The page is the conversation.** The reply line at the bottom accepts anything about this record — a question, an instruction, a correction, a file. The answer streams in directly above the field, in the brief's typography, sourced and receipted; when the exchange concludes, it takes its place in the timeline as history — because a decision made about this record *is* part of this record. Ask "what did they buy last year, and at what discount?" and the answer arrives with footnotes (North Star §7), then becomes a timeline entry that the next person can find.

This is the radical claim made physical: conversation is not attached to the record. Conversation is how the record *grows*.

## 6 · Knowledge

There is no documents section (deleted — pass 1). What the company knows about this record lives in three truer places: facts extracted from documents appear **in the facts margin**, carrying receipts that open the source; documents' arrivals are **timeline entries** ("Their new price list arrived — four items changed"); and the full source material is always one question away through the reply line. A file dropped anywhere on the page attaches to this record and is read — the drop zone is the page itself.

## 7 · Relationships

There is no relationships panel (deleted — pass 1). Relationships are **doors in prose**: the understanding names the people and things that matter ("Procurement is run by *Tunde Okafor*; both machines are *Linea Minis* under service contract") and every name is a door to its own record. The connection graph the company truly has is expressed the way humans express it — in sentences — and traversed the way the product traverses everything: by opening doors. A dedicated "related records" grid is a database confessing it cannot write.

## 8 · Recent Promises

There is no promises section (deleted — pass 2). Standing instructions touching this record surface in exactly two honest places: commitments with a *date* are the timeline's "ahead" entries; the standing rules themselves are one sentence in the understanding when they matter ("Their invoices are sent on the 1st and chased after fourteen days" — the sentence is a door into Promises). Accountability lives in Promises; the record shows its consequences.

## 9 · Provenance

Identical to Today, universal here: every fact value, every sentence of understanding, every timeline entry carries the receipt affordance — hidden at rest, revealed on hover/focus, one gesture to the drawer showing source, judgment, and undo path. On this page provenance has one extra duty: **facts show their freshness** in the receipt ("from their March price list · confirmed 12 days ago"), because a record's trustworthiness is temporal. Nothing on the page distinguishes "AI-written" from "human-entered" at rest — the drawer holds authorship; the page holds truth.

## 10 · Editing

There is no edit mode, no Edit button, no form. Two paths, both in place:

- **Touch the fact.** Click any fact value → it becomes an input (120ms), saves on blur or Enter, records authorship in its receipt, offers undo. Escape abandons. The label never moves; the page never reflows.
- **Say it.** Tell the reply line "their new address is…" — the fact updates, the change becomes a timeline entry, the receipt says who and when.

The understanding itself is not directly editable — it is *corrected*, by sentence ("that's wrong — Tunde left in June"), and visibly rewritten in response (the one place streaming text appears outside an answer). You do not edit a colleague's understanding with a cursor; you tell them, and they revise it. That distinction is the page's soul.

## 11 · Search Within the Record

There is no search box on the record (deleted — pass 1). Asking *is* searching: the reply line answers "when did we last raise their prices?" better than any filter row, with receipts. ⌘F remains the browser's, untouched, for finding text on the visible page — we never steal reflexes. For long histories, the collapsed months unfold on demand; the reply line summarizes what unfolding would take too long to scan.

## 12 · Empty State

A record just created or barely known: the understanding is **one honest sentence** — what is known, and what would help ("All I know so far: a café in Surulere, mentioned in Tuesday's inquiry. Tell me about them, or drop anything you have."). Facts show only what is true (empty facts do not render as "—" farms; an unknown fact is absent, not displayed as absence). Timeline shows its one birth entry. The page is short, honest, and already listening. No illustration, no "get started" checklist (Visual DNA §14).

## 13 · First-Day State

The North Star's import (§7) means first-day records are **born already alive**: the understanding is written from the imported spreadsheet, the connected inbox, the dropped folder; the timeline is backfilled with the history those sources contained; facts carry receipts into the original documents. A user who opens their first record and finds their own company's past — organized, written, sourced — has just met the product's deepest magic with zero onboarding. The first-day record differs from the one-year record only in depth, never in anatomy.

## 14 · One-Year State

Denser, calmer, same five elements: the understanding a paragraph richer (patterns, standing arrangements, the relationship's texture); the facts fuller; the timeline long — months compressed to their single lines, the rare unusual event left unfolded because unusual is what history is for. Nothing new appears after a year. The page ages like the company's memory it is.

## 15 · Mobile Adaptation

The one column survives intact — this page was always a document, and documents are the native format of phones. Facts margin becomes a block after the understanding, collapsed to the four most consequential values with the rest unfolding on tap. The reply line pins above the tab bar (TODAY_SPEC §6). Timeline gutter dates move above their entries (13/16, ink-3). Touch targets per platform floor. The identity condenses to name-only in a quiet top bar on scroll, so context survives depth. Approving a held "ahead" row is one thumb — mobile is the judgment surface (Visual DNA §24).

## 16 · Motion

Arrivals are **set, not streamed** — a record visited daily must open like a file, instantly whole (streaming on open would perform intelligence the page should simply have; Today's brief streams because it is *news*, a record is *reference*). Motion appears in exactly four places: the shared-element continuity of opening the record from wherever it was named (the row becomes the page — Visual DNA §12); answers streaming above the reply line; the understanding visibly rewriting when corrected; and the standard 100/120/200ms vocabulary for hover, focus, inline edit, and held-row resolve. Months unfold in 200ms with no bounce. Nothing else moves. Reduced motion: crossfades, zero information loss.

## 17 · Accessibility

The page is a document, so it is structured as one: the name is the page's single `h1`; understanding, facts, timeline, and reply line are landmarked regions with visually-hidden labels (visual design earns the absence of headings; assistive tech does not pay for that aesthetic). Facts are a definition list; the timeline is a list with dates programmatically bound to entries; the streaming answer announces as one coherent utterance, not fragments (Visual DNA §25); every hover affordance (receipts, verbs) has an identical focus path; inline edit is fully keyboard operable (Enter to edit, Escape to abandon); contrast and target floors per the constitution. AA is the floor, AAA the target for the understanding and timeline — the text people read all day.

---

## Reduction

**Inventory before deletion (13):** identity block with avatar + status pills · action toolbar · understanding · facts panel · relationships section · documents/knowledge section · promises section · timeline with type icons · activity filters · record search box · chat panel · reply line · "view all" links.

**Pass one — delete 30%.** Removed: **avatar/logo** (a photograph is the loudest element on any screen — TODAY_SPEC §7 already ruled), **status pills** (state is a sentence; pills breed and then lie), **action toolbar** (actions are sentences or verbs on content; a toolbar is a menu wearing importance), **record search box** (asking is searching), **documents section** (knowledge lives in facts, timeline, and the drawer — a file list is storage showing its plumbing), **"view all" links** (unfolding happens in place).
*Check:* nothing restored.

**Pass two — delete 20%.** Removed: **relationships section** (relationships are doors in prose — §7), **promises section** (consequences in the timeline's "ahead," rules as one sentence in the understanding — §8), **timeline type icons** (eleven glyphs made history a rebus; sentences already carry their kind), **activity filters** (a filter row is a form asking the user to do the librarian's job; the reply line is the librarian), **chat panel** (the page is the conversation; a panel would make the record and its intelligence roommates instead of one thing).
*Check:* nothing restored.

**Pass three — continue deleting.** Attempted: **the facts margin** — *refused.* Prose cannot carry a phone number, a bank detail, a serial number: structured truth must be scannable, copyable, tabular. The margin stays, as the page's quietest citizen. Attempted: **the one line under the name** — *refused*; without it the identity is a label, not an understanding; it is the page's thesis sentence. Attempted: **the "ahead" segment** — *refused*; a record that only remembers is an obituary. Attempted: **month compression lines** — survived deletion of their decoration, kept as plain unfoldable sentences. Attempted: **the reply line** — refused on the same grounds as Today; it is the page's claim made physical.

**Stopped:** removing any remaining element damages the answer to "what do we know about this?" Five elements hold.

---

## The Paper Test

*"If this page were printed on paper, would it still make sense?"*

Print it: a name; one line of standing; a written briefing; a fact sheet in the margin; a dated chronology, future first. **That is a dossier — a form that predates software by two centuries and has never needed a tutorial.** Every element survives printing except one: the reply line — and that is precisely the point. The reply line is the single thing paper never had; it is the exact width of Voltx's contribution to a very old, very proven document. A page whose only non-printable element is *the living part* has drawn the line between record and intelligence exactly where the philosophy says it belongs.

Yes — it makes sense on paper. No redesign required.

## The Teaching Test

*"Does this page teach the user what Voltx is without needing onboarding?"*

Open any record cold and the page demonstrates, without a single tooltip, every load-bearing idea in the governing documents: **records write themselves** (the understanding exists and nobody typed it); **everything is traceable** (touch any sentence — the receipt is there); **nothing is a form** (touch a fact — it yields; there is no Edit button to find); **the past is kept and the future is held** (the timeline runs both directions); **talking is operating** (the reply line answers about *this*, and the answer joins the record); and **the same page everywhere** (the next record — a machine, a deal, an employee — is this page again, wearing different facts).

A user who has seen Today and one record has seen the entire product's grammar. The third place, Promises, is only these same sentences — receipts, held rows, standing instructions — gathered under their own roof.

Yes — the page is the onboarding. No restart required.
