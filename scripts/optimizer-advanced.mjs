/**
 * Advanced Scoring Model Optimizer
 * Tests ADVANCED scoring models beyond the basic V2 formula.
 * Focus: edge improvements for 1-2 day holds over 360 days.
 *
 * Models tested:
 *   1. Yield Differential
 *   2. Bias Momentum (recent CB bias changes)
 *   3. Rate Gap Extremes
 *   4. Safe Haven Filter (VIX-based)
 *   5. Conviction Tiers
 *   6. Combined Best
 */

import https from 'https';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── 21 PAIRS ───
const PAIR_SYMBOLS = {
  'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X', 'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X', 'NZD/USD': 'NZDUSD=X', 'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X', 'EUR/GBP': 'EURGBP=X', 'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X', 'AUD/JPY': 'AUDJPY=X', 'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X', 'EUR/AUD': 'EURAUD=X', 'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X', 'EUR/CHF': 'EURCHF=X', 'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X', 'GBP/NZD': 'GBPNZD=X', 'AUD/CAD': 'AUDCAD=X',
};

const INTERMARKET_SYMBOLS = {
  'US10Y': '%5ETNX', 'SP500': '%5EGSPC', 'VIX': '%5EVIX',
  'GOLD': 'GC%3DF', 'OIL': 'CL%3DF', 'DXY': 'DX-Y.NYB',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'];
const SAFE_HAVENS = ['JPY', 'CHF'];
const HIGH_YIELD = ['AUD', 'NZD', 'CAD'];

// ─── FETCH HELPERS ───
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers,
      }
    };
    const req = mod.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const parsedUrl = new URL(url);
        const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`;
        return fetchJSON(redirectUrl, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error (${res.statusCode}): ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchYahooHistory(symbol, days = 370) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${now}&interval=1d`;
  const data = await fetchJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) return [];
  const timestamps = result.timestamp;
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().split('T')[0],
    close: closes[i],
  })).filter(p => p.close != null);
}

// ─── SCORING PRIMITIVES ───
function calcCBScore(bias) {
  const map = {
    'hawkish': 2, 'verkrappend': 2,
    'voorzichtig verkrappend': 1.5,
    'afwachtend': 0, 'neutraal': 0, 'neutral': 0,
    'voorzichtig verruimend': -1,
    'dovish': -2, 'verruimend': -2,
  };
  return map[(bias || '').toLowerCase()] ?? 0;
}

function calcRateGap(rate, target) {
  if (rate == null || target == null) return 0;
  return rate - target;
}

function calcRateScore(rate, target) {
  const diff = calcRateGap(rate, target);
  if (diff > 0.5) return 1;
  if (diff > 0) return 0.5;
  if (diff > -0.5) return -0.5;
  return -1;
}

function getPairComponents(pair) {
  return { base: pair.split('/')[0], quote: pair.split('/')[1] };
}

// ─── TRADE EVALUATION ───
function evaluateTrade(pair, direction, priceData, entryDate, holdingDays) {
  const prices = priceData[pair];
  if (!prices || prices.length === 0) return null;

  const entryIdx = prices.findIndex(p => p.date === entryDate);
  if (entryIdx < 0) return null;
  const exitIdx = entryIdx + holdingDays;
  if (exitIdx >= prices.length) return null;

  const entryPrice = prices[entryIdx].close;
  const exitPrice = prices[exitIdx].close;
  const priceDiff = exitPrice - entryPrice;

  const isJpyPair = pair.includes('JPY');
  const pips = Math.round(Math.abs(priceDiff) * (isJpyPair ? 100 : 10000));

  let correct = false;
  if (direction === 'long' && priceDiff > 0) correct = true;
  if (direction === 'short' && priceDiff < 0) correct = true;

  return {
    pair, direction, entryDate,
    pips: correct ? pips : -pips,
    result: correct ? 'correct' : 'incorrect',
  };
}

