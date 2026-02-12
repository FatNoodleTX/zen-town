(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const selectedEl = document.getElementById("selectedItem");
  const modeEl = document.getElementById("modeValue");
  const popEl = document.getElementById("populationValue");
  const vibeEl = document.getElementById("vibeValue");
  const activityEl = document.getElementById("activityValue");
  const brushEl = document.getElementById("brushValue");

  const TILE = 40;
  const HALF = TILE / 2;

  const numTypes = ["house", "tree", "shop", "pond", "park", "cafe", "library", "shrine"];
  const alphaTypes = [
    "bakery",
    "school",
    "clinic",
    "market",
    "theater",
    "gallery",
    "farm",
    "fountain",
    "temple",
    "workshop",
    "inn",
    "observatory"
  ];

  const labelByType = {
    house: "house",
    tree: "tree",
    shop: "shop",
    pond: "pond",
    park: "park",
    cafe: "cafe",
    library: "library",
    shrine: "shrine",
    bakery: "bakery",
    school: "school",
    clinic: "clinic",
    market: "market",
    theater: "theater",
    gallery: "gallery",
    farm: "farm",
    fountain: "fountain",
    temple: "temple",
    workshop: "workshop",
    inn: "inn",
    observatory: "observatory",
    road: "street"
  };

  const toneByType = {
    house: 270,
    tree: 250,
    shop: 310,
    pond: 220,
    park: 240,
    cafe: 290,
    library: 260,
    shrine: 330,
    bakery: 300,
    school: 255,
    clinic: 245,
    market: 318,
    theater: 342,
    gallery: 286,
    farm: 232,
    fountain: 216,
    temple: 334,
    workshop: 306,
    inn: 278,
    observatory: 354,
    road: 168
  };

  const state = {
    cols: 0,
    rows: 0,
    offsetX: 0,
    offsetY: 0,
    grid: [],
    history: [],
    selectedType: "house",
    roadMode: false,
    brush: 1,
    hover: null,
    dayTime: 0,
    dayPaused: false,
    clearing: false,
    clearAlpha: 0,
    clearPhase: "out",
    population: 0,
    vibe: 0,
    activity: 0,
    targetPopulation: 0,
    targetVibe: 0,
    targetActivity: 0,
    audioReady: false,
    audio: null,
    lastTs: 0
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function ensureAudioStarted() {
    if (!state.audioReady) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        state.audioReady = true;
        return;
      }

      const ac = new AudioCtx();
      const master = ac.createGain();
      master.gain.value = 0.06;
      master.connect(ac.destination);
      state.audio = { ac, master };
      state.audioReady = true;
    }

    if (state.audio && state.audio.ac.state === "suspended") {
      state.audio.ac.resume();
    }
  }

  function playSfx(kind, type = "house") {
    if (!state.audio) return;
    const { ac, master } = state.audio;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    const base = toneByType[type] || 260;

    filter.type = "lowpass";
    filter.frequency.value = 1300;

    if (kind === "road") {
      osc.type = "square";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(118, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.028, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      filter.frequency.value = 860;
    } else if (kind === "select") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * 1.2, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      filter.frequency.value = 1800;
    } else if (kind === "undo") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.024, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      filter.frequency.value = 1380;
    } else if (kind === "clear") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.28);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      filter.frequency.value = 1040;
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(base + Math.random() * 45, now);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.026, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      filter.frequency.value = 1520;
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    state.cols = Math.max(8, Math.floor((canvas.width - 80) / TILE));
    state.rows = Math.max(6, Math.floor((canvas.height - 80) / TILE));
    state.offsetX = Math.floor((canvas.width - state.cols * TILE) / 2);
    state.offsetY = Math.floor((canvas.height - state.rows * TILE) / 2);

    const newGrid = Array.from({ length: state.rows }, () => Array(state.cols).fill(null));
    for (let y = 0; y < Math.min(state.rows, state.grid.length); y += 1) {
      for (let x = 0; x < Math.min(state.cols, state.grid[y].length); x += 1) {
        newGrid[y][x] = state.grid[y][x];
      }
    }
    state.grid = newGrid;
  }

  function tileAtScreen(mx, my) {
    const tx = Math.floor((mx - state.offsetX) / TILE);
    const ty = Math.floor((my - state.offsetY) / TILE);
    if (tx < 0 || tx >= state.cols || ty < 0 || ty >= state.rows) return null;
    return { x: tx, y: ty };
  }

  function forEachNeighbor(x, y, fn) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue;
        fn(nx, ny);
      }
    }
  }

  function neighborsOfType(x, y, type) {
    let count = 0;
    forEachNeighbor(x, y, (nx, ny) => {
      const cell = state.grid[ny][nx];
      if (cell && cell.type === type) count += 1;
    });
    return count;
  }

  function isRoad(x, y) {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return false;
    const c = state.grid[y][x];
    return !!c && c.type === "road";
  }

  function applyBrush(cx, cy, chosenType) {
    const changes = [];
    for (let dy = -state.brush + 1; dy <= state.brush - 1; dy += 1) {
      for (let dx = -state.brush + 1; dx <= state.brush - 1; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) continue;

        const prev = state.grid[y][x];
        if (prev && prev.type === chosenType) continue;

        changes.push({ x, y, prev });
        state.grid[y][x] = {
          type: chosenType,
          placedAt: performance.now() * 0.001,
          seed: Math.random() * 1000
        };
      }
    }

    if (changes.length > 0) {
      state.history.push(changes);
      if (state.history.length > 800) state.history.shift();
      recomputeTargets();
      playSfx(chosenType === "road" ? "road" : "place", chosenType);
    }
  }

  function undoLast() {
    const last = state.history.pop();
    if (!last) return;
    for (const c of last) state.grid[c.y][c.x] = c.prev;
    recomputeTargets();
    playSfx("undo");
  }

  function clearWithFade() {
    state.clearing = true;
    state.clearPhase = "out";
    state.clearAlpha = 0;
    playSfx("clear");
  }

  function hardClear() {
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) state.grid[y][x] = null;
    }
    state.history.length = 0;
    recomputeTargets();
  }

  function savePng() {
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `zen-town-${stamp}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function recomputeTargets() {
    const counts = {
      house: 0,
      tree: 0,
      shop: 0,
      pond: 0,
      park: 0,
      cafe: 0,
      library: 0,
      shrine: 0,
      bakery: 0,
      school: 0,
      clinic: 0,
      market: 0,
      theater: 0,
      gallery: 0,
      farm: 0,
      fountain: 0,
      temple: 0,
      workshop: 0,
      inn: 0,
      observatory: 0,
      road: 0
    };

    let vibe = 0;
    let activity = 0;

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const cell = state.grid[y][x];
        if (!cell) continue;
        counts[cell.type] += 1;

        if (cell.type === "house") {
          vibe += 1 + neighborsOfType(x, y, "park") * 2.2 + neighborsOfType(x, y, "pond") * 2.6 + neighborsOfType(x, y, "tree") * 1.5;
          activity += neighborsOfType(x, y, "shop") * 2.1 + neighborsOfType(x, y, "cafe") * 1.4 + neighborsOfType(x, y, "road") * 0.8;
        } else if (cell.type === "tree") {
          vibe += 1.2 + neighborsOfType(x, y, "house") * 0.8 + neighborsOfType(x, y, "shrine") * 0.5;
        } else if (cell.type === "shop") {
          activity += 2 + neighborsOfType(x, y, "house") * 2.4 + neighborsOfType(x, y, "road") * 1.5;
          vibe += neighborsOfType(x, y, "park") * 0.8;
        } else if (cell.type === "pond") {
          vibe += 2.4 + neighborsOfType(x, y, "park") * 0.9 + neighborsOfType(x, y, "shrine") * 0.8;
        } else if (cell.type === "park") {
          vibe += 1.7 + neighborsOfType(x, y, "house") * 1.6 + neighborsOfType(x, y, "pond") * 0.8;
          activity += neighborsOfType(x, y, "cafe") * 0.7;
        } else if (cell.type === "cafe") {
          vibe += 1.3 + neighborsOfType(x, y, "tree") * 0.7;
          activity += 1.7 + neighborsOfType(x, y, "house") * 1.8 + neighborsOfType(x, y, "road") * 1.1;
        } else if (cell.type === "library") {
          vibe += 1.6 + neighborsOfType(x, y, "park") * 0.9 + neighborsOfType(x, y, "house") * 0.7;
          activity += 1.1 + neighborsOfType(x, y, "road") * 0.8;
        } else if (cell.type === "shrine") {
          vibe += 2.3 + neighborsOfType(x, y, "tree") * 1.2 + neighborsOfType(x, y, "pond") * 1.2;
          activity += neighborsOfType(x, y, "house") * 0.6;
        } else if (cell.type === "bakery") {
          vibe += 1.1 + neighborsOfType(x, y, "house") * 1.1;
          activity += 1.4 + neighborsOfType(x, y, "road") * 0.8;
        } else if (cell.type === "school") {
          vibe += 1.2 + neighborsOfType(x, y, "park") * 0.6;
          activity += 1.5 + neighborsOfType(x, y, "house") * 1.6 + neighborsOfType(x, y, "road") * 0.9;
        } else if (cell.type === "clinic") {
          vibe += 1.4 + neighborsOfType(x, y, "house") * 0.9;
          activity += 1.2 + neighborsOfType(x, y, "road") * 0.7;
        } else if (cell.type === "market") {
          vibe += 0.9 + neighborsOfType(x, y, "tree") * 0.4;
          activity += 2.2 + neighborsOfType(x, y, "house") * 1.5 + neighborsOfType(x, y, "road") * 1.4;
        } else if (cell.type === "theater") {
          vibe += 1.9 + neighborsOfType(x, y, "park") * 0.6;
          activity += 1.7 + neighborsOfType(x, y, "road") * 1.1;
        } else if (cell.type === "gallery") {
          vibe += 1.8 + neighborsOfType(x, y, "park") * 0.7 + neighborsOfType(x, y, "pond") * 0.6;
          activity += 1 + neighborsOfType(x, y, "road") * 0.8;
        } else if (cell.type === "farm") {
          vibe += 1 + neighborsOfType(x, y, "pond") * 0.7;
          activity += 1.1 + neighborsOfType(x, y, "market") * 0.8;
        } else if (cell.type === "fountain") {
          vibe += 2 + neighborsOfType(x, y, "park") * 0.9 + neighborsOfType(x, y, "house") * 0.8;
          activity += 0.8;
        } else if (cell.type === "temple") {
          vibe += 2.1 + neighborsOfType(x, y, "tree") * 0.8 + neighborsOfType(x, y, "pond") * 0.8;
          activity += 0.7;
        } else if (cell.type === "workshop") {
          vibe += 0.8 + neighborsOfType(x, y, "house") * 0.5;
          activity += 1.8 + neighborsOfType(x, y, "road") * 1.2;
        } else if (cell.type === "inn") {
          vibe += 1.5 + neighborsOfType(x, y, "park") * 0.5;
          activity += 1.6 + neighborsOfType(x, y, "shop") * 0.7 + neighborsOfType(x, y, "road") * 1;
        } else if (cell.type === "observatory") {
          vibe += 2 + neighborsOfType(x, y, "park") * 0.4;
          activity += 0.9 + neighborsOfType(x, y, "road") * 0.7;
        } else if (cell.type === "road") {
          activity += neighborsOfType(x, y, "house") * 0.6 + neighborsOfType(x, y, "shop") * 0.8 + neighborsOfType(x, y, "cafe") * 0.7 + neighborsOfType(x, y, "library") * 0.5;
        }
      }
    }

    const populationBase =
      counts.house * 3.8 +
      counts.shop * 1.1 +
      counts.park * 0.5 +
      counts.tree * 0.25 +
      counts.pond * 0.35 +
      counts.cafe * 1.4 +
      counts.library * 1.2 +
      counts.shrine * 0.9 +
      counts.bakery * 1.1 +
      counts.school * 1.5 +
      counts.clinic * 1.2 +
      counts.market * 1.7 +
      counts.theater * 1.4 +
      counts.gallery * 1.2 +
      counts.farm * 1 +
      counts.fountain * 0.8 +
      counts.temple * 1 +
      counts.workshop * 1.3 +
      counts.inn * 1.4 +
      counts.observatory * 0.9 +
      counts.road * 0.12;

    state.targetPopulation = Math.round(populationBase + activity * 0.28 + vibe * 0.1);
    state.targetVibe = Math.round(vibe);
    state.targetActivity = Math.round(activity);
  }

  function updateHud() {
    const selectedLabel = labelByType[state.selectedType] || state.selectedType;
    selectedEl.textContent = state.roadMode ? "street (M)" : selectedLabel;
    modeEl.textContent = state.roadMode ? "street" : "build";
    popEl.textContent = String(Math.round(state.population));
    vibeEl.textContent = String(Math.round(state.vibe));
    activityEl.textContent = String(Math.round(state.activity));
    brushEl.textContent = String(state.brush);
  }

  function update(dt) {
    if (!state.dayPaused) state.dayTime += dt * 0.03;

    if (state.clearing) {
      if (state.clearPhase === "out") {
        state.clearAlpha += dt * 0.9;
        if (state.clearAlpha >= 1) {
          state.clearAlpha = 1;
          hardClear();
          state.clearPhase = "in";
        }
      } else {
        state.clearAlpha -= dt * 0.9;
        if (state.clearAlpha <= 0) {
          state.clearAlpha = 0;
          state.clearing = false;
        }
      }
    }

    const smooth = clamp(dt * 2.2, 0, 1);
    state.population += (state.targetPopulation - state.population) * smooth;
    state.vibe += (state.targetVibe - state.vibe) * smooth;
    state.activity += (state.targetActivity - state.activity) * smooth;

    const vitality = (state.targetVibe + state.targetActivity) * 0.01;
    state.population += vitality * dt * 0.35;
    state.vibe += vitality * dt * 0.22;

    updateHud();
  }

  function dayLight() {
    const t = state.dayTime;
    return 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2));
  }

  function nightFactor() {
    return 1 - dayLight();
  }

  function drawBackground() {
    const light = dayLight();
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, `rgba(${Math.floor(190 + light * 30)}, ${Math.floor(208 + light * 24)}, ${Math.floor(220 + light * 20)}, 1)`);
    g.addColorStop(1, `rgba(${Math.floor(168 + light * 22)}, ${Math.floor(196 + light * 24)}, ${Math.floor(174 + light * 30)}, 1)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 4; i += 1) {
      const y = (i / 4) * canvas.height + Math.sin(state.dayTime * 2 + i) * 8;
      ctx.fillRect(0, y, canvas.width, 28);
    }
  }

  function drawGrid() {
    const nf = nightFactor();
    const tileBase = `rgba(245, 251, 247, ${0.55 - nf * 0.08})`;
    const tileAlt = `rgba(233, 244, 237, ${0.56 - nf * 0.08})`;

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const px = state.offsetX + x * TILE;
        const py = state.offsetY + y * TILE;
        ctx.fillStyle = (x + y) % 2 === 0 ? tileBase : tileAlt;
        ctx.fillRect(px, py, TILE - 1, TILE - 1);
      }
    }

    ctx.strokeStyle = `rgba(129, 151, 140, ${0.28 - nf * 0.12})`;
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.cols; x += 1) {
      const px = state.offsetX + x * TILE;
      ctx.beginPath();
      ctx.moveTo(px, state.offsetY);
      ctx.lineTo(px, state.offsetY + state.rows * TILE);
      ctx.stroke();
    }
    for (let y = 0; y <= state.rows; y += 1) {
      const py = state.offsetY + y * TILE;
      ctx.beginPath();
      ctx.moveTo(state.offsetX, py);
      ctx.lineTo(state.offsetX + state.cols * TILE, py);
      ctx.stroke();
    }
  }

  function drawRoadTile(x, y) {
    const px = state.offsetX + x * TILE;
    const py = state.offsetY + y * TILE;
    const cx = px + HALF;
    const cy = py + HALF;

    const n = isRoad(x, y - 1);
    const s = isRoad(x, y + 1);
    const w = isRoad(x - 1, y);
    const e = isRoad(x + 1, y);

    ctx.fillStyle = "rgba(108, 114, 116, 0.95)";
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);

    ctx.fillStyle = "rgba(82, 88, 90, 0.4)";
    ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
    ctx.fillRect(px + 1, py + TILE - 3, TILE - 2, 2);

    ctx.strokeStyle = "rgba(230, 233, 225, 0.28)";
    ctx.lineWidth = 1;
    if (n || s) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, py + 4);
      ctx.lineTo(cx - 5, py + TILE - 4);
      ctx.moveTo(cx + 5, py + 4);
      ctx.lineTo(cx + 5, py + TILE - 4);
      ctx.stroke();
    }
    if (w || e) {
      ctx.beginPath();
      ctx.moveTo(px + 4, cy - 5);
      ctx.lineTo(px + TILE - 4, cy - 5);
      ctx.moveTo(px + 4, cy + 5);
      ctx.lineTo(px + TILE - 4, cy + 5);
      ctx.stroke();
    }

    if ((n && s && !w && !e) || (w && e && !n && !s)) return;

    ctx.fillStyle = "rgba(240, 242, 232, 0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHouse(cx, cy, phase, night) {
    const bounce = 1 - Math.exp(-phase * 4);
    const scale = 0.65 + 0.35 * clamp(bounce, 0, 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#d8c3a5";
    ctx.fillRect(-11, -7, 22, 16);
    ctx.fillStyle = "#8f5d4d";
    ctx.beginPath();
    ctx.moveTo(-13, -7);
    ctx.lineTo(0, -15);
    ctx.lineTo(13, -7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7d4b3b";
    ctx.fillRect(-3, 0, 6, 9);
    const glow = 0.15 + night * 0.7;
    ctx.fillStyle = `rgba(255, 214, 142, ${glow})`;
    ctx.fillRect(5, -2, 4, 4);
    ctx.fillRect(-9, -2, 4, 4);
    const smokeY = -18 - ((phase * 12) % 10);
    ctx.fillStyle = "rgba(230,230,230,0.4)";
    ctx.beginPath();
    ctx.arc(4 + Math.sin(phase * 2) * 2, smokeY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTree(cx, cy, phase) {
    const sway = Math.sin(phase * 1.6) * 1.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#6f4e37";
    ctx.fillRect(-2, -3, 4, 11);
    ctx.fillStyle = "#6a9a6f";
    ctx.beginPath();
    ctx.arc(sway, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(122, 179, 129, 0.8)";
    ctx.beginPath();
    ctx.arc(sway - 4, -8, 5, 0, Math.PI * 2);
    ctx.arc(sway + 4, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShop(cx, cy, phase, night) {
    const pulse = 0.55 + 0.45 * Math.sin(phase * 2.2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#c7b7de";
    ctx.fillRect(-12, -8, 24, 17);
    ctx.fillStyle = "#815f9f";
    ctx.fillRect(-13, -11, 26, 5);
    ctx.fillStyle = "#f7f3fa";
    ctx.fillRect(-11, -10, 22, 3);
    const glow = (0.2 + night * 0.65) * pulse;
    ctx.fillStyle = `rgba(255, 214, 138, ${glow})`;
    ctx.fillRect(-9, -4, 7, 6);
    ctx.fillRect(2, -4, 7, 6);
    ctx.fillStyle = "#6f4b87";
    ctx.fillRect(-2, 1, 4, 8);
    ctx.restore();
  }

  function drawPond(cx, cy, phase) {
    const r1 = 11 + Math.sin(phase * 1.4) * 0.7;
    const r2 = 7 + Math.cos(phase * 1.1) * 0.45;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#85b8d8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(241, 250, 255, 0.5)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r1, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r2, 3.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPark(cx, cy, phase) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#9dcb91";
    ctx.fillRect(-11, -8, 22, 16);
    const twinkle = 0.35 + 0.35 * Math.sin(phase * 2.7);
    ctx.fillStyle = `rgba(255, 244, 186, ${twinkle})`;
    ctx.beginPath();
    ctx.arc(-5, -2, 1.8, 0, Math.PI * 2);
    ctx.arc(2, 1, 1.5, 0, Math.PI * 2);
    ctx.arc(6, -3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(117, 158, 109, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(8, 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCafe(cx, cy, phase, night) {
    const steam = (phase * 3.1) % 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#d9b99b";
    ctx.fillRect(-11, -7, 22, 16);
    ctx.fillStyle = "#b17058";
    ctx.fillRect(-12, -10, 24, 4);
    ctx.fillStyle = "#efe3d6";
    ctx.fillRect(-10, -3, 20, 4);
    const glow = 0.12 + night * 0.5;
    ctx.fillStyle = `rgba(255, 210, 140, ${glow})`;
    ctx.fillRect(-8, 0, 5, 5);
    ctx.fillRect(3, 0, 5, 5);
    ctx.strokeStyle = "rgba(236,236,236,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -12 - steam * 6, 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawLibrary(cx, cy, phase, night) {
    const pulse = 0.5 + 0.5 * Math.sin(phase * 1.4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#b8c8d9";
    ctx.fillRect(-12, -7, 24, 16);
    ctx.fillStyle = "#6f88a3";
    ctx.fillRect(-13, -11, 26, 5);
    ctx.fillStyle = "#9db2c7";
    ctx.fillRect(-10, -3, 3, 12);
    ctx.fillRect(-4, -3, 3, 12);
    ctx.fillRect(2, -3, 3, 12);
    ctx.fillRect(8, -3, 3, 12);
    ctx.fillStyle = `rgba(255, 225, 165, ${(0.15 + night * 0.5) * pulse})`;
    ctx.fillRect(-1, -6, 2, 12);
    ctx.restore();
  }

  function drawShrine(cx, cy, phase) {
    const lantern = 0.35 + 0.35 * Math.sin(phase * 2.1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "#a85147";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-10, 8);
    ctx.moveTo(10, -6);
    ctx.lineTo(10, 8);
    ctx.moveTo(-13, -6);
    ctx.lineTo(13, -6);
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, -10);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 224, 154, ${lantern})`;
    ctx.beginPath();
    ctx.arc(0, 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCompactBuilding(cx, cy, phase, night, colors, details) {
    const pulse = 0.5 + 0.5 * Math.sin(phase * (1.2 + details * 0.08));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = colors.body;
    ctx.fillRect(-11, -7, 22, 16);
    ctx.fillStyle = colors.roof;
    ctx.fillRect(-12, -10, 24, 4);
    ctx.fillStyle = colors.trim;
    ctx.fillRect(-9, -3, 18, 3);
    const glow = (0.1 + night * 0.45) * pulse;
    ctx.fillStyle = `rgba(255, 220, 160, ${glow})`;
    ctx.fillRect(-7, 0, 4, 4);
    ctx.fillRect(3, 0, 4, 4);

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    if (details % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(8, 5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-1, -6);
      ctx.lineTo(-1, 8);
      ctx.stroke();
    }

    if (details % 3 === 0) {
      ctx.beginPath();
      ctx.arc(0, -12, 1.5 + pulse * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFountain(cx, cy, phase) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#85b8d8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(235, 246, 255, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(Math.sin(phase * 2) * 2, -11, 0, -3);
    ctx.stroke();
    ctx.restore();
  }

  function drawTileItem(x, y, cell, tNow) {
    const cx = state.offsetX + x * TILE + HALF;
    const cy = state.offsetY + y * TILE + HALF;
    const phase = tNow - cell.placedAt + cell.seed * 0.003;
    const night = nightFactor();

    if (cell.type === "road") {
      drawRoadTile(x, y);
      return;
    }

    if (cell.type === "house") drawHouse(cx, cy, phase, night);
    else if (cell.type === "tree") drawTree(cx, cy, phase);
    else if (cell.type === "shop") drawShop(cx, cy, phase, night);
    else if (cell.type === "pond") drawPond(cx, cy, phase);
    else if (cell.type === "park") drawPark(cx, cy, phase);
    else if (cell.type === "cafe") drawCafe(cx, cy, phase, night);
    else if (cell.type === "library") drawLibrary(cx, cy, phase, night);
    else if (cell.type === "shrine") drawShrine(cx, cy, phase);
    else if (cell.type === "bakery") drawCompactBuilding(cx, cy, phase, night, { body: "#e2c4aa", roof: "#b97c55", trim: "#f2e4d2", line: "#8d6045" }, 1);
    else if (cell.type === "school") drawCompactBuilding(cx, cy, phase, night, { body: "#d7cfaf", roof: "#8f8a5d", trim: "#ede7cf", line: "#6f6a47" }, 2);
    else if (cell.type === "clinic") drawCompactBuilding(cx, cy, phase, night, { body: "#c9dbe0", roof: "#79a7b5", trim: "#e8f4f7", line: "#5a8794" }, 3);
    else if (cell.type === "market") drawCompactBuilding(cx, cy, phase, night, { body: "#d6c1a5", roof: "#9a6b42", trim: "#efe3d0", line: "#7a5738" }, 4);
    else if (cell.type === "theater") drawCompactBuilding(cx, cy, phase, night, { body: "#c8b3d8", roof: "#7f6097", trim: "#ece4f5", line: "#664b7a" }, 5);
    else if (cell.type === "gallery") drawCompactBuilding(cx, cy, phase, night, { body: "#d9d6ce", roof: "#9f9888", trim: "#f2f1ec", line: "#7c7669" }, 6);
    else if (cell.type === "farm") drawCompactBuilding(cx, cy, phase, night, { body: "#d8c89b", roof: "#98874e", trim: "#ede5c7", line: "#7a6e3f" }, 7);
    else if (cell.type === "fountain") drawFountain(cx, cy, phase);
    else if (cell.type === "temple") drawCompactBuilding(cx, cy, phase, night, { body: "#d5c4ba", roof: "#915b50", trim: "#efe3de", line: "#74473f" }, 8);
    else if (cell.type === "workshop") drawCompactBuilding(cx, cy, phase, night, { body: "#c8c3b8", roof: "#6e6b66", trim: "#e9e7e2", line: "#56534f" }, 9);
    else if (cell.type === "inn") drawCompactBuilding(cx, cy, phase, night, { body: "#d9c3b1", roof: "#9c6b54", trim: "#f0e5dc", line: "#805340" }, 10);
    else if (cell.type === "observatory") drawCompactBuilding(cx, cy, phase, night, { body: "#b9c8d4", roof: "#627d94", trim: "#e2eef4", line: "#4a667d" }, 11);

    if (night > 0.35 && cell.type !== "tree" && cell.type !== "pond" && cell.type !== "park" && cell.type !== "fountain") {
      const glow = (night - 0.35) * 0.4;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
      grad.addColorStop(0, `rgba(255, 212, 140, ${glow})`);
      grad.addColorStop(1, "rgba(255, 212, 140, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHover() {
    if (!state.hover) return;
    const nf = nightFactor();
    const startX = state.hover.x - state.brush + 1;
    const startY = state.hover.y - state.brush + 1;

    ctx.strokeStyle = state.roadMode ? `rgba(92, 98, 104, ${0.8 - nf * 0.2})` : `rgba(74, 111, 97, ${0.75 - nf * 0.2})`;
    ctx.fillStyle = state.roadMode ? `rgba(138, 145, 152, ${0.24 - nf * 0.08})` : `rgba(146, 190, 166, ${0.22 - nf * 0.08})`;

    for (let dy = 0; dy < state.brush * 2 - 1; dy += 1) {
      for (let dx = 0; dx < state.brush * 2 - 1; dx += 1) {
        const x = startX + dx;
        const y = startY + dy;
        if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) continue;
        const px = state.offsetX + x * TILE;
        const py = state.offsetY + y * TILE;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
      }
    }
  }

  function drawNightOverlay() {
    const nf = nightFactor();
    if (nf <= 0.01) return;
    ctx.fillStyle = `rgba(20, 34, 56, ${nf * 0.38})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawClearOverlay() {
    if (!state.clearing) return;
    ctx.fillStyle = `rgba(236, 243, 239, ${state.clearAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function render(ts) {
    const now = ts * 0.001;
    drawBackground();
    drawGrid();

    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const cell = state.grid[y][x];
        if (!cell) continue;
        drawTileItem(x, y, cell, now);
      }
    }

    drawHover();
    drawNightOverlay();
    drawClearOverlay();
  }

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    state.hover = tileAtScreen(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onPointerDown(e) {
    ensureAudioStarted();
    const rect = canvas.getBoundingClientRect();
    const t = tileAtScreen(e.clientX - rect.left, e.clientY - rect.top);
    if (!t) return;
    const chosenType = state.roadMode ? "road" : state.selectedType;
    applyBrush(t.x, t.y, chosenType);
  }

  function onWheel(e) {
    e.preventDefault();
    state.brush = clamp(state.brush + (e.deltaY > 0 ? -1 : 1), 1, 4);
    updateHud();
  }

  function setSelectedType(type) {
    state.selectedType = type;
    state.roadMode = false;
    updateHud();
    playSfx("select", type);
  }

  function onKeyDown(e) {
    ensureAudioStarted();
    const key = e.key;
    const k = key.toLowerCase();

    if (key === "C") {
      clearWithFade();
      return;
    }

    if (key >= "1" && key <= "8") {
      const idx = Number(key) - 1;
      if (idx < numTypes.length) setSelectedType(numTypes[idx]);
      return;
    }

    if (k >= "a" && k <= "l") {
      const idx = k.charCodeAt(0) - "a".charCodeAt(0);
      if (idx >= 0 && idx < alphaTypes.length) {
        setSelectedType(alphaTypes[idx]);
        return;
      }
    }

    if (k === "m") {
      state.roadMode = !state.roadMode;
      updateHud();
      playSfx(state.roadMode ? "road" : "select", state.roadMode ? "road" : state.selectedType);
    } else if (key === "[") {
      state.brush = clamp(state.brush - 1, 1, 4);
      updateHud();
    } else if (key === "]") {
      state.brush = clamp(state.brush + 1, 1, 4);
      updateHud();
    } else if (k === "u") {
      undoLast();
    } else if (k === "s") {
      savePng();
    } else if (key === " ") {
      e.preventDefault();
      state.dayPaused = !state.dayPaused;
      playSfx("select", "observatory");
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    undoLast();
  }

  function frame(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    update(dt);
    render(ts);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  resize();
  recomputeTargets();
  updateHud();
  requestAnimationFrame(frame);
})();
