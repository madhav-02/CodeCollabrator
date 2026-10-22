# Design

How the thing is built. For *what* it must do, see `REQUIREMENTS.md`. For the plan of
work, see `TASKS.md`.

Status: design agreed. Phase 1 unblocked; server work gated on OPEN-1.

---

## 1. Technology

| Part | Choice | Why |
|---|---|---|
| Sync | **Yjs** (a CRDT) | Merges simultaneous edits correctly, survives reconnects, and supplies presence. The server stays a dumb relay |
| Editor | **CodeMirror 6** | Light, works on phones, themes and languages swap at runtime |
| UI | React + TypeScript + Vite | Conventional, fast, type-checked |
| Server | Node + `ws` | Simplest thing that runs locally with no account |
| Storage | none | Rooms expire after an hour idle, so there is nothing worth persisting |
| Hosting | deferred | Cloudflare Workers + Durable Objects is the recommended free target when the time comes |

### Why no database

Rooms die an hour after the last person leaves, so nothing outlives the process that is
worth keeping. Room state is a `Map` in memory. This removes Postgres, migrations, an
ORM, and a deployment dependency from the project. The cost is that rooms are lost on
restart, which is acceptable and recoverable later by snapshotting to Redis with a
one-hour TTL.

### Why local Node rather than Cloudflare now

Plain Node runs with no account and is straightforward to debug. If Cloudflare becomes
the production target, one Durable Object per room is a near-perfect structural match
and its alarm API gives the expiry rule for free — but only the relay is rewritten. The
transport interface (T1.7) exists specifically to contain that change.

---

## 2. Roles and links

Creating a room mints one room id and three independent tokens. The token in the URL
*is* the authorization; there is nothing else to check.

| Link | Role | Capabilities |
|---|---|---|
| `/r/:roomId#h=<hostToken>` | host | edit, language, promote, demote, remove, end, re-display links |
| `/r/:roomId/e/:editToken` | editor | edit, language |
| `/r/:roomId/v/:viewToken` | viewer | watch, chat |

- `roomId` — 10 random characters, used only for routing.
- tokens — 21 random characters from a CSPRNG, compared with `timingSafeEqual`.
- The host token sits in the URL **fragment**, which browsers never send to the server,
  so it cannot reach an access log, a proxy, or a `Referer` header. It is copied into
  browser storage on first load.

### Enforcement

The Yjs wire protocol separates document-sync messages from presence messages. For a
viewer connection the server **allows** a request for current state and presence
messages, and **drops** the two message kinds that carry document changes.

CodeMirror's read-only flag is a UI affordance. The server-side drop is the actual
control.

### Promotion, demotion, removal

A role must survive a reload (R24), so a token alone is insufficient — handing a
promoted viewer the edit token would make demotion impossible.

Each browser generates a persistent random id. Each room holds role overrides and a
removal list keyed by it. Resolution order: **removed → override → token baseline**.

This is defeatable by clearing browser storage, which `REQUIREMENTS.md` states openly.

---

## 3. Data model

One Yjs document per room:

```
content   Y.Text    the code
meta      Y.Map     { language }
chat      Y.Array   { userId, name, text, at }
presence  awareness { userId, name, colour, role, cursor }
```

Chat lives on the same document as the code, which is why late joiners get history for
free (R34) and why it survives a reconnect with no extra work.

Server-side room record, in memory:

```
id, ydoc,
tokens:   { host, edit, view },
overrides: Map<userId, Role>,
removed:   Set<userId>,
conns:     Map<socket, { userId, name, role }>,
createdAt, emptySince
```

---

## 4. Wire protocol

One WebSocket per participant carrying two kinds of frame, told apart by frame type
alone:

- **binary** — the standard Yjs sync and presence protocol, untouched
- **text** — a small JSON control channel

```
to server     { t: 'promote' | 'demote' | 'remove', userId }   host only
              { t: 'end' }                                     host only
              { t: 'links' }                                    host only

to client     { t: 'role', role }
              { t: 'roster', users: [...] }
              { t: 'links', edit, view }
              { t: 'closed', reason: 'ended' | 'removed' | 'expired' | 'hostLeft' }
```

