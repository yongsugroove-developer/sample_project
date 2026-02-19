const RANK_MAP = {
  '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const state = {
  hero: [null, null],
  board: [null, null, null, null, null],
  selecting: null,
};

function makeDeck() {
  const deck = [];
  for (const r of RANKS) {
    for (const s of SUITS) deck.push(`${r}${s}`);
  }
  return deck;
}

function cardImagePath(card) {
  return `assets/cards/${card}.svg`;
}

function rank5(cards) {
  const ranks = cards.map((c) => RANK_MAP[c[0]]).sort((a, b) => b - a);
  const suits = cards.map((c) => c[1]);
  const rankCounts = new Map();
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) || 0) + 1);
  const byCount = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const isFlush = suits.every((s) => s === suits[0]);
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    } else if (JSON.stringify(unique) === JSON.stringify([14, 5, 4, 3, 2])) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  if (isStraight && isFlush) return [8, straightHigh];
  if (byCount[0][1] === 4) return [7, byCount[0][0], byCount[1][0]];
  if (byCount[0][1] === 3 && byCount[1][1] === 2) return [6, byCount[0][0], byCount[1][0]];
  if (isFlush) return [5, ...ranks];
  if (isStraight) return [4, straightHigh];
  if (byCount[0][1] === 3) {
    const kickers = byCount.filter((x) => x[1] === 1).map((x) => x[0]).sort((a, b) => b - a);
    return [3, byCount[0][0], ...kickers];
  }
  if (byCount[0][1] === 2 && byCount[1][1] === 2) {
    const pairRanks = byCount.filter((x) => x[1] === 2).map((x) => x[0]).sort((a, b) => b - a);
    const kicker = byCount.find((x) => x[1] === 1)[0];
    return [2, ...pairRanks, kicker];
  }
  if (byCount[0][1] === 2) {
    const pair = byCount[0][0];
    const kickers = byCount.filter((x) => x[1] === 1).map((x) => x[0]).sort((a, b) => b - a);
    return [1, pair, ...kickers];
  }
  return [0, ...ranks];
}

function compareRanks(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function bestOfSeven(cards7) {
  let best = null;
  for (let i = 0; i < cards7.length - 4; i += 1) {
    for (let j = i + 1; j < cards7.length - 3; j += 1) {
      for (let k = j + 1; k < cards7.length - 2; k += 1) {
        for (let l = k + 1; l < cards7.length - 1; l += 1) {
          for (let m = l + 1; m < cards7.length; m += 1) {
            const score = rank5([cards7[i], cards7[j], cards7[k], cards7[l], cards7[m]]);
            if (!best || compareRanks(score, best) > 0) best = score;
          }
        }
      }
    }
  }
  return best;
}

function sampleWithoutReplacement(arr, count) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function streetBoardCount(street) {
  if (street === 'preflop') return 0;
  if (street === 'flop') return 3;
  if (street === 'turn') return 4;
  return 5;
}

function getUsedCards() {
  return [...state.hero, ...state.board].filter(Boolean);
}

function renderSlots() {
  const heroSlots = document.getElementById('heroSlots');
  const boardSlots = document.getElementById('boardSlots');
  heroSlots.innerHTML = '';
  boardSlots.innerHTML = '';

  for (let i = 0; i < 2; i += 1) heroSlots.appendChild(createSlot('hero', i, state.hero[i]));
  for (let i = 0; i < 5; i += 1) boardSlots.appendChild(createSlot('board', i, state.board[i]));

  const street = document.getElementById('street').value;
  const boardCount = streetBoardCount(street);
  [...boardSlots.children].forEach((slotEl, idx) => {
    slotEl.style.opacity = idx < boardCount ? '1' : '.35';
    slotEl.classList.toggle('clickable', idx < boardCount);
  });
}

function createSlot(type, index, card) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `slot ${card ? 'filled' : ''} clickable`;
  if (card) {
    el.innerHTML = `<img src='${cardImagePath(card)}' alt='${card}' /><small>${card} (클릭해서 변경)</small>`;
  } else {
    el.textContent = type === 'hero' ? `핸드 ${index + 1}` : `보드 ${index + 1}`;
  }

  el.addEventListener('click', () => {
    const street = document.getElementById('street').value;
    if (type === 'board' && index >= streetBoardCount(street)) return;
    openDeckDialog(type, index);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (type === 'hero') state.hero[index] = null;
    else state.board[index] = null;
    renderSlots();
  });

  return el;
}

