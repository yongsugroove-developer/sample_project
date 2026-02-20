const RANK_MAP = {
  '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const HISTORY_KEY = 'gtoEquityHistory';
const MAX_HISTORY = 8;
let historyResetWarningShown = false;
const FIELD_VALIDATION_RULES = [
  {
    id: 'potOdds',
    min: 0,
    max: 100,
    label: 'Pot odds',
  },
  {
    id: 'stackBb',
    min: 5,
    max: 300,
    label: 'Effective stack',
  },
  {
    id: 'betSize',
    min: 0,
    max: 200,
    label: 'Bet size',
  },
];
const SOLVER_TIMEOUT_MS = 5000;
const SOLVER_MAX_ATTEMPTS = 2;
const SOLVER_RETRY_BACKOFF_MS = 350;

const $els = {
  street: $('#street'),
  opponents: $('#opponents'),
  potOdds: $('#potOdds'),
  potOddsError: $('#potOddsError'),
  iterations: $('#iterations'),
  villainRange: $('#villainRange'),
  heroPosition: $('#heroPosition'),
  stackBb: $('#stackBb'),
  stackBbError: $('#stackBbError'),
  betSize: $('#betSize'),
  betSizeError: $('#betSizeError'),
  heroSlots: $('#heroSlots'),
  boardSlots: $('#boardSlots'),
  quickInput: $('#quickInput'),
  historySelect: $('#historySelect'),
  mode: $('#mode'),
  solverUrl: $('#solverUrl'),
  runBtn: $('#runBtn'),
  progressStatus: $('#progressStatus'),
  error: $('#error'),
  equity: $('#equity'),
  tie: $('#tie'),
  breakEven: $('#breakEven'),
  edge: $('#edge'),
  ev: $('#ev'),
  ci: $('#ci'),
  action: $('#action'),
  mix: $('#mix'),
  reason: $('#reason'),
  samplingMode: $('#samplingMode'),
  source: $('#source'),
  precisionBadge: $('#precisionBadge'),
  cardDialog: $('#cardDialog'),
  dialogTitle: $('#dialogTitle'),
  deckGrid: $('#deckGrid'),
};

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
  $els.quickInput.val(cardsToQuickText());
}

function parseQuickInput(value, street) {
  const parts = value.split('|');
  const heroTokens = (parts[0] || '').trim().split(/\s+/).filter(Boolean);
  const boardTokens = (parts[1] || '').trim().split(/\s+/).filter(Boolean);

  if (heroTokens.length !== 2) throw new Error('Quick input: hero cards must be exactly 2 cards.');

  const parsedHero = heroTokens.map(parseSingleCard);
  if (parsedHero.some((c) => !c)) throw new Error('Quick input: invalid hero card format. Ex: As Kd');

  const requiredBoard = streetBoardCount(street);
  if (boardTokens.length !== requiredBoard) {
    throw new Error(`Quick input: ${street} board must contain ${requiredBoard} cards.`);
  }

  const parsedBoard = boardTokens.map(parseSingleCard);
  if (parsedBoard.some((c) => !c)) throw new Error('Quick input: invalid board card format. Ex: Qh Jh 2c');

  const allCards = [...parsedHero, ...parsedBoard];
  if (new Set(allCards).size !== allCards.length) throw new Error('Quick input: duplicate cards are not allowed.');

  return { hero: parsedHero, board: parsedBoard };
}

function clearSlotCard(type, index) {
  if (type === 'hero') state.hero[index] = null;
  else state.board[index] = null;
}

function updateSlotA11y($el, type, index, card, isInteractive) {
  const base = type === 'hero' ? `Hero ${index + 1}` : `Board ${index + 1}`;
  const desc = card ? `${base}: ${card} selected` : `${base}: empty`;
  if (!isInteractive) {
    $el.attr('aria-label', `${desc}. Disabled for this street.`);
    return;
  }

  const clearHint = card ? ' Use remove button to clear.' : '';
  $el.attr('aria-label', `${desc}. Click to select a card.${clearHint}`);
}

