import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

/**
 * Auth 模块 —— 登录、Token、记住登录、过期跳转
 *
 * 设计原则：
 *  - 当前后端没有真实鉴权，全部走 Mock（不调用任何 fetch /api/auth*）
 *  - Token 格式：mock_xxxxxxxxx，附带 expiresAt（默认 2 小时）
 *  - Token 持久化：
 *      * rememberMe=true → localStorage（关闭浏览器仍保留）
 *      * rememberMe=false → sessionStorage（关闭浏览器即失效）
 *  - 过期检测：每次路由切换 / 页面活动 / 定时器 轮询，发现过期自动清空并跳转 /login
 *  - 预留 authApi：以后接后端时只需把 Mock 分支换成 fetch，接口形状保持一致
 *
 * ⚠️ 后端端口提示（接入真实接口时）：
 *    - 计划接口路径：
 *        POST /api/auth/login          → 登录
 *        POST /api/auth/reset-password → 重置密码
 *        POST /api/auth/send-code      → 发送验证码
 *    - dev 走 Vite /api 代理 → http://127.0.0.1:17077（见 vite.config.js）
 *    - prod 需反向代理指向 FastAPI 17077 端口
 *    - 联调前确认后端 main.py 已启动并监听 17077
 */

const LS_TOKEN_KEY = 'vf_auth_token'
const SS_TOKEN_KEY = 'vf_auth_token'
const LS_USER_KEY = 'vf_auth_user'
const LS_REMEMBER_KEY = 'vf_remember_username'

/* Mock Token 有效期：默认 2 小时 */
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000

/* 演示账号预设学习数据 */
const DEMO_LEARN_STATE = {
  "onboarded": true, "goal": "SAM微调", "customGoal": "", "topic": "SAM微调", "stage": "项目实战复盘",
  "currentStageIdx": 3, "knowledgeLevel": "中级", "learningPace": 8.5,
  "stagesVersion": 2,
  "knowledgeMap": { "SAM": 78, "YOLO": 55, "Mask2Former": 25, "UNet": 45, "ViT": 72, "Transformer": 68, "ResNet": 85, "CNN": 90, "DINO": 30, "LoRA": 55, "Adapter": 35, "Attention": 70 },
  "weakTopics": ["Attention 多头机制理解不深", "LoRA rank 选择原则"],
  "masteredTopics": ["CNN 基础", "ResNet 残差连接", "数据预处理流程"],
  "lastModelFeedback": { "mastered": ["CNN", "ResNet"], "weak": ["Attention", "LoRA"] },
  "mainStages": [
    { "id": 1, "title": "理解 SAM 架构原理", "desc": "阅读论文并完成摘要笔记", "agent": "📖 理论学习", "done": true },
    { "id": 2, "title": "完成源码阅读与笔记", "desc": "对照 code_mirror 逐行理解", "agent": "💻 源码阅读", "done": true },
    { "id": 3, "title": "搭建 SAM 微调管线", "desc": "在模型工坊搭建并保存模型", "agent": "🧱 模型搭建", "done": true },
    { "id": 4, "title": "项目实战复盘", "desc": "输出可交付的项目总结", "agent": "🚀 综合应用", "done": false }
  ],
  "learnerPortrait": {
    "dimensions": {
      "知识掌握": { "value": 78, "trend": [42, 48, 55, 58, 63, 68, 72, 78] },
      "认知风格": { "value": 72, "trend": [50, 52, 55, 58, 62, 65, 68, 72] },
      "易错点": { "value": 55, "trend": [30, 32, 35, 38, 42, 45, 50, 55] },
      "学习节奏": { "value": 75, "trend": [55, 58, 60, 62, 66, 68, 72, 75] },
      "兴趣程度": { "value": 88, "trend": [60, 65, 70, 73, 78, 82, 85, 88] },
      "代码能力": { "value": 65, "trend": [35, 40, 45, 50, 53, 58, 62, 65] }
    },
    "overallScore": 72,
    "aiReview": { "overall": "B+", "level": "成长型学习者", "highlight": "你的兴趣维度 88 分，学习驱动力强", "weak": "易错点需专项强化", "next": "优先攻克 Attention 机制" },
    "lastUpdated": "2026-07-19T15:30:00Z"
  }
}

