import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, StyleSheet, type TextStyle, View, type ViewStyle } from 'react-native';

import { Text, TextInput } from '../components/Text';
import { fonts } from '../theme';

/**
 * The 10 starter story templates from design/Linnie_template_layouts.png.
 * Each one is drawn on a canvas 300 units wide and scaled by `u` (pixels per
 * unit), so the gallery thumbnail, the editor and the saved image all come
 * from the same layout.
 */

export type Photos = (string | undefined)[];
export type Texts = Record<string, string>;

type Ctx = {
  u: number;
  photos: Photos;
  texts: Texts;
  /** Editor only: tap a photo slot. */
  onSlot?: (index: number) => void;
  /** Editor only: change a caption. */
  onText?: (key: string, value: string) => void;
  /** Editor only: shows the + on empty slots. */
  editing: boolean;
  /** Called as each photo finishes loading (or fails). */
  onImageLoad?: () => void;
};

const C = createContext<Ctx>({ u: 1, photos: [], texts: {}, editing: false });

/** Slot colours while empty, from the layout sheet. */
const PLACEHOLDER = ['#DF8282', '#D9C27A', '#9CCB78', '#72CC98', '#76C9D6', '#7E84D6', '#B67ED6', '#D67EAE', '#D6927E'];

type Box = { x?: number; y?: number; w: number; h: number };

/** A photo slot. Absolute when x/y are given, in canvas units. */
function Slot({ i, x, y, w, h, r = 3, style }: Box & { i: number; r?: number; style?: ViewStyle }) {
  const { u, photos, onSlot, editing, onImageLoad } = useContext(C);
  const uri = photos[i];
  const box: ViewStyle = {
    width: w * u,
    height: h * u,
    borderRadius: r * u,
    overflow: 'hidden',
    backgroundColor: uri ? '#00000010' : PLACEHOLDER[i % PLACEHOLDER.length],
    ...(x != null && y != null ? { position: 'absolute', left: x * u, top: y * u } : null),
    ...style,
  };
  const number = Math.min(w, h) * 0.3 * u;
  const content = uri ? (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={onImageLoad ? 0 : 150}
      onLoad={onImageLoad}
      onError={onImageLoad}
    />
  ) : (
    <View style={styles.center}>
      <Text style={{ fontFamily: fonts.bold, fontSize: number, color: '#fff' }}>{i + 1}</Text>
      {editing ? <Ionicons name="add-circle" size={Math.max(16, number * 0.45)} color="#fff" /> : null}
    </View>
  );
  if (!onSlot) return <View style={box}>{content}</View>;
  return (
    <Pressable style={box} onPress={() => onSlot(i)} accessibilityLabel={uri ? `Photo ${i + 1}, tap to change` : `Add photo ${i + 1}`}>
      {content}
    </Pressable>
  );
}

/** An editable caption, absolute in canvas units. */
function Words({
  k,
  x,
  y,
  w,
  size,
  font = fonts.regular,
  color = '#25251F',
  align = 'left',
  spacing = 0,
  rotate,
  shadow,
}: {
  k: string;
  x: number;
  y: number;
  w: number;
  size: number;
  font?: string;
  color?: string;
  align?: TextStyle['textAlign'];
  spacing?: number;
  rotate?: number;
  shadow?: boolean;
}) {
  const { u, texts, onText } = useContext(C);
  const style: TextStyle = {
    position: 'absolute',
    left: x * u,
    top: y * u,
    width: w * u,
    fontFamily: font,
    fontSize: size * u,
    lineHeight: size * 1.3 * u,
    letterSpacing: spacing * u,
    color,
    textAlign: align,
    padding: 0,
    margin: 0,
    ...(rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null),
    ...(shadow ? { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 * u, textShadowOffset: { width: 0, height: 1 } } : null),
  };
  const value = texts[k] ?? '';
  if (!onText) return <Text style={style} numberOfLines={1}>{value}</Text>;
  return (
    <TextInput
      style={style}
      value={value}
      onChangeText={(v) => onText(k, v)}
      maxLength={40}
      scrollEnabled={false}
      returnKeyType="done"
      accessibilityLabel="Edit caption"
    />
  );
}

/** Canvas background, absolute fill. */
function Paper({ color, children }: { color: string; children: ReactNode }) {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]}>{children}</View>;
}