function openDeckDialog(type, index) {
  state.selecting = { type, index };
  const dialog = document.getElementById('cardDialog');
  document.getElementById('dialogTitle').textContent = `${type === 'hero' ? '핸드' : '보드'} ${index + 1} 카드 선택`;

  const used = getUsedCards();
  const deckGrid = document.getElementById('deckGrid');
  deckGrid.innerHTML = '';

  for (const card of makeDeck()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `deck-card ${used.includes(card) ? 'used' : ''}`;
    btn.disabled = used.includes(card);
    btn.innerHTML = `<img src='${cardImagePath(card)}' alt='${card}' />`;
    btn.addEventListener('click', () => assignCard(card));
    deckGrid.appendChild(btn);
  }

  dialog.showModal();
}

function assignCard(card) {
  const { type, index } = state.selecting;
  if (type === 'hero') state.hero[index] = card;
  else state.board[index] = card;
  document.getElementById('cardDialog').close();
  renderSlots();
}

function normalizeHandKey([c1, c2]) {
  const r1 = c1[0];
  const r2 = c2[0];
  const s1 = c1[1];
  const s2 = c2[1];
  const a = RANK_MAP[r1] >= RANK_MAP[r2] ? [r1, s1, r2, s2] : [r2, s2, r1, s1];
  if (a[0] === a[2]) return `${a[0]}${a[2]}`;
  return `${a[0]}${a[2]}${a[1] === a[3] ? 's' : 'o'}`;
}

function localGtoPreset(hero, street) {
  const key = normalizeHandKey(hero);
  const preflop = {
    AA: 'Raise 100%', KK: 'Raise 100%', QQ: 'Raise 95% / Call 5%', JJ: 'Raise 90% / Call 10%',
    AKs: 'Raise 90% / Call 10%', AQs: 'Raise 75% / Call 25%', AKo: 'Raise 70% / Call 30%',
    TT: 'Raise 75% / Call 25%', '99': 'Raise 65% / Call 35%',
    KQs: 'Raise 55% / Call 45%', AQo: 'Raise 50% / Call 50%',
  };

  if (street === 'preflop' && preflop[key]) {
    return { action: '프리플랍 GTO 프리셋', mix: preflop[key], source: `로컬 프리셋(${key})` };
  }
  return null;
}

function recommendHeuristic(equity, potOdds, street) {
  const pressureByStreet = { preflop: 0.05, flop: 0.02, turn: 0, river: -0.02 };
  const adjustedCallLine = potOdds + (pressureByStreet[street] || 0);
  const raiseLine = adjustedCallLine + 0.15;

  if (equity >= raiseLine) {
    const raiseRatio = Math.min(85, Math.round((equity - adjustedCallLine) * 140));
    const callRatio = Math.max(10, 100 - raiseRatio - 5);
    return { action: '밸류 레이즈 / 공격적 플레이', mix: `Raise ${raiseRatio}% / Call ${callRatio}% / Fold ${100 - raiseRatio - callRatio}%` };
  }
  if (equity >= adjustedCallLine) {
    const callRatio = Math.min(80, Math.round(55 + (equity - adjustedCallLine) * 120));
    const raiseRatio = Math.max(5, Math.round((equity - adjustedCallLine) * 40));
    return { action: '콜 중심', mix: `Raise ${raiseRatio}% / Call ${callRatio}% / Fold ${100 - raiseRatio - callRatio}%` };
  }
  const foldRatio = Math.min(95, Math.round((adjustedCallLine - equity) * 170 + 40));
  const callRatio = Math.max(5, 100 - foldRatio - 5);
  return { action: '폴드 우선', mix: `Raise 5% / Call ${callRatio}% / Fold ${foldRatio}%` };
}

