import React, { useState, useEffect, useMemo } from 'react'
import { useLearn } from '../LearnContext.jsx'
import { useToasts, ToastStack } from '../components/resources/Toast'
import { fetchLearningMaterials, generateLearningMaterial, generateLearningMaterialsBatch, fetchLearningMaterialById } from '../api.js'

/* ══════════════ 演示资源数据 ══════════════ */
const DEMO_RESOURCES = [
  { id: 1, title: 'SAM模型从入门到实战', type: '讲义', emoji: '📚', color: '#3b82f6', bg: '#eff6ff', desc: '从零掌握视觉分割模型 SAM 的核心架构与微调方法', author: 'Architect 智能体', time: '4.5小时', icon: '📖' },
  { id: 2, title: '计算机视觉知识思维导图', type: '思维导图', emoji: '🗺️', color: '#a855f7', bg: '#faf5ff', desc: 'Backbone/Neck/Head 全架构知识图谱一图掌握', author: 'Tutor 智能体', time: '2小时', icon: '🧠' },
  { id: 3, title: 'SAM 模型练习题集', type: '练习题', emoji: '📝', color: '#22c55e', bg: '#f0fdf4', desc: '12道选择题+3道简答+2道编程实战题', author: 'Evaluator 智能体', time: '3小时', icon: '✏️' },
  { id: 4, title: '图像分割教学PPT大纲', type: 'PPT大纲', emoji: '📊', color: '#f59e0b', bg: '#fffbeb', desc: '15页结构化幻灯片，覆盖从CNN到Transformer的分割演进', author: 'Generator 智能体', time: '1.5小时', icon: '📑' },
  { id: 5, title: 'Attention 机制拓展阅读', type: '拓展阅读', emoji: '📄', color: '#ef4444', bg: '#fef2f2', desc: '5篇必读论文 + 阅读指南 + 思考题', author: 'Tutor 智能体', time: '6小时', icon: '📰' },
  { id: 6, title: 'PyTorch 遥感图像分割实战', type: '实操案例', emoji: '💻', color: '#06b6d4', bg: '#ecfeff', desc: '环境配置→数据预处理→模型训练→结果分析完整流程', author: 'Generator 智能体', time: '8小时', icon: '🔬' },
  { id: 7, title: 'YOLO 检测管线详解', type: '讲义', emoji: '📚', color: '#8b5cf6', bg: '#f5f3ff', desc: 'ResNet50+PAN+YOLO Head 完整检测管线解析', author: 'Architect 智能体', time: '5小时', icon: '📖' },
  { id: 8, title: 'ViT 与 Transformer 架构精讲', type: '讲义', emoji: '📚', color: '#ec4899', bg: '#fdf2f8', desc: '从 Self-Attention 到 Vision Transformer 全面剖析', author: 'Tutor 智能体', time: '6小时', icon: '📖' },
]

