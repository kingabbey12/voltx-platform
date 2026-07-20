# Company

The information architecture of Voltx.

Governed by the Product Experience Manifesto, the North Star Experience, the One-Year Story, the Visual DNA, and the Product Architecture. Today (docs/design/screens/TODAY_SPEC.md) and Ask (docs/design/ASK.md) are frozen and are downstream of this document: doors open what is defined here; held work signs what is defined here; the brief narrates what is defined here.

---

## 1 · Philosophy

A company is not software modules. A company is a living system made of people, commitments, records, money, decisions, conversations and time — and it stays alive by remembering. Voltx's job is to be the company's memory and its voice: everything the owner sees is a reading of one underlying structure, and everything the owner does is a writing into it.

Three commitments follow:

**The structure is smaller than the business.** A coffee-machine business has quotes, invoices, installations, warranties, reorder cycles, staff, and a van. It does not need a software concept for each. It needs a handful of primitives that compose. The measure of this architecture is not how much it can represent but how little it needs in order to represent everything.

**Nothing exists twice.** Every fact has one home; everything else points at it. When Hotel Marlin appears in a quote, a conversation, and the morning brief, those are three references to one party — never three copies. Duplication is where trust dies, because copies drift.

**The company does not erase.** It corrects on the record, the way bookkeeping always has: a wrong entry is superseded by a right one, and both remain. What the owner sees is the present; what the company keeps is everything.

---

## 2 · Entity model — the primitives

Seven primitives. Every other business concept is a kind, a role, a projection, or a composition of these — and the candidate list was not accepted blindly; the rejections at the end of this section matter as much as the primitives.

### The Company
The container and the tenant. One per organization; everything below belongs to exactly one Company. The Company is also itself a Party — it appears as a side in its own promises.

### Party
Anyone the company relates to: a person or an organization. **Customer, supplier, and employee are not entities — they are roles a party plays**, and roles are *derived from the promise graph*, not stamped as types. Hotel Marlin is a customer because standing promises run between it and the company in a customer shape; if Adaeze one day buys beans from them, the same party is also a supplier, with no second record. A party carries the canonical contact facts (names, aliases, addresses); nothing else in the system stores a phone number.

### Promise
The central primitive: a commitment between two parties with terms and a lifecycle — proposed, standing, kept, broken, released. Almost everything a business calls by another name is a promise or a bundle of them: an order is a promise to deliver against a promise to pay; a warranty is a standing promise attached to an asset; employment is a bundle of standing promises; a subscription is a promise that renews; a service reminder is the company promising itself. Money enters here: an **amount is a property of a promise or an event, not an entity** — the ledger is a projection of promises and payments, not a place where money "lives."

### Asset
A thing with identity the company owns or is responsible for: a machine in the workshop, a machine installed at a customer's café (owned by the customer, serviced by the company — ownership and custody are party links, not assumptions), stock, the van. Service promises attach to assets; movement and maintenance are events touching them.

### Document
An artifact of words or images: a quote PDF, a signed contract, a bank statement, a photograph of a delivery. A document *says* something; it does not by itself make it so. Documents instrument promises (the contract) and evidence events (the statement). They are immutable — a revised quote is a new document superseding the old.

### Conversation
Words exchanged over time among parties — an email thread, a WhatsApp exchange, a session with Ask. Conversations are where intent forms before it commits. Messages are events within the conversation. Ask is never a participant in its own name: it drafts and speaks *for the company*, and the company is the party.

### Event
Anything that happened, at a time, done by someone: a payment arrived, a machine shipped, a message was sent, a decision was signed. Events are append-only and are the company's only source of history — every state anywhere is derivable from them. **A decision is a kind of event**, the kind where a person commits the company: every signing of held work is a decision event, carrying its author, its moment, and what it was based on.

### The rejections
- **Customer / Supplier / Employee** — roles derived from promises, not entities. One party, many roles, zero duplication.
- **Invoice** — a document kind that instruments a payment promise. The obligation is the promise; the invoice is its paper.
- **Contract** — a document kind that instruments a promise bundle.
- **Project** — a named grouping of promises, conversations, documents and events around an aim: a *view*, not a primitive (see §9).
- **Record** — not an entity at all, but the written form every entity takes (see §5).
- **Money** — a measure carried on promises and events; the ledger is a projection.
- **Decision** — an event kind, not a peer entity.

---

## 3 · Relationship model

