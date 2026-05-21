import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts'

export default function Center() {
  const location = useLocation()
  const urlParams = new URLSearchParams(location.search)
  const activeTab = urlParams.get('tab') || 'portrait'

  const [skills, setSkills] = useState([
    { id: 1, name: 'Python', selected: false },
    { id: 2, name: 'PyTorch', selected: false },
    { id: 3, name: '计算机视觉', selected: false },
    { id: 4, name: '模型架构', selected: false },
    { id: 5, name: '图像分割', selected: false },
    { id: 6, name: '注意力机制', selected: false },
  ])
  const [plan, setPlan] = useState(null)
  const [showFullPath, setShowFullPath] = useState(false)

  // 6维学习画像数据
  const abilityData = [
    { subject: '知识基础', value: 75, fullMark: 100 },
    { subject: '认知风格', value: 68, fullMark: 100 },
    { subject: '易错点', value: 45, fullMark: 100 },
    { subject: '学习节奏', value: 70, fullMark: 100 },
    { subject: '兴趣程度', value: 85, fullMark: 100 },
    { subject: '代码能力', value: 62, fullMark: 100 },
  ]

  // 评估数据
  const evalData = [
    { name: '知识掌握', score: 82 },
    { name: '应用能力', score: 75 },
    { name: '分析能力', score: 70 },
    { name: '综合能力', score: 78 },
    { name: '创新思维', score: 68 },
  ]

  const weaknessData = [
    { name: '注意力机制', score: 55, suggestion: '加强理论学习' },
    { name: '模型微调', score: 60, suggestion: '多做实践练习' },
    { name: '代码实现', score: 68, suggestion: '阅读源码' },
  ]

  const learningPath = [
    { step: 1, title: '理论基础学习', desc: '学习注意力机制、Transformer架构', agent: '算法教研', status: 'completed' },
    { step: 2, title: '模型搭建实践', desc: '使用可视化工具搭建SAM模型', agent: '架构引导', status: 'current' },
    { step: 3, title: '源码深度解析', desc: '阅读并理解核心代码实现', agent: '算法教研', status: 'pending' },
    { step: 4, title: '项目实战训练', desc: '完成遥感图像分割项目', agent: '资源生成', status: 'pending' },
    { step: 5, title: '学习评估反馈', desc: '系统评估学习效果', agent: '学情评估', status: 'pending' },
  ]

  const toggleSkill = (id) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))
  }

  const generatePlan = () => {
    const selected = skills.filter(s => s.selected).map(s => s.name)
    if (selected.length === 0) {
      alert('请至少选择一项技能')
      return
    }
    setPlan({
      skills: selected,
      time: `${selected.length * 7} 天`,
      level: '中级',
      desc: `根据你选择的 ${selected.join('、')}，系统已为你生成专属学习路径。`
    })
    setShowFullPath(false)
  }

  return (
    <div>
      {/* Tab切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
        {[
          { key: 'portrait', name: '学习画像', icon: '🎯' },
          { key: 'evaluate', name: '效果评估', icon: '📊' },
          { key: 'path', name: '学习路径', icon: '🛤️' },
        ].map(tab => (
          <Link key={tab.key} to={`/center?tab=${tab.key}`}>
            <button style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13,
              background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
              color: activeTab === tab.key ? '#fff' : '#64748b',
              boxShadow: 'none'
            }}>{tab.icon} {tab.name}</button>
          </Link>
        ))}
      </div>

      {/* 学习画像 Tab */}
      {activeTab === 'portrait' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>🎯 6维学习画像</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={abilityData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" fontSize={11} tick={{ fill: '#64748b' }} />
                  <Radar dataKey="value" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 style={{ fontSize: 14, marginBottom: 12 }}>维度说明</h4>
              {abilityData.map((item, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{item.subject}</span>
                    <span style={{ fontSize: 12, color: '#3b82f6' }}>{item.value}%</span>
                  </div>
                  <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99 }}>
                    <div style={{ width: `${item.value}%`, height: '100%', background: '#3b82f6', borderRadius: 99 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 20, padding: 12, background: '#eff6ff', borderRadius: 10 }}>
            <p style={{ fontSize: 13, color: '#475569' }}>
              💡 你的学习画像已生成。<strong>兴趣程度(85%)和知识基础(75%)</strong>表现良好，
              <strong>易错点(45%)和代码能力(62%)</strong>需要重点提升。建议加强代码实践。
            </p>
          </div>
        </div>
      )}

      {/* 效果评估 Tab */}
      {activeTab === 'evaluate' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: '综合评分', value: '78', unit: '分', color: '#3b82f6' },
              { label: '学习效率', value: '82', unit: '%', color: '#10b981' },
              { label: '超越进度', value: '65', unit: '%', color: '#f59e0b' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}{item.unit}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>📊 评分明细</h3>
            {evalData.map((item, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: '#3b82f6' }}>{item.score}分</span>
                </div>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                  <div style={{ width: `${item.score}%`, height: '100%', background: '#3b82f6', borderRadius: 99 }}></div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>⚠️ 薄弱知识点</h3>
            {weaknessData.map((item, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{item.name}</span>
                  <span style={{ fontSize: 12, color: '#ef4444' }}>{item.score}分</span>
                </div>
                <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99 }}>
                  <div style={{ width: `${item.score}%`, height: '100%', background: '#ef4444', borderRadius: 99 }}></div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>建议：{item.suggestion}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>📈 学情评估智能体报告</h3>
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              综合评分78分，相比上周提升5分。<strong>「创新思维」和「应用能力」</strong>是需要重点提升的方向。
              建议每周完成1-2个实践项目，多参与代码实战。
            </p>
          </div>
        </>
      )}

      {/* 学习路径 Tab */}
      {activeTab === 'path' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>🛤️ 个性化学习路径</h3>
            {learningPath.map((item) => (
              <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #e8ecf1' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: item.status === 'completed' ? '#10b981' : (item.status === 'current' ? '#3b82f6' : '#e2e8f0'),
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0
                }}>{item.status === 'completed' ? '✓' : item.step}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{item.desc}</div>
                  <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 2 }}>智能体：{item.agent}</div>
                </div>
                {item.status === 'current' && (
                  <Link to="/canvas"><button style={{ padding: '4px 12px', fontSize: 11, background: '#3b82f6', borderRadius: 16 }}>开始</button></Link>
                )}
              </div>
            ))}
          </div>

          {/* 技能选择与方案生成 */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>🎯 技能选择与方案生成</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {skills.map(s => (
                <div key={s.id} onClick={() => toggleSkill(s.id)} style={{
                  padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                  background: s.selected ? '#3b82f6' : '#f1f5f9',
                  color: s.selected ? '#fff' : '#475569', fontSize: 13
                }}>{s.name}</div>
              ))}
            </div>
            <button onClick={generatePlan} style={{ padding: '10px 20px', fontSize: 13 }}>🚀 生成智能学习方案</button>

            {plan && (
              <div style={{ marginTop: 20, padding: 16, background: '#f0fdf4', borderRadius: 12 }}>
                <h3 style={{ color: '#10b981', fontSize: 13, marginBottom: 8 }}>✅ 你的专属学习方案</h3>
                <p style={{ fontSize: 12, marginBottom: 12 }}>{plan.desc}</p>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div><strong>周期</strong><br /><span style={{ fontSize: 12 }}>{plan.time}</span></div>
                  <div><strong>难度</strong><br /><span style={{ fontSize: 12 }}>{plan.level}</span></div>
                  <div><strong>技能</strong><br /><span style={{ fontSize: 12 }}>{plan.skills.length}项</span></div>
                </div>
                <button onClick={() => setShowFullPath(!showFullPath)} style={{ fontSize: 12, padding: '6px 16px', background: '#10b981' }}>
                  {showFullPath ? '收起完整路径' : '查看完整路径 →'}
                </button>
              </div>
            )}

            {showFullPath && (
              <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 12 }}>
                <h3 style={{ fontSize: 13, marginBottom: 12 }}>📚 完整学习路径详情</h3>
                {[
                  { step: 1, title: '理论基础学习', desc: '学习模型架构、算子原理', agent: '算法教研智能体' },
                  { step: 2, title: '可视化模型搭建', desc: '在沙盒中搭建模型，验证结构', agent: '架构引导智能体' },
                  { step: 3, title: '源码阅读与分析', desc: '学习真实开源库代码', agent: '算法教研智能体' },
                  { step: 4, title: '实战项目训练', desc: '完成实战项目，生成学习讲义', agent: '资源生成智能体' },
                  { step: 5, title: '学习评估与反馈', desc: '评估学习效果，生成改进建议', agent: '学情评估智能体' },
                ].map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{item.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{item.desc}</div>
                      <div style={{ fontSize: 10, color: '#8b5cf6' }}>负责：{item.agent}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 今日任务卡片 */}
          <div style={{ marginTop: 20, background: '#fff', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>📅 今日学习任务</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" style={{ width: 16, height: 16 }} /><span style={{ fontSize: 13 }}>完成模型搭建练习</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" style={{ width: 16, height: 16 }} /><span style={{ fontSize: 13 }}>查看学习方案</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" style={{ width: 16, height: 16 }} /><span style={{ fontSize: 13 }}>学习1节推荐课程</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}