/* ══════════════ 资源详情内容生成 ══════════════ */
function getResourceContent(item) {
  const t = item.title
  switch (item.type) {
    case '讲义':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">📖 ${t}</h3>
<p>本讲义由 <b>AI 智能体</b> 根据你的学习画像自动生成，覆盖以下模块：</p>
<h4 style="color:#3b82f6">一、核心概念</h4>
<p>深入理解 ${t} 的基本原理与关键机制，从理论层面建立扎实的知识基础。</p>
<h4 style="color:#3b82f6">二、架构设计</h4>
<p>详细拆解模型结构，包括 Backbone → Neck → Head 各模块的设计思路与连接方式。</p>
<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px">
# 伪代码示例
model = Backbone("ResNet50")
model.add(Neck("FPN"))
model.add(Head("Mask_Decoder"))
output = model.forward(input_image)</pre>
<h4 style="color:#3b82f6">三、实战指南</h4>
<ul><li>环境配置与依赖安装</li><li>数据集准备与预处理</li><li>训练配置与超参数调优</li><li>模型评估与结果分析</li></ul>
<h4 style="color:#3b82f6">四、学习建议</h4>
<p>建议按 <b>理论→代码→实验→总结</b> 的顺序学习，每完成一章做对应的练习题巩固。</p>
</div>`
    case '思维导图':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">🗺️ ${t}</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px">
<tr style="background:#f8fafc"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">知识模块</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">关键内容</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">重要度</th></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>Backbone 主干网络</b></td><td style="padding:8px;border:1px solid #e2e8f0">ResNet / ViT / SAM / Swin</td><td style="padding:8px;border:1px solid #e2e8f0">⭐⭐⭐⭐⭐</td></tr>
<tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0"><b>Neck 特征融合</b></td><td style="padding:8px;border:1px solid #e2e8f0">FPN / BiFPN / PAN / ASPP</td><td style="padding:8px;border:1px solid #e2e8f0">⭐⭐⭐⭐</td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>Head 检测头</b></td><td style="padding:8px;border:1px solid #e2e8f0">YOLO / Mask Decoder / BBox</td><td style="padding:8px;border:1px solid #e2e8f0">⭐⭐⭐⭐⭐</td></tr>
<tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0"><b>Adapter 微调</b></td><td style="padding:8px;border:1px solid #e2e8f0">LoRA / IA3 / BitFit</td><td style="padding:8px;border:1px solid #e2e8f0">⭐⭐⭐</td></tr>
<tr><td style="padding:8px;border:1px solid #e2e8f0"><b>数据处理</b></td><td style="padding:8px;border:1px solid #e2e8f0">Resize / Normalize / Augment</td><td style="padding:8px;border:1px solid #e2e8f0">⭐⭐⭐⭐</td></tr>
</table>
<p style="margin-top:16px"><b>学习路径：</b>基础概念 → 核心原理 → 代码实践 → 论文复现 → 项目实战</p>
</div>`
    case '练习题':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">📝 ${t}</h3>
<h4 style="color:#22c55e">一、选择题（每题5分）</h4>
<p><b>1.</b> SAM 模型中 Mask Decoder 的核心输入不包括？</p>
<p style="color:#64748b;margin-left:16px">A. Image Embedding &nbsp; B. Prompt Embedding &nbsp; <b style="color:#22c55e">C. Class Label ✓</b> &nbsp; D. Positional Encoding</p>
<p><b>2.</b> 以下哪项不属于 Backbone 的常见选择？</p>
<p style="color:#64748b;margin-left:16px">A. ResNet50 &nbsp; B. ViT_Base &nbsp; <b style="color:#22c55e">C. Adam Optimizer ✓</b> &nbsp; D. SAM_ViT_B</p>
<h4 style="color:#22c55e;margin-top:20px">二、简答题（每题15分）</h4>
<p><b>1.</b> 简述 FPN（Feature Pyramid Network）解决的核心问题及其工作原理。</p>
<p><b>2.</b> 比较 LoRA 微调与全量 Fine-tuning 的优缺点。</p>
<h4 style="color:#22c55e;margin-top:20px">三、编程实战（30分）</h4>
<p>使用 PyTorch 构建一个包含 ResNet50 Backbone + FPN Neck + 自定义 Head 的模型，并完成前向传播测试。</p>
</div>`
    case 'PPT大纲':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">📊 ${t}</h3>
<p><b>共 15 页幻灯片</b>，结构如下：</p>
<ol>
<li><b>封面</b> — 课程标题、学习目标、适用人群</li>
<li><b>背景与动机</b> — 为什么需要图像分割？应用场景展示</li>
<li><b>传统方法回顾</b> — 阈值法、边缘检测、区域生长的局限性</li>
<li><b>CNN 时代的分割</b> — FCN、U-Net 的核心创新</li>
<li><b>SAM 模型架构</b> — Image Encoder + Prompt Encoder + Mask Decoder</li>
<li><b>Prompt Engineering</b> — Point、Box、Mask 三种提示方式</li>
<li><b>Backbone 详解</b> — ViT 在 SAM 中的角色</li>
<li><b>Neck 与特征融合</b> — FPN/BiFPN 在检测中的关键作用</li>
<li><b>Head 设计</b> — 分类头、检测头、分割头的差异</li>
<li><b>微调策略</b> — LoRA/IA3 参数高效微调实践</li>
<li><b>实验设计与评估</b> — IoU/mAP 指标解读</li>
<li><b>常见问题与调优</b> — 过拟合、梯度消失的解决方案</li>
<li><b>实战案例</b> — 玉米病斑检测完整流程</li>
<li><b>总结与展望</b> — 视觉大模型的发展趋势</li>
<li><b>Q&A</b> — 互动问答</li>
</ol>
</div>`
    case '拓展阅读':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">📄 ${t}</h3>
<h4 style="color:#ef4444">经典必读论文（3篇）</h4>
<p><b>1. "Attention Is All You Need"</b> — Vaswani et al., NeurIPS 2017<br/><span style="color:#64748b">Transformer 架构的开山之作，奠定了 Self-Attention 的理论基础。</span></p>
<p><b>2. "Segment Anything"</b> — Kirillov et al., ICCV 2023<br/><span style="color:#64748b">SAM 模型论文，提出了可提示的图像分割框架，含 11M 图像数据集。</span></p>
<p><b>3. "Deep Residual Learning for Image Recognition"</b> — He et al., CVPR 2016<br/><span style="color:#64748b">ResNet 残差网络，解决了深层网络训练困难的问题，引用超 15 万次。</span></p>
<h4 style="color:#ef4444;margin-top:16px">进阶推荐（2篇）</h4>
<p><b>4. "Feature Pyramid Networks for Object Detection"</b> — Lin et al., CVPR 2017</p>
<p><b>5. "LoRA: Low-Rank Adaptation of Large Language Models"</b> — Hu et al., ICLR 2022</p>
<p style="margin-top:16px;background:#fef2f2;padding:10px;border-radius:8px"><b>📌 阅读建议：</b>按 1→3→4→2→5 顺序阅读，预计总耗时 8-10 小时。每篇论文读完写 200 字摘要加深理解。</p>
</div>`
    case '实操案例':
      return `<div style="font-size:14px;line-height:1.9;color:#334155">
<h3 style="color:#1e293b;margin-top:0">💻 ${t}</h3>
<h4 style="color:#06b6d4">1. 环境准备</h4>
<pre style="background:#f1f5f9;padding:10px;border-radius:8px;font-size:12px">pip install torch torchvision opencv-python numpy matplotlib</pre>
<h4 style="color:#06b6d4">2. 数据预处理</h4>
<pre style="background:#f1f5f9;padding:10px;border-radius:8px;font-size:12px">from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T

class SegDataset(Dataset):
    def __init__(self, image_dir, mask_dir, transform=None):
        self.images = sorted(os.listdir(image_dir))
        self.masks = sorted(os.listdir(mask_dir))
        self.transform = transform or T.Compose([
            T.ToTensor(), T.Resize((512, 512))
        ])</pre>
<h4 style="color:#06b6d4">3. 模型构建</h4>
<p>使用 ResNet50 Backbone + FPN Neck + 自定义分割 Head</p>
<h4 style="color:#06b6d4">4. 训练配置</h4>
<p>学习率 1e-4 | Batch Size 8 | Epochs 50 | AdamW 优化器 | Dice Loss + BCE Loss</p>
<h4 style="color:#06b6d4">5. 评估指标</h4>
<p>预期 IoU ≥ 0.78 | Dice ≥ 0.85 | 推理速度 ≥ 15 FPS</p>
</div>`
    default:
      return `<div style="font-size:14px;line-height:1.9;color:#334155"><h3>${t}</h3><p>${item.desc}</p></div>`
  }
}

/* ══════════════ 主组件 ══════════════ */
export default function Resources() {
  const learn = useLearn()
  const [searchParams] = (() => { try { return [new URLSearchParams(window.location.hash.split('?')[1] || '')] } catch (_) { return [new URLSearchParams()] } })()
  const urlTab = searchParams.get('tab') || 'recommend'
  const [activeTab, setActiveTab] = useState(urlTab === 'generate' ? 'generate' : 'recommend')
  const { toasts, pushToast, removeToast } = useToasts()

  // 详情弹窗
  const [detailItem, setDetailItem] = useState(null)

  // 生成状态
  const [genSessionId, setGenSessionId] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genBatch, setGenBatch] = useState(false)

  const handleGenerate = async () => {
    if (!genSessionId.trim()) { pushToast({ type: 'error', title: '请输入会话ID', icon: '⚠️' }); return }
    setGenLoading(true); setGenResult(null)
    try {
      const res = genBatch
        ? await generateLearningMaterialsBatch(genSessionId.trim())
        : await generateLearningMaterial(genSessionId.trim())
      if (res?.status === 'success') {
        setGenResult(res.data)
        pushToast({ type: 'success', title: genBatch ? `已生成 ${res.data.count} 种材料` : '讲义已生成', icon: '✅' })
      }
    } catch (e) { pushToast({ type: 'error', title: '生成失败', detail: e.message, icon: '❌' }) }
    finally { setGenLoading(false) }
  }

  /* ══════════════ 资源卡片 ══════════════ */
  const Card = ({ item }) => (
    <div
      onClick={() => {
        const content = getResourceContent(item)
        setDetailItem({ ...item, content })
      }}
      style={{
        background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        border: '1px solid #f1f5f9', transition: 'all 0.25s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div style={{ height: 80, background: item.bg || `linear-gradient(135deg, ${item.color}22, ${item.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{item.emoji}</div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>{item.title}</h3>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: item.bg || '#f1f5f9', color: item.color, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8 }}>{item.type}</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 12, margin: '6px 0 10px', lineHeight: 1.5 }}>{item.desc}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          <span>🤖 {item.author}</span><span>⏱️ {item.time}</span>
        </div>
        <button style={{
          width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${item.color}30`,
          background: item.bg || '#f8fafc', color: item.color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>查看详情 →</button>
      </div>
    </div>
  )

  /* ══════════════ 详情弹窗 ══════════════ */
  const DetailModal = () => !detailItem ? null : (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDetailItem(null)}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 720, width: '92%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{detailItem.emoji}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>{detailItem.title}</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{detailItem.type} · {detailItem.author} · {detailItem.time}</div>
            </div>
          </div>
          <button onClick={() => setDetailItem(null)} style={{ background: '#f1f5f9', border: 'none', fontSize: 20, width: 36, height: 36, borderRadius: 18, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }} dangerouslySetInnerHTML={{ __html: detailItem.content || `<p>${detailItem.desc}</p>` }} />
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button onClick={() => setDetailItem(null)} style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>关闭</button>
        </div>
      </div>
    </div>
  )

  /* ══════════════ 渲染 ══════════════ */
  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #e8ecf1', paddingBottom: 12 }}>
        {[
          { key: 'recommend', label: '⭐ 推荐资源' },
          { key: 'generate', label: '✨ 资源生成' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: activeTab === tab.key ? '#3b82f6' : '#f1f5f9',
            color: activeTab === tab.key ? '#fff' : '#64748b',
            transition: 'all 0.2s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ─── 推荐资源 Tab ─── */}
      {activeTab === 'recommend' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: '1px solid #c7d2fe', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎯</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>基于学习画像智能推荐</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>目标：{learn.goal === '自定义目标' ? (learn.customGoal || '自定义') : (learn.goal || '尚未选择')} · 阶段：{learn.stage || '主线中'}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
            {DEMO_RESOURCES.map(item => <Card key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* ─── 资源生成 Tab ─── */}
      {activeTab === 'generate' && <GenerateTabContent />}

      <DetailModal />
      <ToastStack toasts={toasts} onClose={removeToast} />
    </div>
  )
}

/* ══════════════ 资源生成 Tab 完整演示版 ══════════════ */
function GenerateTabContent() {
  const learn = useLearn()
  const { pushToast } = useToasts()
  const [genLoading, setGenLoading] = useState(false)
  const [genDone, setGenDone] = useState(false)
  const [activeModule, setActiveModule] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [stepIdx, setStepIdx] = useState(-1)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = React.useRef(null)

  const DEMO_PACK = {
    讲义: { icon: '📚', color: '#3b82f6', content: getResourceContent({ title: 'SAM 模型架构精讲', type: '讲义' }) },
    思维导图: { icon: '🗺️', color: '#a855f7', content: getResourceContent({ title: '计算机视觉知识全景', type: '思维导图' }) },
    练习题: { icon: '📝', color: '#22c55e', content: getResourceContent({ title: '视觉模型专项练习', type: '练习题' }) },
    PPT大纲: { icon: '📊', color: '#f59e0b', content: getResourceContent({ title: '图像分割教学课件', type: 'PPT大纲' }) },
    拓展阅读: { icon: '📄', color: '#ef4444', content: getResourceContent({ title: '必读论文推荐', type: '拓展阅读' }) },
    实操案例: { icon: '💻', color: '#06b6d4', content: getResourceContent({ title: 'PyTorch 分割实战', type: '实操案例' }) },
    动画演示: { icon: '🎬', color: '#ec4899', content: '' },
  }

  const handleGenerate = () => {
    setGenLoading(true); setGenDone(false); setAnimating(true); setStepIdx(0); setElapsed(0)
    const start = Date.now()
    timerRef.current = setInterval(() => setElapsed(Date.now() - start), 50)
    const steps = [
      { delay: 800, idx: 1, log: '🏗️ Architect 解析需求 → 识别学习目标：SAM 模型微调' },
      { delay: 1600, idx: 2, log: '📖 Tutor 检索源码 → 匹配 code_mirror/SE_Block.py' },
      { delay: 2400, idx: 3, log: '📝 Generator 生成讲义 → 组装 Mermaid 拓扑图' },
      { delay: 3000, idx: 4, log: '🔍 Evaluator 质量校验 → 论文基准比对完成' },
    ]
    steps.forEach(s => {
      setTimeout(() => setStepIdx(s.idx), s.delay)
    })
    setTimeout(() => {
      clearInterval(timerRef.current)
      setElapsed(Date.now() - start)
      setStepIdx(5)
      setGenLoading(false)
      setGenDone(true)
      setAnimating(false)
      pushToast({ type: 'success', title: '🎉 学习包生成完成！含 7 个模块', icon: '✅', duration: 3000 })
    }, 3800)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  if (genDone) {
    return <GeneratedPack modules={DEMO_PACK} active={activeModule} setActive={setActiveModule} onRegen={() => { setGenDone(false); setStepIdx(-1); setElapsed(0) }} />
  }

  const flowSteps = [
    { icon: '🏗️', name: 'Architect', desc: '架构分析', color: '#38bdf8' },
    { icon: '📖', name: 'Tutor', desc: '源码教研', color: '#a78bfa' },
    { icon: '📝', name: 'Generator', desc: '资源生成', color: '#22d3ee' },
    { icon: '🔍', name: 'Evaluator', desc: '质量评估', color: '#34d399' },
  ]

  return (
    <div>
      {/* 生成触发区 */}
      <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚀</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#065f46', margin: '0 0 4px' }}>一键生成完整学习包</h2>
          <p style={{ fontSize: 13, color: '#047857', margin: 0 }}>四智能体协同，根据用户学情，生成完整学习资料</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={handleGenerate} disabled={genLoading} style={{
            padding: '12px 40px', borderRadius: 12, border: 'none', cursor: genLoading ? 'not-allowed' : 'pointer',
            background: genLoading ? '#86efac' : 'linear-gradient(135deg,#10b981,#059669)',
            color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: 1,
            boxShadow: genLoading ? 'none' : '0 6px 24px rgba(16,185,129,0.35)',
            transition: 'all 0.3s',
          }}>{genLoading ? '⏳ 智能体协作中...' : '🎯 一键生成学习包'}</button>
          {animating && <div style={{ fontSize: 12, color: '#047857', marginTop: 8 }}>已耗时 {Math.round(elapsed / 100) / 10}s</div>}
        </div>
      </div>

      {/* 四智能体流水线动画 */}
      {animating && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {flowSteps.map((s, i) => {
            const status = i < stepIdx ? 'done' : i === stepIdx ? 'running' : 'waiting'
            return (
              <div key={i} style={{
                background: status === 'running' ? `${s.color}12` : status === 'done' ? '#f0fdf4' : '#f8fafc',
                border: `2px solid ${status === 'running' ? s.color : status === 'done' ? '#10b981' : '#e2e8f0'}`,
                borderRadius: 12, padding: '16px 14px', textAlign: 'center', transition: 'all 0.3s',
                boxShadow: status === 'running' ? `0 0 20px ${s.color}33` : 'none',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6, animation: status === 'running' ? 'spin 1.5s linear infinite' : 'none' }}>
                  {status === 'done' ? '✅' : s.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: status === 'running' ? s.color : status === 'done' ? '#059669' : '#94a3b8' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: status === 'done' ? '#059669' : status === 'running' ? s.color : '#cbd5e1' }}>
                  {status === 'done' ? '✓ 完成' : status === 'running' ? '⚡ 执行中...' : '○ 等待'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 等待中的占位 */}
      {!animating && !genDone && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>🎬</div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', margin: 0 }}>点击上方按钮，观看四智能体流水线演示</h3>
          <p style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>含动画生成过程 + 7 个可交互模块</p>
        </div>
      )}
    </div>
  )
}

/* ══════════════ 生成结果展示 ══════════════ */
function GeneratedPack({ modules, active, setActive, onRegen }) {
  const [previewType, setPreviewType] = useState(null)
  const close = () => { setPreviewType(null); setActive(null) }
  const entries = Object.entries(modules)

  return (
    <div>
      {/* 成功横幅 */}
      <div style={{ background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '1px solid #6ee7b7', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46' }}>✅ 学习包生成完成</div>
          <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>共 7 个模块 · 点击任意模块查看详情</div>
        </div>
        <button onClick={onRegen} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #6ee7b7', background: '#fff', color: '#065f46', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🔄 重新生成</button>
      </div>

      {/* 7 模块网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {entries.map(([name, m]) => (
          <div key={name} onClick={() => { setActive(name); setPreviewType(name) }} style={{
            background: '#fff', borderRadius: 12, border: active === name ? `2px solid ${m.color}` : '1px solid #f1f5f9',
            padding: '20px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: active === name ? `0 4px 16px ${m.color}22` : '0 1px 3px rgba(0,0,0,0.04)',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{m.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{name}</div>
            <div style={{ fontSize: 10, color: m.color, marginTop: 4, fontWeight: 600 }}>点击查看 →</div>
          </div>
        ))}
      </div>

      {/* 详情弹窗 - 按类型不同展示 */}
      {previewType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setPreviewType(null); setActive(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 750, width: '94%', maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            {previewType === '动画演示' ? <AnimationDemo onClose={close} /> :
             previewType === 'PPT大纲' ? <PPTOutlineView onClose={close} /> :
             previewType === '讲义' ? <LectureView onClose={close} /> :
             <div style={{ padding: 28 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>{modules[previewType]?.icon} {previewType}</h2>
                 <button onClick={() => { setPreviewType(null); setActive(null) }} style={{ background: '#f1f5f9', border: 'none', fontSize: 18, width: 32, height: 32, borderRadius: 16, cursor: 'pointer', color: '#64748b' }}>✕</button>
               </div>
               <div dangerouslySetInnerHTML={{ __html: modules[previewType]?.content || '' }} />
             </div>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════ 讲义详情（含 PDF 下载） ══════════════ */
function LectureView({ onClose }) {
  const handleDownloadPDF = () => {
    const html = `<html><head><meta charset="utf-8"><title>Vision-Forge 讲义</title>
<style>body{font-family:'PingFang SC',sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8;color:#333}
h2{border-bottom:2px solid #3b82f6;padding-bottom:8px}pre{background:#f1f5f9;padding:12px;border-radius:8px}</style></head>
<body><h1>📚 SAM 模型架构精讲</h1><p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
<h2>一、核心概念</h2><p>Segment Anything Model (SAM) 是 Meta 提出的通用图像分割模型，通过 Prompt Encoder + Image Encoder + Mask Decoder 架构实现零样本泛化能力。</p>
<h2>二、架构设计</h2><p>SAM 由三个核心模块组成：</p><ul><li><b>Image Encoder</b>：基于 ViT-H 的视觉编码器，将输入图像编码为高维特征</li><li><b>Prompt Encoder</b>：编码用户的点击/框/掩码提示</li><li><b>Mask Decoder</b>：融合图像特征与提示，输出分割掩码</li></ul>
<pre>Input → Image Encoder (ViT-H)
  ↓
Prompt → Prompt Encoder → Mask Decoder → Segmentation Mask</pre>
<h2>三、实战指南</h2><ol><li>安装依赖：pip install segment-anything</li><li>加载模型：sam = sam_model_registry["vit_h"](checkpoint)</li><li>生成掩码：masks = SamPredictor(sam).predict(point_coords)</li></ol>
<h2>四、学习建议</h2><p>建议先理解 ViT 基础 → 阅读 SAM 论文 → 跑通官方 Demo → 在自定义数据上微调。</p>
<p style="margin-top:30px;color:#94a3b8">Generated by Vision-Forge AI</p></body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'SAM模型架构精讲-VisionForge.html'; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>📚 讲义：SAM 模型架构精讲</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadPDF} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📥 下载 HTML</button>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', fontSize: 18, width: 32, height: 32, borderRadius: 16, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: getResourceContent({ title: 'SAM 模型架构精讲', type: '讲义' }) }} />
    </div>
  )
}

/* ══════════════ PPT 大纲视图 ══════════════ */
function PPTOutlineView({ onClose }) {
  const [slide, setSlide] = useState(0)
  const slides = [
    { title: '封面', content: '图像分割：从 CNN 到 Transformer\n主讲：Vision-Forge AI 教学平台', icon: '🎯' },
    { title: '背景与动机', content: '图像分割是计算机视觉的核心任务之一\n应用场景：医学影像、自动驾驶、遥感分析、电商视觉', icon: '📋' },
    { title: '传统方法回顾', content: '阈值法 · 边缘检测 · 区域生长\n局限性：需要大量手工特征，泛化能力差', icon: '📜' },
    { title: 'CNN 时代', content: 'FCN (2015) → U-Net (2015) → DeepLab (2017)\n端到端学习，大幅提升分割精度', icon: '🧠' },
    { title: 'SAM 架构概览', content: 'Image Encoder (ViT-H)\n+ Prompt Encoder (Point/Box/Mask)\n+ Mask Decoder (Transformer)', icon: '🏗️' },
    { title: 'Backbone 详解', content: 'ViT-Base: 86M 参数\nViT-Large: 307M 参数\nViT-Huge: 632M 参数', icon: '🔧' },
    { title: 'Neck 与特征融合', content: 'FPN: 特征金字塔网络\nBiFPN: 双向特征金字塔\nPAN: 路径聚合网络', icon: '🔗' },
    { title: '微调策略', content: 'LoRA: 低秩适配 (仅 0.5M 可训练参数)\nIA3: 更轻量的 Adapter\n全量 Fine-tuning vs 参数高效微调', icon: '🔌' },
    { title: '实战案例', content: '玉米病斑检测管线\nResNet50 → FPN → YOLO_Detect_Head\nIoU: 0.87 | mAP: 0.93', icon: '💻' },
    { title: '总结', content: '1. SAM 实现了零样本分割突破\n2. Backbone+Neck+Head 架构灵活可组合\n3. 参数高效微调是实际落地的关键', icon: '✅' },
  ]
  const s = slides[slide]
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>📊 PPT 大纲预览</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#64748b', padding: '4px 10px', background: '#f1f5f9', borderRadius: 4 }}>{slide + 1} / {slides.length}</span>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', fontSize: 16, width: 28, height: 28, borderRadius: 14, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
      </div>
      <div style={{ background: 'linear-gradient(135deg,#f8fafc,#eff6ff)', borderRadius: 16, padding: '32px 28px', minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', border: '2px solid #e2e8f0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{s.icon}</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 16px' }}>{s.title}</h3>
        <p style={{ fontSize: 15, color: '#475569', lineHeight: 2, margin: 0, whiteSpace: 'pre-line' }}>{s.content}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
        <button onClick={() => setSlide(Math.max(0, slide - 1))} disabled={slide === 0} style={navBtn(slide === 0)}>◀ 上一页</button>
        <button onClick={() => setSlide(Math.min(slides.length - 1, slide + 1))} disabled={slide === slides.length - 1} style={navBtn(slide === slides.length - 1)}>下一页 ▶</button>
      </div>
    </div>
  )
}

/* ══════════════ 动画演示 ══════════════ */
function AnimationDemo({ onClose }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 6), 800)
    return () => clearInterval(t)
  }, [])
  const frames = [
    { emoji: '🖼️', label: '输入图像', desc: '原始图像送入 Image Encoder', color: '#3b82f6' },
    { emoji: '🔍', label: '特征提取', desc: 'ViT 将图像编码为 768 维向量', color: '#8b5cf6' },
    { emoji: '📍', label: 'Prompt 输入', desc: '用户点击目标区域/框选/掩码', color: '#f59e0b' },
    { emoji: '🧩', label: 'Mask Decoder', desc: 'Transformer 融合特征与提示', color: '#22c55e' },
    { emoji: '🎯', label: '掩码生成', desc: '输出精确分割掩码 + 置信度', color: '#ef4444' },
    { emoji: '✅', label: '结果输出', desc: 'IoU 0.89 · 推理耗时 120ms', color: '#06b6d4' },
  ]
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>🎬 SAM 推理流程动画</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>逐步展示 SAM 模型从输入到输出的完整流程</p>
        </div>
        <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', fontSize: 18, width: 32, height: 32, borderRadius: 16, cursor: 'pointer', color: '#64748b' }}>✕</button>
      </div>
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 16, padding: '40px 20px', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
          {frames.map((_, i) => (
            <div key={i} style={{ width: i <= frame ? 42 : 16, height: 4, borderRadius: 2, background: i <= frame ? frames[i].color : '#334155', transition: 'all 0.5s' }} />
          ))}
        </div>
        <div style={{ fontSize: 64, marginBottom: 12, transition: 'all 0.3s', transform: `scale(${1 + Math.sin(frame * 0.5) * 0.1})` }}>
          {frames[frame].emoji}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{frames[frame].label}</div>
        <div style={{ fontSize: 13, color: frames[frame].color, fontWeight: 500 }}>{frames[frame].desc}</div>
        <div style={{ marginTop: 24, fontSize: 11, color: '#64748b' }}>
          步骤 {frame + 1} / {frames.length}
        </div>
      </div>
    </div>
  )
}

const navBtn = (disabled) => ({
  padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
  background: disabled ? '#f1f5f9' : '#fff', color: disabled ? '#cbd5e1' : '#3b82f6',
  fontWeight: 600, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
})
