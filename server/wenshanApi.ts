import { createHmac, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createMockAnalysis, createMockZhihuContext } from './mockData'
import type { QuestionAnalysisResult, SimilarQuestion, ZhihuContext } from './apiTypes'

type Env = Record<string, string>

const dataBaseUrl = 'https://developer.zhihu.com'
const communityBaseUrl = 'https://openapi.zhihu.com'
const defaultRingId = '2029619126742656657'

export async function handleWenshanApi(
  req: IncomingMessage,
  res: ServerResponse,
  env: Env,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method === 'POST' && url.pathname === '/api/zhihu-context') {
    const body = await readJson(req)
    const context = await buildZhihuContext(String(body.question ?? ''), env)
    sendJson(res, context)
    return true
  }
  if (req.method === 'POST' && url.pathname === '/api/analyze-core') {
    const body = await readJson(req)
    const question = String(body.question ?? '').trim()
    const context = body.zhihuContext as ZhihuContext | undefined
    const result = await analyzeQuestion(question, context, env)
    sendJson(res, result)
    return true
  }
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    const body = await readJson(req)
    const question = String(body.question ?? '').trim()
    const zhihuEnabled = Boolean(body.zhihuEnabled)
    const context = zhihuEnabled ? await buildZhihuContext(question, env) : undefined
    const result = await analyzeQuestion(question, context, env)
    sendJson(res, result)
    return true
  }
  if (req.method === 'POST' && url.pathname === '/api/publish') {
    const body = await readJson(req)
    const payload = await publishPin(String(body.title ?? ''), String(body.content ?? ''), env)
    sendJson(res, payload)
    return true
  }
  return false
}

async function buildZhihuContext(question: string, env: Env): Promise<ZhihuContext> {
  if (!env.ZHIHU_API_KEY) {
    return createMockZhihuContext(question)
  }

  const errors: string[] = []
  const zhihuItems = await safeList(() => zhihuSearch(question, env), errors, '知乎搜索')
  const globalItems = await safeList(() => globalSearch(question, env), errors, '全网搜索')
  const directAnswer = await generateDirectAnswer(question, zhihuItems, env)
  const similar = zhihuItems.slice(0, 6).map((item) => toSimilarQuestion(item, 'zhihu_search'))
  const globalRefs = globalItems.slice(0, 4).map((item) => toSimilarQuestion(item, 'global_search'))

  return {
    enabled: true,
    provider: errors.length ? 'zhihu-openapi-partial' : 'zhihu-openapi',
    api_status: errors.length ? `部分接口失败：${errors.slice(0, 3).join('；')}` : '真实知乎接口已接入',
    summary: `围绕“${question}”已检索知乎站内 ${similar.length} 条、全网参考 ${globalRefs.length} 条，并生成直答测试内容。`,
    direct_answer: directAnswer.content,
    direct_answer_provider: directAnswer.provider,
    similar_questions: similar,
    global_references: globalRefs,
    existing_angles: similar.length
      ? ['站内已有相关问答，可先避开泛泛重复问法。', '已有回答摘要可帮助判断讨论是否还有新空间。']
      : ['未获取到足够站内讨论，优先补足问题定义和讨论边界。'],
    avoid_angles: [
      '避免只问“会不会”“是不是”“有没有必要”。',
      '避免把复杂群体压成单一标签。',
      '避免没有时间尺度、对象范围和判断标准。',
    ],
    new_angles: [
      `把“${question}”限定到具体人群、场景和时间范围。`,
      '利用站内相似问题摘要，追问已有回答没有覆盖的反例或条件。',
      '用全网参考补充外部证据，再转成适合知乎讨论的问题。',
    ],
    community_signals: [
      { name: '知乎搜索', value: `${similar.length} 条`, interpretation: '用于判断重复度与已有讨论角度。' },
      { name: '全网搜索', value: `${globalRefs.length} 条`, interpretation: '用于补充外部背景和可验证材料。' },
      { name: '直答测试', value: directAnswer.provider, interpretation: '用于观察原问题会得到怎样的直接回答。' },
    ],
  }
}

async function analyzeQuestion(
  question: string,
  zhihuContext: ZhihuContext | undefined,
  env: Env,
): Promise<QuestionAnalysisResult> {
  if (!question) {
    return createMockAnalysis('未输入问题', zhihuContext)
  }
  if (!env.DEEPSEEK_API_KEY) {
    return createMockAnalysis(question, zhihuContext)
  }

  try {
    const payload = await callDeepSeekJson(question, zhihuContext, env)
    return normalizeAnalysis(payload, question, zhihuContext)
  } catch {
    return createMockAnalysis(question, zhihuContext)
  }
}

