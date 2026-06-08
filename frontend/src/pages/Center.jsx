import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

/* ───────── 数据常量 ───────── */
const RADAR_DIMS = [
  { key: '知识掌握', value: 75, color: '#3b82f6', icon: '📚' },
  { key: '认知风格', value: 68, color: '#22c55e', icon: '🧠' },
  { key: '易错点', value: 45, color: '#ef4444', icon: '⚠️' },
  { key: '学习节奏', value: 70, color: '#eab308', icon: '⏱️' },
  { key: '兴趣程度', value: 85, color: '#a855f7', icon: '⭐' },
  { key: '代码能力', value: 62, color: '#06b6d4', icon: '💻' },
];

const QUIZ_QUESTIONS = [
  { id: 1, dim: '知识掌握', q: 'PyTorch中nn.Module的核心作用是什么？', options: ['自动求导', '定义网络层结构', '数据加载', '模型保存'], correct: 1, explain: 'nn.Module是PyTorch中所有网络层的基类，用于定义和封装网络层结构。' },
  { id: 2, dim: '知识掌握', q: '卷积核的主要作用是？', options: ['降维', '特征提取', '激活函数', '归一化'], correct: 1, explain: '卷积核通过在输入数据上滑动进行卷积运算，主要作用是提取局部特征。' },
  { id: 3, dim: '代码能力', q: 'Python中@torch.no_grad()装饰器的作用是？', options: ['加速计算，禁用梯度', '启用梯度检查', '自动混合精度', '模型编译'], correct: 0, explain: '@torch.no_grad()禁用梯度计算，节省显存并加速推理。' },
  { id: 4, dim: '代码能力', q: '以下哪个是Python列表推导式？', options: ['for x in range(10)', '[x for x in range(10)]', 'map(lambda x: x, range(10))', 'list(range(10))'], correct: 1, explain: '[x for x in range(10)] 是列表推导式的标准语法。' },
  { id: 5, dim: '认知风格', q: '你更倾向通过哪种方式学习新技术？', options: ['阅读文档和论文', '看视频教程', '动手实践项目', '参加讨论组'], correct: -1, explain: '主观题，无标准答案，用于分析你的学习偏好。' },
  { id: 6, dim: '认知风格', q: '遇到Bug时你首先会？', options: ['查看错误日志', '搜索Stack Overflow', '自己调试排查', '请教他人'], correct: -1, explain: '主观题，无标准答案，用于分析你的问题解决风格。' },
  { id: 7, dim: '易错点', q: '模型过拟合的典型表现是？', options: ['训练集准确率低', '测试集准确率远低于训练集', 'loss不下降', '收敛速度慢'], correct: 1, explain: '过拟合指模型在训练集表现好但测试集差，即泛化能力差。' },
  { id: 8, dim: '易错点', q: '学习率设置过大的后果是？', options: ['收敛慢', 'loss震荡不收敛', '内存溢出', '梯度消失'], correct: 1, explain: '学习率过大导致参数更新幅度过大，loss无法稳定收敛。' },
  { id: 9, dim: '学习节奏', q: '你每天能投入的学习时间是？', options: ['< 1小时', '1-2小时', '2-3小时', '> 3小时'], correct: -1, explain: '主观题，用于评估你的学习节奏和时间安排。' },
  { id: 10, dim: '学习节奏', q: '你更喜欢哪种学习频率？', options: ['每天少量', '周末集中', '项目驱动', '课程跟随'], correct: -1, explain: '主观题，用于分析你的学习习惯和节奏偏好。' },
  { id: 11, dim: '兴趣程度', q: '你对深度学习哪个方向最感兴趣？', options: ['计算机视觉', '自然语言处理', '语音识别', '强化学习'], correct: -1, explain: '主观题，用于了解你的兴趣方向和动力来源。' },
  { id: 12, dim: '兴趣程度', q: '你希望多久内掌握SAM模型？', options: ['1周内', '2周内', '1个月内', '3个月内'], correct: -1, explain: '主观题，用于评估你的学习目标和紧迫感。' },
];

