// Types shared between wenshanApi and its mock data.
// Mirrors the subset of src/types.ts that the server needs at runtime.

export type Severity = 'low' | 'medium' | 'high'

export interface Diagnosis {
  summary: string
  problem_types: string[]
  severity: Severity
  conclusion: string
}

export interface UnclearPoint {
  title: string
  explanation: string
  clarification: string
}

export interface HiddenAssumption {
  assumption: string
  why_it_matters: string
  challenge: string
}

export interface RewriteScores {
  clarity: number
  answerability: number
  discussion_potential: number
  zhihu_fit: number
  cognitive_gain: number
}

export interface RewrittenQuestion {
  type: string
  title: string
  question: string
  why_better: string
  community_evidence?: string
  scores: RewriteScores
}

export interface PublishDraft {
  title: string
  content: string
  tags: string[]
}

export interface SimilarQuestion {
  title: string
  url: string
  heat: string
  answer_count: number
  comment_count: number
  author: string
  summary: string
  source: string
  overlap_reason: string
}

export interface CommunitySignal {
  name: string
  value: string
  interpretation: string
}

export interface ZhihuContext {
  enabled: boolean
  provider: string
  summary: string
  api_status: string
  direct_answer: string
  direct_answer_provider: string
  similar_questions: SimilarQuestion[]
  global_references: SimilarQuestion[]
  existing_angles: string[]
  avoid_angles: string[]
  new_angles: string[]
  community_signals: CommunitySignal[]
}

export interface AnalysisMeta {
  provider: string
  generated_at: string
}

export interface QuestionAnalysisResult {
  original_question: string
  diagnosis: Diagnosis
  unclear_points: UnclearPoint[]
  hidden_assumptions: HiddenAssumption[]
  rewritten_questions: RewrittenQuestion[]
  publish_draft: PublishDraft
  meta: AnalysisMeta
  zhihu_context: ZhihuContext
}
