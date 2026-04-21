import { z } from 'zod';

export const AssetSourceSchema = z.object({
  scheme: z.enum(['file', 'url', 's3', 'gs', 'data']),
  uri: z.string().min(1),
});
export type AssetSource = z.infer<typeof AssetSourceSchema>;

const AssetBaseShape = {
  id: z.string().min(1),
  source: AssetSourceSchema,
  hash: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
};

export const ImageAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('image'),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;

export const VideoAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('video'),
  hasAudio: z.boolean().optional(),
});
export type VideoAsset = z.infer<typeof VideoAssetSchema>;

export const AudioAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('audio'),
  durationMs: z.number().nonnegative(),
});
export type AudioAsset = z.infer<typeof AudioAssetSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  fontStyle: z.enum(['normal', 'italic']).optional(),
  color: z.string().optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  shadow: z
    .object({
      color: z.string(),
      offsetX: z.number(),
      offsetY: z.number(),
      blur: z.number().nonnegative(),
    })
    .optional(),
  stroke: z
    .object({
      color: z.string(),
      width: z.number().positive(),
    })
    .optional(),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('text'),
  text: z.string(),
  style: TextStyleSchema.optional(),
});
export type TextAsset = z.infer<typeof TextAssetSchema>;

export const FontAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('font'),
  family: z.string().min(1),
  weight: z.number().optional(),
  style: z.enum(['normal', 'italic']).optional(),
});
export type FontAsset = z.infer<typeof FontAssetSchema>;

export const ShaderAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('shader'),
  frag: z.string().min(1),
  vert: z.string().optional(),
});
export type ShaderAsset = z.infer<typeof ShaderAssetSchema>;

export const LottieAssetSchema = z.object({
  ...AssetBaseShape,
  kind: z.literal('lottie'),
  json: z.unknown(),
});
export type LottieAsset = z.infer<typeof LottieAssetSchema>;

export const AssetSchema = z.discriminatedUnion('kind', [
  ImageAssetSchema,
  VideoAssetSchema,
  AudioAssetSchema,
  TextAssetSchema,
  FontAssetSchema,
  ShaderAssetSchema,
  LottieAssetSchema,
]);
export type Asset = z.infer<typeof AssetSchema>;
