# Just Divide — Kid Mode

A vanilla JavaScript recreation of the supplied **Just Divide — Kid Mode** internship assignment.

## Approach

- Built the game with semantic HTML, responsive CSS, and plain JavaScript.
- Kept the supplied PNG/SVG assets inside `/assets` and referenced them directly.
- Used a 16-item array for the 4×4 board and a 3-item array for the upcoming queue.
- Implemented equal-tile removal and whole-number division merges.
- Added KEEP, TRASH, hints, undo, level progression, game-over detection, and LocalStorage best score.
- Added responsive layouts for desktop, landscape/tablet, and portrait/mobile sizes.
- No external JavaScript libraries are required.

## Decisions made

- The active tile is the first tile in the queue; only that tile can be dragged.
- Clicking KEEP/TRASH remains supported for mouse and keyboard users, while drag-and-drop is also supported.
- KEEP stores the active tile when empty; when occupied, it swaps with the active queue tile.
- TRASH consumes one available trash use and advances the queue.
- Hints only highlight empty cells where the current tile can immediately interact with an adjacent tile.
- Best score is stored under `justDivideBest` in LocalStorage.

## Controls

- Drag the top NEXT tile to an empty grid cell.
- Drag the top NEXT tile to KEEP or TRASH.
- Click KEEP/TRASH as an alternative input.
- `Z` — Undo
- `R` — Restart
- `G` — Toggle hints
- `1` — Easy
- `2` — Medium
- `3` — Hard

## Challenges

The main implementation challenges were keeping queue state consistent across drag/drop, KEEP and TRASH actions; resolving chained mathematical merges; restoring all relevant state during undo; and keeping the supplied artwork responsive across screen sizes.

## What I would improve

- Add richer merge/drop animations.
- Add a small tutorial for first-time players.
- Add optional sound effects and accessibility feedback.
- Add automated browser tests for merge, undo, KEEP, TRASH and game-over edge cases.

## Run locally

Open `index.html` in a modern browser, or serve the folder with any static web server.

Example:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Project structure

```text
Just_Divide/
├── index.html
├── main.js
├── style.css
├── README.md
└── assets/
    ├── Cat.svg
    ├── Levels and Score.svg
    ├── Placement_Box.svg
    ├── blue.svg
    ├── orange.svg
    ├── pink.svg
    ├── purpule.svg
    └── red.svg
```
