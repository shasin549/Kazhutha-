export const SUIT_SYMBOLS: Record<string, string> = {
  '♠️': '♠',
  '♥️': '♥',
  '♦️': '♦',
  '♣️': '♣'
};

export const getColor = (suit: string) => {
  return (suit === '♥️' || suit === '♦️') ? 'text-red-500' : 'text-gray-900';
};
