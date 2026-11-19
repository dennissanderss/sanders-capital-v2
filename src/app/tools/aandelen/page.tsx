import StockAnalyzer from './StockAnalyzer'

export const metadata = {
  title: 'Aandelen Analyzer | Sanders Capital',
  description:
    'Eén aandeel, twee oordelen: het bedrijf voor de lange termijn (jaarrekening, kasstromen, waardering) en de koers voor de korte termijn (trend en momentum) — in gewone taal uitgelegd.',
}

export default function AandelenPage() {
  return <StockAnalyzer />
}
