import type { QuestionAnalysisResult, ZhihuContext } from './types'

export const samples = [
  'AI 会取代程序员吗？',
  '年轻人为什么越来越不想结婚？',
  '学历还重要吗？',
  '35 岁危机到底有没有解？',
  '独立开发者还能赚钱吗？',
  '普通人还有必要学习编程吗？',
]

export function createMockZhihuContext(question: string): ZhihuContext {
  return {
    enabled: true,
    provider: 'mock',
    api_status: '本地演示数据。配置 ZHIHU_API_KEY 后会使用真实知乎搜索。',
    summary: `围绕“${question}”生成离线知乎语境，用于演示分阶段展示。`,
    direct_answer_provider: 'mock',
    direct_answer:
      '这是一个可以回答、但容易泛化的问题。直接回答通常会落到“取决于能力结构、行业阶段和个人定位”这类条件化结论，因此更适合先限定时间、岗位层级和具体工作环节。',
    similar_questions: [
      {
        title: `知乎里已有接近“${question}”的泛讨论`,
        url: '',
        heat: '离线估计：中',
        answer_count: 0,
        comment_count: 0,
        author: '问山',
        summary: '原问法容易引发立场争论，需要限定对象和判断标准。',
        source: 'mock',
        overlap_reason: '主题相关，但问法偏宽。',
      },
    ],
    global_references: [],
    existing_angles: ['泛泛判断趋势。', '用个人经历表达赞成或反对。'],
    avoid_angles: ['避免二元问法。', '避免没有时间尺度。', '避免群体范围过大。'],
    new_angles: ['限定人群、场景和时间范围。', '追问经验边界和反例条件。'],
    community_signals: [
      {
        name: '知乎适配度',
        value: '离线估计',
        interpretation: '真实接口可用时会用站内搜索结果替换。',
      },
    ],
  }
}

export function createMockAnalysis(question: string, context?: ZhihuContext): QuestionAnalysisResult {
  const zhihuContext = context ?? {
    enabled: false,
    provider: 'disabled',
    summary: '',
    api_status: '',
    direct_answer: '',
    direct_answer_provider: '',
    similar_questions: [],
    global_references: [],
    existing_angles: [],
    avoid_angles: [],
    new_angles: [],
    community_signals: [],
  }

  return {
    original_question: question,
    diagnosis: {
      summary: '这个问题可以讨论，但目前概念偏宽、对象不清、判断标准不足，容易变成观点站队。',
      problem_types: ['概念模糊', '范围过大', '缺少时间尺度', '判断标准不明'],
      severity: 'high',
      conclusion: '先拆定义，再谈结论，讨论质量会明显提高。',
    },
    unclear_points: [
      {
        title: '核心概念没有定义',
        explanation: '不同人会按不同含义理解关键词。',
        clarification: '先说明讨论的是能力、趋势、收益还是具体选择。',
      },
      {
        title: '对象范围过大',
        explanation: '不同人群、行业、阶段的情况不一样。',
        clarification: '限定到具体角色、年龄、城市、岗位或场景。',
      },
      {
        title: '缺少时间尺度',
        explanation: '短期经验和长期趋势会导向不同回答。',
        clarification: '明确讨论未来 1 年、3 年还是 10 年。',
      },
      {
        title: '缺少可验证标准',
        explanation: '没有指标时，回答容易变成立场表达。',
        clarification: '加入可观察指标，例如收入、机会、效率、满意度。',
      },
    ],
    hidden_assumptions: [
      {
        assumption: '默认问题只有一个答案',
        why_it_matters: '复杂议题往往取决于条件组合。',
        challenge: '把问题拆成不同情境下的判断。',
      },
      {
        assumption: '默认群体内部差异不重要',
        why_it_matters: '群体差异会影响结论。',
        challenge: '区分新手、熟练者、专家和转型者。',
      },
      {
        assumption: '默认当前趋势会线性延续',
        why_it_matters: '技术、政策和市场都可能改变趋势。',
        challenge: '追问哪些条件会让结论反转。',
      },
      {
        assumption: '默认讨论目标是得出结论',
        why_it_matters: '知乎更适合展示经验边界和多角度分析。',
        challenge: '把结论问题改成经验和机制问题。',
      },
    ],
    rewritten_questions: [
      {
        type: '事实判断型',
        title: `未来 3 年内，${question} 的关键判断标准是什么？`,
        question: `如果把“${question}”限定在未来 3 年和具体场景里，哪些指标最能判断这个问题？`,
        why_better: '加入时间范围和判断指标，减少空泛争论。',
        community_evidence: '更适合知乎用户补充数据、案例和反例。',
        scores: { clarity: 88, answerability: 86, discussion_potential: 82, zhihu_fit: 90, cognitive_gain: 84 },
      },
      {
        type: '经验分享型',
        title: `亲历者如何看待：${question}`,
        question: `有相关经历的人，在哪些具体场景里感受到“${question}”成立或不成立？`,
        why_better: '引导真实经验，而不是抽象站队。',
        community_evidence: '适合知乎经验型回答。',
        scores: { clarity: 84, answerability: 88, discussion_potential: 89, zhihu_fit: 91, cognitive_gain: 82 },
      },
      {
        type: '反常识型',
        title: `${question} 的反例是什么？`,
        question: `在哪些情况下，关于“${question}”的常见判断反而可能失效？`,
        why_better: '用反例检验泛化结论。',
        community_evidence: '能减少重复观点，增加讨论增量。',
        scores: { clarity: 83, answerability: 82, discussion_potential: 90, zhihu_fit: 87, cognitive_gain: 88 },
      },
      {
        type: '深度讨论型',
        title: `${question} 背后真正变化的机制是什么？`,
        question: `如果不急着下结论，${question} 背后有哪些结构性因素在变化？`,
        why_better: '从结论转向机制，讨论更深。',
        community_evidence: '适合长回答和多角度分析。',
        scores: { clarity: 80, answerability: 79, discussion_potential: 92, zhihu_fit: 88, cognitive_gain: 90 },
      },
      {
        type: '职业策略型',
        title: `普通人面对“${question}”应该怎么调整策略？`,
        question: `在资源有限的情况下，普通人如何根据“${question}”调整接下来 1-3 年的行动策略？`,
        why_better: '从抽象趋势落到行动选择。',
        community_evidence: '更容易获得可操作回答。',
        scores: { clarity: 86, answerability: 87, discussion_potential: 84, zhihu_fit: 89, cognitive_gain: 83 },
      },
    ],
    publish_draft: {
      title: '问山：先让问题变好，再让答案出现',
      content:
        '我做了一个 AI 好问题生成器。它不会急着回答问题，而是先检查问题有没有问清楚：概念是否模糊、范围是否过大、有没有隐藏前提、在知乎里是否已有重复讨论。然后它会把一个模糊问题重构成多个更具体、更值得被回答的问题。',
      tags: ['问山', '知乎黑客松', 'AI 提问器'],
    },
    meta: {
      provider: 'mock',
      generated_at: new Date().toISOString(),
    },
    zhihu_context: zhihuContext,
  }
}
