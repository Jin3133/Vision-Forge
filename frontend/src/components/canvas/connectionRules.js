// src/components/canvas/connectionRules.js
// 连线规则（基于后端 node_catalog 五大类别）

const RULE_BOOK = `
**视觉模型管线的连线规则**
1. 数据流方向：PROCESSING → BACKBONE → NECK/ADAPTER → HEAD
2. HEAD 节点是管线终点，不能再连出
3. 不允许自我连线 / 重复连线
4. 不允许构成有向环
5. 类型兼容性：
   - BACKBONE 后通常接 NECK、ADAPTER 或 HEAD
   - NECK 后通常接 HEAD
   - ADAPTER 可以插入任何非 PROCESSING 位置
   - PROCESSING 节点通常作为管线起点
`;

const NODE_OUTPUT_CAPACITY = {
  default: 4,
  BACKBONE: 3,
  NECK: 2,
};

// 类别 → 可连接的下游类别
const TYPE_COMPATIBILITY = {
  PROCESSING: ['BACKBONE', 'ADAPTER', 'NECK'],
  BACKBONE:   ['BACKBONE', 'ADAPTER', 'NECK', 'HEAD'],
  ADAPTER:    ['BACKBONE', 'ADAPTER', 'NECK', 'HEAD'],
  NECK:       ['ADAPTER', 'HEAD'],
  HEAD:       [],  // 终点，不能再连出
};

/**
 * 校验一次连线尝试
 * 返回 { ok, level: 'error' | 'warning' | 'ok', message }
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

  // 2. HEAD 是终点，不能连出
  if (srcNode.type === 'HEAD') {
    return { ok: false, level: 'error', message: '⚠️ HEAD 输出头是管线终点，不能再连出' };
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

  // 4. 环检测
  if (createsCycle(edges, source, target)) {
    return { ok: false, level: 'error', message: '⚠️ 这条连线会形成有向环，模型无法前向传播' };
  }

  // 5. 类型兼容性
  const allowed = TYPE_COMPATIBILITY[srcNode.type];
  if (allowed && !allowed.includes(tgtNode.type)) {
    return {
      ok: true,
      level: 'warning',
      message: `💡 ${srcNode.type} → ${tgtNode.type} 类型组合不太常见，建议调整为 ${srcNode.type} → ${allowed.join('/')}`,
    };
  }

  return { ok: true, level: 'ok', message: '连线合法' };
}

function createsCycle(edges, source, target) {
  const adj = new Map();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  });
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