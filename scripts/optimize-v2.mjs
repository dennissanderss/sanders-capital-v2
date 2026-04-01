/**
 * V2 Scoring Model Optimizer
 * Tests ALL parameter combinations to find optimal win rate
 * - Holding periods: 1, 2, 3, 5, 7 days
 * - Score thresholds: 2.0, 2.5, 3.0, 3.5, 4.0, 5.0
 * - Filter combos: regime alignment, intermarket, cross-pair contradiction, event filter
 * - Alternative strategies: JPY-only, USD-only, regime-specific, momentum, mean reversion
 */

import https from 'https';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── CONFIG ───
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAIR_SYMBOLS = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'AUD/USD': 'AUDUSD=X',
  'NZD/USD': 'NZDUSD=X',
  'USD/CAD': 'USDCAD=X',
  'USD/CHF': 'USDCHF=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
};

const INTERMARKET_SYMBOLS = {
  'US10Y': '%5ETNX',
  'SP500': '%5EGSPC',
  'VIX': '%5EVIX',
  'GOLD': 'GC%3DF',
  'OIL': 'CL%3DF',
  'DXY': 'DX-Y.NYB',
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
    const parsedUrl = new URL(url);
    const req = mod.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
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

async function fetchYahooHistory(symbol, days = 60) {
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

// ─── SCORING MODEL ───
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

function calcRateScore(rate, target) {
  if (rate == null || target == null) return 0;
  const diff = rate - target;
  if (diff > 0.5) return 1;
  if (diff > 0) return 0.5;
  if (diff > -0.5) return -0.5;
  return -1;
}

function calcNewsBonus(articles, currency, signalDate) {
  if (!articles || articles.length === 0) return 0;

  const bullishPhrases = ['rate hike', 'rate increase', 'higher than expected', 'beat expectations', 'hawkish surprise', 'tightening cycle'];
  const bearishPhrases = ['rate cut', 'rate decrease', 'lower than expected', 'missed expectations', 'dovish pivot', 'easing cycle'];
  const negations = ['no ', 'not ', 'without ', 'failed to ', 'unlikely ', 'ruled out '];

  let totalSentiment = 0;
  const relevant = articles.filter(a =>
    a.affected_currencies?.includes(currency) &&
    a.published_at &&
    new Date(a.published_at) <= new Date(signalDate + 'T23:59:59Z')
  );

  for (const article of relevant.slice(0, 10)) {
    const text = ((article.title || '') + ' ' + (article.summary || '')).toLowerCase();
    const pubDate = new Date(article.published_at);
    const signalDateTime = new Date(signalDate + 'T16:00:00Z');
    const hoursAgo = (signalDateTime - pubDate) / 3600000;

    if (hoursAgo < 0 || hoursAgo > 72) continue;

    let recency = hoursAgo < 12 ? 1.5 : hoursAgo < 24 ? 1.2 : hoursAgo < 48 ? 1.0 : 0.7;
    let sentiment = 0;

    for (const phrase of bullishPhrases) {
      if (text.includes(phrase)) {
        const hasNegation = negations.some(n => text.includes(n + phrase));
        sentiment += hasNegation ? -1.5 : 1.5;
      }
    }
    for (const phrase of bearishPhrases) {
      if (text.includes(phrase)) {
        const hasNegation = negations.some(n => text.includes(n + phrase));
        sentiment += hasNegation ? 1.5 : -1.5;
      }
    }

    const relScore = Math.min((article.relevance_score || 3) / 5, 1) * 1.5;
    totalSentiment += sentiment * 0.25 * recency * relScore;
  }

  return Math.max(-1.5, Math.min(1.5, totalSentiment));
}

function calcCurrencyScores(cbRates, newsArticles, signalDate) {
  const scores = {};
  for (const cur of CURRENCIES) {
    const rate = cbRates.find(r => r.currency === cur);
    if (!rate) { scores[cur] = 0; continue; }
    const cbScore = calcCBScore(rate.bias) * 2;
    const rateScore = calcRateScore(rate.rate, rate.target);
    const newsBonus = calcNewsBonus(newsArticles, cur, signalDate);
    scores[cur] = cbScore + rateScore + newsBonus;
  }
  return scores;
}

function determineRegime(scores) {
  const jpyScore = scores['JPY'] || 0;
  const highYieldAvg = (HIGH_YIELD.reduce((s, c) => s + (scores[c] || 0), 0)) / HIGH_YIELD.length;

  if (jpyScore > 1 && highYieldAvg < 0) return 'Risk-Off';
  if (highYieldAvg > 1 && jpyScore < 0) return 'Risk-On';
  if ((scores['USD'] || 0) > 2) return 'USD Dominant';
  if ((scores['USD'] || 0) < -2) return 'USD Zwak';
  return 'Gemengd';
}

function getPairComponents(pair) {
  const [base, quote] = pair.split('/');
  return { base, quote };
}

function calcPairSignals(scores) {
  const signals = [];
  for (const pair of Object.keys(PAIR_SYMBOLS)) {
    const { base, quote } = getPairComponents(pair);
    const diff = (scores[base] || 0) - (scores[quote] || 0);
    let direction, conviction;

    if (diff >= 3.5) { direction = 'bullish'; conviction = 'sterk'; }
    else if (diff >= 2) { direction = 'bullish'; conviction = 'matig'; }
    else if (diff > 0.5) { direction = 'licht bullish'; conviction = 'laag'; }
    else if (diff >= -0.5) { direction = 'neutraal'; conviction = 'geen'; }
    else if (diff >= -2) { direction = 'licht bearish'; conviction = 'laag'; }
    else if (diff >= -3.5) { direction = 'bearish'; conviction = 'matig'; }
    else { direction = 'bearish'; conviction = 'sterk'; }

    signals.push({ pair, base, quote, diff: Math.abs(diff), rawDiff: diff, direction, conviction, score: Math.abs(diff) });
  }
  return signals;
}

function isAlignedWithRegime(signal, regime) {
  const isBullish = signal.direction.includes('bullish');
  if (regime === 'Risk-Off') {
    if (isBullish && SAFE_HAVENS.includes(signal.base)) return true;
    if (!isBullish && SAFE_HAVENS.includes(signal.quote)) return true;
    if (!isBullish && HIGH_YIELD.includes(signal.base)) return true;
    if (isBullish && HIGH_YIELD.includes(signal.quote)) return true;
  } else if (regime === 'Risk-On') {
    if (isBullish && HIGH_YIELD.includes(signal.base)) return true;
    if (!isBullish && HIGH_YIELD.includes(signal.quote)) return true;
    if (!isBullish && SAFE_HAVENS.includes(signal.base)) return true;
    if (isBullish && SAFE_HAVENS.includes(signal.quote)) return true;
  } else if (regime === 'USD Dominant') {
    if (isBullish && signal.base === 'USD') return true;
    if (!isBullish && signal.quote === 'USD') return true;
  } else if (regime === 'USD Zwak') {
    if (!isBullish && signal.base === 'USD') return true;
    if (isBullish && signal.quote === 'USD') return true;
  }
  return regime === 'Gemengd';
}

function getIntermarketAlignment(intermarketData, signalDate, regime) {
  const dayData = {};
  for (const [key, prices] of Object.entries(intermarketData)) {
    const entry = prices.find(p => p.date === signalDate) || prices.find(p => p.date < signalDate);
    const prevIdx = prices.findIndex(p => p.date === signalDate) - 1;
    if (entry && prevIdx >= 0) {
      const prev = prices[prevIdx];
      dayData[key] = { close: entry.close, change: (entry.close - prev.close) / prev.close * 100 };
    }
  }

  let aligned = 0, total = 0;

  if (regime === 'Risk-Off') {
    if (dayData.VIX?.change > 0) aligned++; total++;
    if (dayData.GOLD?.change > 0) aligned++; total++;
    if (dayData.SP500?.change < 0) aligned++; total++;
    if (dayData.US10Y?.change < 0) aligned++; total++;
  } else if (regime === 'Risk-On') {
    if (dayData.VIX?.change < 0) aligned++; total++;
    if (dayData.SP500?.change > 0) aligned++; total++;
    if (dayData.US10Y?.change > 0) aligned++; total++;
    if (dayData.OIL?.change > 0) aligned++; total++;
  } else if (regime === 'USD Dominant' || regime === 'USD Zwak') {
    if (dayData.DXY) {
      const usdUp = regime === 'USD Dominant';
      if ((dayData.DXY.change > 0) === usdUp) aligned++; total++;
    }
    if (dayData.GOLD) {
      const goldDown = regime === 'USD Dominant';
      if ((dayData.GOLD.change < 0) === goldDown) aligned++; total++;
    }
  }

  return total > 0 ? (aligned / total) * 100 : 50;
}

// ─── V2.1 FILTERS ───
function applyFilters(signals, regime, intermarketAlignment, options = {}) {
  const {
    useRegimeFilter = true,
    useIntermarketFilter = true,
    useCrossPairFilter = true,
    useEventFilter = true,
  } = options;

  let filtered = signals.map(s => ({ ...s }));

  // Filter 1: Regime alignment
  if (useRegimeFilter) {
    filtered = filtered.map(s => {
      if (s.conviction === 'sterk' && !isAlignedWithRegime(s, regime) && regime !== 'Gemengd') {
        return { ...s, conviction: 'matig' };
      }
      return s;
    });
  }

  // Filter 2: Intermarket confirmation/contradiction
  if (useIntermarketFilter) {
    filtered = filtered.map(s => {
      if (intermarketAlignment >= 65 && s.conviction === 'matig' && isAlignedWithRegime(s, regime)) {
        return { ...s, conviction: 'sterk' };
      }
      if (intermarketAlignment <= 35 && s.conviction === 'sterk') {
        return { ...s, conviction: 'matig' };
      }
      return s;
    });
  }

  // Filter 3: Cross-pair contradiction
  if (useCrossPairFilter) {
    const sterkSignals = filtered.filter(s => s.conviction === 'sterk');
    for (const s of sterkSignals) {
      const usdImplication = s.base === 'USD' ? (s.direction.includes('bullish') ? 'strong' : 'weak')
        : s.quote === 'USD' ? (s.direction.includes('bullish') ? 'weak' : 'strong') : null;
      if (!usdImplication) continue;

      for (const other of sterkSignals) {
        if (other.pair === s.pair) continue;
        const otherUsd = other.base === 'USD' ? (other.direction.includes('bullish') ? 'strong' : 'weak')
          : other.quote === 'USD' ? (other.direction.includes('bullish') ? 'weak' : 'strong') : null;
        if (otherUsd && otherUsd !== usdImplication) {
          s.conviction = 'matig';
          other.conviction = 'matig';
        }
      }
    }
  }

  return filtered;
}

// ─── TRADE EVALUATION ───
function evaluateTrade(signal, priceData, entryDate, holdingDays) {
  const prices = priceData[signal.pair];
  if (!prices || prices.length === 0) return null;

  const entryIdx = prices.findIndex(p => p.date === entryDate);
  if (entryIdx < 0) return null;

  const exitIdx = entryIdx + holdingDays;
  if (exitIdx >= prices.length) return null;

  const entryPrice = prices[entryIdx].close;
  const exitPrice = prices[exitIdx].close;
  const priceDiff = exitPrice - entryPrice;

  const isJpyPair = signal.pair.includes('JPY');
  const pips = Math.round(Math.abs(priceDiff) * (isJpyPair ? 100 : 10000));

  let correct = false;
  if (signal.direction.includes('bullish') && priceDiff > 0) correct = true;
  if (signal.direction.includes('bearish') && priceDiff < 0) correct = true;

  return {
    pair: signal.pair,
    direction: signal.direction,
    conviction: signal.conviction,
    score: signal.score,
    entryDate,
    exitDate: prices[exitIdx].date,
    entryPrice,
    exitPrice,
    pips: correct ? pips : -pips,
    result: correct ? 'correct' : 'incorrect',
  };
}

// ─── MAIN OPTIMIZER ───
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SANDERS CAPITAL V2 - SCORING MODEL OPTIMIZER');
  console.log('  Testing ALL parameter combinations over 60 days');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Fetch CB rates
  console.log('📊 Fetching central bank rates...');
  const { data: cbRates, error: cbErr } = await supabase.from('central_bank_rates').select('*');
  if (cbErr) { console.error('CB rates error:', cbErr); return; }
  console.log(`   → ${cbRates.length} currencies loaded`);

  // 2. Fetch news articles (last 60 days)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
  console.log('📰 Fetching news articles...');
  const { data: newsArticles, error: newsErr } = await supabase
    .from('news_articles')
    .select('*')
    .gte('published_at', sixtyDaysAgo)
    .order('published_at', { ascending: false })
    .limit(500);
  if (newsErr) { console.error('News error:', newsErr); return; }
  console.log(`   → ${newsArticles.length} articles loaded`);

  // 3. Fetch all FX price data
  console.log('💹 Fetching FX price data (60 days)...');
  const priceData = {};
  for (const [pair, symbol] of Object.entries(PAIR_SYMBOLS)) {
    try {
      priceData[pair] = await fetchYahooHistory(symbol, 70);
      console.log(`   → ${pair}: ${priceData[pair].length} candles`);
    } catch (e) {
      console.log(`   ✗ ${pair}: ${e.message}`);
      priceData[pair] = [];
    }
    await sleep(1500); // Rate limit - Yahoo needs longer delays
  }

  // 4. Fetch intermarket data
  console.log('🌍 Fetching intermarket data...');
  const intermarketData = {};
  for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
    try {
      intermarketData[key] = await fetchYahooHistory(symbol, 70);
      console.log(`   → ${key}: ${intermarketData[key].length} candles`);
    } catch (e) {
      console.log(`   ✗ ${key}: ${e.message}`);
      intermarketData[key] = [];
    }
    await sleep(1500);
  }

  // 5. Get all trading dates from price data
  const allDates = new Set();
  for (const prices of Object.values(priceData)) {
    for (const p of prices) allDates.add(p.date);
  }
  const tradingDates = [...allDates].sort();
  // Use last 45 dates (leave buffer for exit)
  const testDates = tradingDates.slice(Math.max(0, tradingDates.length - 55), tradingDates.length - 10);
  console.log(`\n📅 Testing over ${testDates.length} trading days: ${testDates[0]} → ${testDates[testDates.length - 1]}\n`);

  // 6. Pre-compute signals for each date
  console.log('🧮 Computing signals for all dates...');
  const dailySignals = {};
  const dailyRegimes = {};
  const dailyIntermarket = {};

  for (const date of testDates) {
    const scores = calcCurrencyScores(cbRates, newsArticles, date);
    const regime = determineRegime(scores);
    const signals = calcPairSignals(scores);
    const imAlignment = getIntermarketAlignment(intermarketData, date, regime);

    dailySignals[date] = signals;
    dailyRegimes[date] = regime;
    dailyIntermarket[date] = imAlignment;
  }
  console.log('   → Done\n');

  // ═══════════════════════════════════════════════════════
  // TEST MATRIX
  // ═══════════════════════════════════════════════════════

  const holdingPeriods = [1, 2, 3, 5, 7];
  const thresholds = [2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
  const filterCombos = [
    { name: 'No Filters', useRegimeFilter: false, useIntermarketFilter: false, useCrossPairFilter: false, useEventFilter: false },
    { name: 'Regime Only', useRegimeFilter: true, useIntermarketFilter: false, useCrossPairFilter: false, useEventFilter: false },
    { name: 'Intermarket Only', useRegimeFilter: false, useIntermarketFilter: true, useCrossPairFilter: false, useEventFilter: false },
    { name: 'CrossPair Only', useRegimeFilter: false, useIntermarketFilter: false, useCrossPairFilter: true, useEventFilter: false },
    { name: 'Regime+Intermarket', useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: false, useEventFilter: false },
    { name: 'Regime+CrossPair', useRegimeFilter: true, useIntermarketFilter: false, useCrossPairFilter: true, useEventFilter: false },
    { name: 'All Filters', useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true },
  ];

  const results = [];

  // ─── TEST 1: Holding Periods × Thresholds (with all filters) ───
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TEST 1: HOLDING PERIODS × THRESHOLDS (All Filters)');
  console.log('═══════════════════════════════════════════════════════\n');

  for (const hold of holdingPeriods) {
    for (const threshold of thresholds) {
      let correct = 0, incorrect = 0, totalPips = 0;

      for (const date of testDates) {
        const signals = dailySignals[date];
        const regime = dailyRegimes[date];
        const imAlign = dailyIntermarket[date];

        const filtered = applyFilters(signals, regime, imAlign, {
          useRegimeFilter: true,
          useIntermarketFilter: true,
          useCrossPairFilter: true,
          useEventFilter: true,
        });

        // Only take signals above threshold
        const tradeable = filtered.filter(s =>
          s.score >= threshold &&
          s.conviction !== 'geen' &&
          s.conviction !== 'laag'
        );

        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          if (trade.result === 'correct') correct++;
          else incorrect++;
          totalPips += trade.pips;
        }
      }

      const total = correct + incorrect;
      const winRate = total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A';
      results.push({ test: 'Hold×Thresh', hold, threshold, filters: 'All', correct, incorrect, total, winRate, totalPips });
    }
  }

  // Print Test 1 table
  console.log('Hold | Thresh | Trades | Win% | Pips');
  console.log('─────┼────────┼────────┼──────┼──────');
  for (const r of results.filter(r => r.test === 'Hold×Thresh')) {
    console.log(`${String(r.hold).padStart(4)}d | ${String(r.threshold).padStart(5)}  | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(4)}% | ${String(r.totalPips).padStart(5)}`);
  }

  // ─── TEST 2: Filter Combinations (threshold 3.5, various hold periods) ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TEST 2: FILTER COMBINATIONS');
  console.log('═══════════════════════════════════════════════════════\n');

  const filterResults = [];
  for (const hold of [1, 2, 3, 5]) {
    for (const combo of filterCombos) {
      let correct = 0, incorrect = 0, totalPips = 0;

      for (const date of testDates) {
        const signals = dailySignals[date];
        const regime = dailyRegimes[date];
        const imAlign = dailyIntermarket[date];

        const filtered = applyFilters(signals, regime, imAlign, combo);
        const tradeable = filtered.filter(s => s.score >= 3.5 && s.conviction !== 'geen' && s.conviction !== 'laag');

        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          if (trade.result === 'correct') correct++;
          else incorrect++;
          totalPips += trade.pips;
        }
      }

      const total = correct + incorrect;
      const winRate = total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A';
      filterResults.push({ hold, name: combo.name, correct, incorrect, total, winRate, totalPips });
    }
  }

  console.log('Hold | Filter Combo        | Trades | Win% | Pips');
  console.log('─────┼─────────────────────┼────────┼──────┼──────');
  for (const r of filterResults) {
    console.log(`${String(r.hold).padStart(4)}d | ${r.name.padEnd(19)} | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(4)}% | ${String(r.totalPips).padStart(5)}`);
  }

  // ─── TEST 3: Alternative Strategies ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TEST 3: ALTERNATIVE STRATEGIES');
  console.log('═══════════════════════════════════════════════════════\n');

  const stratResults = [];

  for (const hold of [1, 2, 3, 5]) {
    // Strategy A: JPY pairs only
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const tradeable = filtered.filter(s => s.score >= 3.0 && s.pair.includes('JPY') && s.conviction !== 'geen' && s.conviction !== 'laag');
        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'JPY Pairs Only (≥3.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy B: USD pairs only
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const tradeable = filtered.filter(s => s.score >= 3.0 && (s.base === 'USD' || s.quote === 'USD') && s.conviction !== 'geen' && s.conviction !== 'laag');
        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'USD Pairs Only (≥3.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy C: Only regime-aligned trades
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const signals = dailySignals[date];
        const regime = dailyRegimes[date];
        const tradeable = signals.filter(s => s.score >= 2.5 && isAlignedWithRegime(s, regime) && s.conviction !== 'geen' && s.conviction !== 'laag');
        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Regime-Aligned (≥2.5)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy D: Include matig signals (lower threshold)
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const tradeable = filtered.filter(s => s.score >= 2.0 && s.conviction !== 'geen');
        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Include Matig (≥2.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy E: Extreme divergence only (≥5.0)
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const tradeable = dailySignals[date].filter(s => s.score >= 5.0);
        for (const signal of tradeable) {
          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Extreme Only (≥5.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy F: Top 1 pair per day only (highest score)
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const sorted = filtered.filter(s => s.score >= 2.0 && s.conviction !== 'geen' && s.conviction !== 'laag').sort((a, b) => b.score - a.score);
        if (sorted.length > 0) {
          const trade = evaluateTrade(sorted[0], priceData, date, hold);
          if (trade) {
            trade.result === 'correct' ? correct++ : incorrect++;
            totalPips += trade.pips;
          }
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Top 1 Per Day', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy G: Top 1 regime-aligned per day
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const regime = dailyRegimes[date];
        const filtered = applyFilters(dailySignals[date], regime, dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const sorted = filtered.filter(s => s.score >= 2.0 && isAlignedWithRegime(s, regime) && s.conviction !== 'geen' && s.conviction !== 'laag').sort((a, b) => b.score - a.score);
        if (sorted.length > 0) {
          const trade = evaluateTrade(sorted[0], priceData, date, hold);
          if (trade) {
            trade.result === 'correct' ? correct++ : incorrect++;
            totalPips += trade.pips;
          }
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Top 1 Regime-Aligned', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy H: Momentum confirmation (only if 2-day price momentum aligns)
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const tradeable = filtered.filter(s => s.score >= 3.0 && s.conviction !== 'geen' && s.conviction !== 'laag');
        for (const signal of tradeable) {
          // Check 2-day momentum
          const prices = priceData[signal.pair];
          const idx = prices?.findIndex(p => p.date === date);
          if (!idx || idx < 2) continue;
          const momentum = prices[idx].close - prices[idx - 2].close;
          const momentumAligned = (signal.direction.includes('bullish') && momentum > 0) ||
                                  (signal.direction.includes('bearish') && momentum < 0);
          if (!momentumAligned) continue;

          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Momentum Confirm (≥3.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }

    // Strategy I: Mean reversion (counter-momentum)
    {
      let correct = 0, incorrect = 0, totalPips = 0;
      for (const date of testDates) {
        const filtered = applyFilters(dailySignals[date], dailyRegimes[date], dailyIntermarket[date], { useRegimeFilter: true, useIntermarketFilter: true, useCrossPairFilter: true, useEventFilter: true });
        const tradeable = filtered.filter(s => s.score >= 3.0 && s.conviction !== 'geen' && s.conviction !== 'laag');
        for (const signal of tradeable) {
          const prices = priceData[signal.pair];
          const idx = prices?.findIndex(p => p.date === date);
          if (!idx || idx < 2) continue;
          const momentum = prices[idx].close - prices[idx - 2].close;
          // Only take trade if fundamentals DISAGREE with recent price action (mean reversion)
          const counterMomentum = (signal.direction.includes('bullish') && momentum < 0) ||
                                  (signal.direction.includes('bearish') && momentum > 0);
          if (!counterMomentum) continue;

          const trade = evaluateTrade(signal, priceData, date, hold);
          if (!trade) continue;
          trade.result === 'correct' ? correct++ : incorrect++;
          totalPips += trade.pips;
        }
      }
      const total = correct + incorrect;
      stratResults.push({ hold, name: 'Mean Reversion (≥3.0)', correct, incorrect, total, winRate: total > 0 ? ((correct / total) * 100).toFixed(1) : 'N/A', totalPips });
    }
  }

  console.log('Hold | Strategy                 | Trades | Win% | Pips');
  console.log('─────┼──────────────────────────┼────────┼──────┼──────');
  for (const r of stratResults) {
    console.log(`${String(r.hold).padStart(4)}d | ${r.name.padEnd(24)} | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(4)}% | ${String(r.totalPips).padStart(5)}`);
  }

  // ─── BEST RESULTS SUMMARY ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  TOP 10 BEST CONFIGURATIONS');
  console.log('═══════════════════════════════════════════════════════\n');

  const allResults = [
    ...results.map(r => ({ ...r, name: `Hold${r.hold}d/Thresh${r.threshold}/AllFilters` })),
    ...filterResults.map(r => ({ ...r, name: `Hold${r.hold}d/Thresh3.5/${r.name}` })),
    ...stratResults,
  ].filter(r => r.total >= 10); // Minimum 10 trades for statistical relevance

  allResults.sort((a, b) => {
    const wrA = parseFloat(a.winRate) || 0;
    const wrB = parseFloat(b.winRate) || 0;
    if (wrB !== wrA) return wrB - wrA;
    return b.totalPips - a.totalPips;
  });

  console.log('#  | Configuration                          | Trades | Win%  | Pips');
  console.log('───┼──────────────────────────────────────────┼────────┼───────┼──────');
  for (let i = 0; i < Math.min(20, allResults.length); i++) {
    const r = allResults[i];
    console.log(`${String(i + 1).padStart(2)} | ${(r.name || '?').padEnd(40)} | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(5)}% | ${String(r.totalPips).padStart(5)}`);
  }

  // Also show worst
  console.log('\n── WORST 5 ──');
  const worst = [...allResults].reverse();
  for (let i = 0; i < Math.min(5, worst.length); i++) {
    const r = worst[i];
    console.log(`${String(allResults.length - i).padStart(2)} | ${(r.name || '?').padEnd(40)} | ${String(r.total).padStart(6)} | ${String(r.winRate).padStart(5)}% | ${String(r.totalPips).padStart(5)}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DONE - Optimizer complete');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
