# M8 · INSTALL · AgentPager installs in a minute

[Milestone card](https://app.todoist.com/app/task/6hxHRQVqXq79MRMh) · Design review for Sam · 10 November 2026

## Objective

Someone Sam invites installs AgentPager from TestFlight and gets alerts through Apple's production push service. One line installs the single-file agentpager command where their agents run, and agentpager setup adds it to their agent apps. Apple can try the whole exchange from the review notes with the demo agent. Earlier promises still pass.

| Layer | What M8 delivers |
| --- | --- |
| iPhone | Install from TestFlight, make a pager, get a decision and acknowledgement through production APNs. |
| Service | Alert both iPhone builds and serve CLI downloads on the first-party host. |
| Command | Install one executable, run setup, and deliberately update it. |
| Review and invitation | Try J5 through a demo link on the same iPhone. |

SITE owns the new front page. OPEN owns public source and self-hosting guidance. FRIENDS owns the first invitee cohort and its feedback. Public App Store launch, Windows and package managers are outside M8.

## Owner decides first

| # | Choices | Recommendation and consequence |
| --- | --- | --- |
| 1 · Download host | **1a ★** agentpager.me now. **1b** GitHub Releases after OPEN. | **1a.** Keep the URL stable while the repo is private. 1b would tie a no-login install to a public release repository or a change in milestone order. |
| 2 · CLI targets | **2a ★** Apple silicon macOS plus glibc Linux x86-64 and arm64. **2b** Apple silicon macOS and glibc Linux x86-64. **2c** Apple silicon macOS only. | **2a.** Cover the Macs and common VM architectures. Each binary needs a clean run on its native target. Verify and publish the supported OS floors. Intel Mac and Alpine/musl wait for demand. [Bun targets](https://bun.sh/docs/compiler/executables) |
| 3 · CLI updates | **3a ★** Explicit agentpager update plus instructions when a server refuses an old client. **3b** Re-run the install line. **3c** Automatic updates. | **3a.** Verify and replace the managed binary in place. The owner controls when to update and restart. |
| 4 · Review and invitee demo | **4a ★** Keep the unlisted link and let it start a demo agent running the existing CLI. **4b** Review notes with a second machine running the CLI. **4c** Defer the demo and revise J5. | **4a.** A tester can complete a real exchange on one iPhone. The runner holds demo answers as the agent endpoint. A forwarded link works for a person with a valid pager number. Apple documents beta review and testing instructions. Its published guidance does not require an AgentPager-specific demo. Sam previously wanted this link for both audiences. |
| 5 · Existing pagers | **5a ★** Give TestFlight its own identity and start with a new pager. **5b** Design transfer of existing pagers and history in M8. | **5a.** Sam can use the Xcode-installed app for existing pagers alongside TestFlight. 5b adds a migration for pager keys, local history and push registrations. |
| 6 · Blueprint and checks | **6a ★** Approve the exact lines and checks below. **6b** Approve with named edits. | **6a.** Apply the lines as their behavior is built and verified. |

Other choices on their recommendations, open to override. Use email-only external invitations, automatic Xcode signing run by Sam, per-user installs, first-party HTTPS and SHA-256, the existing M7 setup adapters, and one fixed sample decision per demo session.

## Before and after

| Surface | Today | Proposed |
| --- | --- | --- |
| App install | Xcode installs the dev bundle. [Current empty state](../generated/screens/phone/empty.png) | Email invitation → TestFlight → Install → AgentPager → New pager. Apple owns the TestFlight UI. |
| CLI and /start | Clone a private repo, install build dependencies, compile, symlink, run setup. | One install line and agentpager setup. /start shows the PATH step if needed, the right server for connect and the supported targets. |
| Phone screens | [New pager](../generated/screens/phone/new.png), [decision](../generated/screens/phone/decision.png), [answered record](../generated/screens/phone/answered.png) | Use those screens with the sample decision. Native redesign is inapplicable because TestFlight, /start and the demo link are the new entry points. |
| J5 | [Current phone journey](../generated/screens/journeys/pager/README.md) uses a preinstalled agent command. | Paste a fresh pager's text into the demo, send the sample, answer the alert and return to the demo. AgentPager is in the background when the acknowledgement arrives. [Proposed artboard](M8-install/ui/walkthrough.png) |

~~~console
$ curl -fsSL https://agentpager.me/install | sh
Installed agentpager m8 in ~/.local/bin.
$ agentpager setup
[Setup reports the apps it found and what it added.]
$ agentpager update
Updated agentpager. Restart agent apps to load it. Run agentpager setup if prompted to refresh their integration.
~~~

When the shell cannot find agentpager, show the full path and the PATH step before setup. When the path already holds a checkout symlink or another unmanaged executable, stop and explain how the owner can switch it.

## Technical design

~~~text
Today
  Private checkout → native Bun build → CLI
  Xcode app and extension → dev or prod Worker → sandbox APNs with .dev topic

Proposed
  Approved release source → validated binary set → stage-specific private R2
  Stage Worker /install and /releases/* → R2 download reads → CLI and updater
  TestFlight app and extension → stage Worker → production APNs with release topic
  Xcode app and extension      → stage Worker → sandbox APNs with .dev topic
  Demo link → isolated demo runner → existing CLI → selected stage Worker
~~~

| Alternative | Fit | Reason |
| --- | --- | --- |
| Private R2 behind the stage Workers | 🟢 | Stable URL, large release files, stage separation and no runtime upload endpoint. |
| Worker static assets | 🟡 | Each Bun binary must fit the 25 MiB per-file cap. [Worker limits](https://developers.cloudflare.com/workers/platform/limits/) |
| Private GitHub Releases | 🔴 | Anonymous installs need a publicly accessible download. |
| Hosted demo runner using the existing CLI | 🟢 | Same-phone walkthrough and reuse of the CLI's authorization, card checks and encryption. Requires a small isolated runner outside the relay. |
| Browser talks directly to the relay | 🔴 | Needs an exception to PRODUCT's CLI-only rule and a second agent-side encryption implementation. |
| Demo fixture inside the phone app | 🔴 | A fixture cannot prove the production push and live exchange. |
| Select the APNs host, topic and credential as a unit | 🟢 | Keeps sandbox pushes working for the existing app on production pagers. |
| One release-only topic on the prod Worker | 🔴 | Breaks sandbox push to the .dev app on prod. |

### CLI release and update

- Compile each supported target with Bun and the embedded M7 adapters. Stamp channel, tag and commit. Keep source builds for repo work. Run the release binaries on clean native systems without Bun, Node or a repo, including a real Linux arm64 system if selected.
- Publish binaries to immutable tag paths. The stage manifest names the tag, source SHA and, for each fixed target, its path, byte count and SHA-256. Verify all assets before advancing the latest manifest with a conditional write. The stage Worker reads only allowlisted paths in its own bucket, and the publisher uses bucket-scoped access. Dev and prod use separate artifact channels, with the production build tied to the same source tag that passed on dev. [R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) · [R2 tokens](https://developers.cloudflare.com/r2/api/s3/tokens/)
- Begin install work only after the shell reads the complete wrapper. Use HTTPS from the configured first-party host, validate the size and digest, then validate the embedded release identity before installing. HTTPS and the manifest share the publisher's trust boundary.
- Serialize install and update at the destination. Verify in a temporary file beside the managed executable, then replace it atomically. An interruption, bad digest or failed check leaves the current executable usable. Keep AGENTPAGER_HOME, keys, history and config paths. Already-running clients pick up the new executable on restart. Refresh embedded integrations through the existing setup flow. An older manifest is refused. Source and unmanaged builds show the install route.
- The updater trusts the channel built into the binary, regardless of which service the agent connects to. Use the existing UpdateRequired refusal before authentication and persistence. Managed clients explain agentpager update and the service points legacy clients at the correct /start. Keep the existing admitted protocol floor through M8 so m7 continues working.

### TestFlight and APNs

- Proposed release identities are me.agentpager.app and me.agentpager.app.notifications, subject to availability. Make an archive configuration for both and share a release keychain access group between them. The development pair retains its group and existing pagers. TestFlight defaults to prod, and a fresh TestFlight pager can use the existing server override for dev checks.
- The stored token environment already picks the APNs host. Select the matching topic and credentials with it. Continue using the .dev topic for sandbox tokens even on the prod Worker. Reuse the existing key only if the Apple portal confirms production scope for the new topic. Use a distinct secret if Sam supplies a production-specific key. Cache provider tokens per credential. Verify both push paths, accounting for APNs connection binding when adding the release topic.
- Verify the app's production push and time-sensitive entitlements, the extension's signing and matching keychain group, and the alert extension's ability to decrypt on a real phone. The generic fallback alone cannot pass the decrypted-preview check. The push payload and pager storage schema remain compatible.

### Demo states, storage and privacy

- Serve an unlisted page at a separate first-party origin. A small runner on an isolated host or container runs the existing stage CLI as the demo agent. The runner is the agent's machine and keeps demo keys and readable replies there. It has no access to the relay's storage, APNs keys or deployment credentials. This preserves PRODUCT's CLI-only rule and B33.6. The runner hosting and access are assumptions to verify after approval.
- Accept pager text or number for the configured stage only. Parse the number and pass it to the CLI through AGENTPAGER_PAGER. Run fixed commands with no shell interpolation or user-selected server. Each session gets a private temporary AGENTPAGER_HOME and a reviewed sample card.yaml. The CLI checks the pager fingerprint and seals the sample and preview. It collects the answer, acknowledges it with fixed sample next steps, and finishes. Free-text change requests stay on the agent endpoint and are never passed as command arguments. The runner carries out no sample task.
- Flow: ready → sending → waiting for answer → acknowledging → finished. Associate the browser with an unguessable, short-lived session. Resume on returning to Safari and begin collection then so the acknowledgement arrives while AgentPager is in the background. Serialize each send. When the CLI marks an ask uncertain and allows a retry, reuse the same agent home and card so the CLI retains the original request id. Bound the number and lifetime of runs, expire them, and remove the temporary state at finish or expiry. No input, answer or secret goes into runner logs or browser URLs. Application database changes are inapplicable because the exchange uses existing storage and the runner has short-lived session state.

## Apple requirements and Sam's steps after approval

Apple's current upload floor is Xcode 26 and the iOS 26 SDK or later. The project targets iOS 26.0 and Xcode 27.2 is installed. Confirm that Organizer accepts the release archive. TestFlight builds are available for up to 90 days. An internal group precedes external testing, and the first external submission receives full TestFlight App Review. The testing information includes beta description, feedback and review contact, notes and sign-in details if required. AgentPager uses a pager number the reviewer makes in the app. The demo link and notes provide the complete test path. [Upload requirements](https://developer.apple.com/news/upcoming-requirements/) · [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) · [External testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/) · [Beta test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/)

The current app reads its own settings through UserDefaults and the repo has no privacy manifest. Add PrivacyInfo.xcprivacy to the release target after approval. Inventory the app and extension for all required-reason APIs and verify the manifest in the archive. CA92.1 is the candidate reason for app-only preferences. [Apple's required-reason API list](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype) · [App Store Connect upload policy](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

| Order | Sam does this after design approval | Prepared evidence or handoff |
| --- | --- | --- |
| 1 | Confirm membership and accept any pending agreement. Register or confirm the explicit release app and extension IDs and the app's Push Notifications and Time Sensitive Notifications capabilities. Confirm production APNs key scope for the release topic and provide a scoped key through 1Password if needed. | Proposed IDs and capability/keychain checklist. [App record and agreements](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) · [APNs authentication](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns) · [Keychain sharing](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps) |
| 2 | Create or confirm the App Store Connect iOS record with bundle ID, name, language, SKU and access. With his Xcode account, archive and sign both targets from the approved release source, validate and upload through Organizer. Automatic signing can manage the distribution profiles. | Release SHA and build number, archive steps, bundled privacy manifest and entitlement verification for both signed targets. [Provisioning](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/) · [Upload](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) · [APS entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/aps-environment) |
| 3 | Confirm encryption answers, attach documentation if prompted, create or confirm an internal TestFlight group and install for a push rehearsal. Enter beta metadata, What to Test and the review notes with the demo link. | Crypto inventory for the app and extension, draft metadata and same-phone review script. CryptoKit is the expected OS-provided category, subject to inventory and Sam's answers. [Beta export compliance](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-export-compliance-information-for-beta-builds/) · [Encryption documentation](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/) |
| 4 | Create the external group, add the build, submit to TestFlight App Review and handle Apple's follow-up. After clearance, send the approved email invitations and share the demo link. | Rehearsal evidence, final review notes and invite wording. [External testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/) |

Several App Store Connect roles can perform these steps under Apple's rules. This repo reserves Apple signing and account actions to Sam. The account state, bundle ID availability, credential scope and review result remain unverified.

## Exact proposed Blueprint changes

**Area 7 · B18.1 replace**

> 1. An agent that reads agentpager.me/start gets the one-line install for the agentpager command, then how to set it up and connect with the pager number its owner gave it (B29, B25).

Remove the B18 note about building from source. Keep B18.2–5 and update the area's code and journey references for the new entry points and J5.

**Area 7 · B29 rename and append**

> ### B29 · @M3 · Install and set up the agentpager command
>
> 9. @M8: One line installs the agentpager command as a single file for Apple silicon Macs and glibc Linux on x86-64 and arm64.
> 10. @M8: When a server refuses an out-of-date command, the command explains how to update and what the agent should do next.
> 11. @M8: On an installed command, agentpager update replaces the executable with the newer release from its download host and keeps the agent's keys and history. A failed update leaves the installed command usable.

Keep B29.1, .4 and .6–.8.

**Area 7 · B19 add**

> ### B19 · @M8 · Try a demo agent
>
> 1. Apple receives the unlisted demo link in the TestFlight review notes, and owners Sam invites receive it with their invitation.
> 2. The demo agent connects to a pager with its number, asks one sample decision, picks up the owner's answer, acknowledges it with next steps and finishes.
> 3. A reviewer can complete the demo from the review notes on the iPhone without an agent machine.

**Area 7 · B34 add**

> ### B34 · @M8 · Install the app from TestFlight
>
> 1. An owner Sam invites can install the iPhone app from a TestFlight invitation after Apple clears the build for external testing.
> 2. The first TestFlight install starts with a fresh pager list. Pagers in the Xcode-installed app remain available there.

**Area 4 · B17 append**

> 12. @M8: Alerts for a pager on the TestFlight app use Apple's production push service.

**JOURNEYS · J5 changes**

> 1. @M8: The owner installs AgentPager from TestFlight, makes a pager, and allows alerts when asked (B34, B26, B17).
> 2. @M8: The owner opens the demo link on the iPhone and gives the demo agent the pager's text. The demo agent connects (B19).
> 3. @M8: The owner leaves AgentPager and sends the sample from the demo. An alert arrives titled with who asked and the project, with the question as its body (B17).
> 6. @M8: The owner returns to the demo, and the demo agent picks up the answer (B32).
> 7. @M8: With AgentPager in the background, the demo agent acknowledges and finishes. The acknowledgement arrives as an alert with the agent's words (B17).
>
> - Where: on the deployed product, with the TestFlight app on a real iPhone and Apple's production push service.

Keep J5.4, .5 and .8. Add Area 7 to its areas and B19 and B34 to the Blueprint index. Update FRIENDS's queued cross-reference to the same J5 with an invited owner.

**TERMS · add**

> | Demo agent | The agent an invited owner or Apple reviewer opens from a link to try one sample decision with a pager on their phone. |

**Limits · retire L22 and L24** when the download and external TestFlight install are verified. L21 belongs to SITE.

## Acceptance checks

| Promise or gate | Pass evidence |
| --- | --- |
| B18.1–5 and B29.1, .4, .6–.9 | Install on each approved target in a clean account with no Bun, Node or clone. Verify the one executable, unsupported target, missing PATH and unmanaged destination. Run setup twice against isolated configurations and check the M7 adapters. Check /start, dev, the agent-facing homepage and retired address. |
| B29.10–11 | Force UpdateRequired in a test while keeping the deployed protocol floor. Check old and managed CLI guidance. Update across two fixture releases and reopen existing agent state and history. Exercise current release, downgrade, corrupt manifest, bad hash, wrong target, interruption and concurrent install. Failed updates leave the original executable usable. |
| B34 and B17.12 | Inspect signed entitlements and the bundled privacy manifest. Install through TestFlight on a real iPhone. Verify fresh pager list, production APNs decision and acknowledgement, decrypted preview, deep link, badge and continued sandbox alerts on prod. Reopen a real pre-M8 pager in its original app. After Apple approval, verify an email-invited install with an approved rehearsal tester if FRIENDS has yet to start. |
| B19 and J5 | Complete the same-phone walk from the review notes alone. Check unlinked public entry points, invalid stage and pager fingerprint, Safari return and resume, retry without duplicate asks, both answer forms, acknowledgement and finish. Check session expiry and cleanup, and that readable inputs and keys stay out of logs and relay storage. |
| M7 compatibility and deadline | Record the M8 candidate SHA and green pnpm smoke:dev including the existing m7 upgrade baseline by **December 9, 2026 at 9:15 p.m. Pacific (December 10 at 05:15 UTC)**. Target December 8 for the run. Apple review is independent of this cutoff. [Deadline task](https://app.todoist.com/app/task/6hxX7RPjr9M6Hr79) |
| Merge, walk and release | Required checks and risk-proportional review before merge. Verify dev from main and do Sam's walk. Tag the dev-green candidate. Deploy service, publish CLI and upload TestFlight in that order. Record production smoke, both push paths, invite and review evidence and the new upgrade baseline. |

## Log

- 31 October · Queued, taking TestFlight, the install line, release builds and the demo from FRIENDS.
- 5 November · Sam put INSTALL after CLIENTS.
- 10 November · Started as M8 in Design Review against current main at b1d3115, the completed M7 closeout cards, [PR #100](https://github.com/exocognito/agentpager/pull/100), and [production tag m7](https://github.com/exocognito/agentpager/releases/tag/m7) at 5511193. The independent Codex approval and inline HTML cards remain in Intake.