**One canonical owner, everywhere.** Every object belongs to exactly one Company (this is the tenant boundary the platform already enforces at the ORM layer). Within the company, every fact has one home, and all other appearances are references by ID:

- A **promise** knows its two parties (obligor, obligee), its terms (amounts, dates, subject), the assets it concerns, the documents that instrument it, and the events that advance it.
- An **event** knows its actors (parties), its author, and what it touches — promises, assets, documents, conversations — as references.
- A **document** knows its author and what it instruments or evidences.
- A **conversation** knows its participants; its messages are events; the decisions and promises it gave rise to are references, so the paper trail runs both ways: from the promise back to the words that made it.
- An **asset** knows its owner and its custodian (both party links) and accumulates its history as events.

Roles are computed, never stored: "customers" is the set of parties standing on the customer side of live promises. The morning brief's "Dele Provisions has been quiet for 31 days" is not a CRM field — it is the absence of events against a party with a standing reorder pattern.

Nothing is deleted to sever a relationship; the relationship's promises end (kept, broken, or released) and the parties remain, with their history.

---

## 4 · Time model — how the company remembers

Four registers, strictly distinguished:

| Register | What it is | Property |
|---|---|---|
| **Current state** | The present: open promises, party facts, asset custody | A projection *derived* from events — cached for reading, rebuildable at any time, never the source |
| **History** | The event log itself | Append-only, complete; the only source |
| **Audit** | Who did what, when, on what basis | Not a separate system — the authorship dimension carried by every event; the audit trail is the event log read for its authors |
| **Memory** | What the company has learned: patterns, preferences, beliefs | Compressed and revisable; held by Ask; inspectable and correctable; never evidence (see §7) |

Corrections supersede; they do not overwrite. A record revised is a new version pointing at the old, and the chain is permanent. "Delete" exists only as *release* (a promise ended) or *supersede* (a record corrected) — the company can stop acting on something, but it cannot un-remember it.

---

## 5 · Record model

**A record is the written form of anything: an entity or an event, given identity, time, and provenance.** A promise is a record; a payment event is a record; a party is a record. "Record" is not an eighth primitive — it is what all seven look like once the company has written them down.

Everything eventually becomes a record because the company *is* what it can remember. A conversation is words seeking a decision; a decision is the moment words commit the company; a promise is what the decision creates; events are the promise being kept; and records are how all of it is held. Anything not recorded is rumor — the system may know of it (a belief, §7) but may not act on it as fact.

Every record carries:
- **id** — immutable, unique within the company, never reused;
- **kind** — which primitive, and which kind of it (promise/payment, document/invoice);
- **body** — the facts, each fact living here and nowhere else;
- **provenance** — author, moment, and instrument (which decision or document made it so);
- **version chain** — what it supersedes, what supersedes it.

This is what a door opens. The UI rule from Today — every material figure is a door — is this model's surface: a door is a record id, and a figure with no record behind it cannot be typeset as fact.

### Document · record · conversation · decision
The four the product must never blur:
- A **document** says something. A **record** holds that it is so — the quote PDF versus the promise it instruments.
- A **conversation** is words before commitment. A **decision** is the event of commitment — signed by a person, on the record.
- The chain in one line: *conversation → decision → promise → events → records*, with documents as the paper at each step.

---

## 6 · Trust model — what is true

A strict hierarchy of confidence, and nothing moves up it without a person or the outside world:

