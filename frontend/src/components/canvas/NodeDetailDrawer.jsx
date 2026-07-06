// src/components/canvas/NodeDetailDrawer.jsx
// 节点详情 Drawer：点击画布节点 → 右侧滑出
// 展示：图标 / 名称 / 类型 / 描述 / 关键参数 / 入度出度 / 删除按钮
// onChange 用于把对节点的修改写回 state（仅修改 data，不破坏 React Flow 节点 id）

import React from 'react';

const PARAM_SCHEMA = {
  base: [
    { key: 'hidden_size', label: '隐藏维度', type: 'number', default: 768 },
    { key: 'num_layers', label: '层数', type: 'number', default: 12 },
    { key: 'dropout', label: 'Dropout', type: 'number', step: 0.05, default: 0.1 },
  ],
  encoder: [
    { key: 'img_size', label: '输入尺寸', type: 'number', default: 1024 },
    { key: 'patch_size', label: 'Patch Size', type: 'number', default: 16 },
    { key: 'embed_dim', label: '嵌入维度', type: 'number', default: 768 },
  ],
  prompt_encoder: [
    { key: 'embed_dim', label: '嵌入维度', type: 'number', default: 256 },
    { key: 'num_points', label: '支持点数', type: 'number', default: 4 },
  ],
  conv: [
    { key: 'out_channels', label: '输出通道', type: 'number', default: 64 },
    { key: 'kernel', label: '卷积核', type: 'number', default: 3 },
    { key: 'stride', label: '步幅', type: 'number', default: 1 },
  ],
  attention: [
    { key: 'num_heads', label: '注意力头数', type: 'number', default: 8 },
    { key: 'head_dim', label: '每头维度', type: 'number', default: 64 },
    { key: 'temperature', label: '温度系数', type: 'number', step: 0.01, default: 1.0 },
  ],
  pooling: [
    { key: 'pool_type', label: '池化类型', type: 'select', options: ['max', 'avg'], default: 'max' },
    { key: 'kernel', label: '池化核', type: 'number', default: 2 },
  ],
  aggregate: [
    { key: 'method', label: '融合方式', type: 'select', options: ['concat', 'add', 'attention'], default: 'concat' },
  ],
  norm: [
    { key: 'eps', label: 'Epsilon', type: 'number', step: 0.0001, default: 1e-5 },
  ],
  activation: [
    { key: 'fn', label: '激活函数', type: 'select', options: ['ReLU', 'GELU', 'SiLU', 'Tanh'], default: 'GELU' },
  ],
  dropout: [
    { key: 'p', label: '丢弃率', type: 'number', step: 0.05, default: 0.1 },
  ],
  decoder: [
    { key: 'transformer_dim', label: 'Transformer 维度', type: 'number', default: 256 },
    { key: 'num_multimask', label: '多掩码数', type: 'number', default: 3 },
  ],
  fc: [
    { key: 'out_features', label: '输出维度', type: 'number', default: 1000 },
  ],
  input: [
    { key: 'shape', label: '输入形状 (e.g. 3,224,224)', type: 'text', default: '3,1024,1024' },
  ],
  output: [
    { key: 'num_classes', label: '类别数', type: 'number', default: 1 },
  ],
  extract: [
    { key: 'feature_dim', label: '特征维度', type: 'number', default: 256 },
  ],
};

const TYPE_DESC = {
  base: '基座模型（如 SAM），整个网络的特征根基。',
  encoder: '图像编码器，将图像转为 token 序列。',
  prompt_encoder: '提示编码器，把用户点/框/文本转成 prompt embedding。',
  conv: '卷积层，提取局部空间特征。',
  attention: '注意力层，建模长距离依赖。',
  pooling: '池化层，压缩空间维度。',
  aggregate: '特征融合层，把多分支特征合并。',
  norm: '归一化层，稳定训练过程。',
  activation: '激活函数，引入非线性。',
  dropout: 'Dropout，随机丢弃部分神经元防过拟合。',
  decoder: '解码器，把特征还原成目标输出。',
  fc: '全连接层，做最终分类 / 投影。',
  input: '输入节点，定义数据入口形状。',
  output: '输出节点，定义最终输出形状。',
  extract: '特征提取节点，封装通用特征抽取逻辑。',
};

