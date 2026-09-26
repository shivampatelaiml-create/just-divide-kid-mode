// ==========================================
// JUST DIVIDE — MAIN GAME LOGIC
// ==========================================

// ---------- Game State ----------

let grid = Array(16).fill(null);
let queue = [];
let keepVal = null;
let score = 0;
let best = Number(localStorage.getItem("justDivideBest")) || 0;
let level = 1;
let trashUses = 3;
let hintsOn = false;
let undoStack = [];
let paused = false;

// ---------- Tile Values ----------

const tileValues = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 18, 20];

// ---------- DOM Elements ----------

const gridElement = document.getElementById("grid");
const queueElement = document.getElementById("queue");
const keepSlot = document.getElementById("keep-slot");
const keepValueElement = document.getElementById("keep-value");
const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const levelElement = document.getElementById("level");
const trashCountElement = document.getElementById("trash-count");
const gameOverElement = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const finalBestElement = document.getElementById("final-best");
const gameShell = document.getElementById("game");
const timerDisplay = document.getElementById("timer-display");

// ---------- Tile Colors ----------

const tileColors = {
    2: "pink",
    3: "blue",
    4: "orange",
    5: "red",
    6: "purple",
    8: "blue",
    9: "pink",
    10: "orange",
    12: "red",
    15: "purple",
    16: "blue",
    18: "orange",
    20: "red"
};

const assetMap = {
    2: "pink.svg",
    3: "blue.svg",
    4: "orange.svg",
    5: "red.svg",
    6: "purpule.svg",
    8: "blue.svg",
    9: "pink.svg",
    10: "orange.svg",
    12: "red.svg",
    15: "purpule.svg",
    16: "blue.svg",
    18: "orange.svg",
    20: "red.svg"
};

function getTileAsset(value) {
    return `assets/${assetMap[value] || "blue.svg"}`;
}

// ---------- Start Game ----------

function startGame() {

    grid = Array(16).fill(null);
    queue = [];
    keepVal = null;
    score = 0;
    level = 1;
    trashUses = 3;
    undoStack = [];

    gameOverElement.classList.add("hidden");

    createInitialQueue();
    updateUI();
    renderGrid();
    renderQueue();
    renderKeep();
    resetTimer();

}

// ---------- Queue ----------

function randomTile() {
    const index = Math.floor(Math.random() * tileValues.length);
    return tileValues[index];
}

function createInitialQueue() {
    queue = [randomTile(), randomTile(), randomTile()];
}

function addNextTile() {
    queue.shift();
    queue.push(randomTile());
}

// ---------- Save State For Undo ----------

function saveState() {
    undoStack.push({
        grid: [...grid],
        queue: [...queue],
        keepVal: keepVal,
        score: score,
        level: level,
        trashUses: trashUses
    });

    if (undoStack.length > 10) {
        undoStack.shift();
    }
}

// ---------- Undo ----------

function undoMove() {
    if (undoStack.length === 0) {
        return;
    }

    const previous = undoStack.pop();

    grid = [...previous.grid];
    queue = [...previous.queue];
    keepVal = previous.keepVal;
    score = previous.score;
    level = previous.level;
    trashUses = previous.trashUses;

    updateUI();
    renderGrid();
    renderQueue();
    renderKeep();
}

// ---------- Render Grid ----------

function renderGrid() {

    gridElement.innerHTML = "";

    for (let i = 0; i < 16; i++) {

        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.index = i;

        cell.addEventListener("dragover", (event) => {
            event.preventDefault();
            cell.classList.add("drag-over");
        });

        cell.addEventListener("dragleave", () => {
            cell.classList.remove("drag-over");
        });

        cell.addEventListener("drop", () => {
            cell.classList.remove("drag-over");
            handleDrop(i);
        });

        if (grid[i] !== null) {
            const tile = createTile(grid[i]);
            cell.appendChild(tile);
        }

        gridElement.appendChild(cell);
    }
}

// ---------- Create Tile ----------

function createTile(value) {
    const tile = document.createElement("div");

    tile.className = `tile tile-${tileColors[value] || "blue"}`;
    tile.draggable = true;
    tile.dataset.value = value;
    tile.textContent = value;

    tile.style.backgroundImage = `url("${getTileAsset(value)}")`;

    tile.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", value);
    });

    return tile;
}

// ---------- Queue Rendering ----------

