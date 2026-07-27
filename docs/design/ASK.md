# Ask

The interface between the human and the company.

Governed by the Product Experience Manifesto, the North Star Experience, the One-Year Story, the Visual DNA, and the Product Architecture. Visual companion: the "Voltx — Ask" design artifact. The Today screen (docs/design/screens/TODAY_SPEC.md) is frozen and is the reference implementation of every component Ask uses.

---

## 1 · Philosophy

**What Ask is.** Ask is how the owner addresses their company. It is the reply line on Today, generalized to everywhere: one line that accepts a need in the owner's own words and returns either an answer, a place, or prepared work. Ask is a layer, not a destination — the same five components the letter is made of (prose, doors, answers, held work, the reply line), assembled on demand.

**What Ask is not.** Ask is not a chatbot: it has no persona, no small talk, no name it calls itself in conversation. It is not a page: there is no Ask tab, and no navigation item ever lights up for it. It is not an assistant: nothing is branded, nothing sparkles, nothing introduces itself. It is not a search engine: it acts on the company, it does not merely retrieve from it. And it is not a mode — there is nothing to switch into.

**When Ask appears.** When the owner starts typing, anywhere — the first printable keystroke raises the line. When summoned deliberately with ⌘K. And when the company has a question for the owner: the question inside the morning brief is Ask speaking first.

**When Ask disappears.** The moment intent is resolved. An answer read, a door taken, work held — then it is done. Esc always sets it down. Ask never lingers, never follows the owner to the next screen, never badges, and never volunteers "I can help with that."

**Why it exists.** A small-business owner has no chief of staff; software gave them filing cabinets instead. Ask exists so that the owner's relationship with the company is conversational at the surface and inspectable underneath. The success criterion is linguistic: the owner stops saying "let's ask the AI" and simply begins typing.

---

## 2 · Presence

Five states, all of them variations of the one reply line. No new chrome in any state.

| State | Treatment |
|---|---|
| **Idle** | On Today, the line as designed: hairline field, "Ask anything", the ⌘K hint in hint tone. On every other screen the line has no standing presence — the first keystroke or ⌘K materializes it at the foot of the content column, in Today's exact geometry. Absence is the idle state; Today teaches the line's existence every morning. |
| **Listening** | The designed focus: Volt border, raised surface, soft halo, breathing caret. Nothing else — no suggestion popups, no ghost completions. |
| **Thinking** | The owner's words leave the field and are set into the document above it as a line of the record. If the answer takes longer than 600 ms, one line in hint tone appears where the answer will begin, naming the actual work: "Reading service invoices…" It is replaced in place. No spinner, ever. |
| **Answering** | The answer streams in as typeset prose beneath the owner's line — sentence by sentence, each settling with the standard 150 ms fade, at reading pace. The layout never shifts; the column was always the answer's home. |
| **Waiting** | When Ask needs the owner — a clarification, a decision, prepared work — it uses Today's existing shapes: a question sentence with answers inline, or a held row with one verb. Waiting looks like the morning brief because it is the same grammar. |

---

## 3 · Conversation principles

The register is a trusted chief of staff: plain declarative sentences, no exclamation marks, no emoji, no praise of the question, no reference to being an AI, no apology theater. First person singular is permitted and already established by Today's error voice ("I'll try again the moment the connection returns").

1. **Conclusion first.** The first sentence answers the question. Everything after it is optional reading.
2. **Explain only when it changes a decision.** Reasoning appears when the owner would decide differently knowing it; otherwise it waits behind a door.
3. **Evidence is doors.** Every material figure and claim links to its record. A number the owner cannot open is a number Ask may not state as fact.
4. **Uncertainty is spoken, not styled.** "Likely", "usually", "I estimate" — hedges live in the words, and every inference names its basis.
5. **Next actions arrive naturally, and at most one is pushed.** A recommendation may be offered as answer buttons or a held row. Ask never chains "Would you also like…?" follow-ups.
6. **The default answer fits without scrolling.** Roughly six lines of the 600 px measure; depth is reached through doors, not length.
7. **The conversation is a document.** Dated like the letter, scrollable like a record, with the owner's words set as lines of the transcript — never bubbles, never avatars.

---

## 4 · Commands — one line, no modes

The same line supports asking, searching, navigating, creating, approving, comparing, explaining, and summarizing. The owner never chooses a mode; intent is inferred, and the *shape of the response* is how Ask shows its reading:

