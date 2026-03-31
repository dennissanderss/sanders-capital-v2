import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Shared chart defaults for dark theme
export const darkThemeDefaults: Partial<ChartOptions<'line'>> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(15, 18, 25, 0.95)',
      titleColor: '#e8eaf0',
      bodyColor: '#a0a8be',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#5a6178', font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#5a6178', font: { size: 10 } },
    },
  },
}

export const COLORS = {
  accent: '#3d6ea5',
  accentLight: '#5a8ec4',
  green: '#22c55e',
  red: '#ef4444',
  gold: '#b8935a',
  text: '#a0a8be',
  textDim: '#5a6178',
  border: 'rgba(255,255,255,0.08)',
  bgCard: 'rgba(15,18,25,0.6)',
}
