// ==========================================
// JUST DIVIDE — KID MODE  (vanilla JavaScript, no libraries)
// ==========================================
//
// How the file is organised:
//   1. Config + game state
//   2. Small helpers (storage, random tiles, tile art)
//   3. Merge rules (pure logic)
//   4. Player actions (drop on grid, KEEP, TRASH, undo, restart)
//   5. Rendering + animations
//   6. Drag & drop, buttons, keyboard
//   7. Timer, pause, help, fullscreen, stage scaling

// ---------- 1. Config ----------

const GRID_SIZE = 4;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;   // 16 slots
const QUEUE_LENGTH = 3;                     // upcoming tiles, always 3
const MAX_UNDO_STEPS = 10;
const POINTS_PER_LEVEL = 10;                // every 10 points = next level
const GAME_OVER_DELAY_MS = 700;             // lets the last animation finish

// Difficulty changes which numbers can appear and how many trash uses
// the player gets each level. `pool` is sorted from easy to hard.
const DIFFICULTY = {
    easy:   { trashPerLevel: 5, pool: [2, 3, 4, 5, 6, 8, 9, 10, 12] },
    medium: { trashPerLevel: 3, pool: [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20] },
    hard:   { trashPerLevel: 2, pool: [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 27, 30, 36] }
};
const DEFAULT_DIFFICULTY = "medium";
const START_POOL_SHARE = 0.6;   // share of the pool available at level 1

const STORAGE_KEYS = {
    best: "justDivideBest",
    difficulty: "justDivideDifficulty"
};

// ---------- Game State ----------

let grid = Array(CELL_COUNT).fill(null);   // 16 tile values (null = empty slot)
let queue = [];                            // 3 upcoming tiles, queue[0] is the active tile
let keepVal = null;                        // stored tile
let score = 0;
let best = loadBest();
let level = 1;
let trashUses = 0;
let hintsOn = false;
let undoStack = [];                        // max 10 snapshots
let difficulty = loadDifficulty();

let paused = false;
let isGameOver = false;
let draggingActiveTile = false;            // true only while the top queue tile is being dragged
let turnPoints = 0;                        // points earned by the current move (for the popup)
let leveledUpThisTurn = false;
let gameOverTimeout = null;

// ---------- DOM Elements ----------

const gameShell = document.getElementById("game");
const gridElement = document.getElementById("grid");
const queueElement = document.getElementById("queue");
const keepSlot = document.getElementById("keep-slot");
const keepValueElement = document.getElementById("keep-value");
const trashSlot = document.getElementById("trash-slot");
const boardElement = document.querySelector(".board");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const levelElement = document.getElementById("level");
const trashCountElement = document.getElementById("trash-count");
const scoreBadge = document.getElementById("score-badge");
const levelBadge = document.getElementById("level-badge");
const gameOverElement = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const finalBestElement = document.getElementById("final-best");
const timerDisplay = document.getElementById("timer-display");
const undoButton = document.getElementById("undo-btn");
const hintButton = document.getElementById("hint-btn");
const difficultyButtons = document.querySelectorAll(".difficulty-btn");

const cells = [];   // the 16 grid slot elements, created once in buildGrid()

// ---------- 2. Helpers ----------

// LocalStorage can throw (private mode, blocked cookies) so every access is guarded.
function readStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, String(value));
    } catch (error) {
        // Storage unavailable: the game still works, the value just isn't remembered.
    }
}

function loadBest() {
    const saved = Number(readStorage(STORAGE_KEYS.best));
    return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
}

function loadDifficulty() {
    const saved = readStorage(STORAGE_KEYS.difficulty);
    return DIFFICULTY[saved] ? saved : DEFAULT_DIFFICULTY;
}

// Tiles use the supplied colour art. Colour is only a "category" hint, not game logic.
const TILE_ART = {
    blue:   { file: "blue.svg",    textColor: "#167BDC" },
    pink:   { file: "pink.svg",    textColor: "#DC2AC8" },
    orange: { file: "orange.svg",  textColor: "#CF3F09" },
    red:    { file: "red.svg",     textColor: "#CD0016" },
    purple: { file: "purpule.svg", textColor: "#992EF4" }   // (sic) file name as supplied
};

const TILE_COLOR_BY_VALUE = {
    2: "pink", 3: "blue", 4: "orange", 5: "red", 6: "purple",
    8: "blue", 9: "pink", 10: "orange", 12: "red", 15: "purple",
    16: "blue", 18: "orange", 20: "red",
    24: "purple", 25: "pink", 27: "blue", 30: "orange", 36: "red"
};
const COLOR_CYCLE = ["blue", "pink", "orange", "red", "purple"];