| Owner types | Inferred intent | Response shape |
|---|---|---|
| "can I afford a second technician" | question | answer document |
| "marlin" | retrieval / navigation | the door itself — one line, opens on Enter |
| "invoices from March" | retrieval | a ruled list of doors |
| "quote for Café Asha, six machines" | creation | one confirming sentence + a held row |
| "send it" | approval | the held row signs; the verb reports Sent |
| "this month vs last March" | comparison | answer document, conclusion first |
| "why is the margin down" | explanation | answer document with evidence doors |
| "summarize the week for Chidi" | summarization | a held document, ready to send — never sent unbidden |

Two rules make inference safe:

- **When acting and answering are both plausible, Ask answers and holds the action.** Answering is free; acting is held. A wrong answer costs a correction, a wrong action costs trust.
- **Inference never executes.** Creation produces held work; only explicit approval — "send it", ⌘Enter, the verb — signs it. This is Today's signature (Enter reads, ⌘Enter signs) extended to language.

Ambiguity is handled by answering the likely reading, naming it, and offering the other: "Two Marlins exist — I've assumed the hotel. [The café]".

---

## 5 · Context model

The owner never repeats context. Ask assembles it in layers, cheapest first, and every layer maps to something the platform already has:

| Layer | Contents | Source of truth |
|---|---|---|
| 1 · Session | organization, user, role, permissions, locale, today's date | `TenantContextService` (AsyncLocalStorage), RBAC membership |
| 2 · Place | current screen, current route, the record on screen (e.g. Hotel Marlin's page) | client route state, sent with every turn |
| 3 · Selection | the held document or text the owner has in hand | client selection state |
| 4 · Thread | earlier turns of this conversation | `conversations/` module |
| 5 · Memory | durable facts and preferences captured across conversations | `memory/` scorer + selector |

**Pronoun resolution** walks the layers in order: "them" means the record on screen before it means anyone in the thread, and the thread before memory. When resolution is not certain, Ask names its referent in the answer — "Dele Provisions — assuming you mean the reorder question —" — so a wrong guess is visible and cheap to correct.

**Permissions are a floor, not a filter on phrasing.** Retrieval runs as the user: the tenant-scoped Prisma extension and RBAC checks bound what Ask can see before the model sees anything. A denial is explained by role, never by describing what the hidden data contains.

---

## 6 · Trust model

Every answer distinguishes three registers, and the distinction is carried by the systems the owner already knows — words and color — never by badges or icons:

| Register | Meaning | Treatment | Rule |
|---|---|---|---|
| **Known** | read from the company's records | plain ink prose; every material figure is a door to its record | a claim with no reachable source may not be set as known |
| **Inferred** | computed or estimated by Ask | hedged in words ("likely", "I estimate"), and the basis is always named ("based on the last six reorders") | an inferred figure never sits unhedged inside a known sentence |
| **Recommended** | Ask's judgment about what to do | the Volt register — the recommended answer button, the held verb; also always positionally first | Volt appears in an answer only here; recommendations are never phrased as facts |

This makes the trust model and the color system the same system: ink is knowledge, hedged words are inference, Volt is judgment. Remove all color and the registers survive — hedges are words, recommendations are first.

---

## 7 · Interaction specification

- **Typing is immediate.** Keystroke echo is local and instant; the line never waits on the network to accept text.
- **Submit to first words: under 800 ms target.** Past 600 ms, the doing-line ("Reading service invoices…") names the actual work, replaced in place.
- **Streaming is calm.** Sentences arrive whole, settle with the 150 ms fade, at reading pace. No token jitter, no mid-word reflow, no layout shift — the column is reserved.
- **Interruption is graceful.** Typing during an answer pauses the stream instantly; completed sentences remain. Esc stops generation and keeps what arrived, closed with "— stopped here." The line is never locked.
- **The owner stays in control.** Nothing executes from inference; everything consequential is held work signed explicitly. Esc always descends: stop the stream, then set down the line, then return to the screen beneath. A draft in the line is always kept.
- **Ask opens in place.** The conversation document uses the current column's geometry (Today's 600 px measure); the screen beneath remains, and Esc returns to it exactly as it was.

---

## 8 · Failure specification

Today's error grammar — what happened, what remains safe, what happens next — extended to reasoning:

- **Missing data.** "I can't answer that completely — Voltx has no carrier invoices. What I can see: ₦140,000 of freight inside supplier invoices. If you forward Chidi's carrier statements, I'll carry shipping as its own line from now on." Why, what's missing, next best action.
- **Ambiguity.** Answer the likely reading, name the assumption, offer the alternative as an answer button.
- **Permission.** "That's outside what your role can see. Adaeze can open it to you." Nothing about the content is leaked.
- **Connection and timeouts.** Today's error voice, verbatim grammar. The verb or line returns to an actionable state immediately.
- **Hallucination is prevented structurally, not stylistically.** The model narrates records; it does not recall them. Every figure in a "known" sentence must originate from a tool result in the current turn's context, and the renderer will only bind a door to a record id returned by a tool. A claim the pipeline cannot ground is either re-registered as inference (hedged, basis named) or replaced by the missing-data grammar. A dangling door is a build failure, not a style problem.

