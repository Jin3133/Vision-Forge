import { useEffect, useState, useContext } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { UserContext } from '../App.jsx'
import { useLearn } from '../LearnContext.jsx'

/**
 * Welcome 页 —— 一屏搞定三件事：
 *   ① 介绍 4 智能体 + 学习流程
 *   ② 让用户选择学习目标（合并原 Onboarding 能力）
 *   ③ 点「开始学习」→ 进入首页
 *
 * 路由策略：
 *   - 未登录 → /login
 *   - 已登录 + vf_welcome_seen='1' → /（首页）
 *   - 否则：渲染本页
 */

const AGENTS = [
  {
    key: 'architect',
    name: '架构引导',
    role: 'Architect',
    icon: '🧭',
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    desc: '拆解目标 · 编排路径 · 调度协同',
  },
  {
    key: 'tutor',
    name: '算法教研',
    role: 'Tutor',
    icon: '📖',
    color: '#8b5cf6',
    bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    desc: '原理解读 · 源码伴读 · 案例对照',
  },
  {
    key: 'generator',
    name: '资源生成',
    role: 'Generator',
    icon: '✨',
    color: '#ec4899',
    bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
    desc: '资料生成 · 练习出题 · 图表可视化',
  },
  {
    key: 'evaluator',
    name: '学情评估',
    role: 'Evaluator',
    icon: '📊',
    color: '#10b981',
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    desc: '掌握度评估 · 薄弱识别 · 节奏建议',
  },
]

const FLOW_STEPS = [
  { idx: '01', icon: '🎯', title: '选目标', desc: '告诉 AI 你想学什么', color: '#3b82f6' },
  { idx: '02', icon: '🧭', title: '拆任务', desc: 'Architect 编排 5 阶段', color: '#8b5cf6' },
  { idx: '03', icon: '📖', title: '学原理', desc: 'Tutor 陪读代码', color: '#ec4899' },
  { idx: '04', icon: '🛠️', title: '搭模型', desc: 'Generator 出题 + 工坊', color: '#f59e0b' },
  { idx: '05', icon: '📊', title: '看评估', desc: 'Evaluator 反馈掌握度', color: '#10b981' },
]