function createClearButton(type, index) {
  const labelPrefix = type === 'hero' ? 'Hero' : 'Board';
  const $clearBtn = $('<button>', {
    type: 'button',
    class: 'slot-clear',
    text: 'x',
  });
  $clearBtn.attr('aria-label', `${labelPrefix} ${index + 1} card clear`);
  $clearBtn.on('click', (event) => {
    event.preventDefault();
    clearSlotCard(type, index);
    renderSlots();
    syncQuickInputFromState();
    const selector = `.slot[data-slot-type="${type}"][data-slot-index="${index}"]`;
    const $nextSlot = type === 'hero'
      ? $els.heroSlots.find(selector).first()
      : $els.boardSlots.find(selector).first();
    if ($nextSlot.length) $nextSlot.trigger('focus');
  });
  return $clearBtn;
}

function renderSlots() {
  $els.heroSlots.empty();
  $els.boardSlots.empty();

  const street = String($els.street.val());
  const boardCount = streetBoardCount(street);

  for (let i = 0; i < 2; i += 1) $els.heroSlots.append(createSlot('hero', i, state.hero[i]));
  for (let i = 0; i < 5; i += 1) {
    const isInteractive = i < boardCount;
    const $slotEl = createSlot('board', i, state.board[i], isInteractive);
    $slotEl.css('opacity', isInteractive ? '1' : '.35');
    $els.boardSlots.append($slotEl);
  }
}
function createSlot(type, index, card, isInteractive = true) {
  const classes = ['slot'];
  if (card) classes.push('filled');
  if (isInteractive) classes.push('clickable');

  const $slotButton = $('<button>', {
    type: 'button',
    class: classes.join(' '),
  });
  $slotButton.attr('data-slot-type', type);
  $slotButton.attr('data-slot-index', index);

  if (card) {
    $slotButton.append(
      $('<img>', { src: cardImagePath(card), alt: card }),
      $('<small>').text(`${card} (click to change)`),
    );
  } else {
    $slotButton.text(type === 'hero' ? `Hero ${index + 1}` : `Board ${index + 1}`);
  }

  updateSlotA11y($slotButton, type, index, card, isInteractive);

  const $slotContainer = $('<div>', { class: 'slot-wrap' });
  $slotContainer.append($slotButton);

  if (!isInteractive) {
    $slotButton.prop('disabled', true);
    $slotButton.attr('aria-disabled', 'true');
    $slotButton.prop('tabIndex', -1);
    return $slotContainer;
  }

  $slotButton.on('click', () => {
    const street = String($els.street.val());
    if (type === 'board' && index >= streetBoardCount(street)) return;
    state.lastFocusedSlot = $slotButton.get(0);
    openDeckDialog(type, index);
  });

  $slotButton.on('contextmenu', (event) => {
    event.preventDefault();
    clearSlotCard(type, index);
    renderSlots();
    syncQuickInputFromState();
  });

  if (card) $slotContainer.append(createClearButton(type, index));
  return $slotContainer;
}
function openDeckDialog(type, index) {
  state.selecting = { type, index };
  $els.dialogTitle.text(`${type === 'hero' ? 'Hero' : 'Board'} ${index + 1} Select Card`);

  const used = new Set(getUsedCards());
  $els.deckGrid.empty();

  for (const card of makeDeck()) {
    const isUsed = used.has(card);
    const $btn = $('<button>', {
      type: 'button',
      class: `deck-card${isUsed ? ' used' : ''}`,
    });
    $btn.prop('disabled', isUsed);
    $btn.attr('aria-label', `Select card ${card}`);
    $btn.attr('data-card', card);
    $btn.append($('<img>', { src: cardImagePath(card), alt: card }));
    $els.deckGrid.append($btn);
  }

  const dialogEl = $els.cardDialog.get(0);
  if (dialogEl && typeof dialogEl.showModal === 'function') dialogEl.showModal();

  const $firstEnabled = $els.deckGrid.find('button:not([disabled])').first();
  if ($firstEnabled.length) $firstEnabled.trigger('focus');
}
function assignCard(card) {
  if (!state.selecting) return;
  const { type, index } = state.selecting;
  if (type === 'hero') state.hero[index] = card;
  else state.board[index] = card;
  const dialogEl = $els.cardDialog.get(0);
  if (dialogEl && dialogEl.open && typeof dialogEl.close === 'function') dialogEl.close();
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
    return { action: 'preflop GTO preset', mix: preflop[key], source: `local preset (${key})` };
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
  if (!match) throw new Error(`Range token parse failed: ${token}`);
  const [, hi, lo, suitedFlag] = match;
  const hiIdx = RANKS.indexOf(hi);
  const loIdx = RANKS.indexOf(lo);
  if (hiIdx <= loIdx) throw new Error(`Range format error (high rank must come first): ${token}`);

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

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function normalizeMixRatios(raise, call, fold) {
  const entries = [
    { key: 'raise', value: clampPercent(Number.isFinite(raise) ? raise : 0) },
    { key: 'call', value: clampPercent(Number.isFinite(call) ? call : 0) },
    { key: 'fold', value: clampPercent(Number.isFinite(fold) ? fold : 0) },
  ];

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return { raise: 0, call: 0, fold: 100 };

  const scaled = entries.map((entry) => {
    const exact = (entry.value / total) * 100;
    return { ...entry, floor: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });

  const normalized = {
    raise: scaled.find((entry) => entry.key === 'raise').floor,
    call: scaled.find((entry) => entry.key === 'call').floor,
    fold: scaled.find((entry) => entry.key === 'fold').floor,
  };

  const floorTotal = normalized.raise + normalized.call + normalized.fold;
  const remainder = 100 - floorTotal;
  const byFraction = [...scaled].sort((a, b) => b.fraction - a.fraction || b.value - a.value);

  for (let i = 0; i < remainder; i += 1) {
    const key = byFraction[i % byFraction.length].key;
    normalized[key] += 1;
  }

  return normalized;
}

function formatMixRatios(mix) {
  return `Raise ${mix.raise}% / Call ${mix.call}% / Fold ${mix.fold}%`;
}

function parseMixRatios(rawMix) {
  const parsed = { raise: 0, call: 0, fold: 0 };

  if (typeof rawMix === 'string') {
    const ratioRegex = /(raise|call|fold)\s*([0-9]+(?:\.[0-9]+)?)%/gi;
    let match = ratioRegex.exec(rawMix);
    while (match) {
      const key = String(match[1]).toLowerCase();
      parsed[key] = clampPercent(Number(match[2]));
      match = ratioRegex.exec(rawMix);
    }
  } else if (rawMix && typeof rawMix === 'object') {
    parsed.raise = clampPercent(Number(rawMix.raise));
    parsed.call = clampPercent(Number(rawMix.call));
    parsed.fold = clampPercent(Number(rawMix.fold));
  }

  return parsed;
}

function normalizeRecommendationMix(rawMix) {
  const parsed = parseMixRatios(rawMix);
  let { raise, call, fold } = parsed;
  const total = raise + call + fold;

  if (total <= 0) return { raise: 0, call: 0, fold: 100 };
  if (total < 100) fold += 100 - total;

  return normalizeMixRatios(raise, call, fold);
}

function formatRecommendationMix(rawMix) {
  return formatMixRatios(normalizeRecommendationMix(rawMix));
}

function setFieldValidationUi($inputEl, $errorEl, message) {
  const hasError = Boolean(message);
  $inputEl.toggleClass('invalid', hasError);
  $inputEl.attr('aria-invalid', hasError ? 'true' : 'false');

  if ($errorEl && $errorEl.length) {
    $errorEl.text(hasError ? message : '');
    $errorEl.prop('hidden', !hasError);
  }
}

function validateNumericInputField(rule) {
  const $inputEl = $els[rule.id];
  if (!$inputEl || !$inputEl.length) return true;

  const $errorEl = $els[`${rule.id}Error`];
  const raw = String($inputEl.val() || '').trim();
  let message = '';

  if (!raw) {
    message = `${rule.label} is required.`;
  } else {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      message = `${rule.label} must be a number.`;
    } else if (value < rule.min || value > rule.max) {
      message = `${rule.label} must be between ${rule.min} and ${rule.max}.`;
    }
  }

  setFieldValidationUi($inputEl, $errorEl, message);
  return !message;
}

function validateScenarioInputs({ focusFirstInvalid = false } = {}) {
  let isValid = true;
  let $firstInvalidEl = null;

  for (const rule of FIELD_VALIDATION_RULES) {
    const valid = validateNumericInputField(rule);
    if (!valid) {
      isValid = false;
      if (!$firstInvalidEl) $firstInvalidEl = $els[rule.id];
    }
  }

  if (!isValid && focusFirstInvalid && $firstInvalidEl && $firstInvalidEl.length) $firstInvalidEl.trigger('focus');
  return isValid;
}

function bindRealtimeValidation() {
  for (const rule of FIELD_VALIDATION_RULES) {
    const $inputEl = $els[rule.id];
    if (!$inputEl || !$inputEl.length) continue;

    const validate = () => validateNumericInputField(rule);
    $inputEl.on('input', validate);
    $inputEl.on('change', validate);
    validate();
  }
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
    const mix = normalizeMixRatios(raiseRatio, callRatio, 100 - raiseRatio - callRatio);
    return {
      action: 'value betting / aggressive play',
      mix: formatMixRatios(mix),
      reason: `Required equity ${(adjustedCallLine * 100).toFixed(1)}%, estimated ${(equity * 100).toFixed(1)}% gives enough edge.`,
    };
  }
  if (equity >= adjustedCallLine) {
    const callRatio = Math.min(80, Math.round(55 + (equity - adjustedCallLine) * 120));
    const raiseRatio = Math.max(5, Math.round((equity - adjustedCallLine) * 40));
    const mix = normalizeMixRatios(raiseRatio, callRatio, 100 - raiseRatio - callRatio);
    return {
      action: 'call-focused',
      mix: formatMixRatios(mix),
      reason: `Near break-even line ${(adjustedCallLine * 100).toFixed(1)}% with playable margin.`,
    };
  }
  const foldRatio = Math.min(95, Math.round((adjustedCallLine - equity) * 170 + 40));
  const callRatio = Math.max(5, 100 - foldRatio - 5);
  const mix = normalizeMixRatios(5, callRatio, foldRatio);
  return {
    action: 'fold-leaning',
    mix: formatMixRatios(mix),
    reason: `Required equity ${(adjustedCallLine * 100).toFixed(1)}% is above estimated equity.`,
  };
}