---

## 9 · Prompt architecture

Ask runs on the existing AI module (`backend/src/modules/ai/`). No new runtime is invented; Ask is an agent configuration plus a rendering contract.

**Assembly order** (each block cacheable in this order, most stable first):

1. **Constitution** — Ask's voice and rules: the conversation principles (§3), the trust registers (§6), the failure grammar (§8), and the acting-vs-answering rule (§4). Static per release.
2. **Organization profile** — name, currency, locale, fiscal facts. From the tenant record; stable per org.
3. **Memory selection** — durable facts chosen by `memory.scorer` / `memory.selector` for relevance to this turn.
4. **Place and selection frames** — current screen, record on screen, held document in hand. Small, per-turn.
5. **Thread** — this conversation's turns, from `conversations/`.
6. **Tools** — the registry (`tools/tool.registry.ts`) filtered to the agent's `allowedToolNames` ∩ the user's RBAC permissions. Retrieval tools run tenant-scoped by construction (the Prisma tenant extension).
7. **Response contract** — the structured output rules: conclusion first; registers marked; every known figure paired with a source record id; actions emitted only as held-work envelopes (a structured proposal the platform renders as a ledger row), never as direct execution.
8. **The owner's line.**

**Execution** is one `AgentExecutor` turn: tools resolve retrieval, the stream (`AIStreamEvent`) is re-chunked to sentence granularity by the client, and held-work envelopes are persisted as held documents — signed later through the same path as any held work, with the same permission checks (`ai.agent.run` to converse; the action's own permission key to sign).

---

## 10 · Example conversations

**Known + inferred + recommended, in one answer.**

> **Can I afford to hire a full-time technician?**
>
> Yes — carefully. The company has effectively carried a technician's wage for five months.
>
> [Service revenue] has averaged ₦840,000 monthly since October, and [installations] are booked six weeks out. A full-time technician at market rate costs about ₦450,000 monthly with statutory contributions.
>
> If installations hold at this pace — they usually slow in June, based on the last two years — the position pays for itself by the fourth month.
>
> **[Draft a job description]** [Show me the numbers] [Not now]

Bracketed mid-sentence terms are doors; the bold first button is the Volt recommendation.

**Creation without a mode.**

> **quote for Café Asha, six machines, same terms as their last order**
>
> Drafted from the January quote, with current prices.
>
> ─ Quote for Café Asha — six machines, standard training included · **Send**

**Approval by pronoun.**

> **send it**
>
> ─ Quote for Café Asha — six machines, standard training included · Sent

"It" resolved from the thread; the row signs through the normal held-work path.

**Failure, honestly.**

> **what did we spend on shipping last quarter?**
>
> I can't answer that completely — Voltx has no carrier invoices.
>
> What I can see: [₦140,000] of freight charged inside supplier invoices between January and March. Actual spend is higher by whatever went through the carrier accounts directly.
>
> If you forward Chidi's carrier statements, I'll carry shipping as its own line from now on.
>
> **[I'll forward them]** [Estimate it anyway]

---

## 11 · Remaining risks before implementation

1. **Intent inference is the product.** A wrong reading of "send it" is catastrophic to trust even when technically recoverable; the acting-vs-answering rule needs adversarial test suites before any real verb is wired.
2. **Sentence-granularity streaming** needs real latency measurement — re-chunking a token stream to sentences trades first-paint speed for calm, and the 800 ms budget may not survive provider latencies.
3. **Grounding enforcement is a pipeline, not a prompt.** The "every known figure carries a record id" contract requires structured output validation and a renderer that refuses dangling doors; prompt-only compliance will decay.
4. **Type-anywhere across the whole product** multiplies the IME/modifier/focus edge cases from the Today spec by every screen; it needs one shared capture implementation, not per-screen wiring.
5. **Memory shapes voice over time** — what the selector chooses to remember will drift Ask's answers; memory needs an inspection surface (the owner must be able to see and correct what the company believes) before it silently steers recommendations.
6. **Permission-shaped answers need review** — explaining denials by role without leaking existence is subtle when the question itself implies the data ("what is Chidi's salary").
7. **Cost and cadence** — conclusion-first answers with tool retrieval on every turn have a token profile that must be measured against realistic owner usage before defaults (model choice per turn, via the model registry) are set.
