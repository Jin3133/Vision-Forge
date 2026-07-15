import React, { useState } from 'react'
import { useLearn } from '../LearnContext.jsx'

/* ───────── 目标选项 ───────── */
const GOAL_OPTIONS = [
  {
    key: 'sam微调',
    icon: '🎯',
    title: '我想学会 SAM',
    desc: '图像分割基础模型 SAM 的原理、微调与实战',
    color: '#3b82f6',
    bg: '#eff6ff',
  },
  {
    key: '农业遥感',
    icon: '🌾',
    title: '我想做农业遥感',
    desc: '用 SAM 做农作物长势监测、田块分割',
    color: '#10b981',
    bg: '#f0fdf4',
  },
  {
    key: '医学分割',
    icon: '🩺',
    title: '我想做医学分割',
    desc: '在 CT / MRI / 细胞图像上完成精准分割',
    color: '#ef4444',
    bg: '#fef2f2',
  },
  {
    key: '目标检测',
    icon: '🚗',
    title: '我想做目标检测',
    desc: 'YOLO / DETR 等检测模型原理与实战',
    color: '#f59e0b',
    bg: '#fffbeb',
  },
  {
    key: '自定义目标',
    icon: '✨',
    title: '自定义目标',
    desc: '告诉我你想学什么，AI 导师会帮你定制',
    color: '#8b5cf6',
    bg: '#faf5ff',
  },
]

export default function Onboarding() {
  const { finishOnboarding } = useLearn()
  const [selected, setSelected] = useState('')
  const [custom, setCustom] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = selected && (selected !== '自定义目标' || custom.trim())

  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitting(true)
    setTimeout(() => {
      finishOnboarding(selected, custom.trim())
    }, 600)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        width: 720, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 20,
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.4s ease',
      }}>
        {/* 顶部标题区 */}
        <div style={{
          padding: '32px 36px 24px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          color: '#fff', borderRadius: '20px 20px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>🎓</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>欢迎来到 Vision-Forge</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                4 智能体 · 中央状态机驱动 · 个性化学习闭环
              </div>
            </div>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.7, opacity: 0.95 }}>
            请告诉 AI 导师你的学习目标，我们会为你生成一条 5 阶段的「主线任务」，
            并由 4 个智能体（架构引导 · 算法教研 · 资源生成 · 学情评估）围绕共享黑板协同辅导。
          </p>
        </div>

        {/* 目标选择区 */}
        <div style={{ padding: '28px 36px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
            🎯 请选择你的学习目标
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {GOAL_OPTIONS.map(opt => {
              const isSelected = selected === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelected(opt.key)}
                  style={{
                    textAlign: 'left', padding: 14, borderRadius: 12,
                    border: isSelected ? `2px solid ${opt.color}` : '2px solid #e2e8f0',
                    background: isSelected ? opt.bg : '#fff',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = opt.color }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0' }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{opt.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                  {isSelected && (
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: opt.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                    }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 自定义输入 */}
          {selected === '自定义目标' && (
            <div style={{ marginTop: 14 }}>
              <input
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="例如：我想在无人机航拍图像上做小目标检测..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid #8b5cf6', fontSize: 13, outline: 'none',
                  background: '#faf5ff', color: '#1e293b',
                }}
              />
            </div>
          )}

          {/* 主线任务预览 */}
          <div style={{ marginTop: 22, padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10 }}>
              📋 选定后，AI 导师将为你生成 5 阶段主线任务：
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {['理解基础概念', '阅读关键源码', '搭建模型架构', '完成实验记录', '项目实战复盘'].map((t, i) => (
                <React.Fragment key={i}>
                  <span style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    background: '#fff', color: '#3b82f6', borderRadius: 8,
                    border: '1px solid #bfdbfe',
                  }}>
                    阶段{i + 1} · {t}
                  </span>
                  {i < 4 && <span style={{ color: '#94a3b8', fontSize: 10 }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '18px 36px 28px',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12,
          borderTop: '1px solid #f1f5f9',
        }}>
          <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>
            💡 选错也没关系，之后可以在「个人空间」随时切换
          </span>
          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 700,
              background: canSubmit ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' : '#e2e8f0',
              color: canSubmit ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: 12, cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
              transition: 'all 0.2s',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {submitting ? '⏳ 正在生成主线任务...' : '🚀 让 AI 导师开始辅导'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
