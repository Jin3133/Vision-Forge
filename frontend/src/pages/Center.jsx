import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';
import LearningStats from '../components/learn/LearningStats.jsx';
import AbilityDelta from '../components/learn/AbilityDelta.jsx';
import MapTab from '../components/learn/MapTab.jsx';

/* ════════════════════════════════════════════════════════════
   PortraitTech —— 六维学习画像（科技感）
   6 模块：① 雷达图  ② 综合评分  ③ 成长趋势  ④ 历史变化
         ⑤ 学习统计  ⑥ 能力变化  ⑦ AI 评价
   全部只回答「我是怎样的学习者？」—— 不放学习路线 / 知识树。
   ════════════════════════════════════════════════════════════ */

// 6 维维度数据（含 Mock 历史曲线）
const PT_DIMS = [
  { key: '知识掌握', en: 'Knowledge',     value: 75, color: '#3b82f6', icon: '📚', trend: [42, 48, 55, 58, 63, 68, 72, 75] },
  { key: '认知风格', en: 'Cognition',     value: 68, color: '#22c55e', icon: '🧠', trend: [50, 52, 55, 58, 60, 63, 65, 68] },
  { key: '易错点',   en: 'Pitfalls',      value: 45, color: '#ef4444', icon: '⚠️', trend: [30, 32, 35, 36, 38, 40, 43, 45] },
  { key: '学习节奏', en: 'Pace',          value: 70, color: '#eab308', icon: '⏱️', trend: [55, 58, 60, 62, 64, 66, 68, 70] },
  { key: '兴趣程度', en: 'Interest',      value: 85, color: '#a855f7', icon: '⭐', trend: [60, 65, 70, 73, 76, 79, 82, 85] },
  { key: '代码能力', en: 'Coding',        value: 62, color: '#06b6d4', icon: '💻', trend: [35, 40, 45, 50, 53, 57, 60, 62] },
]

// 维度解释（Mock）
const PT_DIM_DESC = {
  '知识掌握': '对核心概念、原理性知识的吸收与再现能力。得分越高说明你在该领域的理论基础越扎实。',
  '认知风格': '面对新知识时的信息加工偏好（理论型 / 实践型 / 视觉型）。识别你的偏好能定制更高效的学习路径。',
  '易错点':   '在常见陷阱、典型错误上的暴露频率。得分越低说明盲区越多，需要专项强化训练。',
  '学习节奏': '稳定投入学习的时间分布与持续性。评估你是否能保持长期、不中断的学习节律。',
  '兴趣程度': '对当前主题的好奇心、主动探索意愿与内在驱动力。兴趣是最好的学习燃料。',
  '代码能力': '独立编写、调试、阅读代码的综合能力。深度学习最终要落到代码与工程实践上。',
}

// AI 综合评价（亮点 / 短板 / 建议）
const PT_AI_REVIEW = {
  overall: 'B+',
  level: '成长型学习者',
  levelColor: '#0ea5e9',
  highlight: {
    label: '亮点',
    icon: '✨',
    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe',
    text: '你的兴趣维度 85 分，全维 Top 1。说明你对本领域有强烈的内驱力——这是稀缺的、也是后续学习最重要的燃料。',
  },
  weak: {
    label: '短板',
    icon: '⚠️',
    color: '#ef4444', bg: '#fef2f2', border: '#fecaca',
    text: '易错点维度仅 45 分，是当前最大瓶颈。常见错误反复出现，缺少专项错题复盘机制。',
  },
  next: {
    label: '成长建议',
    icon: '🎯',
    color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0',
    text: '下一阶段优先攻克 Attention；同步在「学习地图」开启 SAM 项目实践。预计 2 周内易错点 +10、代码能力 +8。',
  },
}

// 历史变化（Mock · 近 8 周每周均值）
const PT_HISTORY = Array.from({ length: 8 }, (_, w) => {
  const point = { week: `W${w + 1}` }
  PT_DIMS.forEach(d => { point[d.key] = d.trend[w] })
  point['均值'] = Math.round(PT_DIMS.reduce((s, d) => s + d.trend[w], 0) / PT_DIMS.length)
  return point
})

// 学习画像 —— 与项目其它页面统一的卡片样式
const PT_CARD = {
  background: '#ffffff',
  border: '1px solid #f1f5f9',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
}

