import type { CourtPhase, CourtJurisdiction } from '@prisma/client';

export type CourtAction = 'SUBMIT_EVIDENCE' | 'RAISE_OBJECTION' | 'SEND_MESSAGE';

export class PhaseManager {
  private static TRANSITIONS: Record<CourtPhase, CourtPhase | null> = {
    OPENING: 'EVIDENCE',
    EVIDENCE: 'DEBATE',
    DEBATE: 'CLOSING',
    CLOSING: 'VERDICT',
    VERDICT: null,
  };

  canTransition(currentPhase: CourtPhase): boolean {
    return PhaseManager.TRANSITIONS[currentPhase] !== null;
  }

  transition(currentPhase: CourtPhase): CourtPhase {
    const next = PhaseManager.TRANSITIONS[currentPhase];
    if (next === null) {
      throw new Error(`Cannot transition from ${currentPhase}: it is a terminal phase`);
    }
    return next;
  }

  getPhaseRules(phase: CourtPhase, jurisdiction: CourtJurisdiction): string {
    const rules = PHASE_RULES[phase];
    if (!rules) {
      return '';
    }
    return rules[jurisdiction] ?? rules.DEFAULT ?? '';
  }

  isActionAllowed(phase: CourtPhase, action: CourtAction): boolean {
    if (phase === 'VERDICT') {
      return false;
    }
    if (action === 'SUBMIT_EVIDENCE') {
      return phase === 'EVIDENCE';
    }
    // RAISE_OBJECTION and SEND_MESSAGE allowed in all phases except VERDICT
    return true;
  }
}

// Phase rules keyed by phase, then by jurisdiction
const PHASE_RULES: Record<CourtPhase, Record<string, string>> = {
  OPENING: {
    CHINA:
      '开庭陈述阶段：根据《民事诉讼法》，审判长宣布开庭，核对当事人身份，告知诉讼权利义务。原告陈述诉讼请求及事实理由，被告进行答辩。',
    THAILAND:
      'Opening Statement Phase: Under the Civil Procedure Code, the judge opens the session, verifies parties, and outlines rights. The plaintiff presents claims and facts, followed by the defendant\'s response.',
    ARBITRATION:
      'Opening Statement Phase: The arbitrator opens proceedings per applicable arbitration rules (e.g. CIETAC/TAI). Each party presents an overview of their case and key claims.',
  },
  EVIDENCE: {
    CHINA:
      '举证质证阶段：根据《民事诉讼法》及《最高人民法院关于民事诉讼证据的若干规定》，当事人依次提交证据，对方进行质证（真实性、合法性、关联性），法庭对证据采纳作出裁定。',
    THAILAND:
      'Evidence Phase: Under the Civil Procedure Code and Evidence Act, parties submit evidence in turn. The opposing party may challenge authenticity, legality, and relevance. The court rules on admissibility.',
    ARBITRATION:
      'Evidence Phase: Parties present documentary and witness evidence per arbitration rules. The opposing party cross-examines. The tribunal determines admissibility and weight of evidence.',
  },
  DEBATE: {
    CHINA:
      '法庭辩论阶段：根据《民事诉讼法》，双方围绕争议焦点进行辩论，引用法律条文和证据支持各自主张。审判长维持辩论秩序，必要时进行引导。',
    THAILAND:
      'Debate Phase: Under the Civil Procedure Code, parties argue their positions on disputed issues, citing legal provisions and evidence. The judge maintains order and may intervene as needed.',
    ARBITRATION:
      'Debate Phase: Parties present legal arguments on disputed issues, referencing applicable laws and arbitration precedents. The tribunal may ask clarifying questions.',
  },
  CLOSING: {
    CHINA:
      '最后陈述阶段：根据《民事诉讼法》，审判长宣布辩论终结，双方依次进行最后陈述，总结各自立场和请求。',
    THAILAND:
      'Closing Statement Phase: The judge concludes the debate. Each party delivers a final statement summarizing their position, key evidence, and legal basis for their claims.',
    ARBITRATION:
      'Closing Statement Phase: The tribunal invites final statements. Each party summarizes arguments, evidence, and requested relief.',
  },
  VERDICT: {
    CHINA:
      '判决阶段：审判长根据庭审情况、证据和法律规定，宣布判决结果及判决理由。',
    THAILAND:
      'Verdict Phase: The judge delivers the verdict based on the proceedings, evidence, and applicable law, including reasoning for the decision.',
    ARBITRATION:
      'Award Phase: The tribunal renders its award based on the merits, evidence, and applicable rules, with reasons for the decision.',
  },
};
