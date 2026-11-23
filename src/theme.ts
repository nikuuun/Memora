// Memora look, from the Figma design (design/figma-make): warm cream paper, ink
// text, Playfair Display headings and DM Sans for everything else. Terracotta
// (danger) is only for the real delete in Review.
export const colors = {
  bg: '#F5F3EB', // cream page
  card: '#FBFAF5', // raised cards, sheets, tab bar
  surface: '#ECE9DF', // sunken fills: search, chips, segment, placeholders
  text: '#25251F', // ink
  muted: '#6B6C61',
  mutedOnDark: '#CFCBBE',
  line: '#DEDACD',
  accent: '#B88A73', // the dot in "memora."
  clay: '#AD725D', // italic emphasis in big headlines ("beautifully told.")
  studio: '#DED6C7', // the Story Studio card
  eyebrow: '#8F7562', // small caps labels
  keep: '#637C66', // sage
  danger: '#B55B51', // terracotta
  overlay: 'rgba(37,37,31,0.6)',
  dim: 'rgba(37,37,31,0.45)',
};

/** Font faces. Each weight is its own family on iOS/Android, so pick a face, not a fontWeight. */
export const fonts = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  serif: 'PlayfairDisplay_600SemiBold',
  serifItalic: 'PlayfairDisplay_500Medium_Italic',
};

export const radius = { sm: 8, md: 12, lg: 14, xl: 22 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Big serif screen title ("Library", "Clean"). */
export const titleStyle = { fontFamily: fonts.serif, fontSize: 30, letterSpacing: -0.6, color: colors.text } as const;
/** Small spaced capitals above a section ("RECENT MOMENTS"). */
export const eyebrowStyle = { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.eyebrow } as const;

export const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const items = (n: number) => `${formatCount(n)} ${n === 1 ? 'item' : 'items'}`;
export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
