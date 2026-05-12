<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import wenshanIcon from './assets/wenshan.svg'
import { createMockAnalysis, createMockZhihuContext, samples } from './mockData'
import type { QuestionAnalysisResult, RewrittenQuestion, ZhihuContext } from './types'

type TabKey =
  | 'diagnosis'
  | 'unclear'
  | 'assumptions'
  | 'rewrites'
  | 'publish'
  | 'zhihu'
  | 'direct'

const question = ref('')
const zhihuEnabled = ref(true)
const activeTab = ref<TabKey>('diagnosis')
const busy = ref(false)
const stage = ref('准备就绪')
const toast = ref('')
const result = ref<QuestionAnalysisResult | null>(null)
const zhihuContext = ref<ZhihuContext | null>(null)
const completedStages = ref<string[]>([])
const mobileResultsOpen = ref(false)

let statusTimer: number | undefined

const tabs: { key: TabKey; label: string }[] = [
  { key: 'diagnosis', label: '问题诊断' },
  { key: 'unclear', label: '模糊点' },
  { key: 'assumptions', label: '隐藏前提' },
  { key: 'rewrites', label: '更好的问题' },
  { key: 'publish', label: '发布到圈子' },
  { key: 'zhihu', label: '知乎参考' },
  { key: 'direct', label: '直答测试' },
]

const modeText = computed(() => (zhihuEnabled.value ? '知乎语境增强' : '基础分析'))

async function startAnalysis() {
  const raw = question.value.trim()
  if (!raw) {
    showToast('请先输入一个问题')
    return
  }
  busy.value = true
  mobileResultsOpen.value = true
  result.value = null
  zhihuContext.value = null
  completedStages.value = []

  try {
    if (zhihuEnabled.value) {
      activeTab.value = 'zhihu'
      startStatusLoop([
        '正在检索知乎站内内容……',
        '正在读取相似问题摘要……',
        '正在筛选可参考的讨论角度……',
        '正在补充全网参考材料……',
      ])
      zhihuContext.value = await postJson<ZhihuContext>('/api/zhihu-context', { question: raw })
      completedStages.value.push('知乎参考')

      activeTab.value = 'direct'
      startStatusLoop([
        '直答内容已生成，正在整理展示……',
        '正在对照原问题的直接回答……',
        '正在判断回答是否空泛……',
      ])
      completedStages.value.push('直答测试')
    }

    startStatusLoop([
      '正在拆解问题里的隐藏前提……',
      '正在识别模糊概念……',
      '正在生成更值得回答的问题……',
      '正在检查知乎语境适配度……',
      '正在准备圈子发布内容……',
    ])
    result.value = await postJson<QuestionAnalysisResult>('/api/analyze-core', {
      question: raw,
      zhihuContext: zhihuContext.value,
    })
    if (!zhihuContext.value) zhihuContext.value = result.value.zhihu_context
    completedStages.value.push('问山分析')
    activeTab.value = 'rewrites'
    stopStatusLoop()
    stage.value = '分析完成'
  } catch (error) {
    stopStatusLoop()
    const fallbackContext = zhihuEnabled.value ? createMockZhihuContext(raw) : undefined
    result.value = createMockAnalysis(raw, fallbackContext)
    zhihuContext.value = result.value.zhihu_context
    stage.value = error instanceof Error ? `接口失败，已使用演示结果：${error.message}` : '接口失败，已使用演示结果'
    activeTab.value = 'diagnosis'
  } finally {
    busy.value = false
  }
}

function startStatusLoop(messages: string[]) {
  stopStatusLoop()
  let index = 0
  stage.value = messages[index]
  statusTimer = window.setInterval(() => {
    index = (index + 1) % messages.length
    stage.value = messages[index]
  }, 1500)
}

function stopStatusLoop() {
  if (statusTimer !== undefined) {
    window.clearInterval(statusTimer)
    statusTimer = undefined
  }
}

function fillSample(text: string) {
  question.value = text
}

