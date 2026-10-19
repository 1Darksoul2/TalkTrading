# Instagram-parity implementation checklist

Status legend: `[x]` done and tested - `[~]` partly done - `[ ]` not started - `[!]` blocked (reason given)
"Tested" = I ran it and saw the result (actual numbers are in the final report).

## Scope rule (from the user, 2026-10-13)
**Post, Chat, Explore and Community are not to be touched at all.** All work goes into the other backend (Story; News/Chart are market services), the frontend, and the launcher. Anything that needs a change inside the four frozen services is listed under "Blocked by the freeze" with the exact reason.

## Audit findings (real repository)

| Service | Port | Lang | Role | Rule |
|---|---|---|---|---|
| Post | 8004 | Python/FastAPI | Posts + (as built earlier) accounts/login, profiles, follows, notifications, mentions | FROZEN - existing public API is consumed as-is |
| Chat (E2EE) | 8003 | Python/FastAPI | Encrypted DMs | FROZEN - story replies reuse the existing frontend chat client |
| Explore | 8083 | Java/Spring | Discovery feed | FROZEN |
| Community | 8080 | Java/Spring | Communities | FROZEN |
| Story | 8001 | Python/FastAPI + SQLite/Postgres | Stories | IN SCOPE - rebuilt |
| News | 8000 | Python/FastAPI | Market news | In scope; no Instagram feature applies |
| Chart | 8002 | Python/FastAPI | Quotes | In scope; no Instagram feature applies |
| Frontend | 5173 | React 18 + Vite | All screens | In scope |

Not present in the repo: gateway, push infrastructure, mail server, object storage (local disk only), running broker.

Existing state: Settings = 560-line catalogue; **nothing in the app reads any of its values** (all decorative, with invented sessions/blocked/close-friend lists). Stories = bare URL + view counter, no privacy/media/highlights. Profile = name/bio/avatar/counts/follow (real) but no lists, tabs, highlights, menu.

## How things are integrated without touching Post
- Story Service reads identity from the same JWT (shared secret) and learns the social graph by calling Post's **existing public endpoints** with the viewer's own token: `GET /users/{id}/following`, `GET /users/{id}/follow-stats`, `GET /users/by-username/{name}`, `GET /users/lookup`.
- Account IDs: story data is keyed by the account UUID; Post's integer author id is derived with the same documented formula (`crc32(uuid) % 900000 + 100`).
- Story notifications (reply/reaction/mention/poll) are owned by the Story Service and shown in the bell next to Post's notifications.

## Phase B - Stories backend (Story Service) - DONE and tested
- [x] Media upload with validation (type from bytes, size, image decode/re-encode, video length), signed expiring URLs
- [x] Publish image/video stories: caption, overlays (text, mention, link, hashtag, poll), audience
- [x] Privacy: everyone / close friends audience, hide-from list, who-can-see, reply permission, mention permission
- [x] Viewer-aware authorization on every read; uniform 404 for hidden content
- [x] Tray (unseen first, muted last), per-user list, view tracking, viewer list + analytics (owner only)
- [x] Replies, reactions, poll votes (+ story notifications honouring preferences)
- [x] Expiry enforced in queries; archive; purge keeping highlighted stories; unpublished uploads removed
- [x] Highlights: create / rename / reorder stories / cover / reorder highlights / delete; shown on profiles
- [x] Close friends, hidden-from, muted stories, story settings
- [x] Report story, delete story (+ media), data export, guarded data deletion, rate limits
- [x] Tests (123) + migration of the existing stories.db verified on a copy of the real data
- [~] Video: size/duration checks are unit-tested with a stubbed duration reader; playback not verified in a browser

## Phase C - Stories frontend - DONE, verified in the browser
- [x] Tray, full-screen viewer (progress, auto-advance, hold to pause, tap/keyboard navigation, person-to-person)
- [x] Composer with upload progress, draggable overlays, audience, retry without re-upload
- [x] Reply (+ DM through the existing chat client), reactions, poll, links, mentions
- [x] Insights, delete (confirmed), archive screen, highlights on profile + editor, report, mute
- [~] Not exercised in a browser: video stories, replies delivered as chat messages to an owner who has a registered device (delivery to an owner without one was seen to fall back correctly)

## Phase D - Profile - DONE except items blocked by the freeze
- [x] Own and other profiles, real counts, story ring, Highlights, Tagged / Posts / Media / Saved tabs
- [x] Followers / following lists (search, paging, real follow buttons), "Follows you", Message button
- [x] Edit profile (name, bio, photo upload); copy/share profile link; story controls (Close Friends, hide my story, mute)
- [x] Loading, error and not-found states; no mock fallbacks
- [!] Private accounts, follow requests, block/restrict/report user, username/website, remove photo, mutual followers (see below)

