// src/api/favorites.js
//
// 统一收藏 Store —— 5 类：学习包 / 论文 / 资源 / 课程 / 模型
//   - 当前用 localStorage 做 Mock（保证前端独立运行）
//   - 与真接口约定已在每个函数注释中预留，联调时把 __USE_MOCK__ 切到 false 即可
//
// 后端约定（占位）：
//   GET    /api/favorites?category=xxx&keyword=xxx   → 列表
//   POST   /api/favorites                            → 新增（body: FavoriteItem）
//   DELETE /api/favorites/:id                        → 取消收藏
//
// ⚠️ 后端端口提示：所有 /api/favorites* 路径
//    dev → Vite 代理 → http://127.0.0.1:17077（见 vite.config.js）
//    prod → 反向代理指向 FastAPI 17077 端口
//    切换真接口：把 __USE_MOCK__ 置 false，并确认后端 main.py 监听 17077
//
// 关键设计：保留旧版 vf_favorites 中的资源 id，迁移为统一 store，避免老用户收藏丢失。

const __USE_MOCK__ = true
const STORAGE_KEY = 'vf_favorites_v2'

/** 5 个收藏分类 */
export const FAVORITE_CATEGORIES = {
  pack:      { key: 'pack',      label: '学习包',   icon: '📦', color: '#3b82f6' },
  paper:     { key: 'paper',     label: '论文',     icon: '📄', color: '#8b5cf6' },
  resource:  { key: 'resource',  label: '资源',     icon: '📖', color: '#ec4899' },
  course:    { key: 'course',    label: '课程',     icon: '🎓', color: '#10b981' },
  model:     { key: 'model',     label: '模型',     icon: '🧠', color: '#f59e0b' },
}

/** Mock 种子：5 类各 3~4 条 */
function buildSeed() {
  const now = Date.now()
  const m = (offsetH) => new Date(now - offsetH * 3600 * 1000).toISOString()
  return [
    // ── 学习包 ──
    { id: 'f_pack_001', category: 'pack', title: '机器学习入门到精通·完整学习包',
      desc: '涵盖监督学习、无监督学习、深度学习基础 · 共 12 章节',
      cover: '🤖', tags: ['入门', '系统学习'], author: 'AI 学习组', createdAt: m(2) },
    { id: 'f_pack_002', category: 'pack', title: 'PyTorch 实战手册',
      desc: '从 Tensor 到模型部署，30 个真实案例',
      cover: '🔥', tags: ['PyTorch', '实战'], author: '深度学习社区', createdAt: m(8) },
    { id: 'f_pack_003', category: 'pack', title: '数据结构与算法精讲',
      desc: '面试必备，含图解 + 代码 + 真题',
      cover: '🧮', tags: ['算法', '面试'], author: '算法教研组', createdAt: m(48) },

    // ── 论文 ──
    { id: 'f_paper_001', category: 'paper', title: 'Attention Is All You Need',
      desc: 'Vaswani et al. · NeurIPS 2017 · Transformer 原始论文',
      cover: '🎯', tags: ['Transformer', '经典'], author: 'Google Brain', createdAt: m(1) },
    { id: 'f_paper_002', category: 'paper', title: 'A Survey of Large Language Models',
      desc: 'LLM 全景综述 · 2024 最新版',
      cover: '📚', tags: ['LLM', '综述'], author: 'Zhao et al.', createdAt: m(12) },
    { id: 'f_paper_003', category: 'paper', title: 'Segment Anything (SAM)',
      desc: 'Meta AI · 通用图像分割基础模型',
      cover: '🖼️', tags: ['分割', '基础模型'], author: 'Meta AI', createdAt: m(24) },
    { id: 'f_paper_004', category: 'paper', title: 'LoRA: Low-Rank Adaptation',
      desc: '参数高效微调方法 · 工业界广泛使用',
      cover: '⚙️', tags: ['微调', '高效'], author: 'Microsoft', createdAt: m(72) },

    // ── 资源 ──
    { id: 'f_res_001', category: 'resource', title: 'Python 编程规范 PEP8',
      desc: '官方风格指南中文精解',
      cover: '🐍', tags: ['Python', '规范'], author: 'Python 官方', createdAt: m(6) },
    { id: 'f_res_002', category: 'resource', title: 'CS231n 课程笔记',
      desc: '斯坦福 CNN for Visual Recognition 笔记合集',
      cover: '🎓', tags: ['CV', '课程笔记'], author: 'CS231n 助教团', createdAt: m(20) },
    { id: 'f_res_003', category: 'resource', title: 'NumPy 速查表',
      desc: '常用函数一图速查',
      cover: '🔢', tags: ['NumPy', '速查'], author: 'DataCamp', createdAt: m(72) },

    // ── 课程 ──
    { id: 'f_course_001', category: 'course', title: '吴恩达·机器学习',
      desc: '经典入门课 · 含课后作业',
      cover: '🤖', tags: ['入门', '经典'], author: 'Andrew Ng', createdAt: m(3) },
    { id: 'f_course_002', category: 'course', title: '李宏毅·深度学习',
      desc: '台大李宏毅 · 中文讲解 · 通俗易懂',
      cover: '🧠', tags: ['深度学习', '中文'], author: 'Hung-Yi Lee', createdAt: m(36) },
    { id: 'f_course_003', category: 'course', title: 'CS224N · NLP with Deep Learning',
      desc: '斯坦福自然语言处理 · 进阶',
      cover: '💬', tags: ['NLP', '进阶'], author: 'Stanford', createdAt: m(96) },

    // ── 模型 ──
    { id: 'f_model_001', category: 'model', title: 'ResNet-50 图像分类',
      desc: '经典残差网络 · ImageNet 预训练',
      cover: '🏞️', tags: ['CV', '分类'], author: 'Microsoft Research', createdAt: m(5) },
    { id: 'f_model_002', category: 'model', title: 'BERT-base 文本理解',
      desc: '双向 Transformer 编码器',
      cover: '💬', tags: ['NLP', '预训练'], author: 'Google', createdAt: m(18) },
    { id: 'f_model_003', category: 'model', title: 'Stable Diffusion 文生图',
      desc: '扩散模型 · 文本生成图像',
      cover: '🎨', tags: ['AIGC', '扩散模型'], author: 'Stability AI', createdAt: m(40) },
    { id: 'f_model_004', category: 'model', title: 'Whisper 语音识别',
      desc: 'OpenAI 多语言语音识别模型',
      cover: '🎤', tags: ['语音', '多模态'], author: 'OpenAI', createdAt: m(60) },
  ]
}

