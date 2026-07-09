// src/api/notifications.js
//
// 通知中心 API 层
//   - 当前使用 Mock 数据（__USE_MOCK__ = true），保证前端可独立运行
//   - 真实接口路径已在每个函数注释中预留，后续只需：
//        1) 把 __USE_MOCK__ 设为 false
//        2) 后端实现对应路径并按约定返回数据
//
// 与后端约定的接口（占位，后续联调时复用）：
//   GET    /api/notifications?category=xxx        → 拉取通知列表
//   POST   /api/notifications/:id/read            → 标记单条已读
//   POST   /api/notifications/read-all           → 全部已读
//   DELETE /api/notifications/:id                → 删除单条
//
// ⚠️ 后端端口提示：以上所有 /api/notifications* 路径
//    dev → Vite 代理转发到 http://127.0.0.1:17077（见 vite.config.js）
//    prod → 需反向代理指向 FastAPI 17077 端口
//    切换到真接口时：把 __USE_MOCK__ 置为 false，并确认后端 main.py 监听 17077
//
// 返回数据约定：
//   {
//     code: 0,
//     data: [
//       {
//         id: 'n_xxx',
//         category: 'study' | 'ai' | 'experiment' | 'system' | 'resource',
//         title: '...',
//         description: '...',
//         createdAt: '2026-07-06T22:00:00',
//         read: false,
//         meta: { ... }     // 业务可选附加字段（如跳转链接）
//       }
//     ]
//   }

const __USE_MOCK__ = true

/** 模拟网络延迟 */
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/** 通知分类元信息（图标 + 标题 + 配色），组件里复用 */
export const NOTIFICATION_CATEGORIES = {
  study:      { key: 'study',      label: '学习提醒',     icon: '📚', color: '#3b82f6' },
  ai:         { key: 'ai',         label: 'AI 生成完成',  icon: '🤖', color: '#8b5cf6' },
  experiment: { key: 'experiment', label: '实验完成',     icon: '🧪', color: '#10b981' },
  system:     { key: 'system',     label: '系统通知',     icon: '🔔', color: '#f59e0b' },
  resource:   { key: 'resource',   label: '资源更新',     icon: '📖', color: '#ec4899' },
}

/** Mock 种子数据 —— 5 类各 2 条，混合已读 / 未读 */
function buildMockList() {
  const now = Date.now()
  const m = (offsetMin) => new Date(now - offsetMin * 60 * 1000).toISOString()
  return [
    // 学习提醒
    {
      id: 'n_study_001',
      category: 'study',
      title: '今日学习计划待完成',
      description: '《数据结构》第五章 · 二叉树遍历 还有 3 道练习题未完成，建议在 22:00 前完成。',
      createdAt: m(8),
      read: false,
      meta: { link: '/center?tab=portrait' },
    },
    {
      id: 'n_study_002',
      category: 'study',
      title: '学习路径已更新',
      description: '根据你最近的学习表现，AI 已为你重新规划了下周的学习路径，快去学习画像页查看吧～',
      createdAt: m(60 * 6),
      read: true,
      meta: { link: '/center?tab=portrait' },
    },
    // AI 生成完成
    {
      id: 'n_ai_001',
      category: 'ai',
      title: 'AI 资源生成完成',
      description: '《机器学习入门》专属学习资料已生成完毕，包含 12 个知识卡片与 1 份思维导图。',
      createdAt: m(15),
      read: false,
      meta: { link: '/resources?tab=generate' },
    },
    {
      id: 'n_ai_002',
      category: 'ai',
      title: 'AI 导师对话摘要已生成',
      description: '你与 AI 导师关于「梯度下降」的对话已生成结构化摘要，可加入错题本。',
      createdAt: m(60 * 20),
      read: true,
      meta: { link: '/wrong-book' },
    },
    // 实验完成
    {
      id: 'n_exp_001',
      category: 'experiment',
      title: '「逻辑回归分类实验」已完成',
      description: '准确率 92.3%，对比基线提升 4.1%。点击查看完整实验报告与可视化对比。',
      createdAt: m(45),
      read: false,
      meta: { link: '/canvas?tab=record' },
    },
    {
      id: 'n_exp_002',
      category: 'experiment',
      title: '实验记录已自动保存',
      description: '「K-Means 聚类实验 v2」已保存至云端，可在「实验记录」中查看历史版本。',
      createdAt: m(60 * 28),
      read: true,
      meta: { link: '/canvas?tab=record' },
    },
    // 系统通知
    {
      id: 'n_sys_001',
      category: 'system',
      title: '系统将于今晚 23:00 进行例行维护',
      description: '维护时长约 10 分钟，期间可能短暂无法访问，请合理安排学习时间。',
      createdAt: m(120),
      read: false,
      meta: {},
    },
    {
      id: 'n_sys_002',
      category: 'system',
      title: '欢迎使用 Vision-Forge',
      description: '你的账号已激活，开始你的多智能体协同学习之旅吧！',
      createdAt: m(60 * 72),
      read: true,
      meta: {},
    },
    // 资源更新
    {
      id: 'n_res_001',
      category: 'resource',
      title: '新增 5 篇精选论文',
      description: '「深度学习」分类下新增 5 篇 2026 年顶会论文，已自动加入推荐资源。',
      createdAt: m(30),
      read: false,
      meta: { link: '/resources?tab=recommend' },
    },
    {
      id: 'n_res_002',
      category: 'resource',
      title: '收藏资源「Python 编程规范」已更新',
      description: '该资源已更新到 v2.1 版本，包含 12 处新增规范与示例。',
      createdAt: m(60 * 12),
      read: true,
      meta: { link: '/resources?tab=favorites' },
    },
  ]
}

