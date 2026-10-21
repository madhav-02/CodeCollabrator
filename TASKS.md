# Task Breakdown

Ordered by dependency. Each task is small enough to finish in one sitting and has a
stated way to check it actually works.

Markers:

- **[GATE]** — was blocked by OPEN-1 (the security policy). **Cleared on 21 Oct 2026**
  by explicit instruction to proceed without the policy. Kept on the tasks it applied to
  as a record of which work touches a network listener.
- **[OPT]** — valuable but cuttable; not required by any confirmed requirement.

---

## Status board

This is the only place status is recorded. Update it here, not next to each task.

| Task | Status |
|---|---|
| T0.1 Workspace scaffold | **done** |
| T0.2 Shared types | **done** |
| T1.1 App shell and routing | not started |
| T1.2 CodeMirror editor component | not started |
| T1.3 Theme toggle | groundwork only (`lib/theme.ts`) |
| T1.4 Language registry and picker | groundwork only (`editor/languages.ts`) |
| T1.5 Responsive layout | not started |
| T1.6 Username prompt and local identity | groundwork only (`lib/identity.ts`) |
| T1.7 Transport interface and offline stand-in | not started |
| T1.8 Editor bound to Yjs | not started |
| T2.1 Server skeleton | not started |
| T2.2 Room store and token minting | not started |
| T2.3 Join, role resolution, origin check | not started |
| T2.4 Real transport | not started |
| T2.5 Viewer enforcement | not started |
| T2.6 Reconnect handling | not started |
| T3.1 Live cursors | not started |
| T3.2 Participant list | not started |
| T3.3 Host controls | not started |
| T3.4 End room | not started |
| T3.5 Host departure ends the room | not started |
| T3.6 Language change permission | not started |
| T3.7 Share menu | not started |
| T4.1 Chat data and history | not started |
| T4.2 Chat UI | not started |
| T5.1 Idle expiry | not started |
| T5.2 Expired room page | not started |
| T5.3 Abuse caps | not started |
| T5.4 Empty-state copy | not started |
| T6.1 Follow mode [OPT] | not started |
| T6.2 Host reconnect grace period [OPT] | not started |
| T6.3 Code formatting [OPT] | not started |
| T6.4 Deferred features | out of scope for v1 |
| T6.5 Hosting | deferred by decision |

"Groundwork only" means supporting code exists but the task has no visible, verifiable
result yet, so it is not counted as done.

---

## Phase 0 — Project setup

### T0.1 Workspace scaffold
Root and client `package.json`, npm workspaces, TypeScript config, Vite config bound to
loopback only. Install dependencies.
*Partially done — the two manifests exist, nothing installed.*
**Covers:** N4, N9
**Verify:** `npm install` completes; `npm run typecheck` passes on an empty project.

### T0.2 Shared types
A `shared/` folder with the role enum, participant shape, and control-message types,
imported by both halves so they cannot drift apart.
**Verify:** both sides compile against it.

---

## Phase 1 — The editor, with no network at all

This whole phase runs in one browser tab with no server. It is the bulk of the visible
product and is unblocked by OPEN-1.

### T1.1 App shell and routing
Three routes: home (create a room), room, expired. Placeholder content.
**Covers:** R7
**Verify:** all three URLs render.

### T1.2 CodeMirror editor component
Mount CodeMirror 6 with line numbers, bracket matching, search, and sensible defaults.
Light theme. Use runtime-swappable compartments for language and theme from the start —
retrofitting them later is painful.
**Covers:** R1, R37
**Verify:** type in it; it behaves like a code editor.

### T1.3 Theme toggle
Light default, dark option, remembered in the browser. Only consult the operating
system preference for someone who has never chosen.
**Covers:** R37, R38, R39
**Verify:** toggle, reload, choice persists.

### T1.4 Language registry and picker
~40 languages, loaded on demand so the initial download stays small.
**Covers:** R12
**Verify:** switch to Python, Rust, Go; highlighting changes; network tab shows the
grammar fetched only when selected.

### T1.5 Responsive layout
Editor plus two side panels on desktop; a usable single-column arrangement with
collapsible panels on a phone.
**Covers:** R40
**Verify:** at 375px wide the editor is usable and nothing overflows.

### T1.6 Username prompt and local identity
Ask for a username on first visit, remember it, generate a stable anonymous id and a
colour. Allow changing the name later.
**Covers:** R25, R26, R28
**Verify:** prompted once; reload does not ask again.

### T1.7 Transport interface and offline stand-in
Define the single interface the UI uses to reach a room — document, participants, role,
chat, host actions — and write an offline implementation backed by a local Yjs document
with a fake participant list.

This is the seam that keeps OPEN-1 from blocking the UI, and the seam that contains the
cost of switching from Node to Cloudflare later.
**Verify:** the room screen is fully interactive with no server running.

### T1.8 Editor bound to Yjs
Connect the editor to a Yjs document through the interface above, with per-person undo.
**Covers:** R10, R14
**Verify:** typing flows through Yjs; undo works; two local documents merge correctly in
a scratch test.

