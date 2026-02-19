const RANK_MAP = {
  '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const HISTORY_KEY = 'gtoEquityHistory';
const MAX_HISTORY = 8;

const state = {
  hero: [null, null],
  board: [null, null, null, null, null],
  selecting: null,
  lastFocusedSlot: null,
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

function parseSingleCard(raw) {
  const token = raw.trim();
  if (!/^[2-9TJQKA][shdc]$/i.test(token)) return null;
  return `${token[0].toUpperCase()}${token[1].toLowerCase()}`;
}

function cardsToQuickText() {
  const heroText = state.hero.filter(Boolean).join(' ');
  const boardText = state.board.filter(Boolean).join(' ');
  return `${heroText}${boardText ? ` | ${boardText}` : ''}`.trim();
}

function syncQuickInputFromState() {
  document.getElementById('quickInput').value = cardsToQuickText();
}

function parseQuickInput(value, street) {
  const parts = value.split('|');
  const heroTokens = (parts[0] || '').trim().split(/\s+/).filter(Boolean);
  const boardTokens = (parts[1] || '').trim().split(/\s+/).filter(Boolean);

  if (heroTokens.length !== 2) throw new Error('빠른 입력: 히어로 카드는 정확히 2장이어야 합니다.');

  const parsedHero = heroTokens.map(parseSingleCard);
  if (parsedHero.some((c) => !c)) throw new Error('빠른 입력: 히어로 카드 표기 오류가 있습니다. 예) As Kd');

  const requiredBoard = streetBoardCount(street);
  if (boardTokens.length !== requiredBoard) {
    throw new Error(`빠른 입력: ${street} 보드는 ${requiredBoard}장이어야 합니다.`);
  }

  const parsedBoard = boardTokens.map(parseSingleCard);
  if (parsedBoard.some((c) => !c)) throw new Error('빠른 입력: 보드 카드 표기 오류가 있습니다. 예) Qh Jh 2c');

  const allCards = [...parsedHero, ...parsedBoard];
  if (new Set(allCards).size !== allCards.length) throw new Error('빠른 입력: 중복 카드가 있습니다.');

  return { hero: parsedHero, board: parsedBoard };
}

function updateSlotA11y(el, type, index, card) {
  const base = type === 'hero' ? `핸드 ${index + 1}` : `보드 ${index + 1}`;
  const desc = card ? `${base}: ${card} 선택됨` : `${base}: 비어 있음`;
  el.setAttribute('aria-label', `${desc}. 클릭하여 카드 선택, 제거 버튼으로 비우기.`);
}

function createClearButton(type, index) {
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'slot-clear';
  clearBtn.textContent = '×';
  clearBtn.setAttribute('aria-label', `${type === 'hero' ? '핸드' : '보드'} ${index + 1} 카드 삭제`);
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (type === 'hero') state.hero[index] = null;
    else state.board[index] = null;
    renderSlots();
    syncQuickInputFromState();
  });
  return clearBtn;
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
    el.appendChild(createClearButton(type, index));
  } else {
    el.textContent = type === 'hero' ? `핸드 ${index + 1}` : `보드 ${index + 1}`;
  }

  updateSlotA11y(el, type, index, card);

  el.addEventListener('click', () => {
    const street = document.getElementById('street').value;
    if (type === 'board' && index >= streetBoardCount(street)) return;
    state.lastFocusedSlot = el;
    openDeckDialog(type, index);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (type === 'hero') state.hero[index] = null;
    else state.board[index] = null;
    renderSlots();
    syncQuickInputFromState();
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
    btn.setAttribute('aria-label', `카드 ${card} 선택`);
    btn.innerHTML = `<img src='${cardImagePath(card)}' alt='${card}' />`;
    btn.addEventListener('click', () => assignCard(card));
    deckGrid.appendChild(btn);
  }

  dialog.showModal();
  const firstEnabled = deckGrid.querySelector('button:not([disabled])');
  if (firstEnabled) firstEnabled.focus();
}