/* ───────── Mock 状态：模块级单例，刷新页面会重置 ───────── */
let __MOCK_STATE__ = buildMockList()

function mockResponse(data) {
  return Promise.resolve({ code: 0, data })
}

function mockReject(msg) {
  return Promise.reject(new Error(msg))
}

/* ───────── 公共调用函数 ───────── */

/**
 * 获取通知列表
 * @param {string} [category]  分类过滤；不传则返回全部
 * @returns {Promise<{code:number, data:Array}>}
 */
export async function fetchNotifications(category) {
  if (__USE_MOCK__) {
    await delay(150)
    const list = category
      ? __MOCK_STATE__.filter((n) => n.category === category)
      : __MOCK_STATE__
    // 按时间倒序
    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return mockResponse(sorted)
  }
  /* 真接口：
     // ⬇️ GET /api/notifications → FastAPI 17077（Vite /api 代理）
     const qs = category ? `?category=${encodeURIComponent(category)}` : ''
     const res = await fetch(`/api/notifications${qs}`)
     if (!res.ok) return mockReject(`HTTP ${res.status}`)
     return res.json()
  */
  return mockReject('Real API not implemented yet')
}

/**
 * 标记单条已读
 * @param {string} id
 */
export async function markNotificationRead(id) {
  if (__USE_MOCK__) {
    await delay(80)
    const target = __MOCK_STATE__.find((n) => n.id === id)
    if (target) target.read = true
    return mockResponse({ id, read: true })
  }
  /* 真接口：
     // ⬇️ POST /api/notifications/:id/read → FastAPI 17077
     const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
     if (!res.ok) return mockReject(`HTTP ${res.status}`)
     return res.json()
  */
  return mockReject('Real API not implemented yet')
}

/**
 * 全部已读（可选按分类）
 * @param {string} [category]
 */
export async function markAllNotificationsRead(category) {
  if (__USE_MOCK__) {
    await delay(120)
    __MOCK_STATE__ = __MOCK_STATE__.map((n) =>
      !category || n.category === category ? { ...n, read: true } : n
    )
    return mockResponse({ ok: true })
  }
  /* 真接口：
     // ⬇️ POST /api/notifications/read-all → FastAPI 17077
     const res = await fetch('/api/notifications/read-all', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ category }),
     })
     if (!res.ok) return mockReject(`HTTP ${res.status}`)
     return res.json()
  */
  return mockReject('Real API not implemented yet')
}

/**
 * 删除单条通知
 * @param {string} id
 */
export async function deleteNotification(id) {
  if (__USE_MOCK__) {
    await delay(80)
    const before = __MOCK_STATE__.length
    __MOCK_STATE__ = __MOCK_STATE__.filter((n) => n.id !== id)
    return mockResponse({ id, removed: before !== __MOCK_STATE__.length })
  }
  /* 真接口：
     // ⬇️ DELETE /api/notifications/:id → FastAPI 17077
     const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
     if (!res.ok) return mockReject(`HTTP ${res.status}`)
     return res.json()
  */
  return mockReject('Real API not implemented yet')
}

/* ───────── 工具函数 ───────── */

/** 相对时间格式化（中文） */
export function formatRelativeTime(iso) {
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
  if (wk < 4) return `${wk} 周前`
  return new Date(iso).toLocaleDateString('zh-CN')
}