# Ludo Crown Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Zero-PII Public Profiles**: `/profiles/{userId}` holds only public game telemetry (`displayName`, `avatarId`, `elo`, `wins`, `league`). No email, phone, or private wallet data is stored in `/profiles`.
2. **Strict Wallet Isolation**: `/userWallets/{userId}` is readable and writable strictly by `request.auth.uid == userId` with verified email. `list` is permanently denied.
3. **Room Membership & Bounded Seats**: `/rooms/{roomId}` restricts `playerUids` and `seats` to at most 4 entries. Only members in `playerUids` can execute moves or send chat messages.
4. **Terminal State Locking**: Once a `/rooms/{roomId}` reaches `status == 'finished'` or a `/tournaments/{tournamentId}` reaches `status == 'completed'`, all subsequent updates are rejected.
5. **Master Gate Chat Isolation**: `/rooms/{roomId}/messages/{messageId}` verifies room membership against the parent `/rooms/{roomId}` document via `get()` on `get` and `create`, and validates `roomId == resource.data.roomId` and `senderUid == request.auth.uid`.
6. **Temporal & Immutable Integrity**: `createdAt` and owner fields (`uid`, `hostUid`, `creatorUid`, `roomCode`) are immutable after creation; `createdAt` / `updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Profile Create**: User A attempts to create `/profiles/userB` with `uid: "userB"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on Profile Update**: User A updates `/profiles/userA` with `{ displayName: "King", isAdmin: true }`. Expected: `PERMISSION_DENIED`.
3. **Private Wallet Snooping**: User A attempts `get` on `/userWallets/userB`. Expected: `PERMISSION_DENIED`.
4. **Private Wallet Collection Scrape**: User A attempts `list` on `/userWallets`. Expected: `PERMISSION_DENIED`.
5. **Oversized String Resource Poisoning**: User A submits a 2,000-char `displayName` or `text` in chat. Expected: `PERMISSION_DENIED`.
6. **Invalid Document ID Poisoning**: User A attempts to create `/rooms/../../../evil$id`. Expected: `PERMISSION_DENIED`.
7. **Unverified Email Write Attempt**: User with `email_verified: false` tries to create a room or profile. Expected: `PERMISSION_DENIED`.
8. **Terminal Room Mutation**: Member tries to overwrite `winnerUid` after `status == 'finished'`. Expected: `PERMISSION_DENIED`.
9. **Unauthorized Room Hijack**: Non-member tries to update `tokens` and `turnIndex` in an active room. Expected: `PERMISSION_DENIED`.
10. **Cross-Room Chat Injection**: Non-member tries to create a message in `/rooms/room1/messages/msg1`. Expected: `PERMISSION_DENIED`.
11. **Backdated Timestamp Forgery**: Client sends `createdAt: Timestamp(2020-01-01)` instead of `serverTimestamp()`. Expected: `PERMISSION_DENIED`.
12. **Tournament Overfill / Terminal Tamper**: User attempts to append a 9th entrant or modify a `completed` tournament. Expected: `PERMISSION_DENIED`.
