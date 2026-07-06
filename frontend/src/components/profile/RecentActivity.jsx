// src/components/profile/RecentActivity.jsx
//
// 最近活动时间线 —— Mock 数据
// 数据源预留：GET /api/profile/activities?limit=10

import { formatRelativeTime } from '../../api/notifications.js'

const TYPE_STYLE = {
  study:    { color: '#3b82f6', bg: '#eff6ff', icon: '📚', label: '学习' },
  ai:       { color: '#8b5cf6', bg: '#f5f3ff', icon: '🤖', label: 'AI' },
  resource: { color: '#ec4899', bg: '#fdf2f8', icon: '📖', label: '资源' },
  experiment: { color: '#10b981', bg: '#ecfdf5', icon: '🧪', label: '实验' },
  social:   { color: '#f59e0b', bg: '#fffbeb', icon: '🤝', label: '社区' },
}

/**
 * @param {{
 *   activities: Array<{
 *     id: string,
 *     type: keyof typeof TYPE_STYLE,
 *     title: string,
 *     description?: string,
 *     createdAt: string,
 *     meta?: { link?: string, score?: number }
 *   }>
 * }} props
 */
export default function RecentActivity({ activities = [] }) {
  if (activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 12px', color: '#94a3b8', fontSize: 13 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
        暂无最近活动
      </div>
    )
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
      {/* 时间线主轴 */}
      <span style={{
        position: 'absolute', left: 17, top: 8, bottom: 8, width: 2,
        background: 'linear-gradient(180deg, #e2e8f0 0%, #f1f5f9 100%)',
        borderRadius: 1,
      }} />
      {activities.map((act) => {
        const s = TYPE_STYLE[act.type] || TYPE_STYLE.study
        return (
          <li key={act.id} style={{
            position: 'relative', paddingLeft: 44, paddingBottom: 16,
          }}>
            {/* 节点 */}
            <span style={{
              position: 'absolute', left: 0, top: 0,
              width: 36, height: 36, borderRadius: '50%',
              background: s.bg, border: `2px solid #fff`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: s.color,
              boxShadow: `0 0 0 2px ${s.color}33`,
            }}>{s.icon}</span>

            {/* 内容 */}
            <div style={{
              background: '#fafbfc', border: '1px solid #f1f5f9',
              borderRadius: 10, padding: '10px 14px',
              transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fafbfc'
                e.currentTarget.style.borderColor = '#f1f5f9'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 7px', borderRadius: 999,
                  background: s.bg, color: s.color, letterSpacing: 0.5,
                }}>{s.label}</span>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{act.title}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                  {formatRelativeTime(act.createdAt)}
                </span>
              </div>
              {act.description && (
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  {act.description}
                </div>
              )}
              {act.meta?.score !== undefined && (
                <div style={{
                  marginTop: 6, fontSize: 11, color: s.color, fontWeight: 600,
                }}>
                  🏆 得分 {act.meta.score}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* 默认 Mock 数据 —— 后续接入真实接口时删除 */
export const MOCK_ACTIVITIES = [
  {
    id: 'a_001',
    type: 'experiment',
    title: '完成「逻辑回归二分类实验」',
    description: '训练集准确率 92.3%，相比上次提升 4.1%',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    meta: { score: 92 },
  },
  {
    id: 'a_002',
    type: 'ai',
    title: 'AI 资源生成完成',
    description: '《机器学习入门》专属学习资料已生成',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  },
  {
    id: 'a_003',
    type: 'study',
    title: '完成「二叉树遍历」练习 5 道',
    description: '全部通过，平均用时 2 分 12 秒',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    meta: { score: 100 },
  },
  {
    id: 'a_004',
    type: 'resource',
    title: '收藏论文「Attention Is All You Need」',
    description: '已添加至「深度学习」收藏夹',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a_005',
    type: 'study',
    title: '解锁成就「持之以恒·7天」',
    description: '连续学习 7 天，奖励 +50 经验',
    createdAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a_006',
    type: 'social',
    title: '在社区发表了 1 个问题',
    description: '「K-Means 聚类数 k 如何选取？」',
    createdAt: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
  },
]