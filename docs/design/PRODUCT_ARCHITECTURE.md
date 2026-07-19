# The Product Architecture of Voltx
## The Shape of the Whole Application

**Status:** Canonical. Subordinate to the [Product Experience Manifesto](PRODUCT_EXPERIENCE_MANIFESTO.md), [The First Day](NORTH_STAR_EXPERIENCE.md), [The One-Year Story](ONE_YEAR_STORY.md), and the [Visual DNA](VISUAL_DNA.md), which are immutable. This document defines what the application *is* — its places, their contents, and their boundaries — before any screen is drawn. Every future screen must locate itself inside this architecture. If it cannot, either the screen is wrong or this document is amended in writing.

This document deliberately shows its own reduction process (§17–19), because the final answer is only trustworthy if the removals are visible.

---

## 1. The Five Major Areas

We began, as every team does, by drawing five:

1. **Today** — what matters now. The brief, the held work, the one question.
2. **Ask** — the conversation with Voltx, and the history of those conversations.
3. **Company** — the living record: everyone the company touches, everything it sells and services, everything it knows.
4. **Promises** — every standing instruction Voltx keeps, everything it has done, and the boundaries it operates within.
5. **Team** — the people inside the company, their scopes, their invitations.

Hold that list loosely. It does not survive this document intact — see §18.

## 2. Why Only Five

Because the manifesto commands it: *few places, deeply understood, countable on one hand* — and because a business, honestly examined, has only a small number of irreducible questions:

- *What needs me now?* → Today
- *What do I want?* → Ask
- *What is true about my business?* → Company
- *What is being done on my behalf, and under what authority?* → Promises
- *Who works here?* → Team

Every SaaS sidebar with thirty items is answering these same five questions thirty ways. The thirty items are not thirty needs; they are one taxonomy failure, compounding. We refuse the failure at the root: **a place must map to a question the owner actually carries in their head.** Nobody wakes up thinking "I need to visit my integrations." They think *what needs me, what's true, what's being handled, what do I want* — and the architecture is exactly those thoughts, made spatial.

## 3. What Lives Inside Each

**Today** holds three things and refuses a fourth: the **brief** (a few sentences in one voice — what happened, what's handled, what's ahead); the **held work** (everything Voltx has prepared and is politely waiting to release — drafts, resolutions, suggestions, each one tap from done); and, at most, **one question** — the single thing genuinely requiring the owner's judgment today. Today is not a feed. It does not scroll into history. It is finished the way a good morning briefing is finished: quickly.

**Ask** holds the conversation — the live thread of intent and response — and the record of past conversations, because thought that produced decisions is part of the company's memory. (Whether Ask is truly a *place* is questioned in §18.)

**Company** holds the nouns — the single source of truth the One-Year Story promised ("there is no version, there is only the truth"):
- **People** — customers, contacts, suppliers, *and teammates*. Everyone the company touches, inside and out, each a living record that assembles itself from the real work.
- **Sales** — leads, opportunities, the pipeline; the deals in motion.
- **Work** — orders, service, repairs; the promises to customers being physically kept. (Domain modules dock here as the company grows — this is the extensible seam, invisible as a seam.)
- **Knowledge** — everything the company has taught Voltx and everything Voltx has read: documents, price lists, policies. Not a file manager — a library with a librarian.

Every record in Company is a door: open it and the record *is* the conversation about it — its history, its state, and the intent field, in one continuous surface.

**Promises** is the trust architecture made visible, and it is the most original place in the product:
- **Standing instructions** — every workflow, stated as the sentences that created them ("New inquiries get a reply within the hour…"). No canvas, no nodes. Reading this list *is* reading the company's automated operations.
- **The ledger** — everything Voltx has done, is doing, and will do next: every action with its provenance, the drawer from the One-Year Story, open by default here and one gesture away everywhere else.
- **The agreement** — the boundaries: what Voltx may do freely, what it must hold for approval, what it may never do. The working contract from the First Day, §4 — living here, readable in one minute, amendable in a sentence.

**Team** held invitations, scopes, and roles. It is dissolved in §18 — its contents belong to People (teammates are people of the company) and to the agreement in Promises (scopes are boundaries).

## 4. What Never Appears in Primary Navigation

