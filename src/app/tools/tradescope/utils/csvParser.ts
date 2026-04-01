import Papa from 'papaparse'

// FXReplay actual CSV columns
export interface FXReplayRow {
  id: string
  dateStart: string
  dateEnd: string
  pair: string
  uPnL: string
  rPnL: string
  side: string
  entryPrice: string
  initalSL: string  // typo in FXReplay export
  maxTP: string
  idealTP: string
  amount: string
  amountClosed: string
  status: string
  day: string
  tags: string
  avgClosePrice: string
  avgRiskReward: string
  maxRiskReward: string
  exchangeRate: string
  initialBalance: string
  currentRealizedBalance: string
}

export interface ParsedTrade {
  tradeNumber: number
  openDate: Date
  closeDate: Date
  symbol: string
  action: 'buy' | 'sell'
  lotSize: number
  openPrice: number
  closePrice: number
  sl: number
  tp: number
  commission: number
  swap: number
  pips: number
  profitLoss: number
  riskReward: number | null
  session: 'London' | 'New York' | 'Asia' | 'Overlap'
  dayOfWeek: string
  holdingTimeMinutes: number
  isWin: boolean
  tags: string
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  // FXReplay format: "2023/03/01 18:44:55"
  const d = new Date(dateStr.replace(/\//g, '-'))
  if (!isNaN(d.getTime())) return d
  return new Date(dateStr)
}

function getSession(date: Date): 'London' | 'New York' | 'Asia' | 'Overlap' {
  const hour = date.getUTCHours()
  if (hour >= 13 && hour < 17) return 'Overlap'
  if (hour >= 8 && hour < 17) return 'London'
  if (hour >= 13 && hour < 22) return 'New York'
  return 'Asia'
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('nl-NL', { weekday: 'long' })
}

function cleanSymbol(pair: string): string {
  // "OANDA:EURUSD" → "EURUSD"
  if (pair.includes(':')) return pair.split(':')[1]
  return pair
}

function calcPips(entryPrice: number, closePrice: number, side: string, symbol: string): number {
  const diff = side === 'buy' ? closePrice - entryPrice : entryPrice - closePrice
  // JPY pairs have 2 decimal pip value, others 4
  const isJpy = symbol.toUpperCase().includes('JPY')
  const multiplier = isJpy ? 100 : 10000
  return +(diff * multiplier).toFixed(1)
}

export interface ParseResult {
  trades: ParsedTrade[]
  detectedBalance: number | null  // Original backtest balance from CSV
}

export function parseCSV(csvText: string): ParseResult {
  const result = Papa.parse<FXReplayRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors)
  }

  const headers = result.meta.fields || []

  // Detect format: FXReplay has 'dateStart', 'rPnL', 'side'
  const isFXReplay = headers.includes('dateStart') || headers.includes('rPnL')

  if (isFXReplay) {
    const rows = result.data as FXReplayRow[]
    const trades = parseFXReplay(rows)
    // Detect original backtest balance from first row
    const firstRow = rows.find(r => r.initialBalance)
    const detectedBalance = firstRow ? parseFloat(firstRow.initialBalance) : null
    return { trades, detectedBalance: detectedBalance && !isNaN(detectedBalance) ? detectedBalance : null }
  }

  // Fallback: try generic format
  return { trades: parseGeneric(result.data as Record<string, string>[]), detectedBalance: null }
}

function parseFXReplay(data: FXReplayRow[]): ParsedTrade[] {
  return data
    .filter((row) => row.id && row.dateEnd && row.status === 'closed')
    .map((row, index) => {
      const openDate = parseDate(row.dateStart)
      const closeDate = parseDate(row.dateEnd)
      const entryPrice = parseFloat(row.entryPrice) || 0
      const closePrice = parseFloat(row.avgClosePrice) || 0
      const sl = parseFloat(row.initalSL) || 0
      const tp = parseFloat(row.maxTP) || 0
      const side = row.side?.toLowerCase().includes('buy') ? 'buy' as const : 'sell' as const
      const profitLoss = parseFloat(row.rPnL) || 0
      const symbol = cleanSymbol(row.pair || '')
      const pips = calcPips(entryPrice, closePrice, side, symbol)
      const rr = parseFloat(row.avgRiskReward) || null
      const lotSize = parseFloat(row.amount) || 0

      return {
        tradeNumber: index + 1,
        openDate,
        closeDate,
        symbol,
        action: side,
        lotSize,
        openPrice: entryPrice,
        closePrice,
        sl,
        tp,
        commission: 0,
        swap: 0,
        pips,
        profitLoss,
        riskReward: rr,
        session: getSession(openDate),
        dayOfWeek: getDayName(openDate),
        holdingTimeMinutes: Math.round((closeDate.getTime() - openDate.getTime()) / 60000),
        isWin: profitLoss > 0,
        tags: row.tags || '',
      }
    })
    .sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
}

// Fallback parser for other CSV formats (MT4/MT5 etc.)
function parseGeneric(data: Record<string, string>[]): ParsedTrade[] {
  return data
    .filter((row) => {
      // Need at least some date and P/L
      const hasDate = row['Open Date'] || row['Open Time'] || row['Date']
      const hasPnL = row['Profit/Loss'] || row['Profit'] || row['P/L']
      return hasDate && hasPnL
    })
    .map((row, index) => {
      const openDateStr = row['Open Date'] || row['Open Time'] || row['Date'] || ''
      const closeDateStr = row['Close Date'] || row['Close Time'] || openDateStr
      const openDate = parseDate(openDateStr)
      const closeDate = parseDate(closeDateStr)
      const openPrice = parseFloat(row['Open Price'] || row['Entry Price'] || '0')
      const closePrice = parseFloat(row['Close Price'] || row['Exit Price'] || '0')
      const sl = parseFloat(row['S/L'] || row['Stop Loss'] || '0')
      const tp = parseFloat(row['T/P'] || row['Take Profit'] || '0')
      const actionStr = (row['Action'] || row['Type'] || row['Side'] || '').toLowerCase()
      const action = actionStr.includes('buy') || actionStr.includes('long') ? 'buy' as const : 'sell' as const
      const profitLoss = parseFloat(row['Profit/Loss'] || row['Profit'] || row['P/L'] || '0')
      const pips = parseFloat(row['Pips P/L'] || row['Pips'] || '0')
      const symbol = (row['Symbol'] || row['Pair'] || row['Instrument'] || 'Unknown').trim()

      return {
        tradeNumber: parseInt(row['Trade #'] || row['#'] || '') || (index + 1),
        openDate,
        closeDate,
        symbol: cleanSymbol(symbol),
        action,
        lotSize: parseFloat(row['Lot Size'] || row['Lots'] || row['Volume'] || '0'),
        openPrice,
        closePrice,
        sl,
        tp,
        commission: parseFloat(row['Commission'] || '0'),
        swap: parseFloat(row['Swap'] || '0'),
        pips,
        profitLoss,
        riskReward: null,
        session: getSession(openDate),
        dayOfWeek: getDayName(openDate),
        holdingTimeMinutes: Math.round((closeDate.getTime() - openDate.getTime()) / 60000),
        isWin: profitLoss > 0,
        tags: '',
      }
    })
    .sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
}
