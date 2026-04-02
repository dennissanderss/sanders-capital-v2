const http = require('http');

function fetchData() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/trackrecord-v2', (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function stats(arr) {
  const wins = arr.filter(r => r.result === 'correct');
  const losses = arr.filter(r => r.result === 'incorrect');
  const winRate = arr.length > 0 ? (wins.length / arr.length * 100).toFixed(1) : 'N/A';
  const avgWinPips = wins.length > 0 ? (wins.reduce((s,r) => s + Math.abs(r.pips_moved), 0) / wins.length).toFixed(0) : 0;
  const avgLossPips = losses.length > 0 ? (losses.reduce((s,r) => s + Math.abs(r.pips_moved), 0) / losses.length).toFixed(0) : 0;
  const totalPips = arr.reduce((s,r) => s + (r.pips_moved || 0), 0);
  return { n: arr.length, wins: wins.length, losses: losses.length, winRate, avgWinPips, avgLossPips, totalPips };
}

function printTable(title, groups) {
  console.log('\n' + '='.repeat(95));
  console.log(title);
  console.log('-'.repeat(95));
  console.log('Category'.padEnd(25) + 'N'.padStart(5) + 'Wins'.padStart(6) + 'Loss'.padStart(6) + 'WinR%'.padStart(7) + 'AvgW'.padStart(7) + 'AvgL'.padStart(7) + 'TotPips'.padStart(9) + '  Flag');
  console.log('-'.repeat(95));
  for (const [name, s] of groups) {
    const wr = parseFloat(s.winRate);
    const flag = s.n >= 30 && wr >= 55 ? '  *** HIGH VALUE' :
                 s.n >= 30 && wr >= 50 ? '  ** PROMISING' :
                 s.n >= 20 && wr >= 55 ? '  * WATCH' : '';
    console.log(
      name.padEnd(25) +
      String(s.n).padStart(5) +
      String(s.wins).padStart(6) +
      String(s.losses).padStart(6) +
      String(s.winRate).padStart(7) +
      String(s.avgWinPips).padStart(7) +
      String(s.avgLossPips).padStart(7) +
      String(s.totalPips).padStart(9) +
      flag
    );
  }
}