/** A tilted frame (polaroid / scrapbook print) holding one slot. */
function Print({
  i,
  x,
  y,
  size,
  rotate,
  pad,
  bottom,
  caption,
  tape,
}: {
  i: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
  pad: number;
  bottom: number;
  caption?: string;
  tape?: boolean;
}) {
  const { u } = useContext(C);
  return (
    <View
      style={{
        position: 'absolute',
        left: x * u,
        top: y * u,
        width: (size + pad * 2) * u,
        height: (size + pad + bottom) * u,
        padding: pad * u,
        backgroundColor: '#fff',
        transform: [{ rotate: `${rotate}deg` }],
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 4 * u,
        shadowOffset: { width: 0, height: 2 * u },
        elevation: 3,
      }}
    >
      <Slot i={i} w={size} h={size} r={0} />
      {caption ? <Words k={caption} x={0} y={size + pad + (bottom - pad - 13) / 2} w={size + pad * 2} size={10} font={fonts.serifItalic} align="center" /> : null}
      {tape ? (
        <View
          style={{
            position: 'absolute',
            left: ((size + pad * 2) / 2 - 20) * u,
            top: -5 * u,
            width: 40 * u,
            height: 9 * u,
            backgroundColor: 'rgba(240,226,190,0.85)',
          }}
        />
      ) : null}
    </View>
  );
}

export type Template = {
  id: string;
  name: string;
  /** Height of the canvas in units (width is always 300). */
  height: number;
  slots: number;
  texts: Texts;
  Body: () => ReactNode;
};

const W = 300;

export const TEMPLATES: Template[] = [
  {
    id: 'classic-grid',
    name: 'Classic Grid',
    height: 300,
    slots: 4,
    texts: {},
    Body: () => (
      <Paper color="#fff">
        <Slot i={0} x={12} y={12} w={135} h={135} />
        <Slot i={1} x={153} y={12} w={135} h={135} />
        <Slot i={2} x={12} y={153} w={135} h={135} />
        <Slot i={3} x={153} y={153} w={135} h={135} />
      </Paper>
    ),
  },
  {
    id: 'hero-three',
    name: 'Hero + Three',
    height: 375,
    slots: 4,
    texts: { caption: 'Weekend away' },
    Body: () => (
      <Paper color="#fff">
        <Slot i={0} x={12} y={12} w={276} h={206} />
        <Slot i={1} x={12} y={224} w={88} h={112} />
        <Slot i={2} x={106} y={224} w={88} h={112} />
        <Slot i={3} x={200} y={224} w={88} h={112} />
        <Words k="caption" x={12} y={344} w={276} size={12} />
      </Paper>
    ),
  },
  {
    id: 'polaroid-stack',
    name: 'Polaroid Stack',
    height: 375,
    slots: 3,
    texts: { a: 'the beach', b: 'sunset', c: 'us ♡', note: 'summer ’26' },
    Body: () => (
      <Paper color="#D9C3A0">
        <Print i={0} x={10} y={8} size={124} rotate={-4} pad={7} bottom={30} caption="a" />
        <Print i={1} x={146} y={66} size={124} rotate={5} pad={7} bottom={30} caption="b" />
        <Print i={2} x={20} y={196} size={128} rotate={-2} pad={7} bottom={30} caption="c" />
        <Words k="note" x={168} y={300} w={120} size={13} font={fonts.serifItalic} align="center" />
      </Paper>
    ),
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    height: 533,
    slots: 4,
    texts: { roll: 'ROLL 01', footer: 'MEMORA · 2026' },
    Body: () => (
      <Paper color="#141414">
        <Sprockets x={12} />
        <Sprockets x={274} />
        <Words k="roll" x={42} y={16} w={216} size={8} font={fonts.bold} color="#fff" align="center" spacing={0.8} />
        <Slot i={0} x={42} y={38} w={216} h={108} r={0} />
        <Slot i={1} x={42} y={155} w={216} h={108} r={0} />
        <Slot i={2} x={42} y={272} w={216} h={108} r={0} />
        <Slot i={3} x={42} y={389} w={216} h={108} r={0} />
        <Words k="footer" x={42} y={508} w={216} size={8} font={fonts.bold} color="#fff" align="center" spacing={0.8} />
      </Paper>
    ),
  },
  {
    id: 'magazine-cover',
    name: 'Magazine Cover',
    height: 375,
    slots: 1,
    texts: { title: 'MEMORIES', issue: 'The summer issue', vol: 'VOL. 01 — 2026' },
    Body: () => (
      <Paper color="#000">
        <Slot i={0} x={0} y={0} w={W} h={375} r={0} />
        <Words k="title" x={0} y={20} w={W} size={30} font={fonts.bold} color="#fff" align="center" spacing={2} shadow />
        <Words k="issue" x={0} y={318} w={W} size={15} font={fonts.serifItalic} color="#fff" align="center" shadow />
        <Words k="vol" x={0} y={344} w={W} size={8} font={fonts.bold} color="#fff" align="center" spacing={0.6} shadow />
      </Paper>
    ),
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    height: 300,
    slots: 5,
    texts: {},
    Body: () => (
      <Paper color="#fff">
        <Slot i={0} x={12} y={12} w={165} h={165} />
        <Slot i={1} x={183} y={12} w={105} h={79} />
        <Slot i={2} x={183} y={97} w={105} h={80} />
        <Slot i={3} x={12} y={183} w={105} h={105} />
        <Slot i={4} x={123} y={183} w={165} h={105} />
      </Paper>
    ),
  },
  {
    id: 'then-now',
    name: 'Then & Now',
    height: 300,
    slots: 2,
    texts: { caption: 'then & now' },
    Body: () => (
      <Paper color="#F4F0E6">
        <Slot i={0} x={12} y={12} w={135} h={240} />
        <Slot i={1} x={153} y={12} w={135} h={240} />
        <Words k="caption" x={12} y={265} w={276} size={14} font={fonts.serifItalic} align="center" />
      </Paper>
    ),
  },
  {
    id: 'story-trio',
    name: 'Story Trio',
    height: 533,
    slots: 3,
    texts: { title: 'Day one' },
    Body: () => (
      <Paper color="#F5F3EB">
        <Slot i={0} x={0} y={0} w={W} h={175} r={0} />
        <Slot i={1} x={0} y={179} w={W} h={175} r={0} />
        <Slot i={2} x={0} y={358} w={W} h={175} r={0} />
        <Words k="title" x={18} y={128} w={264} size={26} font={fonts.serif} color="#fff" shadow />
      </Paper>
    ),
  },
  {
    id: 'scrapbook',
    name: 'Scrapbook',
    height: 300,
    slots: 4,
    texts: { title: 'our little adventures' },
    Body: () => (
      <Paper color="#F6F2E8">
        <Words k="title" x={0} y={12} w={W} size={17} font={fonts.serif} align="center" />
        <Print i={0} x={22} y={52} size={112} rotate={-5} pad={4} bottom={4} tape />
        <Print i={1} x={160} y={46} size={112} rotate={4} pad={4} bottom={4} tape />
        <Print i={2} x={26} y={172} size={112} rotate={3} pad={4} bottom={4} tape />
        <Print i={3} x={158} y={170} size={112} rotate={-4} pad={4} bottom={4} tape />
      </Paper>
    ),
  },
  {
    id: 'year-in-photos',
    name: 'Year in Photos',
    height: 375,
    slots: 9,
    texts: { year: '2026', sub: 'a year in photos' },
    Body: () => (
      <Paper color="#141414">
        <Words k="year" x={0} y={12} w={W} size={28} font={fonts.bold} color="#fff" align="center" />
        <Words k="sub" x={0} y={50} w={W} size={11} color="#E8E4D8" align="center" />
        {Array.from({ length: 9 }, (_, i) => (
          <Slot key={i} i={i} x={12 + (i % 3) * 94} y={75 + Math.floor(i / 3) * 94} w={88} h={88} />
        ))}
      </Paper>
    ),
  },
];