const PATH_STEPS = [
  { id: 1, title: '基础准备', desc: 'Python基础与PyTorch入门', agent: '🤖 Python导师', status: 'done' },
  { id: 2, title: '模型理论', desc: '理解SAM模型架构与原理', agent: '🧠 理论导师', status: 'current' },
  { id: 3, title: '环境搭建', desc: '配置开发环境与数据集', agent: '🔧 工程导师', status: 'pending' },
  { id: 4, title: '代码实践', desc: '模型训练与推理实操', agent: '💻 代码导师', status: 'pending' },
  { id: 5, title: '项目实战', desc: '完整项目开发与部署', agent: '🚀 项目导师', status: 'pending' },
];

const SKILL_TAGS = ['Python', 'PyTorch', '计算机视觉', '模型架构', '图像分割', '注意力机制'];

const REASSESS_DIALOG = [
  { q: '当你学习一个新概念（如注意力机制）时，你通常会怎么做？', options: ['先理解数学原理', '直接看代码实现', '找图解教程', '做笔记整理'] },
  { q: '在编写代码时遇到错误，你的第一反应是？', options: ['仔细阅读报错信息', '在网上搜索错误', '尝试打印中间结果', '向别人求助'] },
  { q: '你更喜欢的学习方式是什么？', options: ['系统学习理论知识', '边做项目边学', '跟着视频教程', '阅读官方文档'] },
  { q: '对于复杂的模型架构，你如何理解它？', options: ['画出结构图', '逐行阅读源码', '跑通demo再分析', '阅读论文理解'] },
  { q: '在学习过程中，什么最能激发你的动力？', options: ['解决实际问题', '获得新的认知', '完成项目目标', '通过考核测试'] },
  { q: '你如何安排学习时间？', options: ['固定时间段学习', '碎片时间学习', '项目驱动学习', '课程跟随学习'] },
];

/* ───────── 工具函数 ───────── */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const getScoreComment = (score) => {
  if (score >= 90) return { label: '优秀', desc: '你的基础非常扎实，可以直接进入项目实战阶段！', color: '#22c55e' };
  if (score >= 80) return { label: '良好', desc: '整体表现不错，在个别维度上还有提升空间。', color: '#3b82f6' };
  if (score >= 70) return { label: '中等', desc: '基础尚可，建议针对薄弱点进行专项训练。', color: '#eab308' };
  if (score >= 60) return { label: '及格', desc: '需要加强基础知识学习，建议从基础阶段重新开始。', color: '#f97316' };
  return { label: '需努力', desc: '基础较薄弱，建议制定系统的学习计划，循序渐进。', color: '#ef4444' };
};