- **Settings.** There is no settings *place*. Preferences are sentences said to Voltx or small controls living exactly where their effect is felt. A settings labyrinth is the graveyard where failed defaults are buried; we fix defaults instead.
- **Integrations.** Connections appear when named in conversation, live as quiet cards inside Knowledge, and are otherwise invisible. A wall of logos is a catalog, not a place in someone's company.
- **Reports / Analytics.** Reports are *answers*, and answers belong to questions. Any number the owner wants is one Ask away, with provenance. A "reports section" is a monument to questions nobody is currently asking.
- **AI.** Voltx never has an "AI tab." Intelligence is the medium of the whole product, not a district of it. An AI section would be a confession that the rest is dumb.
- **Notifications.** There is no bell, no center, no unread museum. What needs attention is *in Today*; everything else was never worth interrupting for.
- **Admin / Billing / Help.** Rare-by-design surfaces, reached through Ask or the quiet corner (§16), never spending primary chrome.

**The law beneath the list:** primary navigation is spent only on questions the owner carries daily. Everything else is reachable by intent, findable in one keystroke, and invisible until wanted.

## 5. Hidden Until Needed

- **Permission editing** — materializes inside the act of inviting someone, as sentences; otherwise lives folded into the agreement.
- **Connection management** — appears when a tool is mentioned or fails; otherwise a quiet card in Knowledge.
- **Import/export** — summoned by intent ("get me a spreadsheet of…", a file dragged anywhere); never chrome.
- **The provenance drawer** — behind every AI-produced claim and action, everywhere, one gesture; visible chrome nowhere.
- **Bulk operations** — expressed through Ask ("archive everyone who hasn't ordered since 2024"), confirmed by consequence; never a toolbar of dangerous buttons.
- **Deep record detail** — every record leads with its living summary; the full ledger of fields and history unfolds on request (progressive disclosure law, Manifesto §6).
- **Theme, density, accessibility preferences** — one quiet corner, remembered forever, never promoted.

## 6. The First Screen

**Today — which, on the first morning, is almost empty and almost silent.** One greeting, one question ("Tell me about your business — in your own words"), one field. The First Day, §3, *is* the first screen specification: on day one, Today and Ask are the same surface, because on day one the only thing that matters *is* the conversation.

There is no dashboard of zeroes, no tour, no locked-feature showroom. The architecture reveals itself only as it gains contents: Company appears when there is a company to show; Promises appears when the first promise exists. **The product is architecturally complete from the first minute — and visually silent until each place has earned its presence.** Navigation that grows this way is learned without ever being taught.

## 7. The Second Screen

The second screen is **whatever Today's one action opens** — and in the canonical story it is a **record in Company**: the boutique hotel from the First Day, opened from a held reply. It teaches, in one view, the three lessons the whole product rests on: *records are alive* (this page assembled itself), *records are conversational* (the intent field is right here; asking about this customer happens on this customer), and *everything is traceable* (the draft's claims each carry their quiet source). The second screen is where a new user first feels that the company has become a navigable, living thing.

## 8. The Deepest Screen

Four layers down, and no deeper, lives **the receipt**: Today → a held reply → the customer's record → *the provenance of one claim* — what Voltx drew on, what it judged, what it changed, and what it would take to undo. The deepest screen in Voltx is not an admin panel or a config page; it is **the full account of a single judgment.** That is an architectural statement: this product's depth is spent on *accountability*, not on machinery. Nothing in Voltx is more than four deliberate steps from Today, and the bottom of the product is bedrock — the place where trust is audited — not basement clutter.

## 9. Always One Gesture Away

From everywhere, without exception:
1. **Ask** — one keystroke (⌘K / one thumb-reach on mobile). The whole product is one keystroke wide.
2. **Approve / release held work** — the single most important recurring act in Voltx; it is never buried.
3. **Undo** — the manifesto's reversibility promise, physically honored everywhere.
4. **Back** — always safe, always working, never a trap.
5. **The drawer** — provenance for whatever AI-produced thing is in view.

These five are the product's reflexes. Everything else may live behind intent; these live in muscle.

## 10. Actions That Require AI Instead of Menus

Anything whose *specification is a sentence*: analysis and reporting ("how did service margins move this quarter?"), bulk operations, workflow creation (the sentence *is* the workflow — First Day §8), imports (drag chaos, Voltx sorts it), cross-record questions, drafting anything, finding anything not directly visible, and every configuration expressible as a preference ("stop showing me handled items in the brief").

**The rule: if saying it takes one sentence and clicking it would take a wizard, the wizard must not exist.** Menus for these would not be a convenience; they would be a second, worse language bolted beside a working one.

## 11. Actions That Must Never Require AI

