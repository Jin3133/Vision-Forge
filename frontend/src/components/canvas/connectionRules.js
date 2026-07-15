// src/components/canvas/connectionRules.js
// 非法连线规则（mock 校验，不依赖后端）

const RULE_BOOK = `
**SAM / 视觉模型通常遵循的连线规则（mock）**
1. 一个节点的输出最多承载 N 个下游（避免扇出过宽）
2. 不允许从"输出节点"再连出（输出是终止节点）
3. 不允许从"输入节点"接收（输入只能作为起点）
4. 不允许自我连线 / 重复连线
5. 不允许构成有向环（→ → → 第一节点）
6. 类型兼容性建议（软提示，不阻断）：
   - pooling/extract/aggregate/normalization/dropout/activation 通常需要前置卷积/注意力
   - decoder 需要前置 encoder/prompt_encoder
   - output 应当是末端
`;

const NODE_OUTPUT_CAPACITY = {
  default: 4,
  encoder: 3,
  decoder: 2,
};

const NODE_ROLE = {
  input: 'source-only',          // 只能作为 source
  output: 'target-only',         // 只能作为 target（终止节点）
};

const TYPE_COMPATIBILITY = {
  // srcType -> allowedTargetTypes (null 表示任意)
  conv:        ['conv', 'attention', 'pooling', 'aggregate', 'norm', 'activation', 'dropout', 'decoder', 'fc', 'output'],
  attention:   ['attention', 'aggregate', 'norm', 'dropout', 'decoder', 'fc', 'output'],
  pooling:     ['conv', 'attention', 'pooling', 'aggregate', 'norm', 'dropout', 'decoder', 'fc', 'output'],
  extract:     ['aggregate', 'attention', 'decoder', 'fc', 'output'],
  aggregate:   ['norm', 'activation', 'dropout', 'decoder', 'fc', 'output'],
  norm:        ['activation', 'dropout', 'decoder', 'fc', 'output'],
  activation:  ['conv', 'attention', 'pooling', 'aggregate', 'norm', 'dropout', 'decoder', 'fc', 'output'],
  dropout:     ['conv', 'attention', 'aggregate', 'decoder', 'fc', 'output'],
  encoder:     ['aggregate', 'decoder', 'attention', 'fc', 'output'],
  prompt_encoder: ['aggregate', 'attention', 'decoder'],
  decoder:     ['fc', 'output'],
  fc:          ['output'],
  base:        ['encoder', 'extract', 'conv', 'decoder', 'output'],
  input:       ['encoder', 'conv', 'extract', 'base'],
  output:      [],
};

/**
 * 校验一次连线尝试
 * 返回 { ok, level: 'error' | 'warning' | 'ok', message }
 *
 * level === 'error'   - 阻断，必须弹错误 Toast
 * level === 'warning' - 不阻断，弹黄色提示
 * level === 'ok'      - 允许
 */
export function validateConnection({ source, target, sourceType, targetType, edges = [], nodes = [] }) {
  if (!source || !target) return { ok: false, level: 'error', message: '连线信息不完整' };

  // 1. 自连 / 重复
  if (source === target) {
    return { ok: false, level: 'error', message: '⚠️ 不能把节点连到自己' };
  }
  if (edges.some((e) => e.source === source && e.target === target)) {
    return { ok: false, level: 'error', message: '⚠️ 这条连线已存在' };
  }

  const srcNode = nodes.find((n) => n.id === source);
  const tgtNode = nodes.find((n) => n.id === target);
  if (!srcNode || !tgtNode) {
    return { ok: false, level: 'error', message: '⚠️ 节点不存在' };
  }

  // 2. 角色约束（输入/输出节点）
  const srcRole = NODE_ROLE[srcNode.type];
  const tgtRole = NODE_ROLE[tgtNode.type];
  if (srcRole === 'source-only' && false) { /* 占位，避免 lint */ }
  if (srcNode.type === 'output') {
    return { ok: false, level: 'error', message: '⚠️ 输出节点不能再连出，应作为管线终点' };
  }
  if (tgtNode.type === 'input') {
    return { ok: false, level: 'error', message: '⚠️ 输入节点不能作为下游，它必须是数据起点' };
  }

  // 3. 扇出上限
  const cap = NODE_OUTPUT_CAPACITY[srcNode.type] || NODE_OUTPUT_CAPACITY.default;
  const currentOut = edges.filter((e) => e.source === source).length;
  if (currentOut >= cap) {
    return {
      ok: false,
      level: 'warning',
      message: `⚠️ ${srcNode.data?.label || srcNode.type} 的输出已承载 ${currentOut} 条连线，建议拆分子节点`,
    };
  }

  // 4. 环检测：是否会让 target 通过新连线再回到 source（任何一条路径）
  if (createsCycle(edges, source, target)) {
    return { ok: false, level: 'error', message: '⚠️ 这条连线会形成有向环，模型无法前向传播' };
  }

  // 5. 类型兼容性（软提示）
  const allowed = TYPE_COMPATIBILITY[srcNode.type];
  if (allowed && !allowed.includes(tgtNode.type)) {
    return {
      ok: true,
      level: 'warning',
      message: `💡 ${srcNode.type} → ${tgtNode.type} 类型组合不太常见，建议先经过 Norm/Activation`,
    };
  }

  return { ok: true, level: 'ok', message: '连线合法' };
}

function createsCycle(edges, source, target) {
  // BFS：target 可达 source？
  const adj = new Map();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  });
  // 把新边加入：source -> target
  if (!adj.has(source)) adj.set(source, []);
  adj.get(source).push(target);

  const stack = [target];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const next = adj.get(cur) || [];
    next.forEach((n) => stack.push(n));
  }
  return false;
}

export { RULE_BOOK };