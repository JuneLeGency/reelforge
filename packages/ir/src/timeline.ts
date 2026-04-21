import { z } from 'zod';
import { PositionSchema, TransformSchema } from './positions';
import { EffectRefSchema, TransitionRefSchema } from './effects';

export const ClipSchema = z.object({
  id: z.string().min(1),
  assetRef: z.string().min(1),
  startMs: z.number().nonnegative(),
  durationMs: z.number().positive(),
  sourceStartMs: z.number().nonnegative().optional(),
  z: z.number().int().optional(),
  transform: TransformSchema.optional(),
  position: PositionSchema.optional(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  effects: z.array(EffectRefSchema).optional(),
  volume: z.number().min(0).optional(),
  transitionIn: TransitionRefSchema.optional(),
  transitionOut: TransitionRefSchema.optional(),
});
export type Clip = z.infer<typeof ClipSchema>;

export const TrackKindSchema = z.enum(['video', 'audio', 'caption', 'overlay']);
export type TrackKind = z.infer<typeof TrackKindSchema>;

export const TrackSchema = z.object({
  id: z.string().min(1),
  kind: TrackKindSchema,
  clips: z.array(ClipSchema),
});
export type Track = z.infer<typeof TrackSchema>;

export const TimelineSchema = z.object({
  tracks: z.array(TrackSchema).min(1),
});
export type Timeline = z.infer<typeof TimelineSchema>;