The inverse rule is just as absolute — **anything that is a boundary, a reflex, or an exit is deterministic, mechanical, and instant:**
- Approving, rejecting, or editing held work.
- Undo.
- Opening something already visible.
- Correcting the AI, and pausing or stopping any standing instruction — *the off-switch is a switch, not a negotiation.*
- Signing out; reaching a human; exporting your data; leaving.
- Reading the agreement (the boundaries themselves load instantly and identically, every time).

Trust requires that the levers of control never depend on the judgment of the thing being controlled. The AI is the medium of *work*, never the gatekeeper of *authority*.

## 12. How Navigation Evolves After Six Months

**The map does not change. The weight moves.** Spatial memory is sacred (Manifesto §6): the places never reorder, rename, or multiply. What evolves is the *distribution of life* inside them: Today's brief grows shorter as more resolves silently; held work thins from a queue into spot-checks; Promises grows richer — more standing instructions, a deeper ledger — becoming the true portrait of an increasingly self-running company; records in Company grow denser with self-recorded history. Chrome may recede further for veterans — but by the user's own hand (collapse is offered, never imposed).

Navigation in Voltx evolves the way a home does: the rooms never move; the *living* redistributes.

## 13. What Disappears as Trust Grows

- **Approval steps** — within widened boundaries, held-then-approved becomes done-then-visible. The gesture that remains is the glance, not the grant.
- **Confirmation friction** inside granted scope.
- **Explanatory texture** — the small clarifications a new relationship needs ("I'll hold this for you") fall away, exactly as they do between colleagues.
- **Notification volume** — interruption asymptotically approaches the true emergency rate: near zero.

**What never disappears, at any trust level:** the drawer, undo, the agreement, the off-switch, and the held state for anything crossing a boundary the owner has not widened. Trust changes the *defaults*, never the *rights*. (The One-Year Story's answer holds: *"it has never once asked me to trust it more."* Neither may the architecture.)

## 14. What Should Feel Alive

Exactly the things that *are* alive: **thought arriving** (streamed text, the breathing cursor, the named work-in-progress — the texture of intelligence, Visual DNA §13); **Today**, which is different each morning because the company lived overnight; **held work**, whose ready-and-waiting state should carry the quiet tension of an envelope on a desk; and **records**, which visibly accrue their own history without anyone feeding them. Aliveness in Voltx is always *evidence of real work* — never ambience, never decoration in motion.

## 15. What Should Remain Perfectly Still

**The structure.** Navigation: identical yesterday, today, in version four. Records at rest: matte, silent, stable. Tables: still as a ledger. The agreement and its boundaries: fixed print, changing only by the owner's explicit hand. Numbers: never animating for drama, appearing at their final value (a business's figures are not a slot machine). The product breathes only where life is real; everywhere else it holds the stillness that makes the breathing legible. **Calm is the frame; intelligence is the picture.**

## 16. The Information Architecture

```
                              ┌───────────────────────────────┐
                              │              ASK              │
                              │   the intent surface — one    │
                              │   keystroke, from anywhere    │
                              │   (ambient: an air, not a     │
                              │    place — see §18, pass 2)   │
                              └───────────────┬───────────────┘
                                              │ permeates everything
              ┌───────────────────────┬───────┴────────────────┬─────────────────────┐
              │                       │                        │                     │
   ┌──────────▼──────────┐  ┌─────────▼──────────┐  ┌──────────▼──────────┐   ┌──────▼──────┐
   │        TODAY        │  │      COMPANY       │  │      PROMISES       │   │  you ·      │
   │   what needs me     │  │   what is true     │  │  what is done for   │   │ (a corner,  │
   │                     │  │                    │  │  me, and by what    │   │  not a      │
   │  · the brief        │  │  · People          │  │  right              │   │  place —    │
   │  · held work        │  │    customers,      │  │                     │   │  identity,  │
   │  · one question     │  │    suppliers,      │  │  · standing         │   │  quiet      │
   │                     │  │    teammates       │  │    instructions     │   │  prefs,     │
   │  (finished daily,   │  │  · Sales           │  │    (the sentences)  │   │  sign-out)  │
   │   not a feed)       │  │    pipeline, deals │  │  · the ledger       │   └─────────────┘
   │                     │  │  · Work            │  │    every action +   │
   │                     │  │    orders, service │  │    provenance       │
   │                     │  │  · Knowledge       │  │  · the agreement    │
   │                     │  │    docs, library,  │  │    boundaries,      │
   │                     │  │    connections     │  │    scopes, the      │
   │                     │  │                    │  │    off-switch       │
   └──────────┬──────────┘  └─────────┬──────────┘  └──────────┬──────────┘
              │                       │                        │
              │              every record is a door;           │
              │              every door opens onto its         │
              │              own conversation                  │
              │                       │                        │
              └───────────┬───────────┴────────────────────────┘
                          │
               ┌──────────▼──────────┐
               │     THE DRAWER      │   provenance — behind every
               │  (the receipt for   │   AI claim and action,
               │   any judgment)     │   everywhere, one gesture;
               └─────────────────────┘   the product's bedrock

   Depth:  Today ─→ held item ─→ record ─→ receipt        (four layers, never more)
   Width:  one keystroke (Ask reaches everything)
   Day 1:  only Ask is visible; places materialize as they gain contents
```