function assignCard(card) {
  const { type, index } = state.selecting;
  if (type === 'hero') state.hero[index] = card;
  else state.board[index] = card;
  document.getElementById('cardDialog').close();
  renderSlots();
  syncQuickInputFromState();
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

function expandRangeToken(token) {
  const clean = token.trim();
  if (!clean) return [];
  const plus = clean.endsWith('+');
  const core = plus ? clean.slice(0, -1) : clean;

  if (/^[2-9TJQKA]{2}$/.test(core)) {
    const startRank = core[0];
    const startIdx = RANKS.indexOf(startRank);
    if (!plus) return [core];
    return RANKS.slice(startIdx).map((r) => `${r}${r}`);
  }

  const match = core.match(/^([2-9TJQKA])([2-9TJQKA])(s|o)$/);
  if (!match) throw new Error(`레인지 토큰 파싱 실패: ${token}`);
  const [, hi, lo, suitedFlag] = match;
  const hiIdx = RANKS.indexOf(hi);
  const loIdx = RANKS.indexOf(lo);
  if (hiIdx <= loIdx) throw new Error(`레인지 표기 오류(높은 랭크 먼저): ${token}`);

  if (!plus) return [`${hi}${lo}${suitedFlag}`];

  const hands = [];
  for (let i = loIdx; i < hiIdx; i += 1) {
    hands.push(`${hi}${RANKS[i]}${suitedFlag}`);
  }
  return hands;
}

function combosFromHandLabel(label) {
  if (/^[2-9TJQKA]{2}$/.test(label)) {
    const r = label[0];
    const combos = [];
    for (let i = 0; i < SUITS.length; i += 1) {
      for (let j = i + 1; j < SUITS.length; j += 1) {
        combos.push([`${r}${SUITS[i]}`, `${r}${SUITS[j]}`]);
      }
    }
    return combos;
  }

  const m = label.match(/^([2-9TJQKA])([2-9TJQKA])(s|o)$/);
  if (!m) return [];
  const [, r1, r2, suitedFlag] = m;
  const combos = [];

  if (suitedFlag === 's') {
    for (const s of SUITS) combos.push([`${r1}${s}`, `${r2}${s}`]);
  } else {
    for (const s1 of SUITS) {
      for (const s2 of SUITS) {
        if (s1 !== s2) combos.push([`${r1}${s1}`, `${r2}${s2}`]);
      }
    }
  }
  return combos;
}

function parseRangeToCombos(rangeText, deadCards) {
  const tokens = rangeText.split(',').map((x) => x.trim()).filter(Boolean);
  if (!tokens.length) return [];

  const comboSet = new Set();
  for (const token of tokens) {
    const expanded = expandRangeToken(token);
    for (const hand of expanded) {
      for (const combo of combosFromHandLabel(hand)) {
        const [c1, c2] = combo;
        if (deadCards.has(c1) || deadCards.has(c2)) continue;
        const key = [c1, c2].sort().join('-');
        comboSet.add(key);
      }
    }
  }

  return [...comboSet].map((k) => k.split('-'));
}

function takeRandomRangeCombo(rangeCombos, blocked) {
  const candidates = [];
  for (const combo of rangeCombos) {
    if (!blocked.has(combo[0]) && !blocked.has(combo[1])) candidates.push(combo);
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function recommendHeuristic({ equity, potOdds, street, position, stackBb, betSize }) {
  const pressureByStreet = { preflop: 0.05, flop: 0.02, turn: 0, river: -0.02 };
  const positionAdj = position === 'oop' ? 0.03 : -0.01;
  const stackAdj = stackBb < 30 ? -0.02 : stackBb > 150 ? 0.015 : 0;
  const sizeAdj = betSize > 90 ? 0.03 : betSize < 40 ? -0.015 : 0;

  const adjustedCallLine = potOdds + (pressureByStreet[street] || 0) + positionAdj + stackAdj + sizeAdj;
  const raiseLine = adjustedCallLine + 0.15;

  if (equity >= raiseLine) {
    const raiseRatio = Math.min(85, Math.round((equity - adjustedCallLine) * 140));
    const callRatio = Math.max(10, 100 - raiseRatio - 5);
    return {
      action: '밸류 레이즈 / 공격적 플레이',
      mix: `Raise ${raiseRatio}% / Call ${callRatio}% / Fold ${100 - raiseRatio - callRatio}%`,
      reason: `필요 승률 ${(adjustedCallLine * 100).toFixed(1)}% 대비 추정 ${(equity * 100).toFixed(1)}%로 충분한 우위입니다.`,
    };
  }
  if (equity >= adjustedCallLine) {
    const callRatio = Math.min(80, Math.round(55 + (equity - adjustedCallLine) * 120));
    const raiseRatio = Math.max(5, Math.round((equity - adjustedCallLine) * 40));
    return {
      action: '콜 중심',
      mix: `Raise ${raiseRatio}% / Call ${callRatio}% / Fold ${100 - raiseRatio - callRatio}%`,
      reason: `브레이크이븐 라인 ${(adjustedCallLine * 100).toFixed(1)}%를 소폭 상회합니다.`,
    };
  }
  const foldRatio = Math.min(95, Math.round((adjustedCallLine - equity) * 170 + 40));
  const callRatio = Math.max(5, 100 - foldRatio - 5);
  return {
    action: '폴드 우선',
    mix: `Raise 5% / Call ${callRatio}% / Fold ${foldRatio}%`,
    reason: `필요 승률 ${(adjustedCallLine * 100).toFixed(1)}%보다 추정 승률이 낮습니다.`,
  };
}

function monteCarloEquity({ hero, board, opponents, iterations, villainRange }) {
  let win = 0;
  let tie = 0;
  let usedRange = false;
  const used = [...hero, ...board];
  const deck = makeDeck().filter((c) => !used.includes(c));
  const deadCards = new Set(used);
  const rangeCombos = parseRangeToCombos(villainRange, deadCards);

  for (let n = 0; n < iterations; n += 1) {
    const remainBoard = 5 - board.length;
    const sampledVillains = [];
    const blocked = new Set(used);

    for (let p = 0; p < opponents; p += 1) {
      let selected = null;
      if (rangeCombos.length) {
        selected = takeRandomRangeCombo(rangeCombos, blocked);
        if (selected) usedRange = true;
      }
      if (!selected) {
        const remaining = deck.filter((c) => !blocked.has(c));
        if (remaining.length < 2) return { tieRate: 0, equity: 0, ciLow: 0, ciHigh: 0, usedRange: false };
        selected = sampleWithoutReplacement(remaining, 2);
      }

      blocked.add(selected[0]);
      blocked.add(selected[1]);
      sampledVillains.push(selected);
    }

    const remainDeck = deck.filter((c) => !blocked.has(c));
    const boardSample = sampleWithoutReplacement(remainDeck, remainBoard);
    const boardComplete = [...board, ...boardSample];

    const heroScore = bestOfSeven([...hero, ...boardComplete]);
    let betterExists = false;
    let tieExists = false;

    for (const villainCards of sampledVillains) {
      const villainScore = bestOfSeven([...villainCards, ...boardComplete]);
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

  const equity = (win + tie * 0.5) / iterations;
  const tieRate = tie / iterations;
  const se = Math.sqrt(Math.max(0, equity * (1 - equity) / iterations));
  const ciLow = Math.max(0, equity - 1.96 * se);
  const ciHigh = Math.min(1, equity + 1.96 * se);

  return { tieRate, equity, ciLow, ciHigh, usedRange };
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

function saveScenarioToHistory(payload) {
  const raw = localStorage.getItem(HISTORY_KEY);
  const history = raw ? JSON.parse(raw) : [];
  const serialized = JSON.stringify(payload);
  const deduped = history.filter((item) => JSON.stringify(item) !== serialized);
  deduped.unshift(payload);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped.slice(0, MAX_HISTORY)));
  renderHistoryOptions();
}

function renderHistoryOptions() {
  const select = document.getElementById('historySelect');
  const raw = localStorage.getItem(HISTORY_KEY);
  const history = raw ? JSON.parse(raw) : [];
  select.innerHTML = '<option value="">저장된 시나리오 선택</option>';

  history.forEach((item, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = `${item.street.toUpperCase()} | ${item.hero.join(' ')} | ${item.board.join(' ') || '-'}`;
    select.appendChild(option);
  });
}

function loadScenarioFromHistory(index) {
  const raw = localStorage.getItem(HISTORY_KEY);
  const history = raw ? JSON.parse(raw) : [];
  const chosen = history[index];
  if (!chosen) return;

  document.getElementById('street').value = chosen.street;
  document.getElementById('opponents').value = chosen.opponents;
  document.getElementById('potOdds').value = chosen.potOdds;
  document.getElementById('iterations').value = chosen.iterations;
  document.getElementById('villainRange').value = chosen.villainRange;
  document.getElementById('heroPosition').value = chosen.position;
  document.getElementById('stackBb').value = chosen.stackBb;
  document.getElementById('betSize').value = chosen.betSize;

  state.hero = [...chosen.hero];
  state.board = [...chosen.board, null, null, null, null, null].slice(0, 5);
  renderSlots();
  syncQuickInputFromState();
}

function setMetricValue(el, text, status) {
  el.textContent = text;
  el.classList.remove('positive', 'neutral', 'negative');
  if (status) el.classList.add(status);
}

async function runCalculation() {
  const street = document.getElementById('street').value;
  const opponents = Number(document.getElementById('opponents').value);
  const potOdds = Number(document.getElementById('potOdds').value) / 100;
  const iterations = Number(document.getElementById('iterations').value);
  const mode = document.getElementById('mode').value;
  const solverUrl = document.getElementById('solverUrl').value.trim();
  const villainRange = document.getElementById('villainRange').value.trim();
  const position = document.getElementById('heroPosition').value;
  const stackBb = Number(document.getElementById('stackBb').value);
  const betSize = Number(document.getElementById('betSize').value);
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';

  try {
    if (state.hero.some((c) => !c)) throw new Error('내 핸드 2장을 모두 선택해 주세요.');
    const boardCount = streetBoardCount(street);
    const board = state.board.slice(0, boardCount);
    if (board.length !== boardCount || board.some((c) => !c)) throw new Error(`${street}에 맞는 보드 카드를 선택해 주세요.`);
    if (opponents < 1 || opponents > 8) throw new Error('상대 인원 수는 1~8만 허용됩니다.');
    if (iterations < 500 || iterations > 50000) throw new Error('시뮬레이션 횟수는 500~50000 범위여야 합니다.');

    const hero = state.hero;
    const sim = monteCarloEquity({ hero, board, opponents, iterations, villainRange });
    let action = null;
    let source = '로컬 계산';

    if ((mode === 'solver' || solverUrl) && solverUrl) {
      try {
        const solver = await requestExternalSolver({
          street,
          hero,
          board,
          opponents,
          potOdds,
          equity: sim.equity,
          villainRange,
          position,
          stackBb,
          betSize,
        }, solverUrl);
        action = {
          action: solver.action || 'Solver Action',
          mix: solver.mix || '-',
          reason: solver.reason || '외부 솔버 응답을 사용했습니다.',
        };
        source = '외부 GTO Solver API';
      } catch (solverErr) {
        errorEl.textContent = `솔버 연동 실패, 로컬 결과로 폴백: ${solverErr.message}`;
      }
    }

    if (!action) {
      const preset = localGtoPreset(hero, street);
      if (preset) {
        action = { action: preset.action, mix: preset.mix, reason: `프리플랍 프리셋(${preset.source}) 매칭 결과입니다.` };
        source = preset.source;
      } else {
        action = recommendHeuristic({ equity: sim.equity, potOdds, street, position, stackBb, betSize });
        source = '로컬 시뮬레이션 + 컨텍스트 휴리스틱';
      }
    }

    const breakEven = potOdds;
    const edge = sim.equity - breakEven;
    const ev = sim.equity - potOdds;

    setMetricValue(document.getElementById('equity'), `${(sim.equity * 100).toFixed(2)}%`, sim.equity > breakEven ? 'positive' : 'negative');
    document.getElementById('tie').textContent = `${(sim.tieRate * 100).toFixed(2)}%`;
    document.getElementById('breakEven').textContent = `${(breakEven * 100).toFixed(2)}%`;
    setMetricValue(document.getElementById('edge'), `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(2)}%p`, edge >= 0 ? 'positive' : 'negative');
    setMetricValue(document.getElementById('ev'), `${ev >= 0 ? '+' : ''}${ev.toFixed(3)} pot`, ev >= 0 ? 'positive' : 'negative');
    document.getElementById('ci').textContent = `${(sim.ciLow * 100).toFixed(2)}% ~ ${(sim.ciHigh * 100).toFixed(2)}%`;
    document.getElementById('action').textContent = action.action;
    document.getElementById('mix').textContent = action.mix;
    document.getElementById('reason').textContent = `최소 ${(breakEven * 100).toFixed(1)}% 필요, 추정 ${(sim.equity * 100).toFixed(1)}%. ${action.reason}`;
    document.getElementById('samplingMode').textContent = sim.usedRange ? 'Range-weighted' : 'Uniform';
    document.getElementById('source').textContent = source;

    document.getElementById('precisionBadge').hidden = iterations >= 2000;

    saveScenarioToHistory({
      street,
      hero,
      board,
      opponents,
      potOdds: Number(document.getElementById('potOdds').value),
      iterations,
      villainRange,
      position,
      stackBb,
      betSize,
    });
  } catch (err) {
    errorEl.textContent = err.message || String(err);
  }
}

document.getElementById('street').addEventListener('change', () => {
  const street = document.getElementById('street').value;
  const keep = streetBoardCount(street);
  for (let i = keep; i < 5; i += 1) state.board[i] = null;
  renderSlots();
  syncQuickInputFromState();
});

document.getElementById('runBtn').addEventListener('click', runCalculation);

document.getElementById('quickInput').addEventListener('change', (e) => {
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  try {
    const street = document.getElementById('street').value;
    const parsed = parseQuickInput(e.target.value, street);
    state.hero = [...parsed.hero];
    state.board = [...parsed.board, null, null, null, null, null].slice(0, 5);
    renderSlots();
    syncQuickInputFromState();
  } catch (err) {
    errorEl.textContent = err.message || String(err);
  }
});

document.querySelectorAll('.preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('villainRange').value = btn.dataset.range || '';
  });
});

document.getElementById('historySelect').addEventListener('change', (e) => {
  if (!e.target.value) return;
  loadScenarioFromHistory(Number(e.target.value));
});

document.getElementById('cardDialog').addEventListener('close', () => {
  if (state.lastFocusedSlot) state.lastFocusedSlot.focus();
});

renderHistoryOptions();
renderSlots();
syncQuickInputFromState();