/* 学习目标选项（合并原 Onboarding 能力） */
const GOAL_OPTIONS = [
  { key: 'sam微调', icon: '🎯', title: '学会 SAM', color: '#3b82f6', bg: '#eff6ff' },
  { key: '农业遥感', icon: '🌾', title: '农业遥感', color: '#10b981', bg: '#f0fdf4' },
  { key: '医学分割', icon: '🩺', title: '医学分割', color: '#ef4444', bg: '#fef2f2' },
  { key: '目标检测', icon: '🚗', title: '目标检测', color: '#f59e0b', bg: '#fffbeb' },
  { key: '自定义目标', icon: '✨', title: '自定义', color: '#8b5cf6', bg: '#faf5ff' },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, initialized, markCurrentAsOld } = useAuth()
  const { showToast } = useToast()
  const { setUser } = useContext(UserContext)
  const learn = useLearn()
  const [enterLoading, setEnterLoading] = useState(false)
  const [activeAgent, setActiveAgent] = useState(0)

  /* 目标选择状态 */
  const [selectedGoal, setSelectedGoal] = useState(learn.goal || '')
  const [customGoal, setCustomGoal] = useState(learn.customGoal || '')

  /* 守卫逻辑：
   *   1. 未登录 → 跳登录
   *   2. 已登录但是老用户（vf_welcome_seen='1'） → 直接跳首页
   *      （即使是手误输入 /welcome 也不展示，避免老用户被多余页面打扰）
   */
  useEffect(() => {
    if (!initialized) return
    if (!isAuthenticated) {
      if (typeof window !== 'undefined' && localStorage.getItem('isLoggedIn') !== 'true') {
        navigate('/login', { replace: true })
      }
      return
    }
    const seen = (() => {
      try { return localStorage.getItem('vf_welcome_seen') === '1' } catch (_) { return false }
    })()
    if (seen) {
      /* 老用户：直接跳首页 */
      navigate('/', { replace: true })
    }
  }, [initialized, isAuthenticated, navigate])

  /* 智能体卡片轮播高亮 */
  useEffect(() => {
    const t = setInterval(() => {
      setActiveAgent((p) => (p + 1) % AGENTS.length)
    }, 2200)
    return () => clearInterval(t)
  }, [])

  /* 同步 AuthContext.user → UserContext */
  useEffect(() => {
    if (user) {
      setUser((prev) => ({ ...(prev || {}), ...user }))
    }
  }, [user, setUser])

  const handleSwitchAccount = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const canSubmit = selectedGoal && (selectedGoal !== '自定义目标' || customGoal.trim())

  const handleEnter = () => {
    if (!canSubmit) {
      showToast('请先选择一个学习目标', 'warning', 2200)
      return
    }
    setEnterLoading(true)
    /* 写入完成 onboarding（合并原 Onboarding 能力） */
    learn.finishOnboarding(selectedGoal, customGoal.trim())
    try { localStorage.setItem('vf_welcome_seen', '1') } catch (_) {}
    /* 关键：把当前用户名标记为「老用户」，以后再用此账号登录不会再弹 Welcome */
    markCurrentAsOld(user?.username)
    showToast('欢迎进入 Vision-Forge 🚀', 'success', 1500)
    setTimeout(() => {
      navigate('/', { replace: true })
    }, 600)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #fdf2f8 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        padding: '20px 16px 24px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ──── 顶部 Logo + 用户 ──── */}
      <div style={{
        maxWidth: 1080, width: '100%', margin: '0 auto 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 800,
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>VF</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>Vision-Forge</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>多智能体学习平台</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: '#fff', border: '1px solid #e2e8f0',
            }}>
              <span style={{ fontSize: 14 }}>{user.avatar || '👤'}</span>
              <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>
                {user.name || user.username}
              </span>
            </div>
          )}
          <button
            onClick={handleSwitchAccount}
            style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 500,
              background: '#fff', color: '#475569',
              border: '1px solid #e2e8f0', borderRadius: 7,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
          >
            切换账号
          </button>
        </div>
      </div>

      {/* ──── 主体卡片（一屏） ──── */}
      <div style={{
        maxWidth: 1080, width: '100%', margin: '0 auto',
        background: '#fff', borderRadius: 22,
        padding: '28px 36px 26px',
        boxShadow: '0 20px 50px -12px rgba(59,130,246,0.18), 0 8px 24px -8px rgba(139,92,246,0.12)',
        position: 'relative', overflow: 'hidden',
        flex: 1,
      }}>
        {/* 装饰光斑 */}
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 220, height: 220,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.13), transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60, width: 200, height: 200,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.13), transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ──── 标题区 ──── */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: 'linear-gradient(135deg, #eff6ff, #ede9fe)',
            color: '#4f46e5', fontSize: 10, fontWeight: 600,
            border: '1px solid #c7d2fe',
          }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: '#10b981', animation: 'pulse 1.5s infinite',
            }} />
            <span>4-Agent · 中央状态机驱动</span>
          </div>

          <h1 style={{
            fontSize: 30, fontWeight: 800, color: '#1e293b',
            margin: '10px 0 6px', letterSpacing: '-0.5px', lineHeight: 1.15,
          }}>
            欢迎来到 <span style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Vision-Forge</span>
          </h1>
          <p style={{
            fontSize: 13, color: '#64748b',
            margin: 0, lineHeight: 1.6,
          }}>
            4 个智能体围绕共享黑板协同辅导，全程陪伴你的 AI 学习闭环。
          </p>
        </div>

        {/* ──── 4 智能体（一行紧凑） ──── */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
          marginBottom: 18,
        }}>
          {AGENTS.map((agent, i) => {
            const isActive = i === activeAgent
            return (
              <div
                key={agent.key}
                onMouseEnter={() => setActiveAgent(i)}
                style={{
                  background: agent.bg,
                  borderRadius: 14, padding: '14px 14px',
                  border: isActive ? `2px solid ${agent.color}` : '2px solid transparent',
                  transition: 'all 0.3s ease',
                  transform: isActive ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isActive
                    ? `0 10px 24px -8px ${agent.color}55`
                    : '0 2px 6px rgba(0,0,0,0.03)',
                  cursor: 'default', position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: 8, right: 10,
                  fontSize: 10, fontWeight: 800, color: agent.color,
                  opacity: 0.55, letterSpacing: 1,
                }}>0{i + 1}</div>
                <div style={{
                  fontSize: 24, marginBottom: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: 11,
                  background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}>{agent.icon}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{agent.name}</span>
                  <span style={{ fontSize: 10, color: agent.color, fontWeight: 600 }}>· {agent.role}</span>
                </div>
                <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
                  {agent.desc}
                </div>
              </div>
            )
          })}
        </div>

        {/* ──── 5 阶段学习流程（横向紧凑） ──── */}
        <div style={{
          position: 'relative', zIndex: 1,
          background: 'linear-gradient(180deg, #f8fafc, #fafbff)',
          border: '1px solid #eef2f7', borderRadius: 14,
          padding: '14px 16px', marginBottom: 18,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <span style={{
              display: 'inline-block', width: 3, height: 14,
              borderRadius: 2, background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
            }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              5 阶段学习闭环
            </h2>
            <span style={{
              fontSize: 10, color: '#94a3b8',
              padding: '1px 8px', background: '#fff',
              border: '1px solid #e2e8f0', borderRadius: 999,
            }}>选目标 → 评估反馈</span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
            position: 'relative',
          }}>
            {/* 连接线 */}
            <div style={{
              position: 'absolute', top: 18, left: '10%', right: '10%', height: 2,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #10b981)',
              opacity: 0.25, zIndex: 0,
            }} />
            {FLOW_STEPS.map((s, i) => (
              <div
                key={i}
                style={{
                  position: 'relative', zIndex: 1,
                  background: '#fff', borderRadius: 10,
                  padding: '10px 8px', textAlign: 'center',
                  border: '1px solid #e2e8f0',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{
                  width: 34, height: 34, margin: '0 auto 6px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: '#fff',
                  boxShadow: `0 4px 10px -3px ${s.color}66`,
                }}>{s.icon}</div>
                <div style={{
                  fontSize: 9, fontWeight: 800, color: s.color,
                  letterSpacing: 1, marginBottom: 1,
                }}>STEP {s.idx}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ──── 选目标（合并原 Onboarding） ──── */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <span style={{
              display: 'inline-block', width: 3, height: 14,
              borderRadius: 2, background: 'linear-gradient(180deg, #8b5cf6, #ec4899)',
            }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              告诉 AI 导师你的学习目标
            </h2>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              选定后将生成 5 阶段主线任务
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
          }}>
            {GOAL_OPTIONS.map((opt) => {
              const isSelected = selectedGoal === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelectedGoal(opt.key)}
                  style={{
                    textAlign: 'center', padding: '10px 8px', borderRadius: 10,
                    border: isSelected ? `2px solid ${opt.color}` : '1px solid #e2e8f0',
                    background: isSelected ? opt.bg : '#fff',
                    cursor: 'pointer', transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = opt.color }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{opt.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                    {opt.title}
                  </div>
                  {isSelected && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 16, height: 16, borderRadius: '50%',
                      background: opt.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 自定义输入 */}
          {selectedGoal === '自定义目标' && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder="例如：我想在无人机航拍图像上做小目标检测..."
              style={{
                marginTop: 10, width: '100%', padding: '10px 14px',
                borderRadius: 10, border: '1.5px solid #8b5cf6',
                fontSize: 12, outline: 'none', background: '#faf5ff',
                color: '#1e293b', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* ──── CTA ──── */}
        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <button
            onClick={handleEnter}
            disabled={enterLoading}
            style={{
              padding: '12px 56px', fontSize: 14, fontWeight: 700,
              borderRadius: 12, color: '#fff', border: 'none',
              background: enterLoading
                ? 'linear-gradient(90deg, #93c5fd, #c4b5fd)'
                : canSubmit
                  ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                  : '#cbd5e1',
              cursor: enterLoading ? 'not-allowed' : 'pointer',
              boxShadow: canSubmit && !enterLoading
                ? '0 8px 20px -4px rgba(59,130,246,0.4)'
                : 'none',
              transition: 'all 0.2s',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              letterSpacing: 1,
            }}
            onMouseEnter={(e) => {
              if (canSubmit && !enterLoading) e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {enterLoading ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.8s linear infinite',
                }} />
                <span>进入中...</span>
              </>
            ) : (
              <>
                <span>开始学习</span>
                <span style={{ fontSize: 16 }}>→</span>
              </>
            )}
          </button>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            💡 可随时在「个人空间」切换目标
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}