/** Film sprocket holes down one edge. */
function Sprockets({ x }: { x: number }) {
  const { u } = useContext(C);
  return (
    <>
      {Array.from({ length: 27 }, (_, n) => (
        <View
          key={n}
          style={{
            position: 'absolute',
            left: x * u,
            top: (10 + n * 19.2) * u,
            width: 14 * u,
            height: 9 * u,
            borderRadius: 2.5 * u,
            backgroundColor: '#F2F2F2',
          }}
        />
      ))}
    </>
  );
}

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** Draws a template at `width` points. Pass the handlers only in the editor. */
export function TemplateCanvas({
  template,
  width,
  photos = [],
  texts,
  onSlot,
  onText,
  editing = false,
  onImageLoad,
}: {
  template: Template;
  width: number;
  photos?: Photos;
  texts?: Texts;
  onSlot?: Ctx['onSlot'];
  onText?: Ctx['onText'];
  editing?: boolean;
  onImageLoad?: () => void;
}) {
  const u = width / W;
  const { Body } = template;
  return (
    <C.Provider value={{ u, photos, texts: texts ?? template.texts, onSlot, onText, editing, onImageLoad }}>
      <View style={{ width, height: template.height * u, overflow: 'hidden' }} collapsable={false}>
        <Body />
      </View>
    </C.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
