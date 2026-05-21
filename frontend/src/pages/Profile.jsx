import React, { useContext, useState } from 'react'
import { UserContext } from '../App'

export default function Profile() {
  const { user, setUser } = useContext(UserContext)
  
  // 学习画像6维度
  const [profile, setProfile] = useState({
    knowledgeBase: 75,      // 知识基础
    cognitiveStyle: 68,     // 认知风格（视觉型/听觉型/动手型）
    mistakePreference: 45,  // 易错点偏好
    learningPace: 70,       // 学习节奏（慢/中/快）
    interestLevel: 85,      // 兴趣程度
    codeAbility: 62         // 代码能力
  })

  const [showDialog, setShowDialog] = useState(false)
  const [dialogQuestion, setDialogQuestion] = useState('')
  const [dialogMessages, setDialogMessages] = useState([
    { role: 'assistant', text: '你好！我是学习画像构建助手。请告诉我你的学习情况，我会帮你生成6维学习画像。\n\n你可以告诉我：\n• 你目前的知识基础如何？\n• 你喜欢哪种学习方式？\n• 你在哪些知识点上容易出错？' }
  ])
  const [dialogInput, setDialogInput] = useState('')

  // 更新画像维度
  const updateProfile = (key, value) => {
    setProfile({ ...profile, [key]: value })
  }

  // 提交画像
  const submitProfile = () => {
    setUser({ ...user, learningProfile: profile })
    alert('学习画像已保存！系统将根据你的画像推荐个性化学习路径')
    setShowDialog(false)
  }

  const sendDialogMessage = () => {
    if (!dialogInput.trim()) return
    setDialogMessages([...dialogMessages, { role: 'user', text: dialogInput }])
    const userInput = dialogInput
    setDialogInput('')
    
    // 模拟AI分析并更新画像
    setTimeout(() => {
      let response = ''
      let updates = {}
      
      if (userInput.includes('基础') || userInput.includes('知识')) {
        response = '了解你的知识基础情况。我会据此调整你的「知识基础」维度。'
        updates.knowledgeBase = Math.min(100, profile.knowledgeBase + 10)
      } else if (userInput.includes('视觉') || userInput.includes('看')) {
        response = '你是视觉型学习者！我会调整你的「认知风格」维度。'
        updates.cognitiveStyle = 85
      } else if (userInput.includes('动手') || userInput.includes('实践')) {
        response = '你是动手实践型学习者！这会影响你的学习画像。'
        updates.cognitiveStyle = 80
      } else if (userInput.includes('出错') || userInput.includes('易错')) {
        response = '已记录你的易错点，我会在推荐中重点关注这些内容。'
        updates.mistakePreference = Math.min(100, profile.mistakePreference + 15)
      } else if (userInput.includes('快') || userInput.includes('进度')) {
        response = '你学习节奏较快，我会为你安排更有挑战性的内容。'
        updates.learningPace = 85
      } else if (userInput.includes('慢')) {
        response = '你偏好稳健的学习节奏，我会安排更详细的教学内容。'
        updates.learningPace = 50
      } else {
        response = '感谢分享！我会综合分析你的回答，不断完善你的学习画像。\n\n你可以继续告诉我：\n• 你的专业背景\n• 感兴趣的方向\n• 学习中的困难'
      }
      
      setProfile({ ...profile, ...updates })
      setDialogMessages(prev => [...prev, { role: 'assistant', text: response }])
    }, 1000)
  }

  const dimensions = [
    { key: 'knowledgeBase', name: '知识基础', icon: '📚', desc: '对计算机视觉、深度学习的基础了解程度', color: '#3b82f6' },
    { key: 'cognitiveStyle', name: '认知风格', icon: '🧠', desc: '视觉型/听觉型/动手实践型学习偏好', color: '#10b981' },
    { key: 'mistakePreference', name: '易错点', icon: '⚠️', desc: '容易出错的知识点和题型', color: '#ef4444' },
    { key: 'learningPace', name: '学习节奏', icon: '⚡', desc: '学习进度快慢偏好', color: '#f59e0b' },
    { key: 'interestLevel', name: '兴趣程度', icon: '❤️', desc: '对CV领域的兴趣强度', color: '#ec489a' },
    { key: 'codeAbility', name: '代码能力', icon: '💻', desc: '编程和算法实现能力', color: '#8b5cf6' },
  ]

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>我的学习中心</h2>
        <p style={{ color: '#64748b', fontSize: 14 }}>管理个人信息，完善学习画像</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* 左侧个人信息 */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 48, color: '#fff'
            }}>{user.avatar || '👤'}</div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{user.name}</h3>
            <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>{user.studentId}</p>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
            <h4 style={{ marginBottom: 16, fontSize: 14 }}>基本信息</h4>
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <p><span style={{ color: '#64748b' }}>学院：</span> {user.college}</p>
              <p><span style={{ color: '#64748b' }}>专业：</span> {user.major}</p>
              <p><span style={{ color: '#64748b' }}>学习时长：</span> 126小时</p>
              <p><span style={{ color: '#64748b' }}>完成课程：</span> 9门</p>
            </div>
          </div>

          <button 
            onClick={() => setShowDialog(true)}
            style={{ width: '100%', marginTop: 20, padding: 12, borderRadius: 12 }}
          >
            📝 对话式画像构建
          </button>
        </div>

        {/* 右侧学习画像 */}
        <div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18 }}>6维度学习画像</h3>
              <button onClick={submitProfile} style={{ padding: '6px 16px', fontSize: 12, boxShadow: 'none' }}>保存画像</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {dimensions.map(dim => (
                <div key={dim.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{dim.icon}</span>
                      <span style={{ fontWeight: 500 }}>{dim.name}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{dim.desc}</span>
                    </div>
                    <span style={{ color: dim.color, fontWeight: 600 }}>{profile[dim.key]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={profile[dim.key]}
                    onChange={(e) => updateProfile(dim.key, parseInt(e.target.value))}
                    style={{ width: '100%', height: 6, borderRadius: 3, accentColor: dim.color }}
                  />
                  <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginTop: 4 }}>
                    <div style={{ width: `${profile[dim.key]}%`, height: '100%', background: dim.color, borderRadius: 99 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 推荐内容 */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>🎯 基于画像的推荐</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: '#f0fdf4', borderRadius: 12 }}>
                <span style={{ fontSize: 24 }}>📖</span>
                <div>
                  <div style={{ fontWeight: 500 }}>推荐课程：SAM模型从入门到实战</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>基于你的代码能力(62%)和兴趣程度(85%)推荐</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: '#eff6ff', borderRadius: 12 }}>
                <span style={{ fontSize: 24 }}>🎨</span>
                <div>
                  <div style={{ fontWeight: 500 }}>推荐实践：可视化模型搭建</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>基于你的认知风格推荐动手实践</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, background: '#fffbeb', borderRadius: 12 }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 500 }}>易错点强化：注意力机制专题</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>针对你的易错点偏好(45%)专项训练</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 对话式画像构建弹窗 */}
      {showDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: 500, height: 600, background: '#fff', borderRadius: 20,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16 }}>📝 对话式学习画像构建</h3>
              <button onClick={() => setShowDialog(false)} style={{ background: 'transparent', color: '#64748b', boxShadow: 'none', fontSize: 20 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f8fafc' }}>
              {dialogMessages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                    background: msg.role === 'user' ? '#3b82f6' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#1e293b',
                    border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                    fontSize: 13
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
              <input
                style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                value={dialogInput}
                onChange={e => setDialogInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendDialogMessage()}
                placeholder="告诉我你的学习情况..."
              />
              <button onClick={sendDialogMessage} style={{ padding: '0 20px', borderRadius: 12 }}>发送</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}