// ─── CONTRARIAN FILTER ───
// Only take signal if price moved AGAINST the fundamental direction over lookback
function passesContrarian(pair, direction, priceData, signalDate, lookbackDays) {
  const prices = priceData[pair];
  if (!prices || prices.length === 0) return true; // pass if no data
  const idx = prices.findIndex(p => p.date === signalDate);
  if (idx < 0 || idx < lookbackDays) return true;
  const momentum = prices[idx].close - prices[idx - lookbackDays].close;
  // Contrarian: we want price to have moved opposite to our signal
  if (direction === 'long' && momentum < 0) return true;
  if (direction === 'short' && momentum > 0) return true;
  return false;
}

// ─── RESULTS COLLECTOR ───
function calcStats(trades) {
  const correct = trades.filter(t => t.result === 'correct').length;
  const incorrect = trades.length - correct;
  const total = trades.length;
  const winRate = total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A';
  const totalPips = trades.reduce((s, t) => s + t.pips, 0);
  const winPips = trades.filter(t => t.pips > 0).reduce((s, t) => s + t.pips, 0);
  const lossPips = Math.abs(trades.filter(t => t.pips < 0).reduce((s, t) => s + t.pips, 0));
  const profitFactor = lossPips > 0 ? (winPips / lossPips).toFixed(2) : winPips > 0 ? '99.00' : '0.00';
  return { correct, incorrect, total, winRate, totalPips, profitFactor };
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('================================================================');
  console.log('  SANDERS CAPITAL - ADVANCED SCORING MODEL OPTIMIZER');
  console.log('  Testing 6 advanced models over 360 days, 21 pairs');
  console.log('  Focus: 1d and 2d hold periods');
  console.log('================================================================\n');

  // ─── 1. Fetch CB rate snapshots ───
  console.log('[1/5] Fetching CB rate snapshots...');
  const { data: snapshots, error: snapErr } = await supabase
    .from('cb_rate_snapshots')
    .select('snapshot_date, currency, rate, target, bias, bank')
    .order('snapshot_date', { ascending: true });
  if (snapErr) { console.error('Snapshot error:', snapErr); return; }

  const snapshotsByDate = {};
  for (const s of snapshots || []) {
    if (!snapshotsByDate[s.snapshot_date]) snapshotsByDate[s.snapshot_date] = {};
    snapshotsByDate[s.snapshot_date][s.currency] = { rate: s.rate, target: s.target, bias: s.bias };
  }
  const snapshotDates = Object.keys(snapshotsByDate).sort();
  console.log(`   -> ${snapshots?.length || 0} snapshot rows, ${snapshotDates.length} unique dates`);
  if (snapshotDates.length > 0) {
    console.log(`   -> Range: ${snapshotDates[0]} to ${snapshotDates[snapshotDates.length - 1]}`);
  }

  // Current rates as fallback
  const { data: cbRates } = await supabase.from('central_bank_rates').select('currency, rate, target, bias');
  const currentRatesMap = {};
  for (const r of cbRates || []) currentRatesMap[r.currency] = { rate: r.rate, target: r.target, bias: r.bias };
  console.log(`   -> ${cbRates?.length || 0} current rates loaded`);

  function getRatesForDate(dateStr) {
    let best = '';
    for (const sd of snapshotDates) { if (sd <= dateStr) best = sd; else break; }
    return (best && snapshotsByDate[best]) ? snapshotsByDate[best] : currentRatesMap;
  }

  // Build bias change history: for each currency, track dates when bias changed
  const biasHistory = {}; // { currency: [{ date, newBias, oldBias }] }
  for (const ccy of CURRENCIES) biasHistory[ccy] = [];
  let prevBiases = {};
  for (const sd of snapshotDates) {
    const dateRates = snapshotsByDate[sd];
    for (const ccy of CURRENCIES) {
      const r = dateRates?.[ccy];
      if (!r) continue;
      const currentBias = (r.bias || '').toLowerCase();
      if (prevBiases[ccy] && prevBiases[ccy] !== currentBias) {
        biasHistory[ccy].push({ date: sd, newBias: currentBias, oldBias: prevBiases[ccy] });
      }
      prevBiases[ccy] = currentBias;
    }
  }
  let totalChanges = 0;
  for (const ccy of CURRENCIES) totalChanges += biasHistory[ccy].length;
  console.log(`   -> Detected ${totalChanges} total bias changes across currencies`);

  // ─── 2. Fetch FX prices (360 + buffer days) ───
  console.log('\n[2/5] Fetching FX price data (21 pairs, 380 days)...');
  const priceData = {};
  let pairCount = 0;
  for (const [pair, symbol] of Object.entries(PAIR_SYMBOLS)) {
    try {
      priceData[pair] = await fetchYahooHistory(symbol, 400);
      pairCount++;
      process.stdout.write(`   -> ${pairCount}/21 ${pair}: ${priceData[pair].length} candles\n`);
    } catch (e) {
      console.log(`   x ${pair}: ${e.message}`);
      priceData[pair] = [];
    }
    await sleep(1200);
  }

  // ─── 3. Fetch intermarket data ───
  console.log('\n[3/5] Fetching intermarket data...');
  const intermarketData = {};
  for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
    try {
      intermarketData[key] = await fetchYahooHistory(symbol, 400);
      console.log(`   -> ${key}: ${intermarketData[key].length} candles`);
    } catch (e) {
      console.log(`   x ${key}: ${e.message}`);
      intermarketData[key] = [];
    }
    await sleep(1200);
  }

  // ─── 4. Build trading dates ───
  const allDates = new Set();
  for (const prices of Object.values(priceData)) {
    for (const p of prices) allDates.add(p.date);
  }
  const tradingDates = [...allDates].sort();
  // Use the dates from 360 days worth, leaving buffer for exits
  const testDates = tradingDates.slice(Math.max(0, tradingDates.length - 370), tradingDates.length - 10);
  console.log(`\n[4/5] Testing over ${testDates.length} trading days: ${testDates[0]} -> ${testDates[testDates.length - 1]}`);

  // ─── 5. VIX lookup helper ───
  function getVIX(date) {
    const vixPrices = intermarketData['VIX'] || [];
    const entry = vixPrices.find(p => p.date === date) ||
                  vixPrices.filter(p => p.date <= date).pop();
    return entry?.close ?? 18; // default neutral
  }

  // ─── Helpers for scoring ───
  function biasChangedRecently(ccy, date, withinDays = 30) {
    const changes = biasHistory[ccy] || [];
    const cutoff = new Date(new Date(date).getTime() - withinDays * 86400000).toISOString().split('T')[0];
    return changes.some(c => c.date >= cutoff && c.date <= date);
  }

  // ═══════════════════════════════════════════════════════
  console.log('\n[5/5] Running models...\n');
  // ═══════════════════════════════════════════════════════

  const allResults = [];

  // ────────────────────────────────────────────────
  // MODEL 1: YIELD DIFFERENTIAL
  // Score = rate_A - rate_B directly as pair score
  // ────────────────────────────────────────────────
  for (const hold of [1, 2]) {
    for (const useContrarian of [false, true]) {
      const trades = [];
      for (const date of testDates) {
        const rates = getRatesForDate(date);
        for (const pair of Object.keys(PAIR_SYMBOLS)) {
          const { base, quote } = getPairComponents(pair);
          const rBase = rates[base]?.rate ?? 0;
          const rQuote = rates[quote]?.rate ?? 0;
          const diff = rBase - rQuote;
          if (Math.abs(diff) < 0.25) continue; // minimum differential

          const direction = diff > 0 ? 'long' : 'short';
          if (useContrarian && !passesContrarian(pair, direction, priceData, date, 5)) continue;

          const trade = evaluateTrade(pair, direction, priceData, date, hold);
          if (trade) trades.push(trade);
        }
      }
      const stats = calcStats(trades);
      const label = `YieldDiff${useContrarian ? '+Contrarian' : ''}`;
      allResults.push({ model: label, hold, ...stats });
    }
  }
  console.log('   Model 1: Yield Differential - done');

  // ────────────────────────────────────────────────
  // MODEL 2: BIAS MOMENTUM
  // Score = new_bias_score * 3 if bias changed in last 30 days
  // ────────────────────────────────────────────────
  for (const hold of [1, 2]) {
    for (const useContrarian of [false, true]) {
      const trades = [];
      for (const date of testDates) {
        const rates = getRatesForDate(date);
        const scores = {};
        for (const ccy of CURRENCIES) {
          const r = rates[ccy];
          if (!r) { scores[ccy] = 0; continue; }
          const baseScore = calcCBScore(r.bias);
          const changed = biasChangedRecently(ccy, date, 30);
          scores[ccy] = changed ? baseScore * 3 : baseScore;
        }

        for (const pair of Object.keys(PAIR_SYMBOLS)) {
          const { base, quote } = getPairComponents(pair);
          const diff = (scores[base] || 0) - (scores[quote] || 0);
          if (Math.abs(diff) < 2.0) continue;

          const direction = diff > 0 ? 'long' : 'short';
          if (useContrarian && !passesContrarian(pair, direction, priceData, date, 5)) continue;

          const trade = evaluateTrade(pair, direction, priceData, date, hold);
          if (trade) trades.push(trade);
        }
      }
      const stats = calcStats(trades);
      const label = `BiasMomentum${useContrarian ? '+Contrarian' : ''}`;
      allResults.push({ model: label, hold, ...stats });
    }
  }
  console.log('   Model 2: Bias Momentum - done');

  // ────────────────────────────────────────────────
  // MODEL 3: RATE GAP EXTREMES
  // Only trade when rate gap is extreme (> 1.0 or < -1.0)
  // ────────────────────────────────────────────────
  for (const hold of [1, 2]) {
    for (const useContrarian of [false, true]) {
      const trades = [];
      for (const date of testDates) {
        const rates = getRatesForDate(date);
        const scores = {};
        for (const ccy of CURRENCIES) {
          const r = rates[ccy];
          if (!r) { scores[ccy] = 0; continue; }
          const gap = calcRateGap(r.rate, r.target);
          // Only score currencies with extreme rate gaps
          if (Math.abs(gap) < 1.0) { scores[ccy] = 0; continue; }
          // Positive gap = rate above target = hawkish pressure = bullish for currency
          scores[ccy] = gap > 0 ? 2 : -2;
        }

        for (const pair of Object.keys(PAIR_SYMBOLS)) {
          const { base, quote } = getPairComponents(pair);
          const diff = (scores[base] || 0) - (scores[quote] || 0);
          if (Math.abs(diff) < 2.0) continue;

          const direction = diff > 0 ? 'long' : 'short';
          if (useContrarian && !passesContrarian(pair, direction, priceData, date, 5)) continue;

          const trade = evaluateTrade(pair, direction, priceData, date, hold);
          if (trade) trades.push(trade);
        }
      }
      const stats = calcStats(trades);
      const label = `RateGapExtreme${useContrarian ? '+Contrarian' : ''}`;
      allResults.push({ model: label, hold, ...stats });
    }
  }
  console.log('   Model 3: Rate Gap Extremes - done');

  // ────────────────────────────────────────────────
  // MODEL 4: SAFE HAVEN FILTER
  // VIX > 20: only JPY/CHF long or high-yield short
  // VIX < 15: only high-yield long or safe-haven short
  // Neutral: normal V2 scoring
  // ────────────────────────────────────────────────
  for (const hold of [1, 2]) {
    for (const useContrarian of [false, true]) {
      const trades = [];
      for (const date of testDates) {
        const rates = getRatesForDate(date);
        const vix = getVIX(date);

        // Compute standard V2 scores
        const scores = {};
        for (const ccy of CURRENCIES) {
          const r = rates[ccy];
          if (!r) { scores[ccy] = 0; continue; }
          scores[ccy] = calcCBScore(r.bias) * 2 + calcRateScore(r.rate, r.target);
        }

        for (const pair of Object.keys(PAIR_SYMBOLS)) {
          const { base, quote } = getPairComponents(pair);
          const diff = (scores[base] || 0) - (scores[quote] || 0);
          if (Math.abs(diff) < 2.0) continue;

          const direction = diff > 0 ? 'long' : 'short';

          // Apply VIX filter
          if (vix > 20) {
            // Risk-off: only allow safe-haven longs or high-yield shorts
            const validLong = direction === 'long' && SAFE_HAVENS.includes(base);
            const validShort = direction === 'short' && HIGH_YIELD.includes(base);
            if (!validLong && !validShort) continue;
          } else if (vix < 15) {
            // Risk-on: only allow high-yield longs or safe-haven shorts
            const validLong = direction === 'long' && HIGH_YIELD.includes(base);
            const validShort = direction === 'short' && SAFE_HAVENS.includes(base);
            if (!validLong && !validShort) continue;
          }
          // Neutral VIX (15-20): take all signals

          if (useContrarian && !passesContrarian(pair, direction, priceData, date, 5)) continue;

          const trade = evaluateTrade(pair, direction, priceData, date, hold);
          if (trade) trades.push(trade);
        }
      }
      const stats = calcStats(trades);
      const label = `SafeHaven${useContrarian ? '+Contrarian' : ''}`;
      allResults.push({ model: label, hold, ...stats });
    }
  }
  console.log('   Model 4: Safe Haven Filter - done');

  // ────────────────────────────────────────────────
  // MODEL 5: CONVICTION TIERS
  // Tier 1: score diff >= 4.0 only
  // Tier 2: score diff >= 3.0
  // ────────────────────────────────────────────────
  for (const tier of [{ name: 'Tier1(>=4.0)', minDiff: 4.0 }, { name: 'Tier2(>=3.0)', minDiff: 3.0 }]) {
    for (const hold of [1, 2]) {
      for (const useContrarian of [false, true]) {
        const trades = [];
        for (const date of testDates) {
          const rates = getRatesForDate(date);
          const scores = {};
          for (const ccy of CURRENCIES) {
            const r = rates[ccy];
            if (!r) { scores[ccy] = 0; continue; }
            scores[ccy] = calcCBScore(r.bias) * 2 + calcRateScore(r.rate, r.target);
          }

          for (const pair of Object.keys(PAIR_SYMBOLS)) {
            const { base, quote } = getPairComponents(pair);
            const diff = (scores[base] || 0) - (scores[quote] || 0);
            if (Math.abs(diff) < tier.minDiff) continue;

            const direction = diff > 0 ? 'long' : 'short';
            if (useContrarian && !passesContrarian(pair, direction, priceData, date, 5)) continue;

            const trade = evaluateTrade(pair, direction, priceData, date, hold);
            if (trade) trades.push(trade);
          }
        }
        const stats = calcStats(trades);
        const label = `Conviction_${tier.name}${useContrarian ? '+Contrarian' : ''}`;
        allResults.push({ model: label, hold, ...stats });
      }
    }
  }
  console.log('   Model 5: Conviction Tiers - done');

  // ────────────────────────────────────────────────
  // MODEL 6: COMBINED BEST
  // CB_bias * 2 + rate_gap * 1.5 + bias_change_bonus + safe_haven_filter
  // With contrarian 5d lookback, 1d and 2d hold
  // ────────────────────────────────────────────────
  for (const hold of [1, 2]) {
    const trades = [];
    for (const date of testDates) {
      const rates = getRatesForDate(date);
      const vix = getVIX(date);
      const scores = {};

      for (const ccy of CURRENCIES) {
        const r = rates[ccy];
        if (!r) { scores[ccy] = 0; continue; }
        const cbComponent = calcCBScore(r.bias) * 2;
        const gapComponent = calcRateGap(r.rate, r.target) * 1.5;
        const biasBonus = biasChangedRecently(ccy, date, 30) ? 1.5 : 0;
        scores[ccy] = cbComponent + gapComponent + biasBonus;
      }

      for (const pair of Object.keys(PAIR_SYMBOLS)) {
        const { base, quote } = getPairComponents(pair);
        const diff = (scores[base] || 0) - (scores[quote] || 0);
        if (Math.abs(diff) < 2.5) continue;

        const direction = diff > 0 ? 'long' : 'short';

        // Safe haven filter component
        if (vix > 20) {
          const validLong = direction === 'long' && SAFE_HAVENS.includes(base);
          const validShort = direction === 'short' && HIGH_YIELD.includes(base);
          if (!validLong && !validShort) continue;
        } else if (vix < 15) {
          const validLong = direction === 'long' && HIGH_YIELD.includes(base);
          const validShort = direction === 'short' && SAFE_HAVENS.includes(base);
          if (!validLong && !validShort) continue;
        }

        // Contrarian 5d
        if (!passesContrarian(pair, direction, priceData, date, 5)) continue;

        const trade = evaluateTrade(pair, direction, priceData, date, hold);
        if (trade) trades.push(trade);
      }
    }
    const stats = calcStats(trades);
    allResults.push({ model: 'CombinedBest', hold, ...stats });
  }
  console.log('   Model 6: Combined Best - done');

  // ═══════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════
  console.log('\n================================================================');
  console.log('  ALL RESULTS (sorted by win rate, min 20 trades)');
  console.log('================================================================\n');

  // Filter minimum 20 trades
  const validResults = allResults.filter(r => r.total >= 20);

  // Sort by win rate desc, then profit factor desc
  validResults.sort((a, b) => {
    const wrA = parseFloat(a.winRate) || 0;
    const wrB = parseFloat(b.winRate) || 0;
    if (wrB !== wrA) return wrB - wrA;
    return parseFloat(b.profitFactor) - parseFloat(a.profitFactor);
  });

  console.log(' #  | Model                              | Hold | Trades | Win%  | Pips   | PF');
  console.log('----+------------------------------------+------+--------+-------+--------+------');
  for (let i = 0; i < validResults.length; i++) {
    const r = validResults[i];
    const marker = i === 0 ? ' ** BEST **' : '';
    console.log(
      `${String(i + 1).padStart(3)} | ${r.model.padEnd(34)} | ${String(r.hold).padStart(3)}d | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(5)}% | ${String(r.totalPips).padStart(6)} | ${String(r.profitFactor).padStart(5)}${marker}`
    );
  }

  // Also print configs that didn't meet min trades
  const subMinResults = allResults.filter(r => r.total < 20 && r.total > 0);
  if (subMinResults.length > 0) {
    console.log('\n--- Below minimum 20 trades (excluded from ranking) ---');
    for (const r of subMinResults) {
      console.log(`    ${r.model.padEnd(34)} | ${String(r.hold).padStart(3)}d | ${String(r.total).padStart(6)} trades | ${r.winRate}% win | ${r.totalPips} pips`);
    }
  }

  // Zero-trade configs
  const zeroResults = allResults.filter(r => r.total === 0);
  if (zeroResults.length > 0) {
    console.log(`\n--- ${zeroResults.length} configurations produced 0 trades ---`);
  }

  // ─── TOP 5 JSON ───
  const top5 = validResults.slice(0, 5).map(r => ({
    model: r.model,
    hold: r.hold,
    trades: r.total,
    winRate: parseFloat(r.winRate),
    totalPips: r.totalPips,
    profitFactor: parseFloat(r.profitFactor),
  }));

  console.log('\n=== ADVANCED TOP 5 JSON ===');
  console.log(JSON.stringify(top5, null, 2));

  console.log('\n================================================================');
  console.log('  DONE - Advanced optimizer complete');
  console.log('================================================================');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