async function main() {
  const data = await fetchData();
  const records = data.records.filter(r => r.result !== 'pending');
  const total = records.length;

  // 1. BY PAIR
  const byPair = {};
  records.forEach(r => { if (!byPair[r.pair]) byPair[r.pair] = []; byPair[r.pair].push(r); });
  printTable('WIN RATE BY PAIR', Object.entries(byPair).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 2. BY REGIME
  const byRegime = {};
  records.forEach(r => { const k = r.regime || 'Unknown'; if (!byRegime[k]) byRegime[k] = []; byRegime[k].push(r); });
  printTable('WIN RATE BY REGIME', Object.entries(byRegime).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 3. BY CONVICTION
  const byConv = {};
  records.forEach(r => { const k = r.conviction || 'Unknown'; if (!byConv[k]) byConv[k] = []; byConv[k].push(r); });
  printTable('WIN RATE BY CONVICTION', Object.entries(byConv).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 4. BY SCORE RANGE
  const scoreRanges = { '3.0-3.5': [], '3.5-4.0': [], '4.0-4.5': [], '4.5-5.0': [], '5.0+': [] };
  records.forEach(r => {
    const s = Math.abs(r.score);
    if (s >= 5.0) scoreRanges['5.0+'].push(r);
    else if (s >= 4.5) scoreRanges['4.5-5.0'].push(r);
    else if (s >= 4.0) scoreRanges['4.0-4.5'].push(r);
    else if (s >= 3.5) scoreRanges['3.5-4.0'].push(r);
    else scoreRanges['3.0-3.5'].push(r);
  });
  printTable('WIN RATE BY SCORE RANGE', Object.entries(scoreRanges).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 5. BY MONTH
  const byMonth = {};
  records.forEach(r => { const m = r.date.substring(0,7); if (!byMonth[m]) byMonth[m] = []; byMonth[m].push(r); });
  printTable('WIN RATE BY MONTH', Object.entries(byMonth).map(([k,v]) => [k, stats(v)]).sort((a,b) => a[0].localeCompare(b[0])));

  // 6. BY DAY OF WEEK
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const byDay = {};
  records.forEach(r => { const d = dayNames[new Date(r.date).getDay()]; if (!byDay[d]) byDay[d] = []; byDay[d].push(r); });
  printTable('WIN RATE BY DAY OF WEEK', Object.entries(byDay).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 7. BY DIRECTION
  const byDir = {};
  records.forEach(r => { const d = r.direction.includes('bullish') ? 'Bullish' : 'Bearish'; if (!byDir[d]) byDir[d] = []; byDir[d].push(r); });
  printTable('WIN RATE BY DIRECTION', Object.entries(byDir).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 8. BY TIER
  const byTier = {};
  records.forEach(r => { const t = r.metadata?.tier || 'unknown'; if (!byTier[t]) byTier[t] = []; byTier[t].push(r); });
  printTable('WIN RATE BY TIER', Object.entries(byTier).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 9. INTERMARKET ALIGNMENT
  const byIA = { '0-35 (contra)': [], '35-50': [], '50-65': [], '65-80': [], '80-100 (strong)': [] };
  records.forEach(r => {
    const ia = r.metadata?.intermarketAlignment;
    if (ia == null) return;
    if (ia >= 80) byIA['80-100 (strong)'].push(r);
    else if (ia >= 65) byIA['65-80'].push(r);
    else if (ia >= 50) byIA['50-65'].push(r);
    else if (ia >= 35) byIA['35-50'].push(r);
    else byIA['0-35 (contra)'].push(r);
  });
  printTable('WIN RATE BY INTERMARKET ALIGNMENT', Object.entries(byIA).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 10. TIER 1 BY REGIME
  const tier1 = records.filter(r => r.metadata?.tier === 'tier1');
  const t1ByRegime = {};
  tier1.forEach(r => { const k = r.regime || 'Unknown'; if (!t1ByRegime[k]) t1ByRegime[k] = []; t1ByRegime[k].push(r); });
  printTable('TIER 1 BREAKDOWN BY REGIME', Object.entries(t1ByRegime).map(([k,v]) => [k, stats(v)]).sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate)));

  // 11. COMBINED FILTERS
  const combos = [];
  combos.push(['T1 + Score>=4.0', stats(records.filter(r => r.metadata?.tier === 'tier1' && Math.abs(r.score) >= 4.0))]);
  combos.push(['T1 + IA>=80', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.metadata?.intermarketAlignment >= 80))]);
  combos.push(['T1 + Score>=4.5', stats(records.filter(r => r.metadata?.tier === 'tier1' && Math.abs(r.score) >= 4.5))]);
  combos.push(['T1 + Score>=5.0', stats(records.filter(r => r.metadata?.tier === 'tier1' && Math.abs(r.score) >= 5.0))]);
  combos.push(['Sterk + Risk-Off', stats(records.filter(r => r.conviction === 'sterk' && r.regime === 'Risk-Off'))]);
  combos.push(['Sterk + Risk-On', stats(records.filter(r => r.conviction === 'sterk' && r.regime === 'Risk-On'))]);
  combos.push(['Bearish + Score<=-4', stats(records.filter(r => r.direction.includes('bearish') && r.score <= -4.0))]);
  combos.push(['Bullish + Score>=4', stats(records.filter(r => r.direction.includes('bullish') && r.score >= 4.0))]);
  combos.push(['All JPY pairs', stats(records.filter(r => r.pair.includes('JPY')))]);
  combos.push(['Non-JPY pairs', stats(records.filter(r => !r.pair.includes('JPY')))]);
  combos.push(['T2 + Score<3.5', stats(records.filter(r => r.metadata?.tier === 'tier2' && Math.abs(r.score) < 3.5))]);
  combos.push(['Mon+Tue only', stats(records.filter(r => { const d = new Date(r.date).getDay(); return d === 1 || d === 2; }))]);
  combos.push(['Wed+Thu+Fri', stats(records.filter(r => { const d = new Date(r.date).getDay(); return d >= 3 && d <= 5; }))]);
  combos.push(['T1 + Bearish', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.direction.includes('bearish')))]);
  combos.push(['T1 + Bullish', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.direction.includes('bullish')))]);
  combos.push(['Risk-Off + Bearish', stats(records.filter(r => r.regime === 'Risk-Off' && r.direction.includes('bearish')))]);
  combos.push(['Risk-On + Bullish', stats(records.filter(r => r.regime === 'Risk-On' && r.direction.includes('bullish')))]);
  combos.push(['Gemengd regime', stats(records.filter(r => r.regime === 'Gemengd'))]);
  combos.push(['T1+RiskOff+Bear', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.regime === 'Risk-Off' && r.direction.includes('bearish')))]);
  combos.push(['T1+RiskOn+Bull', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.regime === 'Risk-On' && r.direction.includes('bullish')))]);
  combos.push(['Sterk+Score>=4.5', stats(records.filter(r => r.conviction === 'sterk' && Math.abs(r.score) >= 4.5))]);
  combos.push(['T1+IA>=80+Score>=4', stats(records.filter(r => r.metadata?.tier === 'tier1' && r.metadata?.intermarketAlignment >= 80 && Math.abs(r.score) >= 4.0))]);
  combos.push(['Matig conviction', stats(records.filter(r => r.conviction === 'matig'))]);
  combos.push(['T2+Matig', stats(records.filter(r => r.metadata?.tier === 'tier2' && r.conviction === 'matig'))]);
  combos.push(['USD pairs only', stats(records.filter(r => r.pair.includes('USD')))]);
  combos.push(['Cross pairs (no USD)', stats(records.filter(r => !r.pair.includes('USD')))]);

  combos.sort((a,b) => parseFloat(b[1].winRate) - parseFloat(a[1].winRate));
  printTable('COMBINED FILTER ANALYSIS (sorted by win rate)', combos);

  // 12. TOP PERFORMING PAIRS BY PIPS
  console.log('\n' + '='.repeat(95));
  console.log('TOP/BOTTOM PAIRS BY TOTAL PIPS');
  console.log('-'.repeat(95));
  const pairByPips = Object.entries(byPair).map(([k,v]) => [k, stats(v)]).sort((a,b) => b[1].totalPips - a[1].totalPips);
  console.log('Pair'.padEnd(15) + 'TotalPips'.padStart(10) + 'N'.padStart(5) + 'WinR%'.padStart(7));
  console.log('-'.repeat(40));
  for (const [name, s] of pairByPips) {
    console.log(name.padEnd(15) + String(s.totalPips).padStart(10) + String(s.n).padStart(5) + String(s.winRate).padStart(7));
  }

  // OVERALL
  console.log('\n' + '='.repeat(95));
  const overallWins = records.filter(r => r.result === 'correct').length;
  console.log('OVERALL: ' + total + ' records | ' + overallWins + ' wins | ' + (total - overallWins) + ' losses | WinRate: ' + (overallWins/total*100).toFixed(1) + '%');
  console.log('Total pips: ' + records.reduce((s,r) => s + (r.pips_moved || 0), 0));
  console.log('='.repeat(95));
}

main().catch(console.error);
