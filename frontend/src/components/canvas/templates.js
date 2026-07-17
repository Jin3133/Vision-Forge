// src/components/canvas/templates.js
// 模板库（节点类型对齐后端 node_catalog 白名单）
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
    desc: 'SAM_ViT_B + Mask_Decoder，最简分割管线',
    cover: '🎯',
    color: '#3b82f6',
    nodes: [
      { id: 't1-1', type: 'BACKBONE', data: { label: 'SAM_ViT_B' }, position: pos(60, 140) },
      { id: 't1-2', type: 'NECK', data: { label: 'Feature_Pyramid' }, position: pos(320, 140) },
      { id: 't1-3', type: 'HEAD', data: { label: 'Mask_Decoder' }, position: pos(580, 140) },
    ],
    edges: [
      edge('te1', 't1-1', 't1-2'),
      edge('te2', 't1-2', 't1-3'),
    ],
  },
  {
    id: 'sam-lora',
    name: 'SAM + LoRA 微调',
    desc: 'BACKBONE + ADAPTER + HEAD，参数高效微调',
    cover: '🔌',
    color: '#10b981',
    nodes: [
      { id: 't2-1', type: 'BACKBONE', data: { label: 'SAM_ViT_B' }, position: pos(60, 140) },
      { id: 't2-2', type: 'ADAPTER', data: { label: 'LoRA_Sampler' }, position: pos(320, 80) },
      { id: 't2-3', type: 'ADAPTER', data: { label: 'Conv_Adapter' }, position: pos(320, 220) },
      { id: 't2-4', type: 'HEAD', data: { label: 'Mask_Decoder' }, position: pos(580, 140) },
    ],
    edges: [
      edge('te1', 't2-1', 't2-2'),
      edge('te2', 't2-1', 't2-3'),
      edge('te3', 't2-2', 't2-4'),
      edge('te4', 't2-3', 't2-4'),
    ],
  },
  {
    id: 'yolo-detect',
    name: 'YOLO 检测管线',
    desc: 'ResNet50 + PAN + YOLO_Detect_Head',
    cover: '👁️',
    color: '#f59e0b',
    nodes: [
      { id: 't3-1', type: 'PROCESSING', data: { label: 'Resize' }, position: pos(60, 140) },
      { id: 't3-2', type: 'BACKBONE', data: { label: 'ResNet50' }, position: pos(260, 140) },
      { id: 't3-3', type: 'NECK', data: { label: 'PAN' }, position: pos(460, 80) },
      { id: 't3-4', type: 'NECK', data: { label: 'Feature_Pyramid' }, position: pos(460, 210) },
      { id: 't3-5', type: 'HEAD', data: { label: 'YOLO_Detect_Head' }, position: pos(680, 140) },
    ],
    edges: [
      edge('te1', 't3-1', 't3-2'),
      edge('te2', 't3-2', 't3-3'),
      edge('te3', 't3-2', 't3-4'),
      edge('te4', 't3-3', 't3-5'),
      edge('te5', 't3-4', 't3-5'),
    ],
  },
  {
    id: 'sam-full',
    name: 'SAM 完整管线',
    desc: 'PROCESSING → BACKBONE → NECK + ADAPTER → HEAD',
    cover: '🏆',
    color: '#8b5cf6',
    nodes: [
      { id: 't4-1', type: 'PROCESSING', data: { label: 'Normalize' }, position: pos(40, 160) },
      { id: 't4-2', type: 'BACKBONE', data: { label: 'SAM_ViT_H' }, position: pos(220, 160) },
      { id: 't4-3', type: 'NECK', data: { label: 'BiFPN' }, position: pos(400, 80) },
      { id: 't4-4', type: 'ADAPTER', data: { label: 'LoRA_Sampler' }, position: pos(400, 240) },
      { id: 't4-5', type: 'NECK', data: { label: 'Feature_Pyramid' }, position: pos(580, 160) },
      { id: 't4-6', type: 'HEAD', data: { label: 'Mask_Decoder' }, position: pos(780, 160) },
    ],
    edges: [
      edge('te1', 't4-1', 't4-2'),
      edge('te2', 't4-2', 't4-3'),
      edge('te3', 't4-2', 't4-4'),
      edge('te4', 't4-3', 't4-5'),
      edge('te5', 't4-4', 't4-5'),
      edge('te6', 't4-5', 't4-6'),
    ],
  },
];