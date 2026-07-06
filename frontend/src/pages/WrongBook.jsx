/**
 * WrongBook.jsx — 错题本
 *
 * 对应《使用手册》学生端 3.3 错题记录：
 *   - 查看错题（题干 / 你的答案 / 正确答案 / 解析）
 *   - 搜索错题（题干关键词）
 *   - 删除错题（单条/批量）
 *   - 错误次数与最近错题时间
 *
 * 数据源（在没有后端 API 之前，前端 mock + 本地缓存）：
 *   - 用 vf_wrong_book 存错题列表（{ id, qType, stem, myAns, correctAns, knowledge, errorCount, lastWrongAt }）
 *   - 默认预置 6 道错题（让新用户进入即可看到示例）
 */

import { useState, useEffect, useMemo } from 'react'
import { useLearn } from '../LearnContext.jsx'

const STORAGE_KEY = 'vf_wrong_book'

/* 预置 6 道示例错题，覆盖 3 种题型 */
const SEED_WRONG = [
  {
    id: 'w1', qType: '选择题', knowledge: 'Attention',
    stem: '在 Transformer 的自注意力机制中，Q·K^T 除以 √d 的主要目的是？',
    myAns: 'A. 减少计算量',
    correctAns: 'B. 防止 softmax 梯度消失/爆炸',
    explain: '当 d 较大时，点积方差大，会把 softmax 推入饱和区。缩放让它回到稳定分布。',
    errorCount: 3, lastWrongAt: '2026-06-15',
  },
  {
    id: 'w2', qType: '填空题', knowledge: 'CNN',
    stem: '卷积层输出尺寸 = ((输入 + 2*padding − kernel) / stride) + 1。 当输入 28、padding=1、kernel=3、stride=2 时，输出尺寸是 ____',
    myAns: '13',
    correctAns: '14',
    explain: '(28 + 2 − 3)/2 + 1 = 27/2 + 1 = 13.5 + 1 = 14（向下取整后）实际是 floor((28+2-3)/2)+1 = 14。',
    errorCount: 2, lastWrongAt: '2026-06-12',
  },
  {
    id: 'w3', qType: '简答题', knowledge: 'SAM',
    stem: '请简述 SAM 的 Prompt Encoder 与 Mask Decoder 在推理时的数据流。',
    myAns: 'Prompt Encoder 把 prompt 转 embedding 然后 Mask Decoder 输出 mask。',
    correctAns: 'Prompt Encoder（sparse/dense/box 三类）→ 编码为 256-d token，与 image embedding 一同送入 Mask Decoder，经过 2 层 self/cross-attn + token 升维，输出 mask + IoU。',
    explain: '重点：3 类 prompt 分支、image embedding 来自 ViT、双层 transformer decoder、动态 mask 输出。',
    errorCount: 1, lastWrongAt: '2026-06-10',
  },
  {
    id: 'w4', qType: '编程题', knowledge: 'PyTorch',
    stem: '补全代码：用 torchvision 加载 CIFAR-10 训练集，并做归一化到 [-1, 1]。',
    myAns: `transform = transforms.Compose([\n  transforms.ToTensor(),\n])\ntrain = datasets.CIFAR10(root, train=True, transform=transform)`,
    correctAns: `transform = transforms.Compose([\n  transforms.ToTensor(),\n  transforms.Normalize((0.5,)*3, (0.5,)*3),\n])\ntrain = datasets.CIFAR10(root, train=True, transform=transform, download=True)`,
    explain: '归一化公式 (x - mean)/std，要映射到 [-1,1] 即 mean=0.5、std=0.5（针对每通道）。',
    errorCount: 2, lastWrongAt: '2026-06-08',
  },
  {
    id: 'w5', qType: '选择题', knowledge: '目标检测',
    stem: 'YOLOv5 在 Neck 部分使用的结构是？',
    myAns: 'FPN',
    correctAns: 'PANet（特征金字塔 + 自底向上聚合）',
    explain: 'YOLOv5 用的是修改版的 PANet（在 FPN 之上加自底向上路径），不是单纯的 FPN。',
    errorCount: 1, lastWrongAt: '2026-06-05',
  },
  {
    id: 'w6', qType: '填空题', knowledge: '反向传播',
    stem: '链式法则下，损失 L 对 w_ij 的梯度 ∂L/∂w_ij = ____',
    myAns: 'δ_i · x_j',
    correctAns: 'δ_i · x_j （其中 δ_i = ∂L/∂z_i 是该节点的误差项）',
    explain: '标准反向传播写法的两个分量：误差项 δ 与前层激活 x。注意 w_ij 是 i→j 还是 j→i。',
    errorCount: 4, lastWrongAt: '2026-06-02',
  },
]

