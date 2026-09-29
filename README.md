# Just Divide — Kid Mode

A math puzzle game for kids (7–12) built with **plain HTML, CSS and vanilla JavaScript** — no frameworks, no libraries, no build step.

Drag the top tile of the upcoming stack into a 4×4 grid. Equal tiles vanish; if the bigger number divides evenly by the smaller one, they merge into the answer (`12 + 3 → 4`, `15 + 5 → 3`, `9 + 3 → 3`). The game ends when the grid is full and nothing can merge.

## Run it

Open `index.html` in a browser, or serve the folder with any static server:

```bash
python -m http.server 5500   # then open http://localhost:5500
```

**Deploy on Vercel:** import the repo, framework preset **Other**, no build command, output directory = repo root (`index.html` must be at the root).

## Project structure

```text
├── index.html      page structure (ids used by main.js)
├── style.css       layout on a 1440×1024 stage, tiles, panel, animations
├── main.js         game state, merge rules, drag & drop, undo, hints, scaling
├── README.md
└── assets/
    ├── Cat.svg, Placement_Box.svg, Levels and Score.svg      (supplied)
    ├── blue.svg, pink.svg, orange.svg, red.svg, purpule.svg  (supplied tiles)
    ├── Desktop_/Landscape_/Potraite_JustDivide_Game_2.png    (supplied wallpapers)
    └── blank/          supplied tile + badge art with the baked-in text removed
```

## Approach

- **Fixed design stage, scaled to fit.** Everything is positioned on a 1440×1024 stage (the assignment's design resolution). `fitStage()` in `main.js` scales and centres it for any window size. Portrait screens switch to an 800×1280 stage where the action panel sits under the grid. The wallpaper is a full-window background, so there are no side bars.
- **Small, explicit state.** `grid` (16 values), `queue` (always 3 tiles), `keepVal`, `score`, `best`, `level`, `trashUses`, `hintsOn`, and `undoStack` (max 10). Every action changes state first, then calls one `render()` that redraws grid, queue, keep, stats, hints and buttons — so the screen can never disagree with the state.
- **Merge rules in three tiny functions.** `canMerge(a, b)`, `mergeValue(a, b)` and `resolveMerges(index)`. The result replaces the larger tile, the smaller disappears, equal tiles both disappear, a quotient of 1 is never placed. After a merge the new number is checked again, so chain reactions work.
- **Game over** = grid full **and** `hasValidMerge()` is false.
- **Best score** is saved in `localStorage` (`justDivideBest`). Every storage call is wrapped in `try/catch`, and a corrupt saved value falls back to 0.

## Decisions made

- **Baked-in numbers in the supplied tiles.** Each supplied tile SVG already contains a number (35 or 9), which would double up with the live number. I made copies in `assets/blank/` that are byte-for-byte the same artwork with only that one number element removed. The originals stay untouched in `assets/`. The same was done for the Level/Score badge, which has "LEVEL 1" baked in.
- **Number centring.** Numbers are SVG text placed using the measured ink of the digits (canvas `measureText`), so they are centred on the tile face whatever font the computer uses (measured: within 1 px on a 98 px tile).
- **KEEP / TRASH / grid drops** all use HTML5 drag & drop from the top queue tile only. Placed tiles are not draggable, occupied cells and empty areas reject drops, and every drop is re-validated in code, so a bad drop cannot change the game. KEEP and TRASH also work with a click or Enter/Space.
- **Levels.** Level = `floor(score / 10) + 1`. Reaching a new level refills the trash uses to that difficulty's allowance (Easy 5, Medium 3, Hard 2).
- **Difficulty (keys `1` `2` `3` or buttons)** changes which numbers can appear and the trash allowance, then starts a new game. Each level also unlocks one more (bigger) number, so the game gets slightly harder as you go. The choice is remembered.
- **Scoring:** equal tiles vanishing = +2, a division merge = + the quotient. The assignment doesn't specify points, so this is my own choice.
- **Undo** restores grid, queue, keep, score, level and trash count. It does not restore `best` (a best score should never go down) and does not touch the hint toggle, which is a preference that is re-applied to the restored position.
- **Restart** resets everything except the best score and difficulty.
- **Hints** (`G` or the Hint button) highlight only empty cells where the active tile equals or divides with an adjacent tile. They update after every move, keep, trash, undo and restart.
- **Animations** are short CSS animations: tile drop, merge pop, vanish, `+N` score popup, level-up message. Reduced-motion settings are respected.
- **Controls:** `Z` undo, `R` restart, `G` hints, `1/2/3` difficulty. Shortcuts are ignored with Ctrl/Cmd/Alt so browser shortcuts still work.

## Challenges

- The supplied tile and badge SVGs already had text drawn into them, so I had to remove exactly that element without damaging the bevel, gloss or borders.
- Keeping animations separate from game logic: the state changes instantly, and the animation is worked out by comparing the board "just after the tile landed" with the board after merges.
- Making the layout match the reference while still scaling cleanly — the fixed stage plus one scale factor solved this without media-query juggling.
- A full-width header was covering the pause/help buttons and swallowing their clicks; found while testing and fixed.

## What I would improve

- Touch support (pointer-based dragging instead of HTML5 drag & drop).
- Sound effects and a short first-time tutorial.
- A smarter tile generator that avoids handing out impossible boards.
- Automated tests for the merge and game-over rules.
