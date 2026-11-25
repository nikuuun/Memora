import {
  Blur,
  drawAsImage,
  Group,
  ImageFormat,
  ImageShader,
  matchFont,
  Rect,
  Shader,
  Skia,
  type SkImage,
  Text,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { type Develop, DEVELOP_SKSL, developUniforms, FRAME_COLORS, layoutForLongSide, layout as makeLayout, STAMP_COLORS, stampLabel } from './look';

const EFFECT = Skia.RuntimeEffect.Make(DEVELOP_SKSL);
if (!EFFECT) console.warn('Digicam shader failed to compile');

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const SANS = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });

/**
 * A developed photo as Skia drawing commands: the look, date stamp and frame.
 * Used inside a <Canvas> for the editor preview, and with drawAsImage for the
 * saved file, so both always match.
 */
export function DevelopedPhoto({
  image,
  develop,
  takenAt,
  width,
  seed,
}: {
  image: SkImage;
  develop: Develop;
  takenAt: Date;
  width: number;
  seed: number;
}) {
  const L = makeLayout(image.width(), image.height(), develop, width);
  const { photo } = L;
  const short = Math.min(photo.width, photo.height);
  const stampSize = short * 0.05;
  const stampFont = matchFont({ fontFamily: MONO, fontSize: stampSize, fontWeight: 'bold' });
  const stampText = stampLabel(develop.stamp.style, takenAt);
  const stampW = stampFont.getTextWidth(stampText);
  const stampX = develop.stamp.pos === 'br' ? photo.x + photo.width - short * 0.06 - stampW : photo.x + short * 0.06;
  const stampY = photo.y + photo.height - short * 0.06;
  const stampColor = STAMP_COLORS[develop.stamp.color];
  const filmFont = develop.frame === 'film' ? matchFont({ fontFamily: SANS, fontSize: photo.width * 0.028, fontWeight: 'bold' }) : null;

  return (
    <Group>
      {develop.frame !== 'none' ? <Rect x={0} y={0} width={L.width} height={L.height} color={FRAME_COLORS[develop.frame]} /> : null}
      <Rect x={photo.x} y={photo.y} width={photo.width} height={photo.height}>
        {EFFECT ? (
          <Shader source={EFFECT} uniforms={developUniforms(develop, photo, seed)}>
            <ImageShader image={image} fit="cover" rect={photo} />
          </Shader>
        ) : (
          <ImageShader image={image} fit="cover" rect={photo} />
        )}
      </Rect>
      {develop.stamp.on ? (
        <Group>
          <Text x={stampX} y={stampY} text={stampText} font={stampFont} color={stampColor.glow}>
            <Blur blur={stampSize * 0.25} />
          </Text>
          <Text x={stampX} y={stampY} text={stampText} font={stampFont} color={stampColor.fill} />
        </Group>
      ) : null}
      {filmFont ? (
        <Text
          x={photo.x}
          y={photo.y + photo.height + (L.height - photo.y - photo.height) * 0.62}
          text={`MEMORA 400   ▸ ${String(seed % 36).padStart(2, '0')}A`}
          font={filmFont}
          color="#E0892E"
        />
      ) : null}
    </Group>
  );
}

/** Longest side of saved photos, in pixels. */
export const OUTPUT_LONG_SIDE = 3024;

export async function loadSkImage(uri: string) {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Couldn’t read that photo.');
  return image;
}

/** Develops a photo at full size and returns JPEG bytes. */
export async function developToJpeg(image: SkImage, develop: Develop, takenAt: Date, seed: number) {
  const L = layoutForLongSide(image.width(), image.height(), develop, OUTPUT_LONG_SIDE);
  const out = await drawAsImage(
    <DevelopedPhoto image={image} develop={develop} takenAt={takenAt} width={L.width} seed={seed} />,
    { width: L.width, height: Math.round(L.height) },
  );
  if (!out) throw new Error('Developing the photo failed.');
  return out.encodeToBytes(ImageFormat.JPEG, 92);
}
