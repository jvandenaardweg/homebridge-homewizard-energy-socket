import { z } from 'zod';
import isIP from 'validator/lib/isIP';
import { PlatformConfig } from 'homebridge';

export const DEFAULT_OUTLETINUSE_ISACTIVE = false;

export const DEFAULT_OUTLETINUSE_THRESHOLD = 5;
export const DEFAULT_OUTLETINUSE_THRESHOLD_MIN = 0.1;
export const DEFAULT_OUTLETINUSE_THRESHOLD_MAX = 3680;

export const DEFAULT_OUTLETINUSE_THRESHOLD_DURATION = 10;
export const DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MIN = 0;
export const DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MAX = 86400;

// validate the config schema from config.schema.json
export const configSchema = z.object({
  name: z.string(),
  energySockets: z.array(
    z.object({
      ip: z
        .string({
          required_error: 'IP address is required for each Energy Socket',
        })
        .refine(
          ip => isIP(ip, 4),
          ip => ({
            message: `${ip} is not a valid IPv4 address`,
          }),
        ),
      name: z.string({
        required_error: 'Name is required for each Energy Socket',
      }),
      outletInUse: z
        .object({
          isActive: z.boolean().optional(),
          threshold: z
            .number()
            .min(DEFAULT_OUTLETINUSE_THRESHOLD_MIN)
            .max(DEFAULT_OUTLETINUSE_THRESHOLD_MAX)
            .optional(), // set as optional, because it is only required when outletInUse.isActive is true. We'll use superRefine to validate this
          thresholdDuration: z
            .number()
            .min(DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MIN)
            .max(DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MAX)
            .optional(), // set as optional, because it is only required when outletInUse.isActive is true. We'll use superRefine to validate this
        })

        .superRefine((schema, ctx) => {
          const isActive = schema?.isActive;
          const threshold = schema?.threshold;
          const thresholdDuration = schema?.thresholdDuration;

          // If isActive is true, threshold and thresholdDuration are required
          if (isActive) {
            if (!threshold) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['threshold'],
                message: 'A threshold is required when outletInUse.isActive is true',
              });
            }

            if (!thresholdDuration) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['thresholdDuration'],
                message: 'A thresholdDuration is required when outletInUse.isActive is true',
              });
            }
          }

          return z.NEVER;
        }),
    }),
  ),
});

export type ConfigSchema = z.infer<typeof configSchema> & PlatformConfig;
