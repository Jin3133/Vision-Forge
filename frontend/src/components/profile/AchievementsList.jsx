// src/components/profile/AchievementsList.jsx
//
// 学习成就 —— 6 个细分徽章
// 数据源预留：GET /api/profile/achievements

import { useState } from 'react'

const RARITY = {
  common:    { label: '普通', color: '#64748b', bg: '#f1f5f9' },
  rare:      { label: '稀有', color: '#3b82f6', bg: '#eff6ff' },
  epic:      { label: '史诗', color: '#8b5cf6', bg: '#f5f3ff' },
  legendary: { label: '传说', color: '#f59e0b', bg: '#fffbeb' },
}

/**
 * @param {{
 *   items: Array<{
 *     id: string,
 *     name: string,
 *     description: string,
 *     icon: string,
 *     rarity: keyof typeof RARITY,
 *     achieved: boolean,
 *     progress?: number,        // 0-100
 *     achievedAt?: string,
 *     reward?: string,          // 解锁奖励描述
 *   }>
 * }} props
 */
export default function AchievementsList({ items = [] }) {
  const achieved = items.filter((i) => i.achieved).length

  return (
    <div>
      {/* 顶部：完成度摘要 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 14px', borderRadius: 10,
        background: 'linear-gradient(90deg, #eff6ff, #f5f3ff)',
        marginBottom: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: '#fff', flexShrink: 0,
        }}>🏅</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
            已解锁 <span style={{ color: '#3b82f6' }}>{achieved}</span> / {items.length} 个成就
          </div>
          <div style={{
            marginTop: 6, height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden',
          }}>
            <div style={{
              width: `${(achieved / items.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              borderRadius: 99,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 700 }}>
          {Math.round((achieved / items.length) * 100)}%
        </div>
      </div>

      {/* 成就网格 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
      }}>
        {items.map((a) => (
          <AchievementCard key={a.id} item={a} />
        ))}
      </div>
    </div>
  )
}

function AchievementCard({ item }) {
  const r = RARITY[item.rarity] || RARITY.common
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: 14, borderRadius: 12,
        background: item.achieved
          ? `linear-gradient(135deg, ${r.bg}, #ffffff)`
          : '#fafbfc',
        border: '1px solid',
        borderColor: item.achieved ? `${r.color}55` : '#f1f5f9',
        transition: 'all 0.2s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover
          ? '0 8px 20px rgba(0,0,0,0.06)'
          : '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      {/* 稀有度标签 */}
      <span style={{
        position: 'absolute', top: 8, right: 8,
        fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
        padding: '2px 6px', borderRadius: 4,
        background: r.bg, color: r.color,
      }}>{r.label}</span>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: item.achieved
            ? `linear-gradient(135deg, ${r.color}, ${r.color}cc)`
            : '#e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          filter: item.achieved ? 'none' : 'grayscale(100%)',
          opacity: item.achieved ? 1 : 0.5,
          boxShadow: item.achieved ? `0 4px 12px ${r.color}44` : 'none',
          flexShrink: 0,
        }}>{item.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: item.achieved ? '#1e293b' : '#94a3b8',
            marginBottom: 2,
          }}>{item.name}</div>
          <div style={{
            fontSize: 11, color: '#64748b', lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{item.description}</div>
        </div>
      </div>

      {/* 进度 / 解锁状态 */}
      <div style={{ marginTop: 10 }}>
        {item.achieved ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 10,
          }}>
            <span style={{ color: r.color, fontWeight: 700 }}>✓ 已解锁</span>
            {item.reward && (
              <span style={{ color: '#94a3b8' }}>🎁 {item.reward}</span>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: '#94a3b8' }}>进度</span>
              <span style={{ color: r.color, fontWeight: 700 }}>{item.progress ?? 0}%</span>
            </div>
            <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                width: `${item.progress ?? 0}%`, height: '100%',
                background: `linear-gradient(90deg, ${r.color}, ${r.color}aa)`,
                borderRadius: 99,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* 默认 Mock —— 6 个细分成就 */
export const MOCK_ACHIEVEMENTS = [
  {
    id: 'ach_001', name: '学习达人', description: '累计学习时长达到 100 小时',
    icon: '🏆', rarity: 'epic', achieved: true,
    achievedAt: '2024-01-15', reward: '限定头像框',
  },
  {
    id: 'ach_002', name: '代码高手', description: '完成 10 个编程练习',
    icon: '💻', rarity: 'rare', achieved: true,
    achievedAt: '2024-01-20', reward: '+100 经验',
  },
  {
    id: 'ach_003', name: '模型大师', description: '独立搭建 5 个完整模型',
    icon: '🎨', rarity: 'epic', achieved: true,
    achievedAt: '2024-02-10', reward: '专属徽章',
  },
  {
    id: 'ach_004', name: '持之以恒', description: '连续学习 30 天',
    icon: '🔥', rarity: 'legendary', achieved: false, progress: 73,
    reward: '传说称号',
  },
  {
    id: 'ach_005', name: '社区贡献者', description: '在社区回答 20 个问题',
    icon: '🤝', rarity: 'rare', achieved: false, progress: 45,
    reward: '+200 经验',
  },
  {
    id: 'ach_006', name: '早起鸟', description: '连续 7 天在 8 点前开始学习',
    icon: '🌅', rarity: 'common', achieved: false, progress: 57,
    reward: '限定头像',
  },
]