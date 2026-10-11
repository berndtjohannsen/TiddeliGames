# TiddeliGames

This is an app that includes several simple small childrens games. It is a web (PWA) apps and can run on any supported platform including phones and tablets. Primarily tested on Chrome browsers on Windows and Android. Games are in swedish but are pretty easy to localize. No backend is required. Copy and install on any web server to run.

The game can optionally (user selection) be installed as an app or just run in the browser.

Try here: https://tiddelipom.com

## Features
Several games have an element of learning. Letters, words, numbers and simple arithmetics. Best played sitting in the knee of your parents or grand-parents.

Technical details in `design.md`.

## Assets and deployment

Game assets (images, sounds, video) are loaded from a configurable base URL:

- **Local development:** When the app is opened on `localhost` or `127.0.0.1`, it requests assets from `/TiddeliGames-assets/`. Serve the TiddeliGames-assets repo (or a copy of it) at that path, e.g. by serving from a parent directory that contains both this repo and the assets folder.
- **Production (e.g. Netlify):** The app uses `APP_CONFIG.assetBaseUrl` in `js/config.js` (e.g. `https://tiddeligames-assets.netlify.app`). Deploy the main app from this repo and the assets from the separate assets repo to their own Netlify sites (or equivalent). No config change is needed when pushing; the hostname selects local vs production behaviour.

## License

This project is licensed for **non-commercial use only**.

### Permissions (Non-Commercial Use)
- ✅ Use the software for personal, educational, or non-commercial purposes
- ✅ Modify and adapt the code for non-commercial projects
- ✅ Share and distribute for non-commercial purposes
- ✅ Use in educational institutions and non-profit organizations

### Restrictions
- ❌ Commercial use is **not permitted** without explicit written permission
- ❌ Selling or licensing the software or derivatives for commercial purposes
- ❌ Using in commercial products or services without authorization
- ❌ The audio and image files are provided for use only within this app. You may not extract, copy, modify, or redistribute any of these files separately, even for non-commercial purposes.

### Third-Party Components
This project uses the following third-party libraries:
- **Tailwind CSS** - MIT License (commercial-safe)
- **Tone.js** - MIT License (commercial-safe)

These third-party components have their own licenses which allow commercial use. 

### Rights
All rights reserved. For commercial licensing inquiries, please contact the repository owner.

---
### Credits
Some of the music and sound is created with Suno AI for non-commercial purposes.
Some of the music and sound is created with Elevenlabs for non-commercial purposes.
