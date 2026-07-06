// src/components/canvas/templates.js
// 模板库（mock 数据）
// 每个模板提供完整的 nodes + edges，加载时一键铺到画布

const pos = (x, y) => ({ x, y });
const edge = (id, src, tgt) => ({
  id,
  source: src,
  target: tgt,
  animated: true,
  style: { stroke: '#3b82f6', strokeWidth: 2 },
});

export const TEMPLATES = [
  {
    id: 'sam-base',
    name: 'SAM 基础版',
    desc: '4 节点 / 3 连线，最简分割管线',
    cover: '🎯',
    color: '#3b82f6',
    nodes: [
      { id: 't1-1', type: 'input', data: { label: '1024×1024 图像' }, position: pos(60, 140) },
      { id: 't1-2', type: 'encoder', data: { label: 'ViT 编码器' }, position: pos(280, 140) },
      { id: 't1-3', type: 'decoder', data: { label: '掩码解码器' }, position: pos(520, 140) },
      { id: 't1-4', type: 'output', data: { label: '分割结果' }, position: pos(760, 140) },
    ],
    edges: [
      edge('te1', 't1-1', 't1-2'),
      edge('te2', 't1-2', 't1-3'),
      edge('te3', 't1-3', 't1-4'),
    ],
  },
  {
    id: 'sam-prompt',
    name: 'SAM + 提示',
    desc: '加入 Prompt Encoder，支持点/框提示',
    cover: '📝',
    color: '#0ea5e9',
    nodes: [
      { id: 't2-1', type: 'input', data: { label: '图像输入' }, position: pos(60, 80) },
      { id: 't2-2', type: 'encoder', data: { label: '图像编码器' }, position: pos(260, 80) },
      { id: 't2-3', type: 'prompt_encoder', data: { label: '提示编码器' }, position: pos(260, 240) },
      { id: 't2-4', type: 'aggregate', data: { label: '特征融合' }, position: pos(500, 160) },
      { id: 't2-5', type: 'decoder', data: { label: '掩码解码器' }, position: pos(740, 160) },
      { id: 't2-6', type: 'output', data: { label: '分割输出' }, position: pos(960, 160) },
    ],
    edges: [
      edge('te1', 't2-1', 't2-2'),
      edge('te2', 't2-2', 't2-4'),
      edge('te3', 't2-3', 't2-4'),
      edge('te4', 't2-4', 't2-5'),
      edge('te5', 't2-5', 't2-6'),
    ],
  },
  {
    id: 'sam-attention',
    name: 'SAM + 注意力',
    desc: 'Attention + Dropout 提升精度',
    cover: '👁️',
    color: '#10b981',
    nodes: [
      { id: 't3-1', type: 'input', data: { label: '图像' }, position: pos(60, 140) },
      { id: 't3-2', type: 'conv', data: { label: '卷积层' }, position: pos(240, 140) },
      { id: 't3-3', type: 'attention', data: { label: '注意力层' }, position: pos(420, 80) },
      { id: 't3-4', type: 'attention', data: { label: '注意力层 2' }, position: pos(420, 200) },
      { id: 't3-5', type: 'aggregate', data: { label: '特征融合' }, position: pos(620, 140) },
      { id: 't3-6', type: 'dropout', data: { label: 'Dropout' }, position: pos(800, 140) },
      { id: 't3-7', type: 'output', data: { label: '输出' }, position: pos(980, 140) },
    ],
    edges: [
      edge('te1', 't3-1', 't3-2'),
      edge('te2', 't3-2', 't3-3'),
      edge('te3', 't3-2', 't3-4'),
      edge('te4', 't3-3', 't3-5'),
      edge('te5', 't3-4', 't3-5'),
      edge('te6', 't3-5', 't3-6'),
      edge('te7', 't3-6', 't3-7'),
    ],
  },
  {
    id: 'sam-full',
    name: 'SAM 完整版',
    desc: '8 节点 / 完整分割 pipeline',
    cover: '🏆',
    color: '#8b5cf6',
    nodes: [
      { id: 't4-1', type: 'input', data: { label: '图像输入' }, position: pos(40, 140) },
      { id: 't4-2', type: 'norm', data: { label: '归一化' }, position: pos(220, 140) },
      { id: 't4-3', type: 'encoder', data: { label: '图像编码器' }, position: pos(380, 80) },
      { id: 't4-4', type: 'prompt_encoder', data: { label: '提示编码器' }, position: pos(380, 240) },
      { id: 't4-5', type: 'attention', data: { label: '注意力融合' }, position: pos(560, 140) },
      { id: 't4-6', type: 'aggregate', data: { label: '特征聚合' }, position: pos(740, 140) },
      { id: 't4-7', type: 'decoder', data: { label: '掩码解码器' }, position: pos(920, 140) },
      { id: 't4-8', type: 'output', data: { label: '分割输出' }, position: pos(1100, 140) },
    ],
    edges: [
      edge('te1', 't4-1', 't4-2'),
      edge('te2', 't4-2', 't4-3'),
      edge('te3', 't4-4', 't4-5'),
      edge('te4', 't4-3', 't4-5'),
      edge('te5', 't4-5', 't4-6'),
      edge('te6', 't4-6', 't4-7'),
      edge('te7', 't4-7', 't4-8'),
    ],
  },
];