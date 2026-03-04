# audio/

Add your MP3 (or OGG/WAV) files here, then update the `AUDIO_TRACKS` array in `js/content.js` to match.

```js
const AUDIO_TRACKS = [
  { title: 'Accomplice to a Traiter (from The Bostrom Scenario)',      file: 'audio/M20_Accomplice_to_a_Traitor.mp3'      },
  { title: "Malthouse Costumes (from The Bostrom Scenario)", file: 'audio/M45_Malthouse_Costumes.mp3' }
];
```

- The playlist is automatically **shuffled** on each page load.
- Tracks that fail to load are silently skipped, so the site still works before any files are added.
- The site must be served from a local HTTP server (not `file://`) for audio to load. Run:

```sh
cd petlil.github.io
python3 -m http.server 8000
# then open http://localhost:8000
```