function clearAll() {
  stopStatusLoop()
  question.value = ''
  result.value = null
  zhihuContext.value = null
  completedStages.value = []
  mobileResultsOpen.value = false
  stage.value = '准备就绪'
  activeTab.value = 'diagnosis'
}

function copyAll() {
  if (!result.value) {
    showToast('还没有可复制结果')
    return
  }
  copyText(toMarkdown(result.value))
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
  showToast('已复制到剪贴板')
}

function showToast(message: string) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, 2200)
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

function toMarkdown(data: QuestionAnalysisResult): string {
  return [
    '# 问山分析结果',
    '',
    `原始问题：${data.original_question}`,
    '',
    '## 问题诊断',
    data.diagnosis.summary,
    '',
    '## 更好的问题',
    ...data.rewritten_questions.map((item, index) => `${index + 1}. ${item.title}\n${item.question}`),
    '',
    '## 发布到圈子',
    data.publish_draft.title,
    data.publish_draft.content,
  ].join('\n')
}

function scoreEntries(item: RewrittenQuestion) {
  return [
    ['清晰度', item.scores.clarity],
    ['可回答性', item.scores.answerability],
    ['讨论潜力', item.scores.discussion_potential],
    ['知乎适配度', item.scores.zhihu_fit],
    ['认知增量', item.scores.cognitive_gain],
  ] as const
}

onBeforeUnmount(() => {
  stopStatusLoop()
})
</script>

