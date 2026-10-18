const mockNews = [
  {
    id: 1, title: 'S&P 500 Surges to Record Highs Driven by Tech Sector Rally',
    source: 'Bloomberg', timestamp: '2m ago',
    image: 'https://picsum.photos/seed/news1/800/400',
    ticker: 'SPX', summary: 'Major tech equities outperformed expectations in Q3, pushing global indices into unprecedented territory as institutional investors double down on AI infrastructure.',
    category: 'general', isFeatured: true,
  },
  {
    id: 2, title: 'Euro Slips Against Dollar Following ECB Policy Meeting',
    source: 'Reuters', timestamp: '15m ago',
    image: 'https://picsum.photos/seed/news2/400/400',
    ticker: 'EUR/USD', summary: 'The European Central Bank held rates steady but signaled potential easing in Q1 2025.',
    category: 'forex', isFeatured: false,
  },
  {
    id: 3, title: 'Bitcoin Institutional Outflows Stabilize as Resistance Level Holds',
    source: 'CoinDesk', timestamp: '45m ago',
    image: 'https://picsum.photos/seed/news3/400/400',
    ticker: 'BTC', summary: 'After weeks of outflows from spot BTC ETFs, institutional activity has stabilized around the $64,000 support level.',
    category: 'crypto', isFeatured: false,
  },
  {
    id: 4, title: 'NVIDIA Reports Record Revenue, Beats Estimates by 20%',
    source: 'CNBC', timestamp: '1h ago',
    image: 'https://picsum.photos/seed/news4/400/400',
    ticker: 'NVDA', summary: 'Data center revenue surged 150% year-over-year as AI chip demand continues to outpace supply.',
    category: 'general', isFeatured: false,
  },
  {
    id: 5, title: 'Sensex Crosses 80,000 Mark for First Time; Nifty Hits New All-Time High',
    source: 'Economic Times', timestamp: '2h ago',
    image: 'https://picsum.photos/seed/news5/400/400',
    ticker: 'SENSEX', summary: 'Indian equity markets rally on strong FII inflows and robust GDP growth forecast for FY25.',
    category: 'indian', isFeatured: false,
  },
  {
    id: 6, title: 'Gold Prices Surge Past $2,400 on Geopolitical Tensions',
    source: 'Financial Times', timestamp: '3h ago',
    image: 'https://picsum.photos/seed/news6/400/400',
    ticker: 'XAUUSD', summary: 'Safe-haven demand pushes gold to new highs as Middle East tensions escalate and central banks increase reserves.',
    category: 'global', isFeatured: false,
  },
  {
    id: 7, title: 'Ethereum ETF Approval Expected Within Weeks, Sources Say',
    source: 'The Block', timestamp: '4h ago',
    image: 'https://picsum.photos/seed/news7/400/400',
    ticker: 'ETH', summary: 'SEC reportedly in final stages of reviewing spot Ethereum ETF applications from major asset managers.',
    category: 'crypto', isFeatured: false,
  },
  {
    id: 8, title: 'Fed Signals Patience on Rate Cuts Despite Cooling Inflation',
    source: 'Wall Street Journal', timestamp: '5h ago',
    image: 'https://picsum.photos/seed/news8/400/400',
    ticker: 'DXY', summary: 'Federal Reserve officials emphasized data dependency, suggesting rate cuts may begin later than markets expect.',
    category: 'global', isFeatured: false,
  },
]

export default mockNews