## 17. Why Every Section Exists

- **Ask** exists because the manifesto's central inversion — intent over mechanism — must be physically true: one field that accepts anything, from anywhere, or "the talking is the operating" is a slogan.
- **Today** exists because the work must come to the owner (Manifesto §6). Without it, the owner patrols — and patrol is the anxiety this product was built to abolish.
- **Company** exists because a business needs exactly one place where things are *true*. Every duplicated spreadsheet in the world is a monument to products that failed to provide this.
- **People / Sales / Work / Knowledge** exist because they are the four irreducible facts of any operating business: who we deal with, what we're pursuing, what we've promised to deliver, what we know. Not our taxonomy — *the* taxonomy.
- **Promises** exists because an AI that acts needs a visible seat of accountability. Standing instructions, the ledger, the agreement — remove this place and trust reverts to faith. Promises is why delegation feels like management rather than surrender.
- **The drawer** exists because provenance is the load-bearing wall of the entire philosophy (Manifesto §5): calm is only possible when verification is always available.
- **The you-corner** exists because identity and exit must be somewhere — and somewhere quiet is exactly how important-but-rare should live.

## 18. Removing the Unnecessary

**Pass one — Team dissolves.** Held against the architecture's own law (*a place must map to a daily question*), Team fails: "who works here" is not a daily question, and its contents already have truer homes. Teammates are *people of the company* → People. Scopes and roles are *boundaries* → the agreement, in Promises. Invitation is an *act*, not an address → Ask, or a quiet action inside People. A separate Team area was the last residue of admin-console thinking — the org chart as furniture. Removed. **Five places become four.**

**Pass two — Ask dissolves as a place.** The harder cut. Ask is the product's most important surface — which is precisely why it cannot be a *destination*: making it a sibling of Today and Company would quietly declare that talking to Voltx happens *somewhere*, when the entire philosophy insists it happens *everywhere*. The iPhone's home button was not an app. Ask is the product's home button: ambient, permanent, placeless — and conversation history attaches to what it was *about* (each record already is its own conversation), with past threads reachable through Ask itself. **Four places become three.**

**Pass three — attempted, and refused.** Can three become two? Fold Today into Company? No — "what needs me" and "what is true" are different questions with different tempos; merging them rebuilds the feed, the product's sworn enemy. Fold Promises into Company? No — what the company *is* and what is *done on the owner's behalf* must never blur, because that line is the entire trust architecture; an AI's actions filed among ordinary records is how accountability dissolves. Fold Promises into Today? No — Today is finished daily; Promises is standing. The remaining three are mutually irreducible. **The reduction stops here — not from fatigue, but from proof.**

## 19. The Result

```
                    ASK
          (everywhere — the air)
                     │
        ┌────────────┼────────────┐
        │            │            │
      TODAY       COMPANY      PROMISES
    what needs   what is      what is done
       me         true        for me, and
        │            │         by what right
        └────────────┼────────────┘
                     │
                THE DRAWER
         (the receipt, beneath all)
```

Three places, one voice, one drawer. Each place answers one question an owner actually carries; each question appears exactly once; nothing else made the cut. Run the test in either direction: nothing can be removed without breaking a promise made in the immutable documents, and nothing can be added without taxing every user to pay for it.

The iPhone's home screen was inevitable because it was a picture of what a phone truly was — not a list of what it could do. This is that picture for a company:

**What needs me. What is true. What is being done in my name. And a way to say what I want, from anywhere.**

An owner who has never seen software could invent this architecture by describing their own mind. That is the test it had to pass — and the reason it cannot become simpler.
