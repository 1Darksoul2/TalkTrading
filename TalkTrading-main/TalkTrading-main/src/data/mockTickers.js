function generateMiniChart(base, volatility, trend, points = 20) {
  const data = []
  let val = base
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5 + trend * 0.02) * volatility
    data.push(Math.round(val * 100) / 100)
  }
  return data
}

const mockTickers = [
  // US Stocks
  { symbol: 'AAPL', name: 'Apple Inc.', price: 189.84, change: 2.45, changePercent: 1.31, category: 'stock', miniChartData: generateMiniChart(185, 3, 1) },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.10, change: 5.80, changePercent: 2.45, category: 'stock', miniChartData: generateMiniChart(230, 8, 1) },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 124.50, change: 5.02, changePercent: 4.20, category: 'stock', miniChartData: generateMiniChart(115, 5, 1) },
  { symbol: 'AMZN', name: 'Amazon.com', price: 185.20, change: 2.05, changePercent: 1.12, category: 'stock', miniChartData: generateMiniChart(180, 3, 1) },
  { symbol: 'META', name: 'Meta Platforms', price: 512.30, change: -4.39, changePercent: -0.85, category: 'stock', miniChartData: generateMiniChart(518, 5, -1) },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 176.42, change: 1.23, changePercent: 0.70, category: 'stock', miniChartData: generateMiniChart(173, 2, 1) },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 428.50, change: -2.10, changePercent: -0.49, category: 'stock', miniChartData: generateMiniChart(432, 4, -1) },
  { symbol: 'AMD', name: 'Advanced Micro', price: 164.80, change: 3.45, changePercent: 2.14, category: 'stock', miniChartData: generateMiniChart(158, 5, 1) },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 543.21, change: 2.45, changePercent: 0.45, category: 'stock', miniChartData: generateMiniChart(538, 3, 1) },

  // Crypto
  { symbol: 'BTC', name: 'Bitcoin', price: 64230.50, change: 1540.20, changePercent: 2.45, category: 'crypto', miniChartData: generateMiniChart(62000, 1200, 1) },
  { symbol: 'ETH', name: 'Ethereum', price: 3456.80, change: -52.30, changePercent: -1.49, category: 'crypto', miniChartData: generateMiniChart(3520, 80, -1) },
  { symbol: 'SOL', name: 'Solana', price: 172.45, change: 8.92, changePercent: 5.46, category: 'crypto', miniChartData: generateMiniChart(160, 8, 1) },
  { symbol: 'XRP', name: 'Ripple', price: 0.6234, change: 0.0123, changePercent: 2.01, category: 'crypto', miniChartData: generateMiniChart(0.60, 0.02, 1) },

  // Forex
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', price: 1.0876, change: 0.0034, changePercent: 0.31, category: 'forex', miniChartData: generateMiniChart(1.084, 0.003, 1) },
  { symbol: 'GBP/USD', name: 'British Pound', price: 1.2734, change: -0.0045, changePercent: -0.35, category: 'forex', miniChartData: generateMiniChart(1.278, 0.004, -1) },
  { symbol: 'USD/JPY', name: 'US Dollar / Yen', price: 154.32, change: 0.87, changePercent: 0.57, category: 'forex', miniChartData: generateMiniChart(153, 0.8, 1) },
  { symbol: 'USD/INR', name: 'US Dollar / Rupee', price: 83.42, change: 0.12, changePercent: 0.14, category: 'forex', miniChartData: generateMiniChart(83.2, 0.2, 1) },

  // Commodities
  { symbol: 'XAUUSD', name: 'Gold', price: 2412.50, change: 28.30, changePercent: 1.19, category: 'commodity', miniChartData: generateMiniChart(2380, 15, 1) },
  { symbol: 'XAGUSD', name: 'Silver', price: 28.94, change: -0.42, changePercent: -1.43, category: 'commodity', miniChartData: generateMiniChart(29.5, 0.5, -1) },
  { symbol: 'CL', name: 'Crude Oil', price: 78.65, change: 1.23, changePercent: 1.59, category: 'commodity', miniChartData: generateMiniChart(76, 1.5, 1) },
]

export default mockTickers