---

## Phase 2 — Server and live collaboration  **[GATE]**

### T2.1 Server skeleton **[GATE]**
Node + `ws`, loopback only, serving the built client in production mode.
**Covers:** N4, N9

### T2.2 Room store and token minting **[GATE]**
In-memory room records. Create-room endpoint returning the room id and three tokens from
a cryptographic source. Token comparison in constant time. No token ever logged.
**Covers:** R2, R4, N5, N8
**Verify:** two creations return different unguessable ids; tokens absent from logs.

### T2.3 Join, role resolution, origin check **[GATE]**
Accept a connection, verify the token, resolve the role, reject unknown rooms, bad
tokens, removed participants, and full rooms. Reject unrecognised origins.
**Covers:** R3, R8, R17, R24, N6
**Verify:** each rejection path closes with the right reason; a connection forged from
another origin is refused.

### T2.4 Real transport **[GATE]**
A WebSocket implementation of the Phase 1 interface, swapped in behind the same API.
**Covers:** R9
**Verify:** two browsers type into one room and see each other.

### T2.5 Viewer enforcement **[GATE]**
Server drops document-changing messages from viewer connections.
**Covers:** R18
**Verify:** a viewer with the browser's read-only flag removed by hand still cannot
change what anyone else sees.

### T2.6 Reconnect handling **[GATE]**
Automatic reconnect with backoff, a visible connection status, and no lost edits across
a drop.
**Covers:** R11
**Verify:** kill the server mid-session, restart it, confirm recovery and status display.

---

## Phase 3 — Presence and roles  **[GATE]**

### T3.1 Live cursors
Cursors with usernames and colours for host and editors. Viewers publish none.
**Covers:** R27, R29, R30

### T3.2 Participant list
Everyone listed individually with name and role, updating live.
**Covers:** R31, R32

### T3.3 Host controls
Promote, demote, remove. Role overrides keyed to the browser id; removal bans that id
for the room's life.
**Covers:** R20, R21

### T3.4 End room
Host ends the room; everyone is disconnected with a clear explanation. Confirmation
prompt first.
**Covers:** R22

### T3.5 Host departure ends the room
Host disconnect ends the room and disconnects everyone.
**Covers:** R23
**Note:** implemented literally pending OPEN-2.

### T3.6 Language change permission
Only host and editors may change the language.
**Covers:** R13 (and the restriction in the permission table)
**Verify:** a viewer cannot change it, by UI or by crafted message.

### T3.7 Share menu
The three links with copy buttons and one line each explaining what they grant. Host
link kept out of query strings and logs.
**Covers:** R19

---

## Phase 4 — Chat  **[GATE]**

### T4.1 Chat data and history
Messages on the shared document so late joiners get history for free. Never written to
disk.
**Covers:** R34, R35

### T4.2 Chat UI
Sender name, timestamp, send box, anyone may post, unread indicator when the panel is
collapsed on mobile.
**Covers:** R33, R36

---

## Phase 5 — Lifetime and limits  **[GATE]**

### T5.1 Idle expiry
Mark a room empty when the last connection closes; delete it an hour later; cancel if
anyone rejoins.
**Covers:** R5, R6

### T5.2 Expired room page
A dead link gets a clear explanation and a create-new-room button, never a blank editor.
**Covers:** R7

### T5.3 Abuse caps
Message size and rate caps, document size cap with a visible rejection, participant cap,
room creation rate limit, cap on total rooms.
**Covers:** R8, R16, N7

### T5.4 Empty-state copy
A quiet line telling people the room disappears an hour after everyone leaves. No
countdown — with an idle timer the clock only starts once nobody is there to read it.

---

## Phase 6 — Optional

### T6.1 Follow mode **[OPT]**
Click a participant to track their viewport and cursor. Cheap, and the single most
useful feature for teaching, which is a stated primary use case.

### T6.2 Host reconnect grace period **[OPT]**
Suspend rather than destroy the room when the host drops; resume if they return within
90 seconds. Resolves OPEN-2 if accepted.

### T6.3 Code formatting **[OPT]**
Prettier in the browser for the languages it supports. Runs client-side; no execution
risk.

### T6.4 Deferred features
Multiple files per room, session replay, interviewer-private notes, accounts.

### T6.5 Hosting
Deferred by decision. Cloudflare Workers plus Durable Objects is the recommended free
target; only the relay would change.

---

## Critical path

```
T0.1 → T0.2 → T1.1 → T1.2 → T1.3 ─┐
                  ├→ T1.4 ─────────┤
                  ├→ T1.5 ─────────┼→ T1.7 → T1.8 ─┐
                  └→ T1.6 ─────────┘               │
                                                   ▼
                   [GATE]  T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6
                                                   │
                           ┌───────────────────────┼───────────┐
                           ▼                       ▼           ▼
                        Phase 3                 Phase 4     Phase 5
```

Phase 1 is roughly half the work and needs no server. Finishing T2.4 is the moment this
becomes a real thing you can hand someone a link to.
