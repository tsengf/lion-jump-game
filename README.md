# Francis — The Little Lion Run

A cozy, Chrome dinosaur–inspired endless runner featuring Francis, a round plush lion. Built with HTML, CSS, and the Canvas API. No build step or runtime dependencies.

## Play locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Controls

- **Space / ↑ / W**: start, jump, or restart.
- **↓ / S (hold)**: duck under branches.
- **P / Escape**: pause or resume.
- **Touch**: use the Jump and Duck buttons; tapping the scene also jumps.

Francis starts with **3 tufts of mane**. Touching broccoli automatically eats it, visibly grows his mane by one tuft, and adds 25 points. There is no manual eating action or limit on stored tufts. Washing machines replace the cacti: jump over them to protect the mane. Duck under branches, which also remove one tuft on contact. Each obstacle can damage Francis only once, with a brief grace period after a hit. Losing the last tuft ends the run.

A new level starts every 6,000 units of distance. Scrolling continuously accelerates from 300 to 630 units per second as distance increases, while obstacle spacing stays at least 1.65 seconds. The level indicator updates automatically. The mane meter fills at six tufts; its numeric counter continues beyond six, and the drawn mane keeps growing at a tapering rate. Mane growth does not enlarge the obstacle collision box.

Personal bests are saved in browser local storage when a run ends. If storage is unavailable, the personal best lasts for the session. Sound is optional and synthesized in the browser. Switching tabs pauses the run. Fonts use Google Fonts with local system fallbacks; gameplay also works offline.