## Phase E - Settings - DONE (only settings that work)
- [x] Decorative catalogue deleted (nothing read its values); rebuilt as 8 working pages
- [x] Story privacy / replies / mentions / archive / Close Friends / hide-from / muted (server-side)
- [x] Story notification preferences (enforced when the notification is created)
- [x] Appearance & accessibility (theme, high contrast, reduce motion, autoplay), saved on the device with real effects
- [x] Your information: real JSON download; guarded story-data deletion; Account: edit profile, log out of this device
- [!] Password, sessions, 2FA, deactivate/delete account, post-notification preferences (see below)

## Phase F - Verification - DONE
- [x] Story 123, News 12, Chart 12 passing
- [x] Regression: Post 76, Chat 27 (in place, nothing written), Community 110, Explore 56 (on copies)
- [x] No source file changed in Post / Chat / Explore / Community (checked by modification times)
- [x] Live API script (25 checks) and browser verification of the critical flows
- [x] Documentation (PROJECT_DOCUMENTATION.md, story-service/README.md)

## Round 2 (2026-10-15) - DONE, verified in the browser
- [x] Post card: carousel, double-tap like, likes line, caption "more", mentions/hashtags/links, working menu (edit/delete/go to/share/unfollow)
- [x] Post page `/p/:id`, threaded comments (reply/edit/delete own), no fake comments
- [x] Multi-photo/video composer with all-or-nothing publishing; hashtag page `/tags/:tag`
- [x] Share sheet: encrypted DM, add post to story, copy link, native share (shares counted)
- [x] Story stickers: question, slider, quiz (answer hidden until answered), countdown + reminders, shared post
- [x] Story composer filters and drawing baked into the photo; share story by DM; `/stories/:id`
- [x] Notifications page with grouping and follow back; Suggested for you; search `#tag` + recent searches; feed paging
- [x] Error boundary; fixed drawing crash and post timezone bug
- [!] Comment likes, "liked by" list, saved collections, mutual followers - need new Post endpoints (frozen)
- [~] Video posts/stories not verified in a browser

## Completeness pass (2026-10-17) - DONE, verified
- [x] News bookmarks require login and are private per account (was: anyone could read/change anyone's)
- [x] No fake login token fallback; forged dev tokens removed from `.env`; expired logins signed out
- [x] Chat keys encrypted at rest in IndexedDB (were plaintext in localStorage), with migration
- [x] News: no mock feed, real errors + retry, Saved tab, paging; News API key out of source; CORS restricted
- [x] Chats: no fake calls / presence / seen ticks / local-only hearts; real day dividers
- [x] No stock photos as avatars; top bar shows your real photo
- [x] Fixed chat auto-scroll on every keystroke and the stock chart console error
- [ ] Leftover files (stray .db files, talktrading-frontend.zip, root __pycache__) - waiting for your OK to delete

## Blocked by the freeze (cannot be done without changing Post/Chat; stated honestly)
| Feature | Why blocked |
|---|---|
| Private accounts, follow requests (send/accept/reject/cancel) | Post owns the follow edges and all post/profile reads; its follow endpoint always creates the follow immediately and its post/profile APIs would stay open to anyone, so a flag kept elsewhere would not be enforceable |
| Block / restrict (and enforcement of blocks on posts, profiles, likes, comments, DMs) | Same: enforcement points are inside Post/Chat. A block list kept in Story would only hide stories and would mislead users |
| Mute posts in the feed | Feed ranking/filtering is inside Post |
| Report user/post/comment | No moderation store outside Post; only story reports are implemented (Story Service) |
| Change username, website field, remove avatar | Post's `PUT /users/me` accepts only display name and bio; no username/website columns; no avatar delete |
| Change password, login sessions list/revoke, server-side logout, 2FA, deactivate/delete account | Credentials and tokens are owned by Post; it has no such endpoints and does not check session revocation |
| Notification preferences for likes/comments/follows/mentions | Those notifications are generated inside Post; it has no preference check (only story notification preferences are enforceable) |
| Mention/comment permission settings for posts, hidden words in comments | Enforcement is inside Post |
| Message notification preferences, DM privacy | Inside Chat |
| Push notifications, email notifications | No push/mail infrastructure exists in the repo |
| Language preference | The app has no translation layer; not offered |