function yieldToBrowser() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSolverError(message, code, retryable) {
  const err = new Error(message);
  err.code = code;
  err.retryable = retryable;
  return err;
}

async function monteCarloEquity({
  hero,
  board,
  opponents,
  iterations,
  villainRange,
  chunkSize = 500,
  onProgress = null,
}) {
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return { tieRate: 0, equity: 0, ciLow: 0, ciHigh: 0, usedRange: false };
  }

  let win = 0;
  let tie = 0;
  let usedRange = false;
  const used = [...hero, ...board];
  const deck = makeDeck().filter((c) => !used.includes(c));
  const deadCards = new Set(used);
  const rangeCombos = parseRangeToCombos(villainRange, deadCards);
  const safeChunkSize = Math.max(1, Math.min(iterations, Math.floor(chunkSize)));

  let completed = 0;
  while (completed < iterations) {
    const chunkEnd = Math.min(iterations, completed + safeChunkSize);

    for (let n = completed; n < chunkEnd; n += 1) {
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

    completed = chunkEnd;
    const progressPercent = (completed / iterations) * 100;
    if (onProgress) onProgress(progressPercent, completed, iterations);
    if (completed < iterations) await yieldToBrowser();
  }

  const equity = (win + tie * 0.5) / iterations;
  const tieRate = tie / iterations;
  const se = Math.sqrt(Math.max(0, equity * (1 - equity) / iterations));
  const ciLow = Math.max(0, equity - 1.96 * se);
  const ciHigh = Math.min(1, equity + 1.96 * se);

  return { tieRate, equity, ciLow, ciHigh, usedRange };
}

