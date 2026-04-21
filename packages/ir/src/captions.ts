import { z } from 'zod';

/**
 * Caption data model — intentionally matches Remotion's @remotion/captions
 * so tooling from that ecosystem can be reused directly.
 */
export const CaptionSchema = z
  .object({
    text: z.string(),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    timestampMs: z.number().nullable(),
    confidence: z.number().nullable(),
  })
  .refine((c) => c.endMs >= c.startMs, {
    message: 'Caption.endMs must be >= startMs',
  });
export type Caption = z.infer<typeof CaptionSchema>;

export const CaptionStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  color: z.string().optional(),
  highlightColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().nonnegative().optional(),
  maxCharactersPerLine: z.number().int().positive().optional(),
  position: z.enum(['top', 'center', 'bottom']).optional(),
});
export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;

export const CaptionGroupingSchema = z.enum(['tiktok', 'sentence', 'none']);
export type CaptionGrouping = z.infer<typeof CaptionGroupingSchema>;

export const CaptionTrackSchema = z.object({
  id: z.string().min(1),
  language: z.string().min(1),
  captions: z.array(CaptionSchema),
  style: CaptionStyleSchema.optional(),
  groupingStrategy: CaptionGroupingSchema.optional(),
});
export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;