function renderQueue() {

    queueElement.innerHTML = "";

    queue.forEach((value, index) => {
        const tile = createQueueTile(value, index);
        queueElement.appendChild(tile);
    });

}

function createQueueTile(value, index) {
    const tile = document.createElement("div");

    tile.className = `queue-tile tile-${tileColors[value] || "blue"}`;
    tile.dataset.value = value;
    tile.textContent = value;

    tile.style.backgroundImage = `url("${getTileAsset(value)}")`;

    if (index === 0) {
        tile.classList.add("next-active");
        tile.draggable = true;
        tile.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", value);
        });
    }

    return tile;
}

// ---------- Grid Drop ----------

function handleDrop(index) {

    if (paused) {
        return;
    }

    if (grid[index] !== null) {
        return;
    }

    const activeTile = queue[0];

    if (!activeTile) {
        return;
    }

    saveState();
    placeTile(index, activeTile);
    addNextTile();

    renderGrid();
    renderQueue();
    updateUI();
    checkGameOver();
}

// ---------- Place Tile ----------

function placeTile(index, value) {
    grid[index] = value;
    resolveMerges(index);
}

// ---------- Merge Logic ----------

function resolveMerges(index) {

    let currentValue = grid[index];

    if (currentValue === null) {
        return;
    }

    const neighbors = getNeighbors(index);

    for (const neighborIndex of neighbors) {

        const neighborValue = grid[neighborIndex];

        if (neighborValue === null) {
            continue;
        }

        // Equal tiles disappear
        if (neighborValue === currentValue) {
            grid[index] = null;
            grid[neighborIndex] = null;
            addScore(2);
            return;
        }

        // Larger divided by smaller
        const larger = Math.max(currentValue, neighborValue);
        const smaller = Math.min(currentValue, neighborValue);

        if (larger % smaller === 0) {

            const result = larger / smaller;

            // Result 1 means remove
            if (result === 1) {
                grid[index] = null;
                grid[neighborIndex] = null;
                addScore(2);
                return;
            }

            // Result replaces larger tile
            if (currentValue === larger) {
                grid[index] = result;
                grid[neighborIndex] = null;
                addScore(result);
                resolveMerges(index);
                return;
            }

            if (neighborValue === larger) {
                grid[neighborIndex] = result;
                grid[index] = null;
                addScore(result);
                resolveMerges(neighborIndex);
                return;
            }
        }
    }
}

// ---------- Get Neighbor Cells ----------

function getNeighbors(index) {

    const row = Math.floor(index / 4);
    const col = index % 4;
    const neighbors = [];

    if (row > 0) neighbors.push(index - 4);
    if (row < 3) neighbors.push(index + 4);
    if (col > 0) neighbors.push(index - 1);
    if (col < 3) neighbors.push(index + 1);

    return neighbors;
}

// ---------- Score ----------

function addScore(points) {

    score += points;

    if (score > best) {
        best = score;
        localStorage.setItem("justDivideBest", best);
    }

    const newLevel = Math.floor(score / 10) + 1;

    if (newLevel !== level) {
        level = newLevel;
        trashUses++;
    }

    updateUI();
}

// ---------- UI ----------

function updateUI() {
    scoreElement.textContent = score;
    bestElement.textContent = best;
    levelElement.textContent = level;
    trashCountElement.textContent = trashUses;
}

// ---------- KEEP ----------

function handleKeep() {

    if (paused) {
        return;
    }

    if (queue.length === 0) {
        return;
    }

    saveState();

    const activeTile = queue[0];

    if (keepVal === null) {
        keepVal = activeTile;
        addNextTile();
    } else {
        const temp = keepVal;
        keepVal = activeTile;
        queue[0] = temp;
    }

    renderQueue();
    renderKeep();
}

function renderKeep() {

    keepValueElement.innerHTML = "";

    if (keepVal === null) {
        return;
    }

    const tile = createTile(keepVal);
    tile.draggable = false;
    keepValueElement.appendChild(tile);
}

// ---------- TRASH ----------

function handleTrash() {

    if (paused) {
        return;
    }

    if (trashUses <= 0) {
        return;
    }

    saveState();
    trashUses--;
    addNextTile();

    renderQueue();
    updateUI();
    checkGameOver();
}

// ---------- Game Over ----------

