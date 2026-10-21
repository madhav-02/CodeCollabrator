# Requirements

A website where anyone can create a room containing one shared code editor. People join
by link, to contribute or to observe. Code is never executed. Rooms are temporary.

All requirements below are confirmed unless marked **OPEN**.

---

## Scope

**In scope:** collaborative text editing, syntax highlighting, roles, presence, chat,
mobile support, automatic room expiry.

**Out of scope, permanently:** running or compiling user code. No sandbox, no output
pane, no terminal. This removes the entire untrusted-execution risk from the project.

**Out of scope for v1:** accounts, multiple files per room, session replay,
interviewer-private notes, code formatting, voice or video.

**Deferred:** deployment and hosting. Build and run locally first.

---

## Functional requirements

### Rooms

| ID | Requirement |
|---|---|
| R1 | A room contains exactly one shared code editor |
| R2 | Anyone can create a room. No account, no login, no email |
| R3 | A room is reachable by an ordinary web link; opening it joins the room directly |
| R4 | Room identifiers are random and unguessable |
| R5 | A room is deleted 1 hour after the last participant leaves |
| R6 | Any new participant joining resets that 1-hour clock |
| R7 | Opening a link to a deleted or unknown room shows an explicit "room expired" page with a button to create a new one |
| R8 | Maximum 25 participants per room |

### Editing

| ID | Requirement |
|---|---|
| R9 | Edits from all contributors appear to everyone else in real time |
| R10 | Two people typing in the same place at the same time must not corrupt the document |
| R11 | A participant who briefly loses network reconnects and re-syncs without losing work |
| R12 | Syntax highlighting for ~40 languages |
| R13 | The room's language is a shared setting; changing it changes it for everyone |
| R14 | Undo is per-person. Your undo never reverts someone else's typing |
| R15 | The document starts empty |
| R16 | Document size capped at ~1 MB; oversized content rejected with a visible message |

### Roles and permissions

Three roles. Each room has three separate links, one per role.

| Capability | Host | Editor | Viewer |
|---|---|---|---|
| See the document live | yes | yes | yes |
| Edit the document | yes | yes | **no** |
| Change the language | yes | yes | **no** |
| Send chat messages | yes | yes | yes |
| See the participant list | yes | yes | yes |
| Promote / demote / remove participants | yes | no | no |
| End the room | yes | no | no |
| Re-display the shareable links | yes | no | no |

| ID | Requirement |
|---|---|
| R17 | Permissions are enforced by the server. Disabling the editor in the browser is not sufficient |
| R18 | Viewer edits are rejected by the server, not merely hidden in the UI |
| R19 | The host link must not be exposed in server logs or referrer headers |
| R20 | The host can promote a viewer to editor and demote an editor to viewer |
| R21 | The host can remove a participant; a removed participant cannot rejoin that room |
| R22 | The host can end the room immediately. All participants are disconnected |
| R23 | When the host leaves, the room ends and every participant is disconnected |
| R24 | A role survives a page reload |

### Identity and presence

| ID | Requirement |
|---|---|
| R25 | On first visit the person is asked for a username |
| R26 | The username is remembered in the browser for later visits |
| R27 | The username is shown on that person's cursor, in the participant list, and on their chat messages |
| R28 | Each participant gets a distinct colour |
| R29 | Live cursors show position and username for the host and editors |
| R30 | Viewers do not broadcast a cursor |
| R31 | The participant list shows every participant individually, by name, with their role |
| R32 | Participants appearing and leaving updates the list live |

### Chat

| ID | Requirement |
|---|---|
| R33 | Every participant can send chat messages, viewers included |
| R34 | Chat history is retained for the life of the room; someone joining late sees earlier messages |
| R35 | Chat is never written to disk and dies with the room |
| R36 | Messages show the sender's username and a timestamp |

### Appearance

| ID | Requirement |
|---|---|
| R37 | Light theme is the default |
| R38 | A dark mode toggle is available |
| R39 | The theme choice is remembered in the browser |
| R40 | The interface is responsive and the editor is usable on a phone |

---

## Non-functional requirements

| ID | Requirement |
|---|---|
| N1 | Light scale: tens of concurrent rooms, not thousands |
| N2 | No database. Room state is held in memory and is expected to be lost on restart |
| N3 | Modern evergreen browsers only |
| N4 | Runs entirely on a developer laptop with no third-party account |
| N5 | Room links and tokens generated from a cryptographic random source |
| N6 | Connections rejected unless the request origin is recognised |
| N7 | Caps on message size, message rate, and room creation rate |
| N8 | Tokens never written to logs |
| N9 | In local development the server listens on the loopback interface only |

---

## Security posture, stated plainly

The security boundary of this product is **possession of a link**. Anyone holding a
room's edit link can edit; anyone holding its view link can watch. There is nothing
stronger, because there are no accounts.

Roles are enforced server-side and are robust against a participant's browser being
modified to *send* edits it shouldn't. They are **not** robust against someone clearing
their browser storage to shed a demotion, because identity itself is self-asserted.
Roles are a collaboration tool among cooperative people, not a defence against a
determined adversary in the room.

This is an acceptable posture for teaching and ordinary interviews. It would not be
acceptable for a proctored exam.

---

## Open items

| ID | Item |
|---|---|
| **OPEN-1** | **Blocks all server work.** This workspace requires the `builder-security` policy to be followed before building anything that listens on a network port. The document is not installed and not on disk. Needs either the document, or an explicit instruction to proceed without it. Applies to local development too, since the local server listens on a port |
| **OPEN-2** | R23 as written means a host whose network blips for ten seconds destroys the room and everyone's work. A 90-second reconnect grace period was proposed and is not yet accepted or rejected. R23 is implemented literally until decided |
| **OPEN-3** | Product name. "LiveCode" is a placeholder |
