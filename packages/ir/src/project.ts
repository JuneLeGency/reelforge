import { z } from 'zod';
import { ProjectConfigSchema } from './config';
import { AssetSchema } from './assets';
import { TimelineSchema } from './timeline';
import { CaptionTrackSchema } from './captions';
import { EffectSpecSchema, TransitionSpecSchema } from './effects';

export const ProjectMetaSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  author: z.string().optional(),
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;

export const IR_VERSION = '1' as const;

export const VideoProjectSchema = z.object({
  version: z.literal(IR_VERSION),
  config: ProjectConfigSchema,
  assets: z.record(z.string().min(1), AssetSchema),
  timeline: TimelineSchema,
  captions: z.array(CaptionTrackSchema).optional(),
  effectsLibrary: z.record(z.string().min(1), EffectSpecSchema).optional(),
  transitionsLibrary: z.record(z.string().min(1), TransitionSpecSchema).optional(),
  meta: ProjectMetaSchema.optional(),
});

export type VideoProject = z.infer<typeof VideoProjectSchema>;
