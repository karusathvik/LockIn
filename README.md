# Locked In

A local-only Chrome extension for blocking distracting websites. No AI models, page analysis, or external services.

## Install or update

Load this folder with **Load unpacked** at chrome://extensions. For an existing installation, use its Reload button and accept any new permission prompt.

## Use

- Click **Block this website** in the popup, or paste a domain or full URL into settings.
- Blocks cover subdomains, open tabs, embedded frames, and client-side navigation.
- Use monkeytype.com for Monkeytype, mail.google.com for Gmail, outlook.live.com for personal Outlook, or outlook.office.com for work email. Add other hosts separately if your provider uses them.
- Start a 15, 30, 60, or 120 minute focus session in settings to prevent removing blocks. Adding blocks is still allowed.
- Session deadlines persist across browser restarts. When the session ends, blocks remain until removed.
- Old AI keywords and allow-list entries are removed on extension update; explicit blocks now always take precedence.

Chrome still allows disabling or uninstalling extensions, and changing the computer clock can affect the timer. This is a focus aid rather than an administrator-enforced restriction. Incognito requires explicitly enabling the extension there; other browsers and Chrome profiles need their own installation.

## Verification

Run `node --test tests/*.test.cjs`. Manual Chrome checks: block an already-open Monkeytype or Gmail tab, revisit it via Back and a new tab, restart Chrome during a session, and verify removal stays disabled until the deadline.