export function NodeDetailDrawer({ open, node, edges, onClose, onChange, onDelete }) {
  if (!open || !node) return null;

  const cfg = nodeColors[node.type] || { icon: '🧩', label: node.type, border: '#64748b', bg: '#f8fafc' };
  const inEdges = edges.filter((e) => e.target === node.id);
  const outEdges = edges.filter((e) => e.source === node.id);
  const params = PARAM_SCHEMA[node.type] || [];
  const data = node.data || {};

  const setParam = (key, value) => {
    const next = { ...data, params: { ...(data.params || {}), [key]: value } };
    onChange?.(node.id, { data: next });
  };

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.18)',
          zIndex: 1900, animation: 'drawerFade .2s ease',
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 380, maxWidth: '92vw',
          background: '#fff', zIndex: 1950,
          boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'drawerSlide .26s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: cfg.bg,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#fff', border: `2px solid ${cfg.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>{cfg.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              {data.label || cfg.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {cfg.label} · ID: {node.id}
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭"
            style={{
              background: '#fff', border: '1px solid #e2e8f0',
              width: 28, height: 28, borderRadius: 14,
              cursor: 'pointer', fontSize: 16, color: '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* 描述 */}
          <div style={{
            fontSize: 12.5, color: '#475569', lineHeight: 1.7,
            padding: '10px 12px', background: '#f8fafc',
            borderRadius: 8, marginBottom: 14,
            border: '1px solid #e2e8f0',
          }}>
            💡 {TYPE_DESC[node.type] || '通用神经网络节点。'}
          </div>

          {/* 名称编辑 */}
          <FieldGroup label="节点名称">
            <input
              type="text"
              value={data.label || ''}
              onChange={(e) => onChange?.(node.id, { data: { ...data, label: e.target.value } })}
              style={inputStyle}
            />
          </FieldGroup>

          {/* 连接信息 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14,
          }}>
            <StatBox icon="📥" label="入度" value={inEdges.length} color="#0ea5e9" />
            <StatBox icon="📤" label="出度" value={outEdges.length} color="#8b5cf6" />
          </div>

          {/* 参数 */}
          {params.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                ⚙️ 关键参数
              </div>
              {params.map((p) => (
                <FieldGroup key={p.key} label={p.label}>
                  {p.type === 'select' ? (
                    <select
                      value={(data.params?.[p.key]) ?? p.default}
                      onChange={(e) => setParam(p.key, e.target.value)}
                      style={inputStyle}
                    >
                      {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={p.type === 'number' ? 'number' : 'text'}
                      step={p.step}
                      value={(data.params?.[p.key]) ?? p.default}
                      onChange={(e) =>
                        setParam(p.key, p.type === 'number' ? Number(e.target.value) : e.target.value)
                      }
                      style={inputStyle}
                    />
                  )}
                </FieldGroup>
              ))}
            </>
          )}

          {/* 入出节点列表 */}
          {inEdges.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                📥 上游节点
              </div>
              <EdgeList edges={inEdges} side="source" allNodes={[]} />
            </div>
          )}
          {outEdges.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                📤 下游节点
              </div>
              <EdgeList edges={outEdges} side="target" allNodes={[]} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: 8,
          background: '#f8fafc',
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 10,
            border: '1px solid #e2e8f0', background: '#fff',
            color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>关闭</button>
          <button onClick={() => onDelete?.(node.id)} style={{
            padding: '10px 18px', borderRadius: 10,
            border: 'none', background: '#fef2f2',
            color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>🗑 删除节点</button>
        </div>
      </div>
      <style>{`
        @keyframes drawerSlide {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes drawerFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 13,
  background: '#fff',
  outline: 'none',
  transition: 'border-color .15s ease, box-shadow .15s ease',
};

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <div style={{
      padding: '10px 12px', background: '#fff',
      border: '1px solid #e2e8f0', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function EdgeList({ edges, side }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {edges.map((e) => (
        <div key={e.id} style={{
          padding: '6px 10px', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 6,
          fontSize: 12, color: '#475569',
          fontFamily: '"JetBrains Mono", Consolas, monospace',
        }}>
          {side}: <strong>{e[side]}</strong>
        </div>
      ))}
    </div>
  );
}

// 在这里引用 nodeColors（来自 Canvas.jsx 同款定义）
// 为避免循环依赖，直接 import；这里通过 props 的 cfg 已足够，但保留本表供描述用
const nodeColors = {
  base: { label: '基座模型' },
  encoder: { label: '图像编码器' },
  prompt_encoder: { label: '提示编码器' },
  conv: { label: '卷积层' },
  attention: { label: '注意力层' },
  pooling: { label: '池化层' },
  aggregate: { label: '特征融合' },
  norm: { label: '归一化层' },
  activation: { label: '激活函数' },
  dropout: { label: 'Dropout' },
  decoder: { label: '掩码解码器' },
  fc: { label: '全连接层' },
  input: { label: '输入层' },
  output: { label: '输出层' },
  extract: { label: '特征提取' },
};