import Papa from 'papaparse'

export interface RawTradeRow {
  'Trade #': string
  'Open Date': string
  'Close Date': string
  Symbol: string
  Action: string
  'Lot Size': string
  'Open Price': string
  'Close Price': string
  'S/L': string
  'T/P': string
  Commission: string
  Swap: string
  'Pips P/L': string
  'Profit/Loss': string
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
  // Derived fields
  riskReward: number | null
  session: 'London' | 'New York' | 'Asia' | 'Overlap'
  dayOfWeek: string
  holdingTimeMinutes: number
  isWin: boolean
}

function parseDate(dateStr: string): Date {
  // FXReplay format: "2024-01-15 14:30:00" or "01/15/2024 14:30"
  if (!dateStr) return new Date()
  // Try ISO format first
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) return d
  // Try dd/mm/yyyy hh:mm
  const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/)
  if (parts) {
    return new Date(+parts[3], +parts[1] - 1, +parts[2], +parts[4], +parts[5])
  }
  return new Date(dateStr)
}

function getSession(date: Date): 'London' | 'New York' | 'Asia' | 'Overlap' {
  const hour = date.getUTCHours()
  if (hour >= 13 && hour < 17) return 'Overlap' // London + NY overlap
  if (hour >= 8 && hour < 17) return 'London'
  if (hour >= 13 && hour < 22) return 'New York'
  return 'Asia'
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('nl-NL', { weekday: 'long' })
}

function calcRR(entry: number, sl: number, tp: number, action: string): number | null {
  if (!sl || sl === 0) return null
  const risk = Math.abs(entry - sl)
  if (risk === 0) return null
  if (tp && tp !== 0) {
    const reward = Math.abs(tp - entry)
    return +(reward / risk).toFixed(2)
  }
  return null
}

export function parseCSV(csvText: string): ParsedTrade[] {
  const result = Papa.parse<RawTradeRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors)
  }

  return result.data
    .filter((row) => row['Trade #'] && row['Close Date'])
    .map((row) => {
      const openDate = parseDate(row['Open Date'])
      const closeDate = parseDate(row['Close Date'])
      const openPrice = parseFloat(row['Open Price']) || 0
      const closePrice = parseFloat(row['Close Price']) || 0
      const sl = parseFloat(row['S/L']) || 0
      const tp = parseFloat(row['T/P']) || 0
      const action = row.Action?.toLowerCase().includes('buy') ? 'buy' as const : 'sell' as const
      const pips = parseFloat(row['Pips P/L']) || 0
      const profitLoss = parseFloat(row['Profit/Loss']) || 0

      return {
        tradeNumber: parseInt(row['Trade #']) || 0,
        openDate,
        closeDate,
        symbol: row.Symbol?.trim() || 'Unknown',
        action,
        lotSize: parseFloat(row['Lot Size']) || 0,
        openPrice,
        closePrice,
        sl,
        tp,
        commission: parseFloat(row.Commission) || 0,
        swap: parseFloat(row.Swap) || 0,
        pips,
        profitLoss,
        riskReward: calcRR(openPrice, sl, tp, action),
        session: getSession(openDate),
        dayOfWeek: getDayName(openDate),
        holdingTimeMinutes: Math.round((closeDate.getTime() - openDate.getTime()) / 60000),
        isWin: profitLoss > 0,
      }
    })
    .sort((a, b) => a.openDate.getTime() - b.openDate.getTime())
}