async function requestExternalSolver(payload, solverUrl) {
  let lastError = null;

  for (let attempt = 1; attempt <= SOLVER_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

    try {
      const res = await fetch(solverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const is5xx = res.status >= 500 && res.status < 600;
        throw createSolverError(`Solver API HTTP ${res.status}`, is5xx ? 'SOLVER_HTTP_5XX' : 'SOLVER_HTTP_4XX', is5xx);
      }

      return res.json();
    } catch (err) {
      if (err && err.name === 'AbortError') {
        lastError = createSolverError(`Solver request timed out after ${SOLVER_TIMEOUT_MS}ms`, 'SOLVER_TIMEOUT', true);
      } else if (err && err.retryable) {
        lastError = err;
      } else if (err instanceof TypeError) {
        lastError = createSolverError(`Solver network error: ${err.message || 'Request failed'}`, 'SOLVER_NETWORK', true);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!lastError || !lastError.retryable || attempt >= SOLVER_MAX_ATTEMPTS) break;
    await sleep(SOLVER_RETRY_BACKOFF_MS * attempt);
  }

  throw lastError || new Error('Solver request failed.');
}

function showHistoryResetWarningOnce() {
  if (historyResetWarningShown) return;
  historyResetWarningShown = true;
  if ($els.error.length) $els.error.text('Stored history was corrupted and has been reset.');
}

function resetCorruptedHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (_err) {
    // no-op
  }
  showHistoryResetWarningOnce();
  return [];
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const street = entry.street;
  if (!['preflop', 'flop', 'turn', 'river'].includes(street)) return null;

  if (!Array.isArray(entry.hero) || entry.hero.length !== 2) return null;
  if (!Array.isArray(entry.board) || entry.board.length !== streetBoardCount(street) || entry.board.length > 5) return null;

  const hero = entry.hero.map((card) => parseSingleCard(String(card || '')));
  const board = entry.board.map((card) => parseSingleCard(String(card || '')));
  if (hero.some((card) => !card) || board.some((card) => !card)) return null;

  const allCards = [...hero, ...board];
  if (new Set(allCards).size !== allCards.length) return null;

  const opponents = Number(entry.opponents);
  const potOdds = Number(entry.potOdds);
  const iterations = Number(entry.iterations);
  const position = entry.position;
  const stackBb = Number(entry.stackBb);
  const betSize = Number(entry.betSize);

  if (!Number.isInteger(opponents) || opponents < 1 || opponents > 8) return null;
  if (!Number.isFinite(potOdds) || potOdds < 0 || potOdds > 100) return null;
  if (!Number.isInteger(iterations) || iterations < 500 || iterations > 50000) return null;
  if (typeof entry.villainRange !== 'string') return null;
  if (position !== 'ip' && position !== 'oop') return null;
  if (!Number.isFinite(stackBb) || stackBb < 5 || stackBb > 300) return null;
  if (!Number.isFinite(betSize) || betSize < 0 || betSize > 200) return null;

  return {
    street,
    hero,
    board,
    opponents,
    potOdds,
    iterations,
    villainRange: entry.villainRange,
    position,
    stackBb,
    betSize,
  };
}

