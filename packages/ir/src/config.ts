import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  duration: z.number().nonnegative().optional(),
  background: z.string().optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