/* ───────────────── 预留的 Mock API（后续接后端时直接替换） ───────────────── */

/* 模拟异步延迟（让 loading 动画有意义） */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ───────────────── 新用户判定 ───────────────── */
/* 设计目标：只在「该用户名第一次登录」时弹 Welcome，老用户不再弹。
 *
 * 存储结构：localStorage['vf_new_users'] = JSON.stringify({ 'username': true, ... })
 * - 登录成功时，如果用户名不在表中 → 视为新用户 → 返回 isNewUser: true
 * - 已在表中 → 老用户 → 返回 isNewUser: false
 *
 * 兼容：测试账号 demo_user 默认标记为「老用户」，刷新浏览器也不会再弹 Welcome。
 *
 * 真实接入后端时，这里换成后端字段（如 user.createdAt 与 today 对比）即可。
 */
const NEW_USERS_KEY = 'vf_new_users'
/* 默认算作「老用户」的特殊账号，避免演示账号反复弹 Welcome */
const DEFAULT_KNOWN_USERS = ['demo_user']

function loadNewUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(NEW_USERS_KEY) || '{}')
    return { ...DEFAULT_KNOWN_USERS.reduce((a, u) => (a[u] = true, a), {}), ...raw }
  } catch (_) {
    return DEFAULT_KNOWN_USERS.reduce((a, u) => (a[u] = true, a), {})
  }
}

function saveNewUsers(map) {
  try {
    /* 持久化时剔除默认老用户，缩小存储 */
    const slim = {}
    Object.keys(map).forEach((k) => { if (!DEFAULT_KNOWN_USERS.includes(k)) slim[k] = true })
    localStorage.setItem(NEW_USERS_KEY, JSON.stringify(slim))
  } catch (_) {}
}

/** 判断该用户名是否首次登录（首次 → true，老用户 → false） */
function checkIsNewUser(username) {
  const map = loadNewUsers()
  return !map[username]
}

/** 标记该用户为老用户 */
function markAsOldUser(username) {
  const map = loadNewUsers()
  if (map[username]) return
  map[username] = true
  saveNewUsers(map)
}

/**
 * 生成一个看起来像 JWT 但其实是 Mock 的字符串
 * 真实接入时这里会被后端返回的 token 替代
 */
function generateMockToken(username, role = 'student') {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    sub: username,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
    role,
  })))).replace(/=+$/, '')
  return `mock.${rand}.${payload}`
}

function decodeMockToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length < 3 || parts[0] !== 'mock') return null
    const payload = JSON.parse(decodeURIComponent(escape(atob(parts[2]))))
    return payload
  } catch (_) {
    return null
  }
}

/**
 * 登录接口 — 优先调用真实后端 API，失败时自动降级为 Mock
 */
async function mockLoginApi({ username, password }) {
  if (!username || !password) {
    return { code: 400, message: '请输入用户名和密码', data: null }
  }
  if (password.length < 6) {
    return { code: 400, message: '密码至少 6 位', data: null }
  }

  // 尝试真实后端登录
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      const json = await res.json()
      // 后端返回格式：{ id, username, name, role, access_token, ... } （平铺，无嵌套）
      const userData = json.data?.user || json.user || json
      return {
        code: 200,
        message: '登录成功',
        data: {
          token: json.access_token || json.data?.access_token || '',
          expiresAt: Date.now() + TOKEN_TTL_MS,
          user: {
            username: userData.username || json.username || username,
            name: userData.name || json.name || username,
            role: userData.role || json.role || 'student',
            studentId: userData.student_id || userData.studentId || '',
            college: userData.college || '',
            major: userData.major || '',
            class_name: userData.class_name || '',
          },
        },
      }
    }
    // 非 200 响应 → 降级到 Mock 模式（后端无此用户或未启动）
    console.warn('[Auth] 后端登录失败，降级到 Mock 模式:', res.status)
  } catch (_) {
    // 后端不可用 → 降级为 Mock 模式
  }

  // Mock 降级：任何非空用户名 + 密码≥6 即成功
  await sleep(500)
  if (username === 'wrongdemo') {
    return { code: 401, message: '用户名或密码错误', data: null }
  }
  const mockRole = username === 'admin' ? 'admin' : 'student'
  const token = generateMockToken(username, mockRole)
  const expiresAt = Date.now() + TOKEN_TTL_MS
  return {
    code: 200,
    message: '登录成功（Mock 模式）',
    data: {
      token,
      user: {
        username,
        name: username === 'demo_user' ? '体验学员' : username,
        role: username === 'admin' ? 'admin' : 'student',
        studentId: '2022105430066',
        college: '计算机与软件学院',
        major: '软件工程',
        avatar: username === 'demo_user' ? '🧑‍🎓' : '👤',
        role: 'student',
      },
      expiresAt,
    },
  }
}