function monteCarloEquity({ hero, board, opponents, iterations }) {
  let win = 0;
  let tie = 0;
  const used = [...hero, ...board];
  const deck = makeDeck().filter((c) => !used.includes(c));

  for (let n = 0; n < iterations; n += 1) {
    const remainBoard = 5 - board.length;
    const sample = sampleWithoutReplacement(deck, opponents * 2 + remainBoard);
    const boardComplete = [...board, ...sample.slice(0, remainBoard)];
    let cursor = remainBoard;

    const heroScore = bestOfSeven([...hero, ...boardComplete]);
    let betterExists = false;
    let tieExists = false;

    for (let p = 0; p < opponents; p += 1) {
      const villainScore = bestOfSeven([sample[cursor], sample[cursor + 1], ...boardComplete]);
      cursor += 2;
      const cmp = compareRanks(heroScore, villainScore);
      if (cmp < 0) {
        betterExists = true;
        break;
      }
      if (cmp === 0) tieExists = true;
    }

    if (!betterExists && tieExists) tie += 1;
    else if (!betterExists) win += 1;
  }

  return { tieRate: tie / iterations, equity: (win + tie * 0.5) / iterations };
}

async function requestExternalSolver(payload, solverUrl) {
  const res = await fetch(solverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Solver API 오류: ${res.status}`);
  return res.json();
}

async function runCalculation() {
  const street = document.getElementById('street').value;
  const opponents = Number(document.getElementById('opponents').value);
  const potOdds = Number(document.getElementById('potOdds').value) / 100;
  const iterations = Number(document.getElementById('iterations').value);
  const mode = document.getElementById('mode').value;
  const solverUrl = document.getElementById('solverUrl').value.trim();
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  try {
    if (state.hero.some((c) => !c)) throw new Error('내 핸드 2장을 모두 선택해 주세요.');
    const boardCount = streetBoardCount(street);
    const board = state.board.slice(0, boardCount);
    if (board.length !== boardCount || board.some((c) => !c)) throw new Error(`${street}에 맞는 보드 카드를 선택해 주세요.`);
    if (opponents < 1 || opponents > 8) throw new Error('상대 인원 수는 1~8만 허용됩니다.');

    const hero = state.hero;
    const sim = monteCarloEquity({ hero, board, opponents, iterations });
    let action = null;
    let source = '로컬 계산';

    if ((mode === 'solver' || solverUrl) && solverUrl) {
      try {
        const solver = await requestExternalSolver({ street, hero, board, opponents, potOdds, equity: sim.equity }, solverUrl);
        action = { action: solver.action || 'Solver Action', mix: solver.mix || '-' };
        source = '외부 GTO Solver API';
      } catch (solverErr) {
        errorEl.textContent = `솔버 연동 실패, 로컬 결과로 폴백: ${solverErr.message}`;
      }
    }

    if (!action) {
      const preset = localGtoPreset(hero, street);
      if (preset) {
        action = { action: preset.action, mix: preset.mix };
        source = preset.source;
      } else {
        action = recommendHeuristic(sim.equity, potOdds, street);
        source = '로컬 시뮬레이션 + 휴리스틱';
      }
    }

    document.getElementById('equity').textContent = `${(sim.equity * 100).toFixed(2)}%`;
    document.getElementById('tie').textContent = `${(sim.tieRate * 100).toFixed(2)}%`;
    document.getElementById('action').textContent = action.action;
    document.getElementById('mix').textContent = action.mix;
    document.getElementById('source').textContent = source;
  } catch (err) {
    errorEl.textContent = err.message || String(err);
  }
}

document.getElementById('street').addEventListener('change', renderSlots);
document.getElementById('runBtn').addEventListener('click', runCalculation);
renderSlots();
