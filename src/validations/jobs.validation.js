import { z } from 'zod';

export const jobDataSchema = z.object({
  type: z.string().min(1, 'Job type is required'),
  data: z.any(), // Will be validated by type-specific schemas
  options: z
    .object({
      maxAttempts: z.number().int().positive().optional(),
      timeout: z.number().int().positive().optional(),
      priority: z.number().int().nonnegative().optional(),
    })
    .optional()
    .default({}),
});

export const emailJobDataSchema = z
  .object({
    to: z.union([
      z.string().email('Invalid email address'),
      z
        .array(z.string().email('Invalid email address'))
        .min(1, 'At least one email address is required'),
    ]),
    subject: z.string().min(1, 'Subject is required'),
    html: z.string().optional(),
    text: z.string().optional(),
  })
  .refine(data => data.html || data.text, {
    message: 'Either html or text must be provided',
  });

export const jobIdSchema = z.object({
  id: z.string(),
});

// Query parameters schema for bullmq dashboard listing job data
export const listJobsQuerySchema = z.object({
  status: z
    .enum([
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
      'prioritized',
      'waiting-children',
    ])
    .optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});
