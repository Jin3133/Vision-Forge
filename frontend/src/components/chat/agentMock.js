// src/components/chat/agentMock.js
// 4 个智能体的静态元数据 + mock 协同状态机
// 状态：waiting | running | done | failed

export const AGENTS = [
  {
    id: 'architect',
    name: 'Architect',
    label: '架构师',
    desc: '拆解任务 · 编排方案',
    icon: '🧭',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  },
  {
    id: 'tutor',
    name: 'Tutor',
    label: '导师',
    desc: '知识讲解 · 举例说明',
    icon: '🎓',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  },
  {
    id: 'generator',
    name: 'Generator',
    label: '生成器',
    desc: '示例代码 · 思维导图',
    icon: '⚡',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  },
  {
    id: 'evaluator',
    name: 'Evaluator',
    label: '评估器',
    desc: '质量校验 · 安全过滤',
    icon: '🛡️',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  },
];

export const STATUS = {
  IDLE: 'idle',         // 空闲（从未启动）
  WAITING: 'waiting',   // 等待前置任务
  RUNNING: 'running',   // 执行中
  DONE: 'done',         // 完成
  FAILED: 'failed',     // 失败
};

export const STATUS_LABEL = {
  idle:    '空闲',
  waiting: '等待',
  running: '执行中',
  done:    '完成',
  failed:  '失败',
};

const initialAgents = () =>
  AGENTS.map((a) => ({
    ...a,
    status: STATUS.IDLE,
    progress: 0,
    message: '待命中',
    startedAt: null,
    finishedAt: null,
  }));

/**
 * 模拟 4 Agent 协同流水线：
 *   Architect（拆题） → Tutor（讲解） → Generator（示例/图） → Evaluator（校验）
 *
 * 调度器对外暴露：
 *   start(question, hooks)  - 启动一次协同
 *   stop()                  - 立即停止（用于"停止生成"）
 *
 * hooks:
 *   onUpdate(agents)        - 任一 Agent 状态变化时回调（用于 UI 实时刷新）
 *   onComplete()            - 全部 done / 任意 failed
 *
 * 返回 stop()，可在外部调用以终止（不影响 Mock 流式本身的推送）
 */
export function createAgentOrchestrator() {
  let agents = initialAgents();
  let timers = [];
  let stopped = false;

  const update = (id, patch) => {
    agents = agents.map((a) => (a.id === id ? { ...a, ...patch } : a));
    hooks.onUpdate?.(agents);
  };
  const updateMany = (ids, patch) => {
    agents = agents.map((a) => (ids.includes(a.id) ? { ...a, ...patch } : a));
    hooks.onUpdate?.(agents);
  };
  const reset = () => {
    agents = initialAgents();
    hooks.onUpdate?.(agents);
  };

  let hooks = { onUpdate: null, onComplete: null };

  const clearAll = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(() => {
      if (stopped) return;
      fn();
    }, ms);
    timers.push(id);
  };

  /**
   * 跑一条"进度条"，按步长推进；中途被 stop 则不回调 onUpdate
   * progress 0~100
   */
  const runProgress = (id, { step = 25, base = 400, jitter = 250, onDone, failRate = 0 } = {}) => {
    const tick = () => {
      if (stopped) return;
      const a = agents.find((x) => x.id === id);
      if (!a) return;
      // 失败概率（默认 0；Evaluator 阶段可加少量随机失败演示 UI）
      if (a.progress === 0 && Math.random() < failRate) {
        update(id, {
          status: STATUS.FAILED,
          message: '校验未通过 · 已重试',
          finishedAt: Date.now(),
        });
        return;
      }
      const next = Math.min(100, a.progress + step + Math.floor(Math.random() * 15));
      if (next >= 100) {
        update(id, {
          status: STATUS.DONE,
          progress: 100,
          message: '完成',
          finishedAt: Date.now(),
        });
        onDone?.();
      } else {
        update(id, { progress: next, status: STATUS.RUNNING });
        schedule(tick, base + Math.random() * jitter);
      }
    };
    schedule(tick, base);
  };

  const start = (question, h = {}) => {
    hooks = h;
    stopped = false;
    clearAll();
    reset();

    // Architect 启动
    schedule(() => {
      if (stopped) return;
      update('architect', {
        status: STATUS.RUNNING,
        progress: 5,
        message: '正在拆解问题…',
        startedAt: Date.now(),
      });
      runProgress('architect', {
        step: 30,
        base: 350,
        jitter: 200,
        onDone: () => {
          // Tutor 开始
          schedule(() => {
            if (stopped) return;
            update('tutor', {
              status: STATUS.RUNNING,
              progress: 5,
              message: '正在生成讲解…',
              startedAt: Date.now(),
            });
            runProgress('tutor', {
              step: 20,
              base: 300,
              jitter: 200,
              onDone: () => {
                // Generator 开始
                schedule(() => {
                  if (stopped) return;
                  update('generator', {
                    status: STATUS.RUNNING,
                    progress: 5,
                    message: '正在生成代码/示例…',
                    startedAt: Date.now(),
                  });
                  runProgress('generator', {
                    step: 25,
                    base: 300,
                    jitter: 200,
                    onDone: () => {
                      // Evaluator 开始
                      schedule(() => {
                        if (stopped) return;
                        update('evaluator', {
                          status: STATUS.RUNNING,
                          progress: 5,
                          message: '正在校验输出质量…',
                          startedAt: Date.now(),
                        });
                        runProgress('evaluator', {
                          step: 30,
                          base: 350,
                          jitter: 200,
                          // 5% 概率演示失败（你可调成 0）
                          failRate: 0,
                          onDone: () => {
                            hooks.onComplete?.();
                          },
                        });
                      }, 300);
                    },
                  });
                }, 250);
              },
            });
          }, 200);
        },
      });
    }, 80);
  };

  const stop = () => {
    stopped = true;
    clearAll();
    // 把所有 running 标为 failed（更直观）
    agents = agents.map((a) =>
      a.status === STATUS.RUNNING || a.status === STATUS.WAITING
        ? { ...a, status: STATUS.FAILED, message: '已停止', finishedAt: Date.now() }
        : a,
    );
    hooks.onUpdate?.(agents);
  };

  return { start, stop };
}