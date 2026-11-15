// Look from the Clean redesign mockup: black and white, red only for the real delete.
export const colors = {
  bg: '#FFFFFF',
  surface: '#F3F3F1',
  text: '#141414',
  muted: '#62625D',
  mutedOnDark: '#C9C9C4',
  line: '#E4E4E0',
  danger: '#C8322B',
  overlay: 'rgba(0,0,0,0.6)',
  dim: 'rgba(20,20,20,0.45)',
};

export const radius = { sm: 6, md: 10, lg: 12, xl: 20 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const items = (n: number) => `${formatCount(n)} ${n === 1 ? 'item' : 'items'}`;
export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