function loadList() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(s) && s.length) return s
  } catch {}
  /* 第一次进入：写一次种子 */
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_WRONG))
  return SEED_WRONG
}

export default function WrongBook() {
  const learn = useLearn()
  const [list, setList] = useState(loadList)
  const [keyword, setKeyword] = useState('')
  const [filterType, setFilterType] = useState('全部')
  const [selected, setSelected] = useState(null) // 当前展开的错题 id
  const [toast, setToast] = useState({ kind: '', message: '' })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }, [list])

  useEffect(() => {
    if (!toast.message) return
    const t = setTimeout(() => setToast({ kind: '', message: '' }), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    return list.filter(w => {
      if (filterType !== '全部' && w.qType !== filterType) return false
      if (!keyword.trim()) return true
      const kw = keyword.trim().toLowerCase()
      return (w.stem + w.knowledge + w.explain).toLowerCase().includes(kw)
    })
  }, [list, keyword, filterType])

  const stats = useMemo(() => ({
    total: list.length,
    knowledgeCount: new Set(list.map(w => w.knowledge)).size,
    mostErrored: [...list].sort((a, b) => b.errorCount - a.errorCount)[0],
  }), [list])

  const removeOne = (id) => {
    if (!window.confirm('确定删除这条错题？')) return
    setList(p => p.filter(x => x.id !== id))
    setToast({ kind: 'success', message: '已删除' })
  }

  const removeBatch = () => {
    if (!window.confirm(`确定删除全部 ${list.length} 条错题？此操作不可撤销！`)) return
    setList([])
    setToast({ kind: 'success', message: '已清空错题本' })
  }

  const removeFiltered = () => {
    if (!window.confirm(`确定按当前筛选删除 ${filtered.length} 条错题？`)) return
    const keepIds = new Set(filtered.map(w => w.id))
    setList(p => p.filter(w => !keepIds.has(w.id)))
    setToast({ kind: 'success', message: `已删除 ${filtered.length} 条` })
  }

  /* 把错题关联知识点推送回 LearnContext 的 weakTopics，用于推荐资源 */
  const injectIntoWeak = () => {
    const knowledge = [...new Set(list.map(w => w.knowledge))]
    try {
      const cur = JSON.parse(localStorage.getItem('vf_learn_state_v2') || '{}')
      const ws = new Set(cur.weakTopics || [])
      knowledge.forEach(k => ws.add(k))
      cur.weakTopics = [...ws]
      localStorage.setItem('vf_learn_state_v2', JSON.stringify(cur))
      setToast({ kind: 'success', message: `已把 ${knowledge.length} 个知识点推入「今日推荐」` })
    } catch {}
  }

  /* 加入模拟练习：把错题作为题源，跳到资源生成/学习助手 */
  const askTutorAbout = (knowledge) => {
    if (!knowledge) return
    const msg = `请针对「${knowledge}」给我讲解错题本中的题目，并推荐 3 个相关练习。`
    try {
      localStorage.setItem('vf_pending_message', msg)
      window.location.hash = '#/'
    } catch {}
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>📝 错题本</h2>
        <p style={{ fontSize: 13, color: '#64748b' }}>集中查看历史错题，针对性回顾 + 推送给 AI 导师讲解</p>
      </div>

      {/* Toast */}
      {toast.message && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13,
          background: toast.kind === 'success' ? '#f0fdf4' : '#fef2f2',
          color: toast.kind === 'success' ? '#15803d' : '#dc2626',
          border: `1px solid ${toast.kind === 'success' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {toast.message}
        </div>
      )}

      {/* 顶部统计条 */}
      <div style={{
        display: 'flex', gap: 14, marginBottom: 18,
        background: '#fff', borderRadius: 12, padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>📚</span>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>累计错题</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{stats.total}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>涉及知识点</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{stats.knowledgeCount}</div>
          </div>
        </div>
        <div style={{ flex: 1.4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>最高频错点</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
              {stats.mostErrored ? `${stats.mostErrored.knowledge} (${stats.mostErrored.errorCount}次)` : '—'}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>🔥</span>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>最近错题</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              {list.length ? new Date(Math.max(...list.map(w => new Date(w.lastWrongAt).getTime()))).toLocaleDateString('zh-CN') : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center',
        background: '#fff', borderRadius: 12, padding: '12px 14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {/* 搜索框（对应手册：搜索错题） */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="🔍 按题干或知识点关键词搜索…"
            style={{
              width: '100%', padding: '8px 12px', fontSize: 12,
              border: '1px solid #e2e8f0', borderRadius: 10, background: '#fafbfc',
              outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff' }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#fafbfc' }} />
        </div>
        {/* 题型筛选 */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{
          padding: '8px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 10,
          background: '#fafbfc', color: '#475569', cursor: 'pointer',
        }}>
          {['全部', '选择题', '填空题', '简答题', '编程题'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={injectIntoWeak} title="把错题本中的知识点推入你的画像/推荐位" style={{
          padding: '8px 14px', fontSize: 12,
          background: 'linear-gradient(90deg, #3b82f6, #6366f1)', color: '#fff',
          border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
        }}>📤 推送给 AI 导师</button>
        <button onClick={removeFiltered} disabled={!filtered.length} style={{
          padding: '8px 14px', fontSize: 12, background: '#fff', color: '#f59e0b',
          border: '1px solid #fde68a', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
          opacity: filtered.length ? 1 : 0.5,
        }}>🧹 清当前筛选</button>
        <button onClick={removeBatch} disabled={!list.length} style={{
          padding: '8px 14px', fontSize: 12, background: '#fff', color: '#ef4444',
          border: '1px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontWeight: 600,
          opacity: list.length ? 1 : 0.5,
        }}>🗑️ 清空全部</button>
      </div>

      {/* 列表 */}
      {!list.length && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center',
          color: '#94a3b8', fontSize: 13,
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 14, color: '#475569', fontWeight: 600, marginBottom: 6 }}>错题本空空如也</div>
          <div>完成练习后的错题会自动汇总到这里</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((w) => {
          const isOpen = selected === w.id
          return (
            <div key={w.id} style={{
              background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: isOpen ? '1px solid #3b82f6' : '1px solid transparent',
              overflow: 'hidden', transition: 'all 0.2s',
            }}>
              {/* 收起态：单行摘要 */}
              <div onClick={() => setSelected(isOpen ? null : w.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                cursor: 'pointer',
              }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: '#eff6ff', color: '#1e40af', fontWeight: 600, flexShrink: 0,
                }}>{w.qType}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 6,
                    background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600 }}>📌 {w.knowledge}</span>
                  <span style={{
                    fontSize: 13, color: '#1e293b', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{w.stem}</span>
                </div>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ ×{w.errorCount}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{w.lastWrongAt}</span>
                <span style={{ fontSize: 10, color: '#cbd5e1', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }}>▼</span>
              </div>

              {/* 展开态：完整错题 */}
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px dashed #e2e8f0', paddingTop: 14 }}>
                  <div style={{ fontSize: 14, color: '#1e293b', marginBottom: 12, lineHeight: 1.6, fontWeight: 500 }}>
                    {w.stem}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>你的答案（错误）</div>
                      <div style={{ color: '#dc2626', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{w.myAns}</div>
                    </div>
                    <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 8, fontSize: 12 }}>
                      <div style={{ color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>正确答案</div>
                      <div style={{ color: '#15803d', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{w.correctAns}</div>
                    </div>
                  </div>

                  <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 解析</div>
                    <div>{w.explain}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => askTutorAbout(w.knowledge)} style={{
                      padding: '6px 12px', fontSize: 12, background: '#eff6ff', color: '#1e40af',
                      border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                    }}>🤖 让 AI 导师讲解这个知识点</button>
                    <button onClick={() => removeOne(w.id)} style={{
                      padding: '6px 12px', fontSize: 12, background: '#fff', color: '#ef4444',
                      border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                      marginLeft: 'auto',
                    }}>🗑️ 删除这条</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