async function zhihuSearch(query: string, env: Env): Promise<Record<string, unknown>[]> {
  return zhihuDataGet('/api/v1/content/zhihu_search', { Query: query, Count: 10 }, env)
}

async function globalSearch(query: string, env: Env): Promise<Record<string, unknown>[]> {
  return zhihuDataGet('/api/v1/content/global_search', { Query: query, Count: 10 }, env)
}

async function zhihuDataGet(
  path: string,
  params: Record<string, string | number>,
  env: Env,
): Promise<Record<string, unknown>[]> {
  const url = new URL(path, env.ZHIHU_DATA_BASE_URL || dataBaseUrl)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.ZHIHU_API_KEY}`,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as Record<string, unknown>
  if ((data.Code ?? 0) !== 0) throw new Error(String(data.Message || '知乎接口失败'))
  return extractItems(data)
}

async function generateDirectAnswer(
  question: string,
  references: Record<string, unknown>[],
  env: Env,
): Promise<{ provider: string; content: string }> {
  const apiKey = env.ZHIHU_AGENT_API_KEY || env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { provider: 'mock', content: createMockZhihuContext(question).direct_answer }
  }
  const context = references
    .slice(0, 5)
    .map((item) => `- ${pickText(item, ['Title', 'title'])}：${pickText(item, ['ContentText', 'summary', 'excerpt'])}`)
    .join('\n')
  const content = await callChat(
    [
      { role: 'system', content: '你是知乎直答 Agent。请直接回答用户问题，中文，克制、有依据，避免编造。不要输出 JSON。' },
      { role: 'user', content: `问题：${question}\n\n可参考的知乎搜索摘要：\n${context}\n\n请直接回答这个问题。` },
    ],
    env,
    Boolean(env.ZHIHU_AGENT_API_KEY),
  )
  return { provider: env.ZHIHU_AGENT_API_KEY ? 'zhihu-agent' : 'deepseek', content: content || '直答 Agent 空返回。' }
}

async function callDeepSeekJson(
  question: string,
  zhihuContext: ZhihuContext | undefined,
  env: Env,
): Promise<Record<string, unknown>> {
  const userPrompt = buildUserPrompt(question, zhihuContext)
  const content = await callChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    env,
    false,
    true,
  )
  return robustJsonParse(content)
}

async function callChat(
  messages: { role: 'system' | 'user'; content: string }[],
  env: Env,
  useAgent: boolean,
  jsonMode = false,
): Promise<string> {
  const apiKey = useAgent ? env.ZHIHU_AGENT_API_KEY || env.DEEPSEEK_API_KEY : env.DEEPSEEK_API_KEY
  const baseUrl = useAgent ? env.ZHIHU_AGENT_BASE_URL || env.DEEPSEEK_BASE_URL : env.DEEPSEEK_BASE_URL
  const model = useAgent ? env.ZHIHU_AGENT_MODEL || env.DEEPSEEK_MODEL : env.DEEPSEEK_MODEL
  const response = await fetch(`${baseUrl || 'https://api.deepseek.com'}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'deepseek-v4-pro',
      messages,
      stream: false,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`)
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

async function publishPin(title: string, content: string, env: Env): Promise<Record<string, unknown>> {
  if (!env.ZHIHU_APP_KEY || !env.ZHIHU_APP_SECRET) {
    throw new Error('发布到圈子需要配置 ZHIHU_APP_KEY 与 ZHIHU_APP_SECRET。')
  }
  const url = new URL('/openapi/publish/pin', env.ZHIHU_COMMUNITY_BASE_URL || communityBaseUrl)
  const body = JSON.stringify({
    ring_id: env.ZHIHU_RING_ID || defaultRingId,
    title,
    content,
  })
  const response = await fetch(url, {
    method: 'POST',
    headers: communityHeaders(env),
    body,
  })
  if (!response.ok) throw new Error(`发布失败：HTTP ${response.status}`)
  return (await response.json()) as Record<string, unknown>
}

function communityHeaders(env: Env): Record<string, string> {
  const ts = String(Math.floor(Date.now() / 1000))
  const logId = `wenshan_${randomUUID()}`
  const extra = env.ZHIHU_EXTRA_INFO || ''
  const signString = `app_key:${env.ZHIHU_APP_KEY}|ts:${ts}|logid:${logId}|extra_info:${extra}`
  const sign = createHmac('sha256', env.ZHIHU_APP_SECRET).update(signString).digest('base64')
  return {
    'Content-Type': 'application/json',
    'X-App-Key': env.ZHIHU_APP_KEY,
    'X-Timestamp': ts,
    'X-Log-Id': logId,
    'X-Sign': sign,
    'X-Extra-Info': extra,
  }
}

function toSimilarQuestion(item: Record<string, unknown>, source: string): SimilarQuestion {
  const title = pickText(item, ['Title', 'title'])
  const summary = pickText(item, ['ContentText', 'summary', 'excerpt'])
  return {
    title,
    url: pickText(item, ['Url', 'url']),
    heat: pickText(item, ['RankingScore', 'AuthorityLevel', 'score']),
    answer_count: pickNumber(item, ['VoteUpCount', 'answer_count']),
    comment_count: pickNumber(item, ['CommentCount', 'comment_count']),
    author: pickText(item, ['AuthorName', 'author']),
    summary,
    source,
    overlap_reason: title.includes('会不会') || title.includes('是不是') ? '已有问法偏二元判断。' : '主题相关，可用于判断重复度。',
  }
}

function normalizeAnalysis(
  payload: Record<string, unknown>,
  question: string,
  context: ZhihuContext | undefined,
): QuestionAnalysisResult {
  const result = payload as unknown as QuestionAnalysisResult
  result.original_question ||= question
  result.zhihu_context = context ?? createMockAnalysis(question).zhihu_context
  result.meta ||= { provider: 'deepseek', generated_at: new Date().toISOString() }
  result.meta.provider = 'deepseek'
  return result
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  for (const key of ['Items', 'items', 'Data', 'data', 'Results', 'results']) {
    const value = data[key]
    if (Array.isArray(value)) return value.filter(isRecord)
    if (isRecord(value)) {
      const nested = extractItems(value)
      if (nested.length) return nested
    }
  }
  return []
}

function pickText(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return ''
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(item[key])
    if (Number.isFinite(value)) return Math.max(0, value)
  }
  return 0
}

function robustJsonParse(text: string): Record<string, unknown> {
  const raw = text.trim()
  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/)
    if (fenced) return JSON.parse(fenced[1])
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1))
    throw new Error('JSON parse failed')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, payload: unknown): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const systemPrompt = `