<template>
  <main class="app-shell">
    <aside class="side-panel">
      <div class="brand-block">
        <div class="brand-row">
          <div class="brand-title">
            <img class="brand-icon" :src="wenshanIcon" alt="问山图标" />
            <h1>刘问山</h1>
          </div>
          <span class="mode-badge">{{ modeText }}</span>
        </div>
        <p class="subtitle">这个时代不缺答案，缺少好问题。</p>
        <p class="description">一点分析，万般好回答。</p>
      </div>

      <textarea
        v-model="question"
        class="question-input"
        placeholder="输入一个你想完善的问题，例如：AI 会取代程序员吗？"
      />

      <label class="toggle-line">
        <input v-model="zhihuEnabled" type="checkbox" />
        <span>知乎语境增强</span>
      </label>

      <div class="action-row">
        <button class="primary-button" :disabled="busy" @click="startAnalysis">完善这个问题</button>
        <button class="secondary-button" :disabled="busy" @click="clearAll">清空</button>
        <button class="secondary-button" @click="copyAll">复制全部</button>
      </div>

      <section class="examples">
        <h2>示例问题</h2>
        <button v-for="sample in samples" :key="sample" class="sample-button" @click="fillSample(sample)">
          {{ sample }}
        </button>
      </section>
    </aside>

    <div
      v-if="mobileResultsOpen"
      class="mobile-backdrop"
      @click="mobileResultsOpen = false"
    />

    <section class="result-panel" :class="{ 'mobile-open': mobileResultsOpen }">
      <header class="result-header">
        <div>
          <h2>分析结果</h2>
          <p>{{ stage }}</p>
        </div>
        <div class="stage-strip">
          <span v-for="item in completedStages" :key="item">{{ item }}</span>
        </div>
        <button class="mobile-close" aria-label="关闭结果页" @click="mobileResultsOpen = false">×</button>
      </header>

      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section class="tab-body">
        <template v-if="activeTab === 'diagnosis'">
          <div v-if="result" class="stack">
            <article class="info-card">
              <h3>原始问题</h3>
              <p>{{ result.original_question }}</p>
            </article>
            <article class="info-card">
              <h3>诊断摘要</h3>
              <p>{{ result.diagnosis.summary }}</p>
            </article>
            <article class="info-card">
              <h3>问题类型标签</h3>
              <p>{{ result.diagnosis.problem_types.join('、') }}</p>
            </article>
            <article class="info-card">
              <h3>严重程度</h3>
              <p>{{ result.diagnosis.severity }}</p>
            </article>
            <article class="info-card">
              <h3>一句话结论</h3>
              <p>{{ result.diagnosis.conclusion }}</p>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'unclear'">
          <div v-if="result" class="stack">
            <article v-for="item in result.unclear_points" :key="item.title" class="info-card">
              <h3>{{ item.title }}</h3>
              <p><strong>为什么模糊：</strong>{{ item.explanation }}</p>
              <p><strong>如何澄清：</strong>{{ item.clarification }}</p>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'assumptions'">
          <div v-if="result" class="stack">
            <article v-for="item in result.hidden_assumptions" :key="item.assumption" class="info-card">
              <h3>{{ item.assumption }}</h3>
              <p><strong>为什么重要：</strong>{{ item.why_it_matters }}</p>
              <p><strong>如何挑战：</strong>{{ item.challenge }}</p>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'rewrites'">
          <div v-if="result" class="stack">
            <article v-for="item in result.rewritten_questions" :key="item.title" class="rewrite-card">
              <div class="card-top">
                <span class="type-badge">{{ item.type }}</span>
                <button class="mini-button" @click="copyText(item.question)">复制</button>
              </div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.question }}</p>
              <p class="muted">为什么更好：{{ item.why_better }}</p>
              <p class="muted">社区依据：{{ item.community_evidence || '未启用知乎语境增强' }}</p>
              <div class="scores">
                <label v-for="[label, value] in scoreEntries(item)" :key="label">
                  <span>{{ label }}：{{ value }}</span>
                  <progress :value="value" max="100" />
                </label>
              </div>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'publish'">
          <div v-if="result" class="stack">
            <article class="info-card">
              <h3>{{ result.publish_draft.title }}</h3>
              <p>{{ result.publish_draft.content }}</p>
              <p class="muted">标签：{{ result.publish_draft.tags.join('、') }}</p>
            </article>
            <div class="publish-actions">
              <button class="secondary-button" @click="copyText(`${result.publish_draft.title}\n\n${result.publish_draft.content}`)">
                复制圈子内容
              </button>
            </div>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'zhihu'">
          <div v-if="zhihuContext?.enabled" class="stack">
            <article class="info-card">
              <h3>语境摘要</h3>
              <p>{{ zhihuContext.summary }}</p>
            </article>
            <article v-if="zhihuContext.api_status" class="info-card">
              <h3>接口状态</h3>
              <p>{{ zhihuContext.api_status }}</p>
            </article>
            <article v-for="item in zhihuContext.similar_questions" :key="item.title" class="info-card">
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <p class="muted">作者：{{ item.author }}｜赞同：{{ item.answer_count }}｜评论：{{ item.comment_count }}</p>
              <p class="muted">{{ item.overlap_reason }}</p>
            </article>
            <article v-for="item in zhihuContext.global_references" :key="item.title" class="info-card">
              <h3>全网：{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <p class="muted">{{ item.url }}</p>
            </article>
            <article class="info-card">
              <h3>可切入的新角度</h3>
              <ul>
                <li v-for="item in zhihuContext.new_angles" :key="item">{{ item }}</li>
              </ul>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>

        <template v-else-if="activeTab === 'direct'">
          <div v-if="zhihuContext?.enabled" class="stack">
            <article class="info-card">
              <h3>直答来源</h3>
              <p>{{ zhihuContext.direct_answer_provider || '未生成' }}</p>
            </article>
            <article class="info-card">
              <h3>直答内容</h3>
              <p class="preserve">{{ zhihuContext.direct_answer || '未生成直答内容。' }}</p>
            </article>
            <article class="info-card">
              <h3>用途</h3>
              <p>用来观察原问题会得到怎样的回答。如果直答空泛、条件很多或结论摇摆，就说明原问题需要继续重构。</p>
            </article>
          </div>
          <p v-else class="empty-state">{{ stage }}</p>
        </template>
      </section>
    </section>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </main>
</template>
