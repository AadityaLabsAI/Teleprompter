# Teleqen

> Your words. Your flow.

Teleqen is a privacy-first, offline-oriented web teleprompter for creators, presenters, teachers and video makers. Scripts and display preferences stay in the browser; no account is required for the core experience.

## Features

- Smooth WPM-based auto-scroll with pause, resume, reset and progress
- Voice Follow using the browser's built-in Speech Recognition API when supported
- 3-second countdown with optional audio cue
- Mirror mode for physical teleprompter glass
- Fullscreen mode and Screen Wake Lock where supported
- Focus/eye-line guide
- Adjustable font size, width, line spacing and typeface
- Local persistence for scripts, WPM and prompter preferences
- Import TXT / Markdown and export TXT
- Mobile-friendly controls and keyboard shortcuts
- No backend is required for the core app

## Run locally

Requires Node.js 20+.

    npm install
    npm run dev

Production build:

    npm run lint
    npm run build

## Browser support

Core scrolling works in modern browsers. Voice Follow depends on the browser's Web Speech API and microphone permissions, so the Voice control may be unavailable on some browsers.

## Privacy

Teleqen does not need a server for the core editor/prompter workflow. Speech recognition is provided by the browser when Voice Follow is enabled; browser implementations may differ in how speech is processed.

## Deployment

The app is a Vite frontend and can be deployed to static hosting such as Vercel, Netlify or Cloudflare Pages.

## License

See LICENSE.md for the repository license.