function readHistorySafely() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_err) {
    return resetCorruptedHistory();
  }

  if (!Array.isArray(parsed)) return resetCorruptedHistory();

  const normalized = [];
  for (const item of parsed) {
    const safeItem = normalizeHistoryEntry(item);
    if (!safeItem) return resetCorruptedHistory();
    normalized.push(safeItem);
  }

  return normalized.slice(0, MAX_HISTORY);
}

function saveScenarioToHistory(payload) {
  const history = readHistorySafely();
  const serialized = JSON.stringify(payload);
  const deduped = history.filter((item) => JSON.stringify(item) !== serialized);
  deduped.unshift(payload);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(deduped.slice(0, MAX_HISTORY)));
  renderHistoryOptions();
}

function renderHistoryOptions() {
  const history = readHistorySafely();
  $els.historySelect.empty();
  $els.historySelect.append($('<option>', {
    value: '',
    text: 'Select a saved scenario',
  }));

  history.forEach((item, idx) => {
    $els.historySelect.append($('<option>', {
      value: String(idx),
      text: `${item.street.toUpperCase()} | ${item.hero.join(' ')} | ${item.board.join(' ') || '-'}`,
    }));
  });
}

function loadScenarioFromHistory(index) {
  const history = readHistorySafely();
  const chosen = history[index];
  if (!chosen) return;

  $els.street.val(chosen.street);
  $els.opponents.val(chosen.opponents);
  $els.potOdds.val(chosen.potOdds);
  $els.iterations.val(chosen.iterations);
  $els.villainRange.val(chosen.villainRange);
  $els.heroPosition.val(chosen.position);
  $els.stackBb.val(chosen.stackBb);
  $els.betSize.val(chosen.betSize);

  state.hero = [...chosen.hero];
  state.board = [...chosen.board, null, null, null, null, null].slice(0, 5);
  renderSlots();
  syncQuickInputFromState();
  validateScenarioInputs();
}

