// src/components/canvas/useAutosave.js
// 自动保存 + 版本记录
// 策略：
//   - 每隔 AUTOSAVE_INTERVAL 检测 nodes/edges 变更（指纹比对）
//   - 变更则写入 localStorage 'vf_autosave'
//   - 同时记录到 'vf_versions'（环形列表，最多 20 条），每条含时间戳 + 节点数 + 缩略图
//
// 用法：
//   const { status, lastSavedAt, saveNow, versions, restoreVersion, removeVersion } =
//     useAutosave({ nodes, edges, intervalMs = 8000 })
//
// status: 'idle' | 'saving' | 'saved' | 'error'

import { useCallback, useEffect, useRef, useState } from 'react';

const AUTOSAVE_KEY = 'vf_autosave';
const VERSIONS_KEY = 'vf_versions';
const MAX_VERSIONS = 20;
const AUTOSAVE_INTERVAL = 8000;

const fingerprint = (nodes, edges) =>
  JSON.stringify({
    n: nodes.map((n) => ({ id: n.id, t: n.type, p: n.position, d: n.data })),
    e: edges.map((e) => [e.source, e.target]),
  });

const loadVersions = () => {
  try {
    return JSON.parse(localStorage.getItem(VERSIONS_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveVersions = (list) => {
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(list.slice(0, MAX_VERSIONS)));
  } catch {}
};

export function useAutosave({ nodes, edges, intervalMs = AUTOSAVE_INTERVAL, onSave }) {
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [versions, setVersions] = useState(() => loadVersions());
  const lastFpRef = useRef('');
  const timerRef = useRef(null);
  const savingRef = useRef(false);

  /** 真正写一次：写入当前 autosave + 推一条版本 */
  const saveNow = useCallback((reason = 'manual') => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus('saving');
    try {
      const fp = fingerprint(nodes, edges);
      if (fp === lastFpRef.current && reason === 'auto') {
        // 没变更，跳过自动保存
        setStatus('idle');
        savingRef.current = false;
        return;
      }
      const record = {
        id: 'ver-' + Date.now(),
        savedAt: new Date().toISOString(),
        reason,                       // 'auto' | 'manual'
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodes,
        edges,
      };
      // 当前快照
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(record));
      // 版本环
      const next = [record, ...loadVersions()].slice(0, MAX_VERSIONS);
      saveVersions(next);
      setVersions(next);
      setLastSavedAt(record.savedAt);
      lastFpRef.current = fp;
      setStatus('saved');
      onSave?.(record);
    } catch (e) {
      setStatus('error');
    } finally {
      savingRef.current = false;
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2200);
    }
  }, [nodes, edges, onSave]);

  // 自动保存定时器
  useEffect(() => {
    timerRef.current = setInterval(() => saveNow('auto'), intervalMs);
    return () => clearInterval(timerRef.current);
  }, [intervalMs, saveNow]);

  const restoreVersion = useCallback((id) => {
    const list = loadVersions();
    const v = list.find((x) => x.id === id);
    if (!v) return null;
    return { nodes: v.nodes, edges: v.edges };
  }, []);

  const removeVersion = useCallback((id) => {
    const next = loadVersions().filter((v) => v.id !== id);
    saveVersions(next);
    setVersions(next);
  }, []);

  return {
    status,
    lastSavedAt,
    saveNow,
    versions,
    restoreVersion,
    removeVersion,
  };
}