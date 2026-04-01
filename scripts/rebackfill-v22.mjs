import https from 'https';

function httpRequest(method, url, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        return httpRequest(method, redirectUrl, data).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  const baseUrl = 'https://www.sanderscapital.nl';
  
  // Step 1: Delete old backfill records
  console.log('🗑️  Deleting old V2 backfill records...');
  const delResult = await httpRequest('DELETE', `${baseUrl}/api/trackrecord-v2/backfill`);
  console.log('   Delete result:', JSON.stringify(delResult.data, null, 2));
  
  // Step 2: Re-backfill with V2.2 (45 days)
  console.log('\n📊 Backfilling V2.2 with mean reversion (45 days)...');
  const fillResult = await httpRequest('POST', `${baseUrl}/api/trackrecord-v2/backfill`, { days: 45 });
  console.log('   Backfill result:', JSON.stringify(fillResult.data, null, 2));
  
  console.log('\n✅ Done!');
}

main().catch(err => console.error('Error:', err));
