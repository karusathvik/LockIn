# Locked In

A local-only Chrome extension for blocking distracting websites. No AI models, page analysis, or external services.

## Install or update

Load this folder with **Load unpacked** at chrome://extensions. For an existing installation, use its Reload button and accept any new permission prompt.

## Use

- Click **Block this website** in the popup, or paste a domain or full URL into settings.
- Blocks cover subdomains, open tabs, embedded frames, and client-side navigation.
- Use monkeytype.com for Monkeytype, mail.google.com for Gmail, outlook.live.com for personal Outlook, or outlook.office.com for work email. Add other hosts separately if your provider uses them.
- Start a 15, 30, 60, or 120 minute focus session in settings to prevent removing blocks. Adding blocks is still allowed.
- To end early, enter a reason (100–500 characters), wait 60 seconds, then explicitly confirm. You can cancel the request to keep focusing. The countdown survives restarts; ending early leaves blocks in place and earns no progress.
- Settings includes a GitHub-style heatmap for the last 364 days and all-time session, minute, and active-day totals. Shades indicate 1–29, 30–59, 60–119, and 120+ completed minutes. Sessions are grouped by the local date they started.
- Progress lives only in chrome.storage.local in this Chrome profile. Completed timers are recorded once on the next worker startup or settings refresh, including timers that expired while Chrome was closed. This tracks timer completion rather than actual activity. Older sessions from before this update cannot be reconstructed.
- Session deadlines persist across browser restarts. When the session ends, blocks remain until removed.
- Old AI keywords and allow-list entries are removed on extension update; explicit blocks now always take precedence.

Chrome still allows disabling or uninstalling extensions, and changing the computer clock can affect the timer. This is a focus aid rather than an administrator-enforced restriction. Incognito requires explicitly enabling the extension there; other browsers and Chrome profiles need their own installation.

## Verification

Run `node --test tests/*.test.cjs`. Manual Chrome checks: block an already-open Monkeytype or Gmail tab, revisit it via Back and a new tab, restart Chrome during a session, and verify removal stays disabled until the deadline.

## Personal reminders

Settings lets you save a goal, one concrete next step, and an optional HTTP(S) work link. These appear on the blocked page. The work link follows existing blocks and cannot unlock a website.

Import a UTF-8 text file (one phrase per line) or a JSON array of strings: up to 64 KB, 100 unique phrases, and 280 characters per phrase. Imports replace the draft; click Save reminders to apply. Leave the list blank for built-in reminders. One phrase is chosen per local day without notifications, external requests, API keys, or AI.

You can add one optional PNG, JPEG, or WebP below 1 MB. The image, phrases, and goal stay in chrome.storage.local; uninstalling the extension removes this local data. Use Preview my reminder page to review the result.

## Focus Dojo interface

The dashboard, popup, and blocked page use an anime-inspired night palette with a moon-and-mountain scene, cyan activity cells, and violet accents. The dashboard keeps the heatmap first and website additions beside session controls. Active sessions show a live countdown and elapsed-time bar. No animation, remote fonts, or theme image downloads are required.

Import `focus-phrases.json` from this folder for an optional set of original training-arc reminders. Goal and next-step reminders are practical prompts rather than a guarantee of improved productivity; no live content API is used.
