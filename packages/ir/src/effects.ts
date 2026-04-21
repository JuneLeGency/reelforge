import { z } from 'zod';

export const EffectSpecSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
  glsl: z.string().optional(),
  css: z.string().optional(),
});
export type EffectSpec = z.infer<typeof EffectSpecSchema>;

export const EffectRefSchema = z.union([z.string().min(1), EffectSpecSchema]);
export type EffectRef = z.infer<typeof EffectRefSchema>;

export const TransitionSpecSchema = z.object({
  name: z.string().min(1),
  durationMs: z.number().positive(),
  params: z.record(z.string(), z.unknown()).optional(),
  easing: z.string().optional(),
});
export type TransitionSpec = z.infer<typeof TransitionSpecSchema>;

export const TransitionRefSchema = z.union([z.string().min(1), TransitionSpecSchema]);
export type TransitionRef = z.infer<typeof TransitionRefSchema>;