function setMetricValue($el, text, status) {
  $el.text(text);
  $el.removeClass('positive neutral negative');
  if (status) $el.addClass(status);
}

let isCalculating = false;
const runBtnIdleLabel = $els.runBtn.length ? String($els.runBtn.text()) : 'Run Calculation';

function setCalculationUiState({ busy, progressPercent = 0, statusText = '' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(progressPercent)));

  if ($els.runBtn.length) {
    $els.runBtn.prop('disabled', busy);
    $els.runBtn.attr('aria-disabled', busy ? 'true' : 'false');
    $els.runBtn.text(busy ? `${runBtnIdleLabel} (${safePercent}%)` : runBtnIdleLabel);
  }

  if ($els.progressStatus.length) {
    $els.progressStatus.text(busy ? statusText : '');
  }
}

async function runCalculation() {
  if (isCalculating) return;
  $els.error.text('');
  if (!validateScenarioInputs({ focusFirstInvalid: true })) return;

  isCalculating = true;
  setCalculationUiState({ busy: true, progressPercent: 0, statusText: 'Preparing calculation...' });

  const street = String($els.street.val());
  const opponents = Number($els.opponents.val());
  const potOdds = Number($els.potOdds.val()) / 100;
  const iterations = Number($els.iterations.val());
  const mode = String($els.mode.val());
  const solverUrl = String($els.solverUrl.val() || '').trim();
  const villainRange = String($els.villainRange.val() || '').trim();
  const position = String($els.heroPosition.val());
  const stackBb = Number($els.stackBb.val());
  const betSize = Number($els.betSize.val());

  try {
    if (state.hero.some((c) => !c)) throw new Error('Please select both hero cards.');
    const boardCount = streetBoardCount(street);
    const board = state.board.slice(0, boardCount);
    if (board.length !== boardCount || board.some((c) => !c)) throw new Error(`Please select board cards for ${street}.`);
    if (opponents < 1 || opponents > 8) throw new Error('Opponent count must be between 1 and 8.');
    if (iterations < 500 || iterations > 50000) throw new Error('Simulation iterations must be between 500 and 50000.');

    const hero = [...state.hero];
    const simulationChunkSize = Math.max(
      50,
      Math.min(400, Math.floor(iterations / Math.max(60, opponents * 20))),
    );
    const sim = await monteCarloEquity({
      hero,
      board,
      opponents,
      iterations,
      villainRange,
      chunkSize: simulationChunkSize,
      onProgress: (progressPercent, completed, total) => {
        setCalculationUiState({
          busy: true,
          progressPercent,
          statusText: `Simulation in progress... ${completed}/${total} (${Math.round(progressPercent)}%)`,
        });
      },
    });
    setCalculationUiState({ busy: true, progressPercent: 100, statusText: 'Simulation complete. Finalizing results...' });

    let action = null;
    let source = 'Local simulation';

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
          reason: solver.reason || 'Used response from external solver.',
        };
        source = 'External GTO Solver API';
      } catch (solverErr) {
        const message = solverErr && solverErr.message ? solverErr.message : String(solverErr);
        $els.error.text(`Solver request failed, using local fallback: ${message}`);
      }
    }

    if (!action) {
      const preset = localGtoPreset(hero, street);
      if (preset) {
        action = { action: preset.action, mix: preset.mix, reason: `Chart match result (${preset.source}).` };
        source = preset.source;
      } else {
        action = recommendHeuristic({ equity: sim.equity, potOdds, street, position, stackBb, betSize });
        source = 'Local simulation + context heuristic';
      }
    }

    const breakEven = potOdds;
    const edge = sim.equity - breakEven;
    const ev = sim.equity - potOdds;

    setMetricValue($els.equity, `${(sim.equity * 100).toFixed(2)}%`, sim.equity > breakEven ? 'positive' : 'negative');
    $els.tie.text(`${(sim.tieRate * 100).toFixed(2)}%`);
    $els.breakEven.text(`${(breakEven * 100).toFixed(2)}%`);
    setMetricValue($els.edge, `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(2)}%p`, edge >= 0 ? 'positive' : 'negative');
    setMetricValue($els.ev, `${ev >= 0 ? '+' : ''}${ev.toFixed(3)} pot`, ev >= 0 ? 'positive' : 'negative');
    $els.ci.text(`${(sim.ciLow * 100).toFixed(2)}% ~ ${(sim.ciHigh * 100).toFixed(2)}%`);
    $els.action.text(action.action);
    $els.mix.text(formatRecommendationMix(action.mix));
    $els.reason.text(`Need at least ${(breakEven * 100).toFixed(1)}%, estimated ${(sim.equity * 100).toFixed(1)}%. ${action.reason}`);
    $els.samplingMode.text(sim.usedRange ? 'Range-weighted' : 'Uniform');
    $els.source.text(source);

    $els.precisionBadge.prop('hidden', iterations >= 2000);

    saveScenarioToHistory({
      street,
      hero,
      board,
      opponents,
      potOdds: Number($els.potOdds.val()),
      iterations,
      villainRange,
      position,
      stackBb,
      betSize,
    });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    $els.error.text(message);
  } finally {
    isCalculating = false;
    setCalculationUiState({ busy: false });
  }
}