/**
 * Mock 重置密码接口
 * 入参：{ username, email, code, newPassword }
 * 出参：{ code, message }
 *
 * ⚠️ 当前为 Mock：用户名非空 + 验证码 6 位 + 新密码≥6 位即成功
 */
async function mockResetPasswordApi({ username, code, newPassword }) {
  await sleep(700)
  if (!username) return { code: 400, message: '请输入用户名', data: null }
  if (!code || code.length !== 6) return { code: 400, message: '请输入 6 位验证码', data: null }
  if (!newPassword || newPassword.length < 6) {
    return { code: 400, message: '新密码至少 6 位', data: null }
  }
  return { code: 200, message: '密码重置成功', data: null }
}

/**
 * Mock 发送验证码接口
 * 入参：{ username, email }
 * 出参：{ code, message, data: { sentTo } }
 *
 * ⚠️ 当前为 Mock：固定返回验证码 888888，前端展示「已发送」
 */
async function mockSendCodeApi({ username, email }) {
  await sleep(500)
  if (!username) return { code: 400, message: '请先输入用户名', data: null }
  return {
    code: 200,
    message: '验证码已发送（Mock：演示用固定码 888888）',
    data: { sentTo: email || `${username}@example.com`, code: '888888' },
  }
}

/* ───────────────── Auth Context ───────────────── */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState(0)
  const [user, setUser] = useState(null)
  const [initialized, setInitialized] = useState(false)
  const expiredTimerRef = useRef(null)

  /* 启动时从存储恢复 Token / User */
  useEffect(() => {
    try {
      const remembered = localStorage.getItem(LS_REMEMBER_KEY)
      const persistedToken = localStorage.getItem(LS_TOKEN_KEY)
      const sessionToken = sessionStorage.getItem(SS_TOKEN_KEY)
      const finalToken = remembered ? persistedToken : sessionToken
      if (finalToken) {
        const payload = decodeMockToken(finalToken)
        if (payload && payload.exp > Date.now()) {
          setToken(finalToken)
          setTokenExpiresAt(payload.exp)
          const savedUser = localStorage.getItem(LS_USER_KEY)
          if (savedUser) {
            try { setUser(JSON.parse(savedUser)) } catch (_) {}
          }
        } else {
          /* 已过期，清理 */
          localStorage.removeItem(LS_TOKEN_KEY)
          sessionStorage.removeItem(SS_TOKEN_KEY)
        }
      }
    } catch (_) {}
    setInitialized(true)
  }, [])

  /* 过期检测：到点自动清空并触发 onExpired */
  const scheduleExpiry = useCallback((exp) => {
    if (expiredTimerRef.current) {
      clearTimeout(expiredTimerRef.current)
      expiredTimerRef.current = null
    }
    if (!exp) return
    const delay = Math.max(0, exp - Date.now())
    /* 提前 5 秒提示也算友好，但这里简化为到点即过期 */
    expiredTimerRef.current = setTimeout(() => {
      clearAuth({ silent: false, reason: 'expired' })
    }, delay)
  }, [])

  useEffect(() => {
    if (token && tokenExpiresAt) {
      scheduleExpiry(tokenExpiresAt)
    }
    return () => {
      if (expiredTimerRef.current) clearTimeout(expiredTimerRef.current)
    }
  }, [token, tokenExpiresAt, scheduleExpiry])

  /* 写入 Token / User 到存储 */
  const persistAuth = useCallback((tk, exp, u, remember) => {
    try {
      if (remember) {
        localStorage.setItem(LS_TOKEN_KEY, tk)
        sessionStorage.removeItem(SS_TOKEN_KEY)
      } else {
        sessionStorage.setItem(SS_TOKEN_KEY, tk)
        localStorage.removeItem(LS_TOKEN_KEY)
      }
      localStorage.setItem(LS_USER_KEY, JSON.stringify(u))
    } catch (_) {}
  }, [])

  /* 清空认证（登出 / 过期） */
  const clearAuth = useCallback(({ silent = true, reason = 'logout' } = {}) => {
    localStorage.removeItem(LS_TOKEN_KEY)
    sessionStorage.removeItem(SS_TOKEN_KEY)
    localStorage.removeItem(LS_USER_KEY)
    setToken(null)
    setTokenExpiresAt(0)
    setUser(null)
    if (expiredTimerRef.current) {
      clearTimeout(expiredTimerRef.current)
      expiredTimerRef.current = null
    }
    /* 过期场景下，自动跳 /login 并标记 reason */
    if (!silent && typeof window !== 'undefined') {
      const hash = window.location.hash || ''
      if (!hash.includes('/login') && !hash.includes('/forgot-password')) {
        try {
          window.location.hash = `#/login?reason=${reason}`
        } catch (_) {
          window.location.href = '/#/login?reason=' + reason
        }
      }
    }
  }, [])

  /* 登录 */
  const login = useCallback(async ({ username, password, rememberMe }) => {
    const resp = await mockLoginApi({ username, password })
    if (resp.code === 200) {
      const { token: tk, user: u, expiresAt } = resp.data
      persistAuth(tk, expiresAt, u, !!rememberMe)
      setToken(tk)
      setTokenExpiresAt(expiresAt)
      setUser(u)
      if (rememberMe) {
        localStorage.setItem(LS_REMEMBER_KEY, username)
      } else {
        localStorage.removeItem(LS_REMEMBER_KEY)
      }
      /* 保留兼容：旧代码用 localStorage.isLoggedIn 判断登录态 */
      try { localStorage.setItem('isLoggedIn', 'true') } catch (_) {}
      /* 演示账号：预置学习数据；其它账号：强制重置为空白 */
      if (username === 'demo_user') {
        try { localStorage.setItem('vf_learn_state_v2', JSON.stringify(DEMO_LEARN_STATE)) } catch (_) {}
        try { window.__vf_resetLearnState?.() } catch (_) {}
      } else {
        try { localStorage.removeItem('vf_learn_state_v2') } catch (_) {}
        try { localStorage.removeItem('vf_welcome_seen') } catch (_) {}
        try { localStorage.removeItem('vf_new_users') } catch (_) {}
        try { window.__vf_resetLearnState?.() } catch (_) {}
      }
      /* 判定新/老用户 */
      const isNewUser = checkIsNewUser(username)
      if (!isNewUser) {
        try { localStorage.setItem('vf_welcome_seen', '1') } catch (_) {}
      }
      return {
        ok: true,
        message: resp.message,
        data: { ...resp.data, isNewUser },
      }
    }
    return { ok: false, message: resp.message, data: null }
  }, [persistAuth])

  /* 重置密码 */
  const resetPassword = useCallback(async (payload) => {
    return await mockResetPasswordApi(payload)
  }, [])

  /* 发送验证码 */
  const sendCode = useCallback(async (payload) => {
    return await mockSendCodeApi(payload)
  }, [])

  /* 登出 */
  const logout = useCallback(() => {
    clearAuth({ silent: true })
    try { localStorage.removeItem('isLoggedIn') } catch (_) {}
  }, [clearAuth])

  /* 标记当前用户为老用户（Welcome 完成时调用） */
  const markCurrentAsOld = useCallback((username) => {
    if (!username) return
    markAsOldUser(username)
  }, [])

  const value = {
    token,
    user,
    initialized,
    isAuthenticated: !!token,
    login,
    logout,
    resetPassword,
    sendCode,
    markCurrentAsOld,
    /* 兼容旧字段：clearAuth 在过期场景外部可用 */
    clearAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/* ───────────────── 暴露给外部使用的辅助方法（预留接后端） ───────────────── */
export const authApi = {
  login: mockLoginApi,
  resetPassword: mockResetPasswordApi,
  sendCode: mockSendCodeApi,
}