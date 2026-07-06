// src/components/profile/StreakCard.jsx
//
// 连续学习天数卡片
//   - 火焰大数字（streak）
//   - 历史最长 / 本周新增
//   - 最近 7 天柱状（绿=有学习，灰=未学习，今天=蓝色高亮）

const DAY_LABEL = ['一', '二', '三', '四', '五', '六', '日']

/**
 * @param {{
 *   streak: number,           // 当前连续天数
 *   longestStreak: number,    // 历史最长
 *   weeklyGain: number,       // 本周新增学习天数
 *   last7Days: boolean[],     // 从远到近 7 天是否有学习（长度 = 7）
 * }} props
 */
export default function StreakCard({ streak = 0, longestStreak = 0, weeklyGain = 0, last7Days = [] }) {
  const today = new Date()
  // 倒序展示：把今天放最右
  const reversed = [...last7Days].reverse()

  return (
    <div style={{
      padding: 20,
      background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
      borderRadius: 14,
      border: '1px solid #fed7aa',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* 装饰光斑 */}
      <span style={{
        position: 'absolute', right: -30, top: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,146,60,0.25), transparent 70%)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, position: 'relative' }}>
        {/* 火焰 + 数字 */}
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #f97316, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, color: '#fff',
          boxShadow: '0 6px 20px rgba(239,68,68,0.3)',
          flexShrink: 0,
        }}>🔥</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#9a3412', lineHeight: 1 }}>
              {streak}
            </span>
            <span style={{ fontSize: 13, color: '#c2410c', fontWeight: 600 }}>天连续学习</span>
          </div>
          <div style={{ fontSize: 11, color: '#a16207', marginTop: 4 }}>
            最长 <strong>{longestStreak}</strong> 天 · 本周新增 <strong>{weeklyGain}</strong> 天
          </div>
        </div>
      </div>

      {/* 最近 7 天柱状 */}
      <div style={{ position: 'relative' }}>
        <div style={{
          fontSize: 11, color: '#a16207', fontWeight: 600, marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>📊</span> 最近 7 天
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 64 }}>
          {reversed.map((has, i) => {
            const isToday = i === reversed.length - 1
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', height: has ? 44 : 8,
                  borderRadius: 6,
                  background: has
                    ? (isToday
                        ? 'linear-gradient(180deg, #3b82f6, #6366f1)'
                        : 'linear-gradient(180deg, #fb923c, #f97316)')
                    : '#f3f4f6',
                  boxShadow: has && isToday ? '0 2px 8px rgba(99,102,241,0.35)' : 'none',
                  transition: 'height 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#fff', fontWeight: 700,
                }}>{has && isToday ? '今' : ''}</div>
                <div style={{
                  fontSize: 10, color: isToday ? '#3b82f6' : '#a16207',
                  fontWeight: isToday ? 700 : 500,
                }}>
                  {DAY_LABEL[(today.getDay() - (reversed.length - 1 - i) + 7) % 7]}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}