function PortraitTech() {
  const navigate = useNavigate()
  const heroDim = PT_DIMS[0]
  const overallNow = Math.round(PT_DIMS.reduce((s, d) => s + d.value, 0) / PT_DIMS.length)
  const overallPrev = Math.round(PT_DIMS.reduce((s, d) => s + d.trend[d.trend.length - 2], 0) / PT_DIMS.length)
  const overallDelta = overallNow - overallPrev

  const sectionTitle = {
    fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 14px',
  }

  return (
    <div>
      {/* ════════════════════════════════════
          ① 雷达图 + ② 综合评分
          ════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={PT_CARD}>
          <h3 style={sectionTitle}>🎯 六维能力雷达</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={PT_DIMS.map(d => ({ subject: d.key, A: d.value, fullMark: 100 }))}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#475569' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" />
              <Radar name="能力值" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={PT_CARD}>
          <h3 style={sectionTitle}>📊 综合评分</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{overallNow}</span>
            <span style={{ fontSize: 14, color: '#94a3b8' }}>/ 100</span>
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 700,
              color: overallDelta >= 0 ? '#10b981' : '#ef4444',
              padding: '2px 8px', borderRadius: 6,
              background: overallDelta >= 0 ? '#ecfdf5' : '#fef2f2',
            }}>
              {overallDelta >= 0 ? '▲' : '▼'} {Math.abs(overallDelta)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
            等级 <strong style={{ color: '#3b82f6' }}>{PT_AI_REVIEW.level}</strong>
          </div>

          {/* 6 维迷你条 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PT_DIMS.map(d => (
              <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, width: 18 }}>{d.icon}</span>
                <span style={{ color: '#475569', fontSize: 12, width: 56 }}>{d.key}</span>
                <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${d.value}%`, height: '100%',
                    background: d.color, borderRadius: 3,
                  }} />
                </div>
                <span style={{ color: d.color, fontSize: 12, fontWeight: 700, width: 32, textAlign: 'right' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════
          ③ 成长趋势（主维度近 8 周）
          ════════════════════════════════════ */}
      <div style={{ ...PT_CARD, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            📈 成长趋势
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, color: heroDim.color }}>
              {heroDim.icon} {heroDim.key}
            </span>
          </h3>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>近 8 周 · 周均值</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={heroDim.trend.map((v, i) => ({ week: `W${i + 1}`, value: v }))}>
            <defs>
              <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={heroDim.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={heroDim.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="value" stroke={heroDim.color} strokeWidth={2.5}
              fill="url(#growthGrad)" dot={{ r: 3, fill: heroDim.color, stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#64748b' }}>
          <span>起点 {heroDim.trend[0]} → 当前 {heroDim.value}</span>
          <span style={{ color: '#10b981', fontWeight: 600 }}>
            +{heroDim.value - heroDim.trend[0]} 分 · {Math.round((heroDim.value - heroDim.trend[0]) / heroDim.trend[0] * 100)}% ↑
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════
          ④ 历史变化（6 维折线）+ ⑤ 学习统计
          ════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={PT_CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...sectionTitle, margin: 0 }}>📉 6 维历史变化</h3>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>近 8 周</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={PT_HISTORY}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} iconType="circle" />
              {PT_DIMS.map(d => (
                <Line key={d.key} type="monotone" dataKey={d.key} stroke={d.color} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <LearningStats />
        </div>
      </div>

      {/* ════════════════════════════════════
          ⑥ 能力变化（近 7 天净变化）
          ════════════════════════════════════ */}
      <AbilityDelta />

      {/* ════════════════════════════════════
          ⑦ AI 综合评价（亮点 / 短板 / 建议）
          ════════════════════════════════════ */}
      <div style={{
        ...PT_CARD,
        background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #fdf4ff 100%)',
        border: '1px solid #c7d2fe',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>🤖 AI 综合评价</h3>
          <span style={{
            fontSize: 11, color: '#4f46e5', fontWeight: 600,
            padding: '3px 10px', background: '#fff', borderRadius: 999,
            border: '1px solid #c7d2fe',
          }}>基于近 30 天学习数据</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <ReviewItem {...PT_AI_REVIEW.highlight} />
          <ReviewItem {...PT_AI_REVIEW.weak} />
          <ReviewItem {...PT_AI_REVIEW.next} onClick={() => navigate('/center?tab=map')} />
        </div>
      </div>
    </div>
  )
}

/* ───── 子组件：AI 评价单条 ───── */
function ReviewItem({ icon, color, bg, border, label, text, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16, borderRadius: 12,
        background: bg,
        border: `1px solid ${border}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .2s, box-shadow .2s',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 24px -8px ${color}66`
      }}
      onMouseLeave={(e) => {
        if (!onClick) return
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{label}</span>
      </div>
      <p style={{ margin: 0, color: '#334155', fontSize: 12.5, lineHeight: 1.75 }}>{text}</p>
      {onClick && (
        <div style={{ marginTop: 10, fontSize: 11, color, fontWeight: 600 }}>
          前往学习地图 →
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Center —— 学习中心入口（仅作为路由壳）
   两个 tab：
     · portrait → 学习分析（"我是怎样的学习者？"）
     · map      → 学习地图（"下一步怎么学？" · 内嵌知识树）
   ════════════════════════════════════════════════════════════ */
export default function Center() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab') || 'portrait';
  /* 兼容旧 URL：老链接里 ?tab=path 自动重定向到 map（学习地图接管了路径规划） */
  const activeTab = urlTab === 'path' ? 'map' : urlTab;
  useEffect(() => {
    if (urlTab === 'path') {
      navigate('/center?tab=map', { replace: true });
    }
  }, [urlTab, navigate]);

  /* 6 维画像由后端 AI 智能体（学情评估 Agent）统一计算驱动 */

  return (
    <div style={{ padding: '8px 16px 16px', maxWidth: 1200, margin: '0 auto' }}>
      {activeTab === 'portrait' && <PortraitTech />}
      {activeTab === 'map' && <MapTab />}
    </div>
  );
}