Connect: `ws://localhost:PORT/ws?room=&token=&user=&name=`

The upgrade request is checked against an allowed origin list before anything else. HTTP
requests from other sites are blocked by CORS, but **WebSocket upgrades are not** — so
without this check, any page a participant visits could open a connection to a room they
hold a token for.

---

## 5. Lifetime

- Last socket closes → record the time. A sweeper deletes the room an hour later.
- Anyone rejoining cancels it.
- Host disconnects → room ends, everyone disconnected with `hostLeft` (R23).
- Host ends deliberately → immediate, `ended`, after a confirmation prompt.
- A dead link gets an explicit expired page, never a blank editor.

No countdown in the UI: with an idle timer the clock only starts once nobody is left to
watch it.

---

## 6. Layout

```
┌───────────────────────────────────────────────────────────┐
│ LiveCode   room aB3dK9mZ2x    [Share ▾]  [TypeScript ▾] ◐ │
├────────────────────────────────────┬──────────────────────┤
│  1  function greet(name) {         │ In this room         │
│  2    return `hi ${name}`;  ▏Ana   │  ● You     host      │
│  3  }                              │  ● Ana     editor    │
│                                    │  ● Raj     viewer    │
│                                    ├──────────────────────┤
│                                    │ Ana  10:04           │
│                                    │  try a template lit  │
│                                    │ ┌──────────────────┐ │
│                                    │ │ message…         │ │
└────────────────────────────────────┴─┴──────────────────┴─┘
```

On a phone: single column, editor first, participants and chat as collapsible sheets
with an unread badge.

---

## 7. Structure

```
LiveCodeSharing/
  shared/          role and message types, used by both halves
  client/
    src/
      routes/      Home, Room, Expired
      editor/      CodeMirror setup, themes, languages, Yjs binding
      room/        transport, roster, chat, share, presence
      lib/         identity, theme
  server/
    src/
      index.ts     http + ws bootstrap
      rooms.ts     room store, tokens, expiry sweeper
      protocol.ts  origin check, role resolution, message filtering, control channel
```

One repo, npm workspaces. In production the Node process serves the built client and the
WebSocket endpoint, so there is one deployable and no CORS to configure.

---

## 8. Limits

Modest caps, all configurable, none security-critical — they stop one bored person from
exhausting the box: room creation rate per address, total rooms, 25 connections per room,
~1 MB document, message size cap, per-connection message rate cap.

---

## 9. Known limitations

Found while building, worth knowing before relying on any of it.

**Refusing a Yjs update forks that client permanently.** Yjs positions reference
neighbouring items, tombstones included, so once the server refuses an update every
later edit from that same client depends on data the server will never hold. Those
updates sit pending forever and that client is out of step until the page is
reloaded. Other clients are unaffected.

This is reachable two ways: a viewer whose browser read-only flag has been removed,
and a document that has hit the 1 MB ceiling. Neither is reachable by ordinary use —
a viewer's editor genuinely cannot be typed into — and the warning text tells the
person to reload. It does mean a *tampering* viewer who is later promoted must
reload before their edits take effect.

**The idle sweep fires less often than it looks.** A host leaving ends the room
outright (R23), so a room that ever had a host connected never reaches the one-hour
idle rule. In practice the sweep collects rooms created and never entered, and rooms
only ever occupied by editors and viewers. The hour-long rule is a backstop, not the
usual path.

**Rooms do not survive a restart**, by design (N2). A client reconnecting to a
restarted server is told `notFound` and stops retrying, which is correct — the room
really is gone.

**Roles are defeatable by clearing browser storage**, since identity is
self-asserted. See the security posture section of `REQUIREMENTS.md`.

**The bottom sheet has no focus trap**, so Tab can reach the editor behind it. It
closes on Escape and on a backdrop tap, so nobody is stuck.

**Untested in a real browser**: cursor rendering, the mobile layout, the reconnect
loop end to end, and `100dvh` against the iOS keyboard. Every mechanism underneath
them is verified over the wire or in isolation; their composition in a browser is not.
