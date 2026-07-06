// src/components/canvas/useHistory.js
// 轻量 Undo/Redo：基于 nodes/edges 的快照栈
// 用法：
//   const { state, set, undo, redo, canUndo, canRedo, reset } = useHistory({ nodes: [], edges: [] })
//
// state 永远是当前快照；set(...) 推入新快照到栈顶（同时清空 redo 栈）；
// undo/redo 改变 state 但不入栈（避免循环）。
//
// 合并策略：set 接受第二个参数 { merge=true } 会替换栈顶而非推入，
// 适合"短时间内连续操作合并成一帧"（可选，本组件暂未使用，预留）。

import { useCallback, useRef, useState } from 'react';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function useHistory(initial) {
  const past = useRef([]);
  const future = useRef([]);
  const [state, setState] = useState(clone(initial));

  const set = useCallback((updater, options = {}) => {
    setState((prev) => {
      const prevSnap = clone(prev);
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      if (options.merge && past.current.length > 0) {
        past.current[past.current.length - 1] = prevSnap;
      } else {
        past.current.push(prevSnap);
        // 限制栈大小，避免内存爆炸
        if (past.current.length > 100) past.current.shift();
      }
      future.current = [];
      return clone(next);
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (past.current.length === 0) return prev;
      const prevSnap = past.current.pop();
      future.current.push(clone(prev));
      if (future.current.length > 100) future.current.shift();
      return prevSnap;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (future.current.length === 0) return prev;
      const nextSnap = future.current.pop();
      past.current.push(clone(prev));
      if (past.current.length > 100) past.current.shift();
      return nextSnap;
    });
  }, []);

  const reset = useCallback((next) => {
    past.current = [];
    future.current = [];
    setState(clone(next));
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    reset,
  };
}