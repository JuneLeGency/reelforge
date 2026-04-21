import { z } from 'zod';

export const AnchorSchema = z.enum([
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);
export type Anchor = z.infer<typeof AnchorSchema>;

export const AbsolutePositionSchema = z.object({
  mode: z.literal('absolute'),
  x: z.number(),
  y: z.number(),
});

export const RelativePositionSchema = z.object({
  mode: z.literal('relative'),
  x: z.number(),
  y: z.number(),
});

export const AnchorPositionSchema = z.object({
  mode: z.literal('anchor'),
  anchor: AnchorSchema,
  offset: z.tuple([z.number(), z.number()]).optional(),
});

export const PositionSchema = z.discriminatedUnion('mode', [
  AbsolutePositionSchema,
  RelativePositionSchema,
  AnchorPositionSchema,
]);
export type Position = z.infer<typeof PositionSchema>;

export const TransformSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  scaleX: z.number().optional(),
  scaleY: z.number().optional(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  anchor: z.tuple([z.number(), z.number()]).optional(),
});
export type Transform = z.infer<typeof TransformSchema>;