function getTileColor(value) {
    return TILE_COLOR_BY_VALUE[value] || COLOR_CYCLE[value % COLOR_CYCLE.length];
}

// The supplied tile SVGs have a number baked into the artwork. The copies in
// assets/blank/ are the same art with only that number removed, so the live
// number below is the only one that shows.
function getTileAsset(value) {
    return `assets/blank/${TILE_ART[getTileColor(value)].file}`;
}

// Higher levels unlock bigger numbers (difficulty ramps up slightly).
function getActivePool() {
    const { pool } = DIFFICULTY[difficulty];
    const startCount = Math.ceil(pool.length * START_POOL_SHARE);
    const count = Math.min(pool.length, startCount + (level - 1));
    return pool.slice(0, count);
}

function randomTile() {
    const pool = getActivePool();
    return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Queue ----------

function refillQueue() {
    while (queue.length < QUEUE_LENGTH) {
        queue.push(randomTile());
    }
}

// Remove the active tile and slide the next ones up (queue stays at 3).
function advanceQueue() {
    queue.shift();
    refillQueue();
}

// ---------- 3. Merge Rules ----------

function getNeighbors(index) {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    const neighbors = [];

    if (row > 0) neighbors.push(index - GRID_SIZE);
    if (row < GRID_SIZE - 1) neighbors.push(index + GRID_SIZE);
    if (col > 0) neighbors.push(index - 1);
    if (col < GRID_SIZE - 1) neighbors.push(index + 1);

    return neighbors;
}

// Two tiles merge when they are equal, or the larger divides evenly by the smaller.
function canMerge(a, b) {
    if (a === b) return true;
    const larger = Math.max(a, b);
    const smaller = Math.min(a, b);
    return larger % smaller === 0;
}

// Result of merging: 0 means both tiles disappear, otherwise the new number
// (which replaces the larger tile). A quotient of 1 is never placed.
function mergeValue(a, b) {
    if (a === b) return 0;
    const result = Math.max(a, b) / Math.min(a, b);
    return result === 1 ? 0 : result;
}

// Keep merging from `startIndex` until nothing else can merge (chain reactions).
function resolveMerges(startIndex) {
    let index = startIndex;

    while (grid[index] !== null) {
        const value = grid[index];
        const partnerIndex = getNeighbors(index).find(
            (n) => grid[n] !== null && canMerge(value, grid[n])
        );

        if (partnerIndex === undefined) return;

        const partnerValue = grid[partnerIndex];
        const result = mergeValue(value, partnerValue);

        if (result === 0) {
            // Equal tiles: both disappear
            grid[index] = null;
            grid[partnerIndex] = null;
            addScore(2);
            return;
        }

        // Divisible tiles: result replaces the larger tile, smaller one disappears
        const largerIndex = value >= partnerValue ? index : partnerIndex;
        const smallerIndex = largerIndex === index ? partnerIndex : index;

        grid[largerIndex] = result;
        grid[smallerIndex] = null;
        addScore(result);

        index = largerIndex;   // the new number may merge again
    }
}

// ---------- Score + Levels ----------

function addScore(points) {
    score += points;
    turnPoints += points;

    if (score > best) {
        best = score;
        writeStorage(STORAGE_KEYS.best, best);
    }

    const newLevel = Math.floor(score / POINTS_PER_LEVEL) + 1;

    if (newLevel > level) {
        level = newLevel;
        trashUses = DIFFICULTY[difficulty].trashPerLevel;   // fresh trash uses each level
        leveledUpThisTurn = true;
    }
}

// ---------- Game Over ----------

function hasValidMerge() {
    for (let i = 0; i < CELL_COUNT; i++) {
        if (grid[i] === null) continue;

        for (const n of getNeighbors(i)) {
            if (grid[n] !== null && canMerge(grid[i], grid[n])) {
                return true;
            }
        }
    }
    return false;
}

// Game over = grid full AND no valid merge left.
function checkGameOver() {
    if (grid.includes(null)) return;
    if (hasValidMerge()) return;

    isGameOver = true;
    stopTimer();
    gameOverTimeout = setTimeout(showGameOver, GAME_OVER_DELAY_MS);
}

function showGameOver() {
    finalScoreElement.textContent = score;
    finalBestElement.textContent = best;
    gameOverElement.classList.remove("hidden");
}

// ---------- 4. Player actions ----------

function canAct() {
    return !paused && !isGameOver;
}

// Undo snapshot: everything that defines the game position.
function saveState() {
    undoStack.push({
        grid: [...grid],
        queue: [...queue],
        keepVal: keepVal,
        score: score,
        level: level,
        trashUses: trashUses
    });

    if (undoStack.length > MAX_UNDO_STEPS) {
        undoStack.shift();
    }
}

function startGame() {
    clearTimeout(gameOverTimeout);

    grid = Array(CELL_COUNT).fill(null);
    queue = [];
    keepVal = null;
    score = 0;
    level = 1;
    trashUses = DIFFICULTY[difficulty].trashPerLevel;
    undoStack = [];
    isGameOver = false;
    setPaused(false);       // best score is kept on purpose

    gameOverElement.classList.add("hidden");

    refillQueue();
    render();
    resetTimer();
}

function setDifficulty(name) {
    if (!DIFFICULTY[name] || name === difficulty) return;
    difficulty = name;
    writeStorage(STORAGE_KEYS.difficulty, name);
    startGame();            // a new difficulty starts a fresh game
}

// Drag/drop the active tile into an empty grid slot.
function playActiveTileAt(index) {
    if (!canAct() || grid[index] !== null || queue.length === 0) return;

    const tile = queue[0];
    saveState();

    // What the board looks like the moment the tile lands (used for animations)
    const boardBefore = [...grid];
    boardBefore[index] = tile;

    turnPoints = 0;
    leveledUpThisTurn = false;

    grid[index] = tile;
    advanceQueue();
    resolveMerges(index);   // may merge immediately

    render({ before: boardBefore, placedIndex: index, animateQueue: true });
    showFeedback();
    checkGameOver();
}

// KEEP: store the active tile, or swap it with the stored one.
function keepActiveTile() {
    if (!canAct() || queue.length === 0) return;
    if (keepVal === queue[0]) return;   // swapping identical tiles changes nothing

    saveState();

    if (keepVal === null) {
        keepVal = queue[0];
        advanceQueue();
    } else {
        const stored = keepVal;
        keepVal = queue[0];
        queue[0] = stored;
    }

    render({ animateQueue: true, animateKeep: true });
}

// TRASH: throw away the active tile (limited uses per level).
function trashActiveTile() {
    if (!canAct() || queue.length === 0) return;

    if (trashUses <= 0) {
        restartAnimation(trashSlot, "shake");
        return;
    }

    saveState();
    trashUses--;
    advanceQueue();

    render({ animateQueue: true });
}

function undoMove() {
    if (!canAct() || undoStack.length === 0) return;

    const previous = undoStack.pop();

    grid = [...previous.grid];
    queue = [...previous.queue];
    keepVal = previous.keepVal;
    score = previous.score;
    level = previous.level;
    trashUses = previous.trashUses;

    render({ animateQueue: true, animateKeep: true });
}

function toggleHints() {
    hintsOn = !hintsOn;
    updateHints();
    updateControls();
}

// ---------- 5. Rendering ----------

const SVG_NS = "http://www.w3.org/2000/svg";
const NUMBER_FONT = '"Trebuchet MS", "Segoe UI", Arial, Helvetica, sans-serif';
const inkCanvas = document.createElement("canvas").getContext("2d");
const TILE_VIEWBOX = 86;          // size of the supplied tile SVGs
const TILE_FACE_CENTER = 42.7;    // centre of the tile's coloured face inside that box

// Measure the real ink of the digits so they can be centred exactly,
// whatever font the player's computer ends up using.
function centerNumber(text, fontSize) {
    inkCanvas.font = `900 ${fontSize}px ${NUMBER_FONT}`;
    const m = inkCanvas.measureText(text);
    return {
        x: TILE_FACE_CENTER - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
        y: TILE_FACE_CENTER + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
    };
}

function createNumberSvg(value) {
    const label = String(value);
    const fontSize = label.length >= 3 ? 28 : 40;
    const position = centerNumber(label, fontSize);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${TILE_VIEWBOX} ${TILE_VIEWBOX}`);
    svg.classList.add("tile-number");

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", position.x);
    text.setAttribute("y", position.y);
    text.setAttribute("font-size", fontSize);
    text.setAttribute("fill", TILE_ART[getTileColor(value)].textColor);
    text.textContent = label;

    svg.appendChild(text);
    return svg;
}

// One tile = supplied SVG art as background + one centred number on top.
function createTile(value) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.value = value;
    tile.style.backgroundImage = `url("${getTileAsset(value)}")`;
    tile.appendChild(createNumberSvg(value));
    return tile;
}

// A copy of a tile that just changed or disappeared, so it can animate away.
function createGhostTile(value, wasJustPlaced) {
    const ghost = createTile(value);
    ghost.classList.add("tile-ghost");
    if (wasJustPlaced) ghost.classList.add("ghost-placed");

    ghost.addEventListener("animationend", (event) => {
        if (event.animationName === "tile-vanish") ghost.remove();
    });
    return ghost;
}

function restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;   // force reflow so the animation can replay
    element.classList.add(className);
}

// `effects` is optional and only controls animation:
//   before       board right after the tile landed (before merges)
//   placedIndex  slot the tile was dropped on
//   animateQueue / animateKeep  play the pop-in animation
function render(effects = {}) {
    renderGrid(effects);
    renderQueue(effects);
    renderKeep(effects);
    renderStats();
    updateHints();
    updateControls();
}

function buildGrid() {
    gridElement.innerHTML = "";

    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.index = i;

        wireDropTarget(cell, () => grid[i] === null, () => playActiveTileAt(i));

        gridElement.appendChild(cell);
        cells.push(cell);
    }
}

function renderGrid(effects) {
    const before = effects.before || null;
    const placedIndex = effects.placedIndex;

    cells.forEach((cell, i) => {
        cell.replaceChildren();

        const value = grid[i];
        const previous = before ? before[i] : value;

        // Something was here a moment ago and is now gone or changed: animate it out
        if (previous !== null && previous !== value) {
            cell.appendChild(createGhostTile(previous, i === placedIndex));
        }

        if (value !== null) {
            const tile = createTile(value);

            if (before && previous === value && i === placedIndex) {
                tile.classList.add("tile-drop");        // placed tile, no merge
            } else if (before && previous !== value) {
                tile.classList.add("tile-merge");       // merge result
            }

            cell.appendChild(tile);
        }
    });
}

function renderQueue(effects) {
    queueElement.innerHTML = "";

    queue.forEach((value, index) => {
        const tile = createTile(value);
        tile.classList.add(`queue-pos-${index}`);
        if (effects.animateQueue) tile.classList.add("pop-in");

        if (index === 0) {
            tile.classList.add("queue-active");
            makeDraggable(tile);
        }

        queueElement.appendChild(tile);
    });
}

function renderKeep(effects) {
    keepValueElement.innerHTML = "";

    if (keepVal === null) return;

    const tile = createTile(keepVal);
    if (effects.animateKeep) tile.classList.add("pop-in");
    keepValueElement.appendChild(tile);
}

function renderStats() {
    scoreElement.textContent = score;
    bestElement.textContent = best;
    levelElement.textContent = level;
    trashCountElement.textContent = trashUses;
}

function updateControls() {
    undoButton.disabled = undoStack.length === 0;

    trashSlot.classList.toggle("disabled", trashUses <= 0);
    trashSlot.setAttribute("aria-disabled", trashUses <= 0);

    hintButton.classList.toggle("on", hintsOn);
    hintButton.setAttribute("aria-pressed", hintsOn);

    difficultyButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.difficulty === difficulty);
    });
}

// Hints: highlight EMPTY slots where the active tile would merge with a neighbour.
function updateHints() {
    const activeTile = queue[0];

    cells.forEach((cell, i) => {
        let isHint = false;

        if (hintsOn && !isGameOver && activeTile !== undefined && grid[i] === null) {
            isHint = getNeighbors(i).some(
                (n) => grid[n] !== null && canMerge(activeTile, grid[n])
            );
        }

        cell.classList.toggle("hint", isHint);
    });
}

// "+N" score popup, badge bump and level-up message
function showFeedback() {
    if (turnPoints > 0) {
        const popup = document.createElement("div");
        popup.className = "score-popup";
        popup.textContent = `+${turnPoints}`;
        popup.addEventListener("animationend", () => popup.remove());
        boardElement.appendChild(popup);

        restartAnimation(scoreBadge, "bump");
    }

    if (leveledUpThisTurn) {
        const message = document.createElement("div");
        message.className = "score-popup level-up";
        message.textContent = "LEVEL UP!";
        message.addEventListener("animationend", () => message.remove());
        boardElement.appendChild(message);

        restartAnimation(levelBadge, "bump");
    }
}

// ---------- 6. Drag & Drop, buttons, keyboard ----------

// Only the top queue tile can be dragged.
function makeDraggable(tile) {
    tile.draggable = true;

    tile.addEventListener("dragstart", (event) => {
        if (!canAct()) {
            event.preventDefault();
            return;
        }
        draggingActiveTile = true;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", tile.dataset.value);   // Firefox needs data to start a drag
        setTimeout(() => tile.classList.add("dragging"), 0);
    });

    tile.addEventListener("dragend", () => {
        tile.classList.remove("dragging");
    });
}

// Lets an element accept the dragged active tile. `canDrop` is checked on every
// event so an invalid drop can never change the game state.
function wireDropTarget(element, canDrop, onDrop) {
    element.addEventListener("dragover", (event) => {
        if (!draggingActiveTile || !canAct() || !canDrop()) return;
        event.preventDefault();   // required to allow dropping
        event.dataTransfer.dropEffect = "move";
        element.classList.add("drag-over");
    });

    element.addEventListener("dragleave", (event) => {
        if (!element.contains(event.relatedTarget)) {
            element.classList.remove("drag-over");
        }
    });

    element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drag-over");

        if (!draggingActiveTile || !canAct() || !canDrop()) return;
        draggingActiveTile = false;
        onDrop();
    });
}

// Always clean up when a drag ends (dropped anywhere, or cancelled with Esc).
document.addEventListener("dragend", () => {
    draggingActiveTile = false;
    document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
});

buildGrid();
wireDropTarget(keepSlot, () => queue.length > 0, keepActiveTile);
wireDropTarget(trashSlot, () => trashUses > 0, trashActiveTile);

// Clicking KEEP / TRASH also works (and Enter / Space when focused)
function onActivate(element, action) {
    element.addEventListener("click", action);
    element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            action();
        }
    });
}

onActivate(keepSlot, keepActiveTile);
onActivate(trashSlot, trashActiveTile);

undoButton.addEventListener("click", undoMove);
hintButton.addEventListener("click", toggleHints);
document.getElementById("restart-btn").addEventListener("click", startGame);
document.getElementById("play-again-btn").addEventListener("click", startGame);

difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => setDifficulty(button.dataset.difficulty));
});

const KEY_DIFFICULTY = { "1": "easy", "2": "medium", "3": "hard" };

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;

    const key = event.key.toLowerCase();

    if (key === "z") undoMove();
    else if (key === "r") startGame();
    else if (key === "g") toggleHints();
    else if (KEY_DIFFICULTY[key]) setDifficulty(KEY_DIFFICULTY[key]);
    else if (key === "escape") helpModal.classList.add("hidden");
});

// ---------- 7. Timer, pause, help, fullscreen, scaling ----------

let elapsedSeconds = 0;
let timerInterval = null;

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function tickTimer() {
    if (paused) return;
    elapsedSeconds++;
    timerDisplay.textContent = formatTime(elapsedSeconds);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    timerInterval = setInterval(tickTimer, 1000);
}

// Pause button
const pauseButton = document.getElementById("pause-btn");
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="30" height="30"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M7 5l12 7-12 7V5z" fill="currentColor"/></svg>';

function setPaused(value) {
    paused = value;
    gameShell.classList.toggle("paused", paused);
    pauseButton.setAttribute("aria-label", paused ? "Resume" : "Pause");
    pauseButton.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
}

pauseButton.addEventListener("click", () => {
    if (!isGameOver) setPaused(!paused);
});

// Help modal
const helpButton = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");

helpButton.addEventListener("click", () => helpModal.classList.remove("hidden"));
document.getElementById("help-close-btn").addEventListener("click", () => helpModal.classList.add("hidden"));
helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) helpModal.classList.add("hidden");
});

// Fullscreen (whole page, so the wallpaper stays behind the stage)
document.getElementById("fullscreen-btn").addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
});

// Responsive scaling: fit the fixed-size stage (1440x1024 landscape,
// 800x1280 portrait, see style.css) inside the window and centre it.
function fitStage() {
    const stageWidth = gameShell.offsetWidth;
    const stageHeight = gameShell.offsetHeight;
    const scale = Math.min(window.innerWidth / stageWidth, window.innerHeight / stageHeight);
    const offsetX = (window.innerWidth - stageWidth * scale) / 2;
    const offsetY = (window.innerHeight - stageHeight * scale) / 2;

    gameShell.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

window.addEventListener("resize", fitStage);

// ---------- Start ----------

fitStage();
startGame();