你不是回答问题的助手。
你的任务是帮助用户完善问题，而不是直接替用户得出答案或结论。
识别问题中的模糊概念、隐藏前提、范围缺失、二元对立、情绪化表达、预设立场和不可验证部分。
把原问题重构成更清晰、更具体、更有讨论价值的知乎问题。
输出必须是严格 JSON。只输出 JSON，不要输出 Markdown，不要输出解释。
语言必须是中文。观点要克制、清晰、有逻辑。
目标是让问题更值得回答，而不是让答案更快生成。
`.trim()

function buildUserPrompt(question: string, context?: ZhihuContext): string {
  return `
请分析并重构这个问题：${question}

知乎参考：
${context?.summary || '未启用'}
相似问题：
${context?.similar_questions.map((item) => `- ${item.title}：${item.summary}`).join('\n') || ''}
全网参考：
${context?.global_references.map((item) => `- ${item.title}：${item.summary}`).join('\n') || ''}
直答测试：
${context?.direct_answer || ''}

输出严格 JSON，字段如下：
{
  "original_question": "string",
  "diagnosis": {"summary": "string", "problem_types": ["string"], "severity": "low | medium | high", "conclusion": "string"},
  "unclear_points": [{"title": "string", "explanation": "string", "clarification": "string"}],
  "hidden_assumptions": [{"assumption": "string", "why_it_matters": "string", "challenge": "string"}],
  "rewritten_questions": [{
    "type": "事实判断型 | 经验分享型 | 反常识型 | 深度讨论型 | 职业策略型",
    "title": "string",
    "question": "string",
    "why_better": "string",
    "community_evidence": "string",
    "scores": {"clarity": 0, "answerability": 0, "discussion_potential": 0, "zhihu_fit": 0, "cognitive_gain": 0}
  }],
  "publish_draft": {"title": "string", "content": "string", "tags": ["string"]},
  "meta": {"provider": "deepseek", "generated_at": "string"}
}

数量要求：
- unclear_points 至少 4 条。
- hidden_assumptions 至少 4 条。
- rewritten_questions 必须正好 5 条。
- scores 必须是 0 到 100 的整数。
- publish_draft.content 适合发布到知乎圈子，150-300 字。
`.trim()
}

async function safeList(
  action: () => Promise<Record<string, unknown>[]>,
  errors: string[],
  label: string,
): Promise<Record<string, unknown>[]> {
  try {
    return await action()
  } catch (error) {
    errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
