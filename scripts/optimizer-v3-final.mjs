/**
 * V3 FINAL - Comprehensive FX Backtest Optimizer
 * Tests ALL parameter combinations over 360 days with max 1-2 day holding periods.
 * Goal: Find the configuration with the highest winrate.
 *
 * Configurations tested:
 * - Holding periods: [1, 2]
 * - Score thresholds: [2.0, 2.5, 3.0, 3.5, 4.0]
 * - Lookback periods: [2, 3, 5]
 * - Strategies: Contrarian, Momentum, No Filter, Contrarian+Regime, Contrarian+IM, Top1, Top3
 * - Scoring models: A (V2 baseline), B (enhanced), C (CB only)
 * - Pair sets: Original 10, All 21
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

const ALL_PAIRS = {
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
  'AUD/JPY': 'AUDJPY=X',
  'NZD/JPY': 'NZDJPY=X',
  'CAD/JPY': 'CADJPY=X',
  'EUR/AUD': 'EURAUD=X',
  'GBP/AUD': 'GBPAUD=X',
  'AUD/NZD': 'AUDNZD=X',
  'EUR/CHF': 'EURCHF=X',
  'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X',
  'GBP/NZD': 'GBPNZD=X',
  'AUD/CAD': 'AUDCAD=X',
};

const ORIGINAL_10 = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD',
  'USD/CAD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
];

const INTERMARKET_SYMBOLS = {
  'DXY': 'DX-Y.NYB',
  'US10Y': '%5ETNX',
  'SP500': '%5EGSPC',
  'VIX': '%5EVIX',
  'GOLD': 'GC%3DF',
  'OIL': 'CL%3DF',
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

async function fetchYahooHistory(symbol, days = 400) {
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

// ─── SCORING MODELS ───
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

// Model A: V2 baseline  => CB_bias * 2 + rate_gap
// Model B: enhanced     => CB_bias * 2 + rate_gap * 1.5 + news_bonus
// Model C: CB only      => CB_bias * 3
function calcCurrencyScores(cbRatesForDate, newsArticles, signalDate, model) {
  const scores = {};
  for (const cur of CURRENCIES) {
    const rate = cbRatesForDate.find(r => r.currency === cur);
    if (!rate) { scores[cur] = 0; continue; }
    const cbScore = calcCBScore(rate.bias);
    const rateScore = calcRateScore(rate.rate, rate.target);

    if (model === 'A') {
      scores[cur] = cbScore * 2 + rateScore;
    } else if (model === 'B') {
      const newsBonus = calcNewsBonus(newsArticles, cur, signalDate);
      scores[cur] = cbScore * 2 + rateScore * 1.5 + newsBonus;
    } else if (model === 'C') {
      scores[cur] = cbScore * 3;
    }
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

function calcPairSignals(scores, pairList) {
  const signals = [];
  for (const pair of pairList) {
    const { base, quote } = getPairComponents(pair);
    const diff = (scores[base] || 0) - (scores[quote] || 0);
    let direction;
    if (diff > 0) direction = 'bullish';
    else if (diff < 0) direction = 'bearish';
    else direction = 'neutraal';

    signals.push({ pair, base, quote, rawDiff: diff, score: Math.abs(diff), direction });
  }
  return signals;
}

function isAlignedWithRegime(signal, regime) {
  const isBullish = signal.direction === 'bullish';
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
    const idx = prices.findIndex(p => p.date === signalDate);
    if (idx > 0) {
      const entry = prices[idx];
      const prev = prices[idx - 1];
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
  if (signal.direction === 'bullish' && priceDiff > 0) correct = true;
  if (signal.direction === 'bearish' && priceDiff < 0) correct = true;

  return {
    pair: signal.pair,
    direction: signal.direction,
    score: signal.score,
    entryDate,
    exitDate: prices[exitIdx].date,
    entryPrice,
    exitPrice,
    pips: correct ? pips : -pips,
    result: correct ? 'correct' : 'incorrect',
  };
}

// ─── MOMENTUM HELPER ───
function getMomentum(priceData, pair, date, lookback) {
  const prices = priceData[pair];
  if (!prices) return null;
  const idx = prices.findIndex(p => p.date === date);
  if (idx < lookback) return null;
  return prices[idx].close - prices[idx - lookback].close;
}

// ─── CB RATE LOOKUP ───
// Build a map: for each date, find the nearest earlier snapshot per currency
function buildCBRateTimeline(snapshots, tradingDates) {
  // snapshots sorted by date ascending
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  // Get unique snapshot dates
  const snapshotDates = [...new Set(sorted.map(s => s.snapshot_date))].sort();

  // For each trading date, find the nearest earlier snapshot date
  const timeline = {};
  for (const tDate of tradingDates) {
    let bestSnapshotDate = null;
    for (const sd of snapshotDates) {
      if (sd <= tDate) bestSnapshotDate = sd;
      else break;
    }
    if (bestSnapshotDate) {
      timeline[tDate] = sorted.filter(s => s.snapshot_date === bestSnapshotDate);
    }
  }
  return timeline;
}

// ─── MAIN ───
async function main() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('  SANDERS CAPITAL V3 FINAL - COMPREHENSIVE FX BACKTEST OPTIMIZER');
  console.log('  360 days | 1-2 day holds | All configurations');
  console.log('================================================================\n');

  // 1. Fetch CB rate snapshots from Supabase
  console.log('[1/5] Fetching CB rate snapshots from Supabase...');
  const { data: cbSnapshots, error: cbErr } = await supabase
    .from('cb_rate_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: true });
  if (cbErr) { console.error('CB snapshots error:', cbErr); return; }
  console.log(`  -> ${cbSnapshots.length} snapshots loaded`);
  const snapshotDates = [...new Set(cbSnapshots.map(s => s.snapshot_date))].sort();
  console.log(`  -> Snapshot dates: ${snapshotDates[0]} to ${snapshotDates[snapshotDates.length - 1]}`);

  // Also fetch current CB rates as fallback
  const { data: currentCBRates, error: cbCurrErr } = await supabase
    .from('central_bank_rates')
    .select('*');
  if (cbCurrErr) { console.error('CB rates error:', cbCurrErr); return; }
  console.log(`  -> ${currentCBRates.length} current rates as fallback`);

  // 2. Fetch news articles (all available)
  console.log('\n[2/5] Fetching news articles...');
  const yearAgo = new Date(Date.now() - 400 * 86400000).toISOString();
  let allNews = [];
  let newsOffset = 0;
  const newsPageSize = 1000;
  while (true) {
    const { data: newsBatch, error: newsErr } = await supabase
      .from('news_articles')
      .select('*')
      .gte('published_at', yearAgo)
      .order('published_at', { ascending: false })
      .range(newsOffset, newsOffset + newsPageSize - 1);
    if (newsErr) { console.error('News error:', newsErr); break; }
    if (!newsBatch || newsBatch.length === 0) break;
    allNews = allNews.concat(newsBatch);
    console.log(`  -> Fetched ${allNews.length} articles so far...`);
    if (newsBatch.length < newsPageSize) break;
    newsOffset += newsPageSize;
  }
  console.log(`  -> ${allNews.length} total articles loaded`);

  // 3. Fetch all FX price data (360 days + buffer)
  console.log('\n[3/5] Fetching FX price data (21 pairs, 360+ days)...');
  const priceData = {};
  let pairCount = 0;
  for (const [pair, symbol] of Object.entries(ALL_PAIRS)) {
    pairCount++;
    let retries = 3;
    while (retries > 0) {
      try {
        priceData[pair] = await fetchYahooHistory(symbol, 400);
        console.log(`  -> [${pairCount}/21] ${pair}: ${priceData[pair].length} candles`);
        break;
      } catch (e) {
        retries--;
        if (retries > 0) {
          console.log(`  -> [${pairCount}/21] ${pair}: retry (${e.message})`);
          await sleep(3000);
        } else {
          console.log(`  -> [${pairCount}/21] ${pair}: FAILED (${e.message})`);
          priceData[pair] = [];
        }
      }
    }
    await sleep(2000);
  }

  // 4. Fetch intermarket data
  console.log('\n[4/5] Fetching intermarket data (6 instruments)...');
  const intermarketData = {};
  for (const [key, symbol] of Object.entries(INTERMARKET_SYMBOLS)) {
    let retries = 3;
    while (retries > 0) {
      try {
        intermarketData[key] = await fetchYahooHistory(symbol, 400);
        console.log(`  -> ${key}: ${intermarketData[key].length} candles`);
        break;
      } catch (e) {
        retries--;
        if (retries > 0) {
          console.log(`  -> ${key}: retry (${e.message})`);
          await sleep(3000);
        } else {
          console.log(`  -> ${key}: FAILED (${e.message})`);
          intermarketData[key] = [];
        }
      }
    }
    await sleep(2000);
  }

  // 5. Determine trading dates
  console.log('\n[5/5] Computing trading date universe...');
  const allDates = new Set();
  for (const prices of Object.values(priceData)) {
    for (const p of prices) allDates.add(p.date);
  }
  const tradingDates = [...allDates].sort();
  // Leave buffer at end for exit trades
  const testDates = tradingDates.slice(10, tradingDates.length - 5);
  console.log(`  -> ${tradingDates.length} total trading days`);
  console.log(`  -> Testing over ${testDates.length} days: ${testDates[0]} to ${testDates[testDates.length - 1]}`);

  // Build CB rate timeline
  const cbTimeline = buildCBRateTimeline(cbSnapshots, testDates);
  // For dates before earliest snapshot, use current rates as fallback
  const datesWithCB = Object.keys(cbTimeline).length;
  console.log(`  -> CB rate coverage: ${datesWithCB}/${testDates.length} dates`);

  // ═══════════════════════════════════════════════════════
  // CONFIGURATION MATRIX
  // ═══════════════════════════════════════════════════════

  const holdingPeriods = [1, 2];
  const thresholds = [2.0, 2.5, 3.0, 3.5, 4.0];
  const lookbacks = [2, 3, 5];
  const scoringModels = ['A', 'B', 'C'];
  const strategies = [
    'contrarian',
    'momentum',
    'no_filter',
    'contrarian_regime',
    'contrarian_im',
    'top1',
    'top3',
  ];
  const pairSets = ['10_majors', 'all_21'];

  const totalCombos = holdingPeriods.length * thresholds.length * lookbacks.length *
    strategies.length * scoringModels.length * pairSets.length;

  console.log(`\n================================================================`);
  console.log(`  RUNNING ${totalCombos} CONFIGURATIONS...`);
  console.log(`  ${holdingPeriods.length} holds x ${thresholds.length} thresholds x ${lookbacks.length} lookbacks`);
  console.log(`  x ${strategies.length} strategies x ${scoringModels.length} models x ${pairSets.length} pair sets`);
  console.log(`================================================================\n`);

  // Pre-compute signals per (date, model, pairSet) to avoid redundant computation
  // We also cache regime and IM alignment per (date, model)
  console.log('Pre-computing daily signals for all models...');

  // Cache: signalCache[model][date] = { scores, regime, imAlignment }
  const signalCache = {};
  for (const model of scoringModels) {
    signalCache[model] = {};
    for (const date of testDates) {
      const cbRatesForDate = cbTimeline[date] || currentCBRates;
      const scores = calcCurrencyScores(cbRatesForDate, allNews, date, model);
      const regime = determineRegime(scores);
      const imAlignment = getIntermarketAlignment(intermarketData, date, regime);
      signalCache[model][date] = { scores, regime, imAlignment };
    }
  }
  console.log('  -> Done pre-computing signals\n');

  // Run all configurations
  const allResults = [];
  let configNum = 0;
  const progressInterval = Math.max(1, Math.floor(totalCombos / 20));

  for (const hold of holdingPeriods) {
    for (const threshold of thresholds) {
      for (const lookback of lookbacks) {
        for (const strategy of strategies) {
          for (const model of scoringModels) {
            for (const pairSetName of pairSets) {
              configNum++;
              if (configNum % progressInterval === 0 || configNum === totalCombos) {
                const pct = ((configNum / totalCombos) * 100).toFixed(0);
                process.stdout.write(`  Progress: ${configNum}/${totalCombos} (${pct}%)\r`);
              }

              const pairList = pairSetName === '10_majors' ? ORIGINAL_10 : Object.keys(ALL_PAIRS);
              let correct = 0, incorrect = 0, totalPips = 0;
              let wins = [], losses = [];
              let consecutiveLosses = 0, maxConsecLosses = 0;
              const monthlyBreakdown = {};

              for (const date of testDates) {
                const cached = signalCache[model][date];
                const { scores, regime, imAlignment } = cached;
                const signals = calcPairSignals(scores, pairList);

                // Filter by threshold
                let tradeable = signals.filter(s => s.score >= threshold && s.direction !== 'neutraal');

                // Apply strategy filter
                if (strategy === 'contrarian') {
                  tradeable = tradeable.filter(s => {
                    const mom = getMomentum(priceData, s.pair, date, lookback);
                    if (mom === null) return false;
                    // Contrarian: trade AGAINST momentum when fundamentals are strong
                    return (s.direction === 'bullish' && mom < 0) ||
                           (s.direction === 'bearish' && mom > 0);
                  });
                } else if (strategy === 'momentum') {
                  tradeable = tradeable.filter(s => {
                    const mom = getMomentum(priceData, s.pair, date, lookback);
                    if (mom === null) return false;
                    // Momentum: trade WITH momentum when fundamentals confirm
                    return (s.direction === 'bullish' && mom > 0) ||
                           (s.direction === 'bearish' && mom < 0);
                  });
                } else if (strategy === 'no_filter') {
                  // No momentum filter, just score threshold
                } else if (strategy === 'contrarian_regime') {
                  tradeable = tradeable.filter(s => {
                    const mom = getMomentum(priceData, s.pair, date, lookback);
                    if (mom === null) return false;
                    const isContrarian = (s.direction === 'bullish' && mom < 0) ||
                                         (s.direction === 'bearish' && mom > 0);
                    return isContrarian && isAlignedWithRegime(s, regime);
                  });
                } else if (strategy === 'contrarian_im') {
                  tradeable = tradeable.filter(s => {
                    const mom = getMomentum(priceData, s.pair, date, lookback);
                    if (mom === null) return false;
                    const isContrarian = (s.direction === 'bullish' && mom < 0) ||
                                         (s.direction === 'bearish' && mom > 0);
                    return isContrarian && imAlignment > 50;
                  });
                } else if (strategy === 'top1') {
                  tradeable = tradeable.sort((a, b) => b.score - a.score).slice(0, 1);
                } else if (strategy === 'top3') {
                  tradeable = tradeable.sort((a, b) => b.score - a.score).slice(0, 3);
                }

                for (const signal of tradeable) {
                  const trade = evaluateTrade(signal, priceData, date, hold);
                  if (!trade) continue;

                  const month = date.substring(0, 7);
                  if (!monthlyBreakdown[month]) monthlyBreakdown[month] = { correct: 0, incorrect: 0, pips: 0 };

                  if (trade.result === 'correct') {
                    correct++;
                    wins.push(trade.pips);
                    totalPips += trade.pips;
                    monthlyBreakdown[month].correct++;
                    monthlyBreakdown[month].pips += trade.pips;
                    consecutiveLosses = 0;
                  } else {
                    incorrect++;
                    losses.push(Math.abs(trade.pips));
                    totalPips += trade.pips;
                    monthlyBreakdown[month].incorrect++;
                    monthlyBreakdown[month].pips += trade.pips;
                    consecutiveLosses++;
                    if (consecutiveLosses > maxConsecLosses) maxConsecLosses = consecutiveLosses;
                  }
                }
              }

              const total = correct + incorrect;
              const winRate = total > 0 ? (correct / total) * 100 : 0;
              const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
              const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
              const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

              allResults.push({
                hold,
                threshold,
                lookback,
                strategy,
                model,
                pairSet: pairSetName,
                trades: total,
                correct,
                incorrect,
                winRate: +winRate.toFixed(2),
                totalPips,
                avgWin: +avgWin.toFixed(1),
                avgLoss: +avgLoss.toFixed(1),
                profitFactor: +profitFactor.toFixed(2),
                maxConsecLosses,
                monthlyBreakdown,
              });
            }
          }
        }
      }
    }
  }

  console.log(`\n\nAll ${totalCombos} configurations tested.\n`);

  // ═══════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════

  // Filter: minimum 30 trades
  const qualified = allResults.filter(r => r.trades >= 30);
  console.log(`Qualified configs (>= 30 trades): ${qualified.length} / ${allResults.length}`);

  // Sort by winrate desc, then profit factor desc
  qualified.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.profitFactor - a.profitFactor;
  });

  // TOP 20
  console.log('\n================================================================');
  console.log('  TOP 20 CONFIGURATIONS (by win rate)');
  console.log('================================================================\n');
  console.log('Rank | Hold | Thresh | LB | Strategy           | Model | Pairs   | Trades | Win%  | Pips   | AvgW | AvgL | PF   | MaxCL');
  console.log('─────┼──────┼────────┼────┼────────────────────┼───────┼─────────┼────────┼───────┼────────┼──────┼──────┼──────┼──────');

  const top20 = qualified.slice(0, 20);
  for (let i = 0; i < top20.length; i++) {
    const r = top20[i];
    console.log(
      `${String(i + 1).padStart(4)} | ` +
      `${String(r.hold).padStart(4)}d | ` +
      `${String(r.threshold).padStart(5)}  | ` +
      `${String(r.lookback).padStart(2)} | ` +
      `${r.strategy.padEnd(18)} | ` +
      `  ${r.model}    | ` +
      `${r.pairSet === '10_majors' ? '10 maj ' : 'all 21 '} | ` +
      `${String(r.trades).padStart(6)} | ` +
      `${String(r.winRate.toFixed(1)).padStart(5)}% | ` +
      `${String(r.totalPips).padStart(6)} | ` +
      `${String(r.avgWin).padStart(4)} | ` +
      `${String(r.avgLoss).padStart(4)} | ` +
      `${String(r.profitFactor.toFixed(2)).padStart(4)} | ` +
      `${String(r.maxConsecLosses).padStart(5)}`
    );
  }

  // WORST 5
  console.log('\n================================================================');
  console.log('  WORST 5 CONFIGURATIONS');
  console.log('================================================================\n');
  console.log('Rank | Hold | Thresh | LB | Strategy           | Model | Pairs   | Trades | Win%  | Pips   | PF');
  console.log('─────┼──────┼────────┼────┼────────────────────┼───────┼─────────┼────────┼───────┼────────┼──────');

  const worst5 = qualified.slice(-5).reverse();
  for (let i = 0; i < worst5.length; i++) {
    const r = worst5[i];
    console.log(
      `${String(i + 1).padStart(4)} | ` +
      `${String(r.hold).padStart(4)}d | ` +
      `${String(r.threshold).padStart(5)}  | ` +
      `${String(r.lookback).padStart(2)} | ` +
      `${r.strategy.padEnd(18)} | ` +
      `  ${r.model}    | ` +
      `${r.pairSet === '10_majors' ? '10 maj ' : 'all 21 '} | ` +
      `${String(r.trades).padStart(6)} | ` +
      `${String(r.winRate.toFixed(1)).padStart(5)}% | ` +
      `${String(r.totalPips).padStart(6)} | ` +
      `${String(r.profitFactor.toFixed(2)).padStart(4)}`
    );
  }

  // BEST CONFIG MONTHLY BREAKDOWN
  if (qualified.length > 0) {
    const best = qualified[0];
    console.log('\n================================================================');
    console.log('  BEST CONFIG - MONTHLY BREAKDOWN');
    console.log(`  Hold=${best.hold}d | Thresh=${best.threshold} | LB=${best.lookback} | ${best.strategy} | Model ${best.model} | ${best.pairSet}`);
    console.log('================================================================\n');
    console.log('Month    | Trades | Win% | Pips');
    console.log('─────────┼────────┼──────┼──────');

    const months = Object.keys(best.monthlyBreakdown).sort();
    for (const month of months) {
      const m = best.monthlyBreakdown[month];
      const total = m.correct + m.incorrect;
      const wr = total > 0 ? ((m.correct / total) * 100).toFixed(1) : 'N/A';
      console.log(
        `${month}  | ` +
        `${String(total).padStart(6)} | ` +
        `${String(wr).padStart(4)}% | ` +
        `${String(m.pips).padStart(5)}`
      );
    }
  }

  // Summary stats
  console.log('\n================================================================');
  console.log('  SUMMARY STATISTICS');
  console.log('================================================================\n');
  if (qualified.length > 0) {
    const winRates = qualified.map(r => r.winRate);
    const avgWR = winRates.reduce((a, b) => a + b, 0) / winRates.length;
    const maxWR = Math.max(...winRates);
    const minWR = Math.min(...winRates);
    const medianWR = winRates[Math.floor(winRates.length / 2)];

    console.log(`Total configs tested:   ${allResults.length}`);
    console.log(`Qualified (>=30 trades): ${qualified.length}`);
    console.log(`Average win rate:        ${avgWR.toFixed(1)}%`);
    console.log(`Median win rate:         ${medianWR.toFixed(1)}%`);
    console.log(`Best win rate:           ${maxWR.toFixed(1)}%`);
    console.log(`Worst win rate:          ${minWR.toFixed(1)}%`);

    // Best by strategy
    console.log('\nBest win rate per strategy:');
    for (const strat of strategies) {
      const best = qualified.filter(r => r.strategy === strat).sort((a, b) => b.winRate - a.winRate)[0];
      if (best) {
        console.log(`  ${strat.padEnd(20)} => ${best.winRate.toFixed(1)}% (${best.trades} trades, PF=${best.profitFactor.toFixed(2)})`);
      }
    }

    // Best by model
    console.log('\nBest win rate per scoring model:');
    for (const model of scoringModels) {
      const best = qualified.filter(r => r.model === model).sort((a, b) => b.winRate - a.winRate)[0];
      if (best) {
        console.log(`  Model ${model}  => ${best.winRate.toFixed(1)}% (${best.trades} trades, ${best.strategy})`);
      }
    }
  }

  // JSON output
  const top5JSON = qualified.slice(0, 5).map(r => ({
    hold: r.hold,
    lookback: r.lookback,
    threshold: r.threshold,
    strategy: r.strategy,
    model: r.model,
    pairSet: r.pairSet,
    trades: r.trades,
    winRate: r.winRate,
    totalPips: r.totalPips,
    profitFactor: r.profitFactor,
  }));

  console.log('\n=== TOP 5 JSON ===');
  console.log(JSON.stringify(top5JSON, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nCompleted in ${elapsed} seconds.`);
}

main().catch(e => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});