const getWeakAreas = (results) => {
  const dimScores = {};
  const dimCounts = {};
  results.forEach((r) => {
    if (r.correct !== -1) {
      dimScores[r.dim] = (dimScores[r.dim] || 0) + (r.isCorrect ? 1 : 0);
      dimCounts[r.dim] = (dimCounts[r.dim] || 0) + 1;
    }
  });
  const weak = Object.keys(dimScores)
    .filter((d) => dimCounts[d] > 0)
    .map((d) => ({ dim: d, score: Math.round((dimScores[d] / dimCounts[d]) * 100) }))
    .filter((d) => d.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  return weak;
};

/* ───────── 主组件 ───────── */
export default function Center() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const urlTab = urlParams.get('tab') || 'portrait';
  const activeTab = urlTab;
  const setActiveTab = (tab) => {
    navigate(`/center?tab=${tab}`);
  };

  /* -- Tab1: 学习画像 --
     6维画像由后端AI智能体（学情评估智能体）统一计算驱动，
     前端仅负责展示与对话交互，禁止直接调整数值（5.21会议决议）
  */
  const [portraitData, setPortraitData] = useState(RADAR_DIMS);
  const [portraitSource, setPortraitSource] = useState('initial'); // initial | remote
  const [portraitUpdatedAt, setPortraitUpdatedAt] = useState(null);
  const [showReassess, setShowReassess] = useState(false);
  const [reassessStep, setReassessStep] = useState(0);
  const [reassessAnswers, setReassessAnswers] = useState([]);
  const [reassessStatus, setReassessStatus] = useState('idle'); // idle | dialog | submitting | done

  useEffect(() => {
    const saved = localStorage.getItem('portraitData');
    if (saved) {
      try {
        setPortraitData(JSON.parse(saved));
        setPortraitSource('remote');
        setPortraitUpdatedAt(localStorage.getItem('portraitUpdatedAt') || null);
      } catch (_) { /* ignore */ }
    }
  }, []);

  /* 模拟后端学情评估智能体：用户对话结束后，前端把对话数据回传后端，
     后端调用星火大模型计算6维画像后回写（这里用小幅随机模拟） */
  const handleReassessAnswer = (idx) => {
    const newAnswers = [...reassessAnswers, idx];
    setReassessAnswers(newAnswers);
    if (reassessStep < REASSESS_DIALOG.length - 1) {
      setReassessStep(reassessStep + 1);
    } else {
      /* 关闭问题弹窗，模拟"前端把数据回传后端 → 后端AI计算 → 回写" */
      setReassessStatus('submitting');
      setTimeout(() => {
        const updated = RADAR_DIMS.map((d) => ({
          ...d,
          value: clamp(d.value + Math.round((Math.random() - 0.4) * 18), 30, 98),
        }));
        setPortraitData(updated);
        const now = new Date().toLocaleString('zh-CN');
        setPortraitUpdatedAt(now);
        setPortraitSource('remote');
        localStorage.setItem('portraitData', JSON.stringify(updated));
        localStorage.setItem('portraitUpdatedAt', now);
        setReassessStatus('done');
        setShowReassess(false);
        setTimeout(() => {
          setReassessStep(0);
          setReassessAnswers([]);
          setReassessStatus('idle');
        }, 1800);
      }, 1200);
    }
  };

  /* -- Tab2: 能力测评 -- */
  const [quizPhase, setQuizPhase] = useState('intro');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizResults, setQuizResults] = useState([]);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [showExplain, setShowExplain] = useState(false);

  const startQuiz = () => { setQuizPhase('quiz'); setQuizIndex(0); setQuizResults([]); setSelectedOpt(null); setShowExplain(false); };
  const currentQ = QUIZ_QUESTIONS[quizIndex];
  const progress = ((quizIndex + 1) / QUIZ_QUESTIONS.length) * 100;

  const handleAnswer = (idx) => {
    if (selectedOpt !== null) return;
    setSelectedOpt(idx);
    const isCorrect = currentQ.correct === -1 ? true : idx === currentQ.correct;
    setQuizResults([...quizResults, { dim: currentQ.dim, isCorrect, correct: currentQ.correct }]);
    setShowExplain(true);
  };

  const nextQuestion = () => {
    if (quizIndex < QUIZ_QUESTIONS.length - 1) {
      setQuizIndex(quizIndex + 1);
      setSelectedOpt(null);
      setShowExplain(false);
    } else {
      setQuizPhase('result');
    }
  };

  const quizScore = useMemo(() => {
    const scorable = quizResults.filter((r) => r.correct !== -1);
    if (!scorable.length) return 0;
    return Math.round((scorable.filter((r) => r.isCorrect).length / scorable.length) * 100);
  }, [quizResults]);

  const comment = useMemo(() => getScoreComment(quizScore), [quizScore]);
  const weakAreas = useMemo(() => getWeakAreas(quizResults), [quizResults]);

  const dimBarData = useMemo(() => {
    const map = {};
    const cnt = {};
    quizResults.forEach((r) => {
      if (r.correct !== -1) {
        map[r.dim] = (map[r.dim] || 0) + (r.isCorrect ? 1 : 0);
        cnt[r.dim] = (cnt[r.dim] || 0) + 1;
      }
    });
    return Object.keys(map).map((d) => ({ name: d, score: Math.round((map[d] / cnt[d]) * 100) }));
  }, [quizResults]);

  /* -- Tab3: 学习路径 -- */
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [showPlanDetail, setShowPlanDetail] = useState(false);

  const toggleSkill = (s) => {
    setSelectedSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const planRef = useRef(null)
  const generatePlan = () => {
    if (selectedSkills.length === 0) return;
    setPlanGenerated(true);
    setShowPlanDetail(true);
    // 滚动到方案区域
    setTimeout(() => {
      planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100);
  };

  /* ───────── 样式常量 ───────── */
  const cardStyle = {
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 1px 2px rgba(0,0,0,.06)',
  };

  /* ───────── 渲染 ───────── */
  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0, color: '#1e293b' }}>📊 学情分析中心</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>AI驱动的个性化学习评估与路径规划</p>
      </div>

      {/* Tab导航 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '2px solid #e2e8f0', paddingBottom: 2 }}>
        {[
          { key: 'portrait', label: '🎯 学习画像' },
          { key: 'evaluate', label: '📝 能力测评' },
          { key: 'path', label: '🛤️ 学习路径' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === t.key ? '3px solid #3b82f6' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? '#3b82f6' : '#64748b',
              marginBottom: -2,
              transition: 'all .2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════
          Tab1: 学习画像
          ════════════════════════════════════ */}
      {activeTab === 'portrait' && (
        <div>
          {/* 标题行 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>🎯 6维学习画像</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#3b82f6', background: '#eff6ff', padding: '3px 8px', borderRadius: 10, fontWeight: 600 }}>
                🔒 由后端AI智能体评估 · 前端不可调整
              </span>
              {portraitSource === 'remote' && portraitUpdatedAt && (
                <span style={{ fontSize: 10, color: '#94a3b8' }}>最近更新：{portraitUpdatedAt}</span>
              )}
            </div>
          </div>

          {/* 上半：左右双栏 左60%雷达图 + 右40%维度进度条 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* 左侧雷达图 60% */}
            <div style={{ flex: '0 0 60%', ...cardStyle, padding: 14 }}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={portraitData.map((d) => ({ subject: d.key, A: d.value, fullMark: 100 }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="能力值" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 右侧维度详情 40% */}
            <div style={{ flex: '0 0 40%', ...cardStyle, padding: 14 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#334155' }}>维度详情</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portraitData.map((d) => (
                  <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{d.icon}</span>
                    <span style={{ fontSize: 12, color: '#475569', width: 64 }}>{d.key}</span>
                    <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${d.value}%`, height: '100%', background: d.color, borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.color, width: 34, textAlign: 'right' }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 下半：AI评语卡片 + 重新评估按钮 */}
          <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>💡 AI综合评语</div>
            <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
              你的<strong>兴趣程度</strong>和<strong>知识掌握</strong>表现突出，说明你对该领域有浓厚的学习热情和较好的理论基础。
              但<strong>易错点</strong>维度得分较低，建议针对常见错误进行专项训练。代码能力还有提升空间，多动手实践是关键。
              建议下一步：通过能力测评获取详细诊断，或直接进入学习路径开始针对性学习。
            </p>
          </div>

          <button
            onClick={() => { setShowReassess(true); setReassessStep(0); setReassessAnswers([]); setReassessStatus('dialog'); }}
            style={{ marginTop: 10, padding: '6px 14px', border: '1px solid #3b82f6', background: '#fff', color: '#3b82f6', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
          >
            🔄 与AI智能体对话 · 触发后端重新评估
          </button>

          {/* 重新评估弹窗 */}
          {showReassess && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
                {reassessStatus === 'submitting' ? (
                  /* 提交到后端AI计算的loading */
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{
                      width: 40, height: 40, margin: '0 auto 12px',
                      border: '3px solid #dbeafe', borderTop: '3px solid #3b82f6',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#1e293b' }}>学情评估智能体计算中…</h3>
                    <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                      正在调用星火大模型分析您的 6 个维度画像
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: 11, margin: '8px 0 0' }}>
                      对话数据已写入 Task_State.json（共享黑板）
                    </p>
                  </div>
                ) : reassessStatus === 'done' ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                    <h3 style={{ margin: 0, color: '#22c55e' }}>后端评估完成</h3>
                    <p style={{ color: '#64748b', fontSize: 12 }}>6维画像已由AI智能体重写</p>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🤖 与学情评估智能体对话 ({reassessStep + 1}/{REASSESS_DIALOG.length})</h3>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                        您的回答会回传后端，由星火大模型统一计算6维画像
                      </p>
                    </div>
                    <p style={{ fontSize: 13, color: '#334155', marginBottom: 14 }}>{REASSESS_DIALOG[reassessStep].q}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {REASSESS_DIALOG[reassessStep].options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleReassessAnswer(i)}
                          style={{
                            padding: '10px 14px', textAlign: 'left', border: '1px solid #e2e8f0',
                            background: '#f8fafc', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            transition: 'all .2s',
                          }}
                          onMouseEnter={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#eff6ff'; }}
                          onMouseLeave={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button
                  onClick={() => { setShowReassess(false); setReassessStatus('idle'); }}
                  style={{ marginTop: 14, padding: '6px 12px', border: '1px solid #cbd5e1', background: '#f1f5f9', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {/* 提交到后端的loading提示（弹窗外） */}
          {reassessStatus === 'submitting' && (
            <div style={{
              position: 'fixed', top: 24, right: 24, zIndex: 1100,
              background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 10,
              fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{
                width: 14, height: 14,
                border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff',
                borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite',
              }} />
              学情评估智能体调用大模型中…
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          Tab2: 能力测评
          ════════════════════════════════════ */}
      {activeTab === 'evaluate' && (
        <div>
          {/* ── Intro阶段：全宽居中 ── */}
          {quizPhase === 'intro' && (
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
              <h2 style={{ fontSize: 18, margin: '0 0 6px', color: '#1e293b' }}>学习能力测评</h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>本测试涵盖6个维度共12道题，约需5分钟</p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
                {[
                  { icon: '⚡', title: '即时反馈', desc: '答完即刻查看解析' },
                  { icon: '🔍', title: '薄弱分析', desc: '精准定位知识盲区' },
                  { icon: '🎯', title: '路径推荐', desc: '定制学习方案' },
                ].map((f) => (
                  <div key={f.title} style={{ ...cardStyle, padding: 14, width: 130 }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{f.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={startQuiz}
                style={{
                  padding: '10px 28px', background: '#3b82f6', color: '#fff', border: 'none',
                  borderRadius: 24, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(59,130,246,.25)',
                }}
              >
                开始测试
              </button>
            </div>
          )}

          {/* ── Quiz阶段：左65%题目 + 右35%统计 ── */}
          {quizPhase === 'quiz' && (
            <div style={{ display: 'flex', gap: 16 }}>
              {/* 左65%: 题目+选项 */}
              <div style={{ flex: '0 0 65%' }}>
                {/* 进度条 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>第 {quizIndex + 1}/{QUIZ_QUESTIONS.length} 题</span>
                  <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4 }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: '#3b82f6', borderRadius: 4, transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(progress)}%</span>
                </div>

                {/* 题目卡片 */}
                <div style={{ ...cardStyle, padding: 20, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#3b82f6', background: '#eff6ff', display: 'inline-block', padding: '2px 8px', borderRadius: 6, marginBottom: 6 }}>
                    {currentQ.dim}
                  </div>
                  <h3 style={{ fontSize: 15, margin: '0 0 16px', color: '#1e293b', lineHeight: 1.5 }}>{currentQ.q}</h3>

                  {/* 选项 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentQ.options.map((opt, i) => {
                      let optStyle = {
                        padding: '10px 14px', border: '1px solid #e2e8f0', background: '#f8fafc',
                        borderRadius: 10, cursor: 'pointer', fontSize: 13, textAlign: 'left',
                        transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 10,
                      };
                      if (selectedOpt !== null) {
                        if (currentQ.correct === -1) {
                          if (i === selectedOpt) optStyle = { ...optStyle, borderColor: '#3b82f6', background: '#eff6ff' };
                        } else if (i === currentQ.correct) {
                          optStyle = { ...optStyle, borderColor: '#22c55e', background: '#f0fdf4' };
                        } else if (i === selectedOpt) {
                          optStyle = { ...optStyle, borderColor: '#ef4444', background: '#fef2f2' };
                        } else {
                          optStyle = { ...optStyle, opacity: 0.5, cursor: 'default' };
                        }
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => handleAnswer(i)}
                          disabled={selectedOpt !== null}
                          style={optStyle}
                        >
                          <span style={{
                            display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', background: selectedOpt !== null && i === currentQ.correct ? '#22c55e' : '#e2e8f0',
                            color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>
                            {selectedOpt !== null && i === currentQ.correct ? '✓' : selectedOpt !== null && i === selectedOpt && currentQ.correct !== -1 && i !== currentQ.correct ? '✗' : String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* 解析 */}
                  {showExplain && (
                    <div style={{
                      marginTop: 12, padding: 10, borderRadius: 8,
                      background: currentQ.correct === -1 ? '#f8fafc' : (selectedOpt === currentQ.correct ? '#f0fdf4' : '#fef2f2'),
                      border: `1px solid ${currentQ.correct === -1 ? '#e2e8f0' : (selectedOpt === currentQ.correct ? '#bbf7d0' : '#fecaca')}`,
                      fontSize: 12, color: '#334155', lineHeight: 1.5,
                    }}>
                      {currentQ.correct !== -1 && (
                        <div style={{ fontWeight: 700, marginBottom: 3, color: selectedOpt === currentQ.correct ? '#15803d' : '#dc2626' }}>
                          {selectedOpt === currentQ.correct ? '✓ 回答正确！' : `✗ 正确答案是：${currentQ.options[currentQ.correct]}`}
                        </div>
                      )}
                      {currentQ.explain}
                    </div>
                  )}
                </div>

                {/* 下一题按钮 */}
                {showExplain && (
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={nextQuestion}
                      style={{
                        padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none',
                        borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      {quizIndex < QUIZ_QUESTIONS.length - 1 ? '下一题 →' : '查看结果'}
                    </button>
                  </div>
                )}
              </div>

              {/* 右35%: 答题统计+维度分布 */}
              <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 答题统计 */}
                <div style={{ ...cardStyle, padding: 14 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>答题统计</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { label: '当前题号', value: quizIndex + 1, color: '#3b82f6' },
                      { label: '答对题数', value: quizResults.filter(r => r.isCorrect).length, color: '#22c55e' },
                      { label: '答错题数', value: quizResults.filter(r => !r.isCorrect && r.correct !== -1).length, color: '#ef4444' },
                      { label: '完成进度', value: `${Math.round(progress)}%`, color: '#f59e0b' },
                    ].map((s) => (
                      <div key={s.label} style={{ textAlign: 'center', padding: '8px', background: '#f8fafc', borderRadius: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 维度分布 */}
                <div style={{ ...cardStyle, padding: 14, flex: 1 }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>维度分布</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dimBarData.map((d) => (
                      <div key={d.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: '#475569' }}>{d.name}</span>
                          <span style={{ fontWeight: 700, color: '#3b82f6' }}>{d.score}%</span>
                        </div>
                        <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3 }}>
                          <div style={{ width: `${d.score}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                    {dimBarData.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11, padding: '16px 0' }}>答题后显示数据</div>
                    )}
                  </div>
                </div>

                {/* 当前解析（如果有） */}
                {showExplain && (
                  <div style={{
                    ...cardStyle, padding: 12,
                    background: currentQ.correct === -1 ? '#f8fafc' : (selectedOpt === currentQ.correct ? '#f0fdf4' : '#fef2f2'),
                    border: `1px solid ${currentQ.correct === -1 ? '#e2e8f0' : (selectedOpt === currentQ.correct ? '#bbf7d0' : '#fecaca')}`,
                  }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>📖 本题解析</h4>
                    <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                      {currentQ.correct !== -1 && (
                        <div style={{ fontWeight: 700, marginBottom: 3, color: selectedOpt === currentQ.correct ? '#15803d' : '#dc2626' }}>
                          {selectedOpt === currentQ.correct ? '✓ 正确' : '✗ 错误'}
                        </div>
                      )}
                      {currentQ.explain}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Result阶段：上方全宽环形图+评语 / 下方双栏 ── */}
          {quizPhase === 'result' && (
            <div>
              {/* 上方全宽：环形分数+评语 */}
              <div style={{ ...cardStyle, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  {/* 环形图 120px */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="48" fill="none" stroke={comment.color} strokeWidth="10"
                        strokeDasharray={`${2 * Math.PI * 48 * (quizScore / 100)} ${2 * Math.PI * 48 * (1 - quizScore / 100)}`}
                        strokeDashoffset={2 * Math.PI * 48 * 0.25}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dasharray 1s ease' }}
                      />
                      <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1e293b">{quizScore}</text>
                      <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#64748b">分</text>
                    </svg>
                    <div style={{ fontSize: 14, fontWeight: 700, color: comment.color, marginTop: 4 }}>{comment.label}</div>
                  </div>

                  {/* 评语 */}
                  <div style={{ textAlign: 'left', maxWidth: 400 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{comment.desc}</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={startQuiz} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>重新测试</button>
                      <button onClick={() => setActiveTab('path')} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>查看学习路径</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 下方双栏：左60%维度柱状图 + 右40%薄弱点 */}
              <div style={{ display: 'flex', gap: 16 }}>
                {/* 左60%: 各维度柱状图 */}
                <div style={{ flex: '0 0 60%', ...cardStyle, padding: 14 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 13 }}>各维度得分</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dimBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 右40%: 薄弱点Top3 */}
                <div style={{ flex: '0 0 40%', ...cardStyle, padding: 14 }}>
                  {weakAreas.length > 0 ? (
                    <div>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#ef4444' }}>⚠️ 薄弱知识点 Top {weakAreas.length}</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {weakAreas.map((w) => (
                          <div key={w.dim} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fef2f2', borderRadius: 8 }}>
                            <span style={{ fontSize: 12, color: '#475569' }}>{w.dim}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{w.score}分</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>没有薄弱点</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>各维度表现均衡</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════
          Tab3: 学习路径
          ════════════════════════════════════ */}
      {activeTab === 'path' && (
        <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: 4 }}>
          {/* 上半：左右双栏 左50%时间线 + 右50%技能选择 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* 左50%: 5步时间线 */}
            <div style={{ flex: '0 0 50%' }}>
              <h3 style={{ fontSize: 15, color: '#1e293b', margin: '0 0 12px' }}>🛤️ 你的学习路径</h3>
              <div style={{ ...cardStyle, padding: '16px 16px 16px 44px', position: 'relative' }}>
                {/* 连接线 */}
                <div style={{ position: 'absolute', left: 31, top: 28, bottom: 28, width: 2, background: '#e2e8f0' }} />

                {PATH_STEPS.map((step) => (
                  <div key={step.id} style={{ position: 'relative', marginBottom: step.id === 5 ? 0 : 14, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* 节点 */}
                    <div style={{
                      position: 'absolute', left: -20, top: 2, width: 20, height: 20, borderRadius: '50%',
                      background: step.status === 'done' ? '#22c55e' : step.status === 'current' ? '#3b82f6' : '#e2e8f0',
                      color: step.status === 'pending' ? '#94a3b8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, zIndex: 1, border: `2px solid ${step.status === 'done' ? '#22c55e' : step.status === 'current' ? '#3b82f6' : '#e2e8f0'}`,
                    }}>
                      {step.status === 'done' ? '✓' : step.id}
                    </div>

                    {/* 内容 */}
                    <div style={{
                      flex: 1, background: step.status === 'pending' ? '#f8fafc' : '#fff', borderRadius: 8, padding: 12,
                      boxShadow: step.status === 'current' ? '0 0 0 2px #3b82f6, 0 1px 2px rgba(0,0,0,.04)' : '0 1px 2px rgba(0,0,0,.04)',
                      opacity: step.status === 'pending' ? 0.7 : 1,
                      border: `1px solid ${step.status === 'current' ? '#bfdbfe' : '#f1f5f9'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{step.title}</span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{step.agent}</span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b' }}>{step.desc}</p>
                      {step.status === 'current' && (
                        <button style={{ padding: '3px 10px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                          开始
                        </button>
                      )}
                      {step.status === 'done' && <span style={{ fontSize: 10, color: '#22c55e' }}>✓ 已完成</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右50%: 技能选择 + 生成按钮 */}
            <div style={{ flex: '0 0 50%' }}>
              <h3 style={{ fontSize: 15, color: '#1e293b', margin: '0 0 12px' }}>🎯 技能规划</h3>
              <div style={{ ...cardStyle, padding: 16 }}>
                <h3 style={{ fontSize: 14, color: '#1e293b', margin: '0 0 12px' }}>选择你想掌握的技能</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {SKILL_TAGS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSkill(s)}
                      style={{
                        padding: '5px 12px', borderRadius: 14, border: '1px solid', fontSize: 12, cursor: 'pointer',
                        borderColor: selectedSkills.includes(s) ? '#3b82f6' : '#e2e8f0',
                        background: selectedSkills.includes(s) ? '#eff6ff' : '#f8fafc',
                        color: selectedSkills.includes(s) ? '#3b82f6' : '#475569',
                        transition: 'all .2s',
                      }}
                    >
                      {selectedSkills.includes(s) ? '✓ ' : ''}{s}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generatePlan}
                  disabled={selectedSkills.length === 0}
                  style={{
                    padding: '8px 20px', background: selectedSkills.length === 0 ? '#e2e8f0' : '#3b82f6', color: selectedSkills.length === 0 ? '#94a3b8' : '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: selectedSkills.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  🚀 生成智能学习方案
                </button>
              </div>
            </div>
          </div>

          {/* 下半（可展开/收起）：方案详情 */}
          {planGenerated && (
            <div ref={planRef} style={{ scrollMarginTop: 20 }}>
              {/* 摘要栏 + 展开按钮 */}
              <div style={{ ...cardStyle, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>📋 你的智能学习方案</span>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>周期：<strong style={{ color: '#1e293b' }}>4周</strong></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>难度：<strong style={{ color: '#1e293b' }}>中级</strong></span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>方向：<strong style={{ color: '#1e293b' }}>{selectedSkills.join('、')}</strong></span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlanDetail(!showPlanDetail)}
                  style={{ padding: '5px 12px', background: 'none', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  {showPlanDetail ? '收起方案 ▲' : '查看完整方案 ▼'}
                </button>
              </div>

              {/* 展开详情 */}
              {showPlanDetail && (
                <div style={{ ...cardStyle, padding: 16, marginTop: 2, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {['模型搭建', '推荐课程', '模型评估'].map((link) => (
                      <a key={link} href="#" style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', padding: '3px 10px', background: '#fff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                        {link} →
                      </a>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                    {[
                      { week: '第1周', content: `${selectedSkills[0] || 'Python'}基础巩固 + 环境配置` },
                      { week: '第2周', content: '核心概念学习与代码实践' },
                      { week: '第3周', content: `${selectedSkills[1] || '模型'}深入理解与实验` },
                      { week: '第4周', content: '综合项目实战与评估' },
                    ].map((item) => (
                      <div key={item.week} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                        <span style={{ fontWeight: 700, color: '#3b82f6', whiteSpace: 'nowrap', fontSize: 11 }}>{item.week}</span>
                        <span>{item.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}