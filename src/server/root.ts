import { createCallerFactory, createTRPCRouter } from './trpc';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { consultationRouter } from './routers/consultation';
import { contractRouter } from './routers/contract';
import { caseRouter } from './routers/case';
import { evidenceRouter } from './routers/evidence';
import { caseSearchRouter } from './routers/caseSearch';
import { visaRouter } from './routers/visa';
import { reportRouter } from './routers/report';
import { subscriptionRouter } from './routers/subscription';
import { paymentRouter } from './routers/payment';
import { sessionRouter } from './routers/session';
import { adminRouter } from './routers/admin';
import {
  conversationRouter,
  riskRouter,
  enhancedContractRouter,
  documentRouter,
  qaRouter,
  personalizationRouter,
  qualityRouter,
} from './routers/ai';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  user: userRouter,
  consultation: consultationRouter,
  contract: contractRouter,
  case: caseRouter,
  evidence: evidenceRouter,
  caseSearch: caseSearchRouter,
  visa: visaRouter,
  report: reportRouter,
  subscription: subscriptionRouter,
  payment: paymentRouter,
  session: sessionRouter,
  admin: adminRouter,
  // AI module routers
  conversation: conversationRouter,
  risk: riskRouter,
  enhancedContract: enhancedContractRouter,
  document: documentRouter,
  qa: qaRouter,
  personalization: personalizationRouter,
  quality: qualityRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