/* ──────── 状态读取 + 一次性迁移老数据 ──────── */
function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr
    }
  } catch (_) { /* 忽略 */ }

  /* 迁移老 vf_favorites：把旧的资源 id 转成"resource"分类的占位条目 */
  let migrated = []
  try {
    const old = JSON.parse(localStorage.getItem('vf_favorites') || '[]')
    if (Array.isArray(old) && old.length > 0) {
      migrated = old.map((id, i) => ({
        id: `f_legacy_${id}`,
        category: 'resource',
        title: `已收藏资源 #${id}`,
        desc: '从旧版收藏迁移（占位）',
        cover: '📌',
        tags: ['已迁移'],
        author: '—',
        createdAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
      }))
    }
  } catch (_) { /* 忽略 */ }

  const seed = buildSeed()
  /* 如果有迁移数据就拼到种子前面，否则只用种子 */
  const list = migrated.length > 0 ? [...migrated, ...seed] : seed
  writeStore(list)
  return list
}

function writeStore(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('[favorites] localStorage 写入失败', e)
  }
}

/* ──────── 公共调用 ──────── */

/**
 * 拉取收藏列表
 * @param {string} [category] 分类过滤
 * @param {string} [keyword] 搜索关键字（标题/描述/标签/作者模糊匹配）
 */
export async function fetchFavorites({ category, keyword } = {}) {
  if (__USE_MOCK__) {
    await delay(120)
    let list = readStore()
    if (category) list = list.filter((f) => f.category === category)
    if (keyword) {
      const k = keyword.trim().toLowerCase()
      if (k) {
        list = list.filter((f) =>
          f.title.toLowerCase().includes(k) ||
          (f.desc || '').toLowerCase().includes(k) ||
          (f.tags || []).some((t) => t.toLowerCase().includes(k)) ||
          (f.author || '').toLowerCase().includes(k)
        )
      }
    }
    /* 按时间倒序 */
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return { code: 0, data: list }
  }
  /* 真接口：
     // ⬇️ GET /api/favorites → FastAPI 17077（Vite /api 代理）
     const qs = new URLSearchParams()
     if (category) qs.set('category', category)
     if (keyword)  qs.set('keyword',  keyword)
     const res = await fetch(`/api/favorites?${qs}`)
     return res.json()
  */
  return { code: 0, data: [] }
}

/** 是否已收藏（按 id + category） */
export async function isFavorited(id, category) {
  const list = readStore()
  return list.some((f) => f.id === id && (!category || f.category === category))
}

/**
 * 新增收藏
 * @param {{
 *   id: string,
 *   category: keyof typeof FAVORITE_CATEGORIES,
 *   title: string,
 *   desc?: string,
 *   cover?: string,
 *   tags?: string[],
 *   author?: string,
 * }} item
 */
export async function addFavorite(item) {
  if (__USE_MOCK__) {
    await delay(80)
    const list = readStore()
    if (list.some((f) => f.id === item.id && f.category === item.category)) {
      return { code: 0, data: { added: false, reason: 'duplicate' } }
    }
    const next = [{
      id: item.id,
      category: item.category,
      title: item.title,
      desc: item.desc || '',
      cover: item.cover || FAVORITE_CATEGORIES[item.category]?.icon || '⭐',
      tags: item.tags || [],
      author: item.author || '—',
      createdAt: new Date().toISOString(),
    }, ...list]
    writeStore(next)
    return { code: 0, data: { added: true } }
  }
  /* 真接口：
     // ⬇️ POST /api/favorites → FastAPI 17077
     const res = await fetch('/api/favorites', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(item),
     })
     return res.json()
  */
  return { code: 0, data: { added: false } }
}

/** 取消收藏（按 id） */
export async function removeFavorite(id) {
  if (__USE_MOCK__) {
    await delay(80)
    const list = readStore()
    const next = list.filter((f) => f.id !== id)
    writeStore(next)
    return { code: 0, data: { removed: next.length !== list.length } }
  }
  /* 真接口：
     // ⬇️ DELETE /api/favorites/:id → FastAPI 17077
     const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' })
     return res.json()
  */
  return { code: 0, data: { removed: false } }
}

/** 切换收藏状态（用于资源卡片等地方直接调） */
export async function toggleFavorite(item) {
  const list = readStore()
  const existed = list.find((f) => f.id === item.id && f.category === item.category)
  if (existed) {
    await removeFavorite(existed.id)
    return { code: 0, data: { favorited: false } }
  }
  await addFavorite(item)
  return { code: 0, data: { favorited: true } }
}

/* ──────── 工具 ──────── */
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/** 相对时间 */
export function formatFavTime(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} 周前`
  return new Date(iso).toLocaleDateString('zh-CN')
}