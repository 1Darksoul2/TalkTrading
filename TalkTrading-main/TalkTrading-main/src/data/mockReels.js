// Short vertical chart breakdowns. Videos and posters live in public/reels/.
// WebM comes first; MP4 is the fallback for browsers without WebM support.
const mockReels = [
  {
    id: 1, userId: 1, username: 'elena_trade', displayName: 'Elena Rostova',
    userAvatar: 'https://picsum.photos/seed/elena/200/200', isVerified: true,
    sources: ['/reels/reel-nvda.webm', '/reels/reel-nvda.mp4'], poster: '/reels/reel-nvda.jpg',
    caption: 'NVDA finally cleared the 120 resistance after two days of chop. Entry on the retest, stop under the range. Volume confirmed the move. #NVDA #Breakout',
    tickers: ['NVDA', 'AMD'],
    likes: 1243, comments: 84, timestamp: '2h ago', isLiked: false, isSaved: false,
  },
  {
    id: 2, userId: 2, username: 'alex_quant', displayName: 'Alex Mercer',
    userAvatar: 'https://picsum.photos/seed/alexq/200/200', isVerified: true,
    sources: ['/reels/reel-tsla.webm', '/reels/reel-tsla.mp4'], poster: '/reels/reel-tsla.jpg',
    caption: 'TSLA defended support three times on the hourly. Waiting for a close above the last lower high before adding. Risk is defined, patience is the edge.',
    tickers: ['TSLA'],
    likes: 1876, comments: 92, timestamp: '4h ago', isLiked: false, isSaved: true,
  },
  {
    id: 3, userId: 5, username: 'crypto_wolf', displayName: 'James Davies',
    userAvatar: 'https://picsum.photos/seed/james/200/200', isVerified: false,
    sources: ['/reels/reel-btc.webm', '/reels/reel-btc.mp4'], poster: '/reels/reel-btc.jpg',
    caption: 'BTC flipped the prior high into support on the 4h. As long as we hold this level, the trend stays intact. NFA, manage your own risk.',
    tickers: ['BTC', 'ETH'],
    likes: 3420, comments: 234, timestamp: '5h ago', isLiked: true, isSaved: false,
  },
  {
    id: 4, userId: 4, username: 'macro_bull', displayName: 'Marcus Chen',
    userAvatar: 'https://picsum.photos/seed/marcus/200/200', isVerified: true,
    sources: ['/reels/reel-meta.webm', '/reels/reel-meta.mp4'], poster: '/reels/reel-meta.jpg',
    caption: 'META printing lower highs all session. Not shorting a megacap blindly, but this is not where I add longs either. Watching the daily close.',
    tickers: ['META', 'GOOGL'],
    likes: 2891, comments: 156, timestamp: '7h ago', isLiked: false, isSaved: false,
  },
  {
    id: 5, userId: 3, username: 'sarah_options', displayName: 'Sarah Jensen',
    userAvatar: 'https://picsum.photos/seed/sarah/200/200', isVerified: false,
    sources: ['/reels/reel-aapl.webm', '/reels/reel-aapl.mp4'], poster: '/reels/reel-aapl.jpg',
    caption: 'AAPL range trading setup: sell premium near the top, buy near the bottom, step aside on a clean break. Unusual call flow showing up near the range top.',
    tickers: ['AAPL', 'MSFT'],
    likes: 945, comments: 67, timestamp: '9h ago', isLiked: false, isSaved: false,
  },
  {
    id: 6, userId: 6, username: 'mike_trades', displayName: 'Mike Rodriguez',
    userAvatar: 'https://picsum.photos/seed/mike/200/200', isVerified: true,
    sources: ['/reels/reel-spy.webm', '/reels/reel-spy.mp4'], poster: '/reels/reel-spy.jpg',
    caption: 'SPY respecting the rising trendline on the daily. Every dip into it has been bought. A close below changes the picture, until then the trend is your friend.',
    tickers: ['SPY'],
    likes: 1532, comments: 71, timestamp: '1d ago', isLiked: true, isSaved: true,
  },
]

export default mockReels