$els.street.on('change', () => {
  const street = String($els.street.val());
  const keep = streetBoardCount(street);
  for (let i = keep; i < 5; i += 1) state.board[i] = null;
  renderSlots();
  syncQuickInputFromState();
});

if ($els.runBtn.length) {
  $els.runBtn.on('click', () => {
    void runCalculation();
  });
}

$els.quickInput.on('change', (event) => {
  $els.error.text('');
  try {
    const street = String($els.street.val());
    const parsed = parseQuickInput(String($(event.currentTarget).val() || ''), street);
    state.hero = [...parsed.hero];
    state.board = [...parsed.board, null, null, null, null, null].slice(0, 5);
    renderSlots();
    syncQuickInputFromState();
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    $els.error.text(message);
  }
});

$('.preset').on('click', (event) => {
  $els.villainRange.val(String($(event.currentTarget).data('range') || ''));
});

$els.historySelect.on('change', (event) => {
  const value = String($(event.currentTarget).val() || '');
  if (!value) return;
  loadScenarioFromHistory(Number(value));
});

$els.deckGrid.on('click', '.deck-card', (event) => {
  const $target = $(event.currentTarget);
  if ($target.prop('disabled')) return;
  const card = String($target.data('card') || '');
  if (!card) return;
  assignCard(card);
});

$els.cardDialog.on('close', () => {
  if (state.lastFocusedSlot) state.lastFocusedSlot.focus();
});

bindRealtimeValidation();
renderHistoryOptions();
renderSlots();
syncQuickInputFromState();