1. **Evidence** — artifacts and events from outside the company's own assertions: a bank statement, a signed contract, an inbound email, a delivery confirmation. Evidence is the strongest register because the company did not write it alone.
2. **Attested record** — what a person committed on the record: a signed decision, an entered payment, a held document sent. True because someone answerable said so, with provenance to prove it.
3. **Opinion** — attributed judgment: a note that a customer seems unhappy, an assessment of a supplier. Opinions are records *of the opining* — "Chidi believes X" is a fact; X is not. Opinions never silently become facts.
4. **Inference** — what Ask computed or estimated. Inference lives in memory as belief, is always hedged and basis-named at the surface (Ask's trust registers), and **can never become a record by itself**: the only path from inference to truth is through a person signing held work — at which moment it becomes an attested record with dual provenance, *prepared by Voltx, signed by Amara*.

This makes the whole system auditable in one sentence: every fact is either evidenced from outside, or signed by someone, and everything else is labeled as the judgment or guess it is.

---

## 7 · AI model — how Ask understands without duplicating knowledge

**One source.** Ask reads the same records through the same permissions as the person asking — RBAC-filtered at retrieval, tenant-scoped by construction. There is no shadow database and no second truth.

**Indexes are not knowledge.** Embeddings, knowledge graphs, and search structures are *derived* from records and rebuildable from them at any time. They accelerate finding; they never originate facts. If an index disagrees with a record, the index is wrong by definition. (The existing knowledge module — sources, chunks, entities, relationships — is bound by this rule: it is Ask's card catalog, not a parallel company.)

**Beliefs are justified or discarded.** Ask's memory holds beliefs — "they usually reorder by day 25", "Amara prefers short quotes" — and every belief links to the records that justify it. A belief that loses its justifying records loses its standing. Beliefs are inspectable and correctable by the owner: the company may not believe things about itself that the owner cannot see and overrule.

**Ask writes like everyone else.** Through held work and signed decisions, entering the record with dual provenance. Ask can propose truth; only people and evidence can make it.

**Context is the graph.** Ask's context layers (session, place, selection, thread, memory — ASK.md §5) are readings of this structure: the "place" is a record id, the selection is a record id, and pronouns resolve against the graph. Ask needs no private model of the company because the company's model is already the product.

---

## 8 · Identity

- **ID** — every object has one immutable identifier, unique within its company, assigned at creation, never reused, never recycled across versions. IDs are what doors, references, and provenance hold.
- **Names** — mutable labels for humans. Renaming a party rewrites no history, because nothing referenced the name.
- **Aliases** — many per party ("Marlin", "the hotel", "HM Ltd"), searchable, and learnable: when the owner says "marlin" and confirms the hotel, the alias may be remembered as a belief and promoted to the party record through the normal path.
- **Versions** — records supersede; identity persists across the chain; the current version answers for the record, the chain answers for the audit.
- **Ownership** — every object: one company (tenant isolation, enforced in the ORM). Every record: an author in provenance. Custody (who holds the van; whose café the machine sits in) is a party link on the asset, distinct from ownership.

---

## 9 · Future expansion model

**The test for any future module: it may add new kinds — of promise, event, document, asset, role, or projection — but never a new primitive.** If a proposed feature cannot be expressed in these seven, the feature is either misunderstood or this document is wrong; both cases stop the feature until resolved. What modules ship is *projections*: named, saved readings of the graph — and projections are always derived, rebuildable, and truth-free.

Worked examples:

| Module | Expressed as |
|---|---|
| Invoicing | payment promises + invoice documents + payment events; the ledger is a projection |
| Payroll | standing promise bundles to person-parties + payment events on a cycle |
| Inventory | assets + movement events; stock level is a projection |
| Field service | service promises attached to assets + visit events |
| Support | conversations + service promises; SLA is a promise with a clock |
| Projects | a named grouping (projection) over promises, conversations, documents, events |
| Compliance | evidence documents + standing promises to authorities + deadline events |
| Billing / subscriptions | renewing promises + invoice documents + payment events |

**Mapping to the current platform** (`backend/prisma/schema.prisma`), so this architecture lands as reconciliation, not rewrite:

| Today's model | In this architecture |
|---|---|
| `Organization` | the Company (and its Party face) |
| `User`, `Membership`, `Role`, `Permission` | person-parties + access promises; RBAC remains the permission floor |
| `Conversation`, `Message` | Conversation; messages as its events |
| `Memory`, `MemoryAccess` | beliefs (§7), to gain justification links and an inspection surface |
| `Agent`, `AgentRun`, `AgentActionApproval` | Ask's runtime; approvals are the held-work → decision path |
| `AuditLog` | absorbed by event provenance (§4) — the log becomes a reading, not a place |
| `SalesCompany`, `SalesContact` | parties (organization / person kinds) |
| `SalesLead`, `SalesOpportunity` | promises in formation (proposed) |
| `SalesActivity` | events |
| `Knowledge*` | derived indexes (§7) — never sources of truth |
| `Workflow*` | standing instructions: promises the company makes to itself, whose runs are events |

The sales module thus becomes the first projection rebuilt on the primitives, and every later module inherits the vocabulary Today and Ask already speak: parties behind doors, promises in the ledger, decisions under signatures, events in the brief.

---

*Voltx design documents · Company · with TODAY_SPEC.md and ASK.md · every future module fits here or does not ship.*