function checkGameOver() {

    const hasEmptyCell = grid.some(cell => cell === null);

    if (hasEmptyCell) {
        return;
    }

    if (!hasValidMerge()) {
        showGameOver();
    }
}

function hasValidMerge() {

    for (let i = 0; i < 16; i++) {

        if (grid[i] === null) {
            continue;
        }

        const neighbors = getNeighbors(i);

        for (const n of neighbors) {

            if (grid[n] === null) {
                continue;
            }

            const a = grid[i];
            const b = grid[n];

            if (a === b) {
                return true;
            }

            const larger = Math.max(a, b);
            const smaller = Math.min(a, b);

            if (larger % smaller === 0) {
                return true;
            }
        }
    }

    return false;
}

function showGameOver() {
    finalScoreElement.textContent = score;
    finalBestElement.textContent = best;
    gameOverElement.classList.remove("hidden");
    stopTimer();
}

// ---------- Buttons ----------

document.getElementById("undo-btn").addEventListener("click", undoMove);
document.getElementById("restart-btn").addEventListener("click", startGame);
document.getElementById("play-again-btn").addEventListener("click", startGame);

document.getElementById("hint-btn").addEventListener("click", () => {
    hintsOn = !hintsOn;
    highlightHints();
});

keepSlot.addEventListener("dragover", (e) => {
    e.preventDefault();
    keepSlot.classList.add("drag-over");
});
keepSlot.addEventListener("dragleave", () => keepSlot.classList.remove("drag-over"));
keepSlot.addEventListener("drop", () => {
    keepSlot.classList.remove("drag-over");
    handleKeep();
});
keepSlot.addEventListener("click", handleKeep);

const trashSlotElement = document.getElementById("trash-slot");
trashSlotElement.addEventListener("dragover", (e) => {
    e.preventDefault();
    trashSlotElement.classList.add("drag-over");
});
trashSlotElement.addEventListener("dragleave", () => trashSlotElement.classList.remove("drag-over"));
trashSlotElement.addEventListener("drop", () => {
    trashSlotElement.classList.remove("drag-over");
    handleTrash();
});
trashSlotElement.addEventListener("click", handleTrash);
trashSlotElement.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTrash();
    }
});

// ---------- Hint System ----------

function highlightHints() {

    const cells = document.querySelectorAll(".cell");

    cells.forEach(cell => {
        cell.style.outline = "none";
    });

    if (!hintsOn) {
        return;
    }

    const activeTile = queue[0];

    if (!activeTile) {
        return;
    }

    for (let i = 0; i < 16; i++) {

        if (grid[i] !== null) {
            continue;
        }

        const neighbors = getNeighbors(i);
        let valid = false;

        for (const n of neighbors) {

            if (grid[n] === null) {
                continue;
            }

            const neighbor = grid[n];

            if (neighbor === activeTile) {
                valid = true;
            }

            const larger = Math.max(activeTile, neighbor);
            const smaller = Math.min(activeTile, neighbor);

            if (larger % smaller === 0) {
                valid = true;
            }
        }

        if (valid) {
            cells[i].style.outline = "4px solid #ffe600";
        }
    }
}

// ---------- Keyboard ----------

document.addEventListener("keydown", (event) => {

    const key = event.key.toLowerCase();

    if (key === "z") undoMove();
    if (key === "r") startGame();

    if (key === "g") {
        hintsOn = !hintsOn;
        highlightHints();
    }
});

// ==========================================
// UI EXTRAS — timer, pause, help, fullscreen
// (visual/UX additions only; no game logic changes)
// ==========================================

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

function resetTimer() {
    elapsedSeconds = 0;
    timerDisplay.textContent = formatTime(elapsedSeconds);
    stopTimer();
    timerInterval = setInterval(tickTimer, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Pause button
const pauseBtn = document.getElementById("pause-btn");
pauseBtn.addEventListener("click", () => {
    paused = !paused;
    gameShell.classList.toggle("paused", paused);
    pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");
    pauseBtn.innerHTML = paused
        ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 5l12 7-12 7V5z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>';
});

// Help modal
const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpCloseBtn = document.getElementById("help-close-btn");

helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
helpCloseBtn.addEventListener("click", () => helpModal.classList.add("hidden"));
helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
});

// Fullscreen toggle
const fullscreenBtn = document.getElementById("fullscreen-btn");
fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        gameShell.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
});

// ---------- Start ----------

startGame();