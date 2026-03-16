import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { getVisaAdvisor } from '@/server/services/legal/visa';

const visaUserProfileSchema = z.object({
  nationality: z.string().min(1),
  purpose: z.string().min(1),
  duration: z.string().optional(),
  occupation: z.string().optional(),
  age: z.number().int().min(0).max(150).optional(),
  financialStatus: z.string().optional(),
  currentLocation: z.string().optional(),
});

const visaInfoSchema = z.object({
  visaType: z.string().min(1),
  expiryDate: z.string().optional(),
  entryType: z.string().optional(),
});

export const visaRouter = createTRPCRouter({
  recommend: protectedProcedure
    .input(z.object({ userProfile: visaUserProfileSchema }))
    .query(async ({ input }) => {
      const advisor = getVisaAdvisor();
      const recommendations = await advisor.recommend(input.userProfile);
      return { recommendations };
    }),

  getRenewalInfo: protectedProcedure
    .input(z.object({ currentVisa: visaInfoSchema }))
    .query(async ({ input }) => {
      const advisor = getVisaAdvisor();
      const renewalInfo = await advisor.getRenewalInfo(input.currentVisa);
      return renewalInfo;
    }),

  getConversionPaths: protectedProcedure
    .input(
      z.object({
        currentVisa: visaInfoSchema,
        targetType: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const advisor = getVisaAdvisor();
      const paths = await advisor.getConversionPaths(input.currentVisa, input.targetType);
      return { paths };
    }),
});
