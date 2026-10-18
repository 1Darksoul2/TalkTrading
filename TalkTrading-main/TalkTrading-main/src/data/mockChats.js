const mockChats = [
  {
    id: 1,
    user: { name: 'Elena Rostova', avatar: 'https://picsum.photos/seed/elena/200/200', online: true },
    lastMessage: 'Just cleared the AAPL position. +12% 🎯',
    timestamp: '10:42 AM',
    unreadCount: 2,
    messages: [
      { id: 1, text: 'Hey, did you see the AAPL setup I posted?', sender: 'them', timestamp: '10:15 AM' },
      { id: 2, text: 'Yeah! That resistance break was clean. You entered at $178?', sender: 'me', timestamp: '10:18 AM' },
      { id: 3, text: 'Exactly. Got in right at the breakout with tight stops.', sender: 'them', timestamp: '10:20 AM' },
      { id: 4, text: 'Smart. What\'s your target?', sender: 'me', timestamp: '10:22 AM' },
      { id: 5, text: 'Was looking at $198 but hit $192 and decided to take profits early.', sender: 'them', timestamp: '10:35 AM' },
      { id: 6, text: 'Just cleared the AAPL position. +12% 🎯', sender: 'them', timestamp: '10:42 AM' },
    ]
  },
  {
    id: 2,
    user: { name: 'Marcus Chen', avatar: 'https://picsum.photos/seed/marcus/200/200', online: false },
    lastMessage: 'Are you looking at the macro data for EU?',
    timestamp: 'Yesterday',
    unreadCount: 0,
    messages: [
      { id: 1, text: 'The PMI data coming out of Europe is concerning.', sender: 'them', timestamp: 'Yesterday 3:15 PM' },
      { id: 2, text: 'Agreed. Manufacturing has been in contraction for months now.', sender: 'me', timestamp: 'Yesterday 3:20 PM' },
      { id: 3, text: 'I\'m watching EUR/USD closely. Could see 1.05 again.', sender: 'them', timestamp: 'Yesterday 3:25 PM' },
      { id: 4, text: 'Are you looking at the macro data for EU?', sender: 'them', timestamp: 'Yesterday 4:00 PM' },
    ]
  },
  {
    id: 3,
    user: { name: 'James Davies', avatar: 'https://picsum.photos/seed/james/200/200', online: false },
    lastMessage: 'Thanks for the heads up on that setup.',
    timestamp: 'Mon',
    unreadCount: 0,
    messages: [
      { id: 1, text: 'Yo, check BTC on the 4H chart. Inverse H&S forming.', sender: 'me', timestamp: 'Mon 9:00 AM' },
      { id: 2, text: 'Oh wow, I see it. Neckline at 64.5k?', sender: 'them', timestamp: 'Mon 9:05 AM' },
      { id: 3, text: 'Yep. If it breaks, target is ~68k.', sender: 'me', timestamp: 'Mon 9:07 AM' },
      { id: 4, text: 'I just entered a small long. Stops below 62k.', sender: 'them', timestamp: 'Mon 9:15 AM' },
      { id: 5, text: 'Thanks for the heads up on that setup.', sender: 'them', timestamp: 'Mon 11:30 AM' },
    ]
  },
  {
    id: 4,
    user: { name: 'Sarah Jensen', avatar: 'https://picsum.photos/seed/sarah/200/200', online: true },
    lastMessage: 'The NVDA flow is insane today 🔥',
    timestamp: '2h ago',
    unreadCount: 5,
    messages: [
      { id: 1, text: 'Have you been tracking the NVDA options flow?', sender: 'them', timestamp: '2:00 PM' },
      { id: 2, text: 'Not closely. What are you seeing?', sender: 'me', timestamp: '2:05 PM' },
      { id: 3, text: 'Massive call sweeps on the Jan 150s. Over $12M in premium.', sender: 'them', timestamp: '2:08 PM' },
      { id: 4, text: 'That\'s not retail money. Institutional for sure.', sender: 'me', timestamp: '2:10 PM' },
      { id: 5, text: 'Exactly my thought. Following the smart money on this one.', sender: 'them', timestamp: '2:12 PM' },
      { id: 6, text: 'The NVDA flow is insane today 🔥', sender: 'them', timestamp: '2:30 PM' },
    ]
  },
  {
    id: 5,
    user: { name: 'Nina Patel', avatar: 'https://picsum.photos/seed/nina/200/200', online: false },
    lastMessage: 'London session was wild. GBP/USD hit my TP.',
    timestamp: 'Tue',
    unreadCount: 0,
    messages: [
      { id: 1, text: 'How was the London session for you?', sender: 'me', timestamp: 'Tue 8:00 AM' },
      { id: 2, text: 'Caught a beautiful GBP/USD long off the Asian range low.', sender: 'them', timestamp: 'Tue 8:05 AM' },
      { id: 3, text: 'Nice! What was your entry?', sender: 'me', timestamp: 'Tue 8:08 AM' },
      { id: 4, text: '1.2650 with TP at 1.2720. Hit it within the hour.', sender: 'them', timestamp: 'Tue 8:10 AM' },
      { id: 5, text: 'London session was wild. GBP/USD hit my TP.', sender: 'them', timestamp: 'Tue 10:00 AM' },
    ]
  },
]

export default mockChats
