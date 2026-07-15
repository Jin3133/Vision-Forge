// src/components/profile/FavoritesPanel.jsx
//
// 我的收藏 —— 个人中心内的收藏 Tab
//   - 顶部：搜索框 + 5 类分类（带计数徽标）+ 全部 Tab
//   - 主体：卡片网格（按时间倒序）
//   - 每张卡：分类色条 / 封面 emoji / 标题 / 描述 / 标签 / 作者 / 时间 / 操作
//   - 操作：取消收藏、打开（占位）

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  fetchFavorites,
  removeFavorite,
  FAVORITE_CATEGORIES,
  formatFavTime,
} from '../../api/favorites.js'

const ALL_TAB = { key: 'all', label: '全部', icon: '⭐', color: '#64748b' }

export default function FavoritesPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchFavorites({
        category: activeTab === 'all' ? undefined : activeTab,
        keyword: keyword.trim() || undefined,
      })
      if (res?.code === 0) setItems(res.data || [])
    } catch (e) {
      console.error('[favorites] load failed', e)
    } finally {
      setLoading(false)
    }
  }, [activeTab, keyword])

  /* Tab / 搜索变化时重新加载 */
  useEffect(() => { load() }, [load])

  /* 统计：每个分类的条数（不过滤 keyword） */
  const counts = useMemo(() => {
    /* 这里用"所有非过滤"数据来算分类计数更准，
       但为了减少一次 IO，简单起见用当前 items 的分类数（搜索态会被影响）——
       所以改用一次性全量拉一次。 */
    return null
  }, [items])

  /* 改成独立拉一次总数 */
  const [allItems, setAllItems] = useState([])
  useEffect(() => {
    fetchFavorites().then((res) => {
      if (res?.code === 0) setAllItems(res.data || [])
    })
  }, [items])

  const categoryCounts = useMemo(() => {
    const map = { all: allItems.length }
    Object.keys(FAVORITE_CATEGORIES).forEach((k) => { map[k] = 0 })
    allItems.forEach((it) => { map[it.category] = (map[it.category] || 0) + 1 })
    return map
  }, [allItems])

  const handleUnfav = async (e, id) => {
    e.stopPropagation()
    await removeFavorite(id)
    /* 本地立即移除，无需等下次加载 */
    setItems((prev) => prev.filter((it) => it.id !== id))
    setAllItems((prev) => prev.filter((it) => it.id !== id))
  }

  const tabs = [ALL_TAB, ...Object.values(FAVORITE_CATEGORIES)]

  return (
    <div>
      {/* ── 顶部：搜索 + 摘要 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        background: 'linear-gradient(90deg, #eff6ff, #fdf2f8)',
        marginBottom: 14,
      }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff', flexShrink: 0,
        }}>❤️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
            共收藏 <span style={{ color: '#ec4899' }}>{allItems.length}</span> 项内容
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            涵盖学习包 / 论文 / 资源 / 课程 / 模型 · 数据仅存本地浏览器
          </div>
        </div>
      </div>

      {/* ── 搜索框 ── */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%',
          transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8',
        }}>🔍</span>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索标题 / 描述 / 标签 / 作者"
          style={{
            width: '100%', padding: '11px 38px 11px 38px',
            borderRadius: 10, border: '1px solid #e2e8f0',
            background: '#fff', fontSize: 13, color: '#1e293b',
            outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        {keyword && (
          <button
            onClick={() => setKeyword('')}
            style={{
              position: 'absolute', right: 10, top: '50%',
              transform: 'translateY(-50%)',
              width: 22, height: 22, borderRadius: '50%',
              background: '#e2e8f0', color: '#64748b',
              border: 'none', cursor: 'pointer', fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="清除搜索"
          >✕</button>
        )}
      </div>

      {/* ── 分类 Tabs（带计数） ── */}
      <div style={{
        display: 'flex', gap: 8,
        overflowX: 'auto', paddingBottom: 4, marginBottom: 14,
      }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key
          const count = categoryCounts[tab.key] || 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: 'pointer', whiteSpace: 'nowrap',
                border: '1px solid',
                borderColor: active ? tab.color : '#e2e8f0',
                background: active ? `${tab.color}15` : '#fff',
                color: active ? tab.color : '#64748b',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = '#f8fafc'
                  e.currentTarget.style.borderColor = '#cbd5e1'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = '#e2e8f0'
                }
              }}
            >
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999,
                background: active ? `${tab.color}26` : '#f1f5f9',
                color: active ? tab.color : '#94a3b8',
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── 内容区 ── */}
      {loading && items.length === 0 ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState keyword={keyword} tab={activeTab} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {items.map((it) => (
            <FavoriteCard
              key={it.id}
              item={it}
              onUnfav={(e) => handleUnfav(e, it.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────── 子组件 ───────── */

function FavoriteCard({ item, onUnfav }) {
  const cat = FAVORITE_CATEGORIES[item.category] || { label: '收藏', icon: '⭐', color: '#64748b' }
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleUnfav = async (e) => {
    if (busy) return
    setBusy(true)
    try { await onUnfav(e) }
    finally { setBusy(false) }
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: '#fff',
        border: '1px solid',
        borderColor: hover ? cat.color : '#f1f5f9',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.18s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover
          ? `0 10px 24px ${cat.color}1a`
          : '0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      {/* 顶部色条 */}
      <div style={{
        height: 4,
        background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`,
      }} />

      <div style={{ padding: 14 }}>
        {/* 封面 + 分类标签 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: `${cat.color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>{item.cover || cat.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block',
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              padding: '2px 7px', borderRadius: 999,
              background: `${cat.color}1a`, color: cat.color,
              marginBottom: 4,
            }}>{cat.label}</span>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#1e293b',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{item.title}</div>
          </div>
        </div>

        {/* 描述 */}
        <p style={{
          margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{item.desc}</p>

        {/* 标签 */}
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {item.tags.slice(0, 3).map((t) => (
              <span key={t} style={{
                fontSize: 10, fontWeight: 500,
                padding: '2px 7px', borderRadius: 4,
                background: '#f1f5f9', color: '#475569',
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* 底部信息 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 8, borderTop: '1px solid #f1f5f9',
          fontSize: 11, color: '#94a3b8',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span>👤</span>
            <span>{item.author}</span>
          </span>
          <span style={{ flexShrink: 0 }}>{formatFavTime(item.createdAt)}</span>
        </div>
      </div>

      {/* hover 时浮出的取消按钮 */}
      <button
        onClick={handleUnfav}
        disabled={busy}
        title="取消收藏"
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 28, height: 28, borderRadius: 8,
          background: hover ? '#fff' : 'transparent',
          border: hover ? '1px solid #fecaca' : '1px solid transparent',
          color: hover ? '#ef4444' : '#cbd5e1',
          cursor: busy ? 'wait' : 'pointer',
          fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hover || busy ? 1 : 0,
          transition: 'all 0.15s',
          boxShadow: hover ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
        }}
      >{busy ? '…' : '✕'}</button>
    </div>
  )
}

function EmptyState({ keyword, tab }) {
  const catLabel = tab === 'all' ? '' : (FAVORITE_CATEGORIES[tab]?.label || '')
  return (
    <div style={{
      padding: '60px 20px', textAlign: 'center',
      background: '#fafbfc', borderRadius: 14,
      border: '1px dashed #e2e8f0',
    }}>
      <div style={{
        width: 72, height: 72, margin: '0 auto 14px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32,
      }}>💝</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
        {keyword ? '没有匹配的内容' : '暂无收藏'}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
        {keyword
          ? <>搜索 <strong style={{ color: '#3b82f6' }}>"{keyword}"</strong> 没有找到结果</>
          : catLabel
            ? `${catLabel}分类下还没有收藏，去资源中心逛逛吧～`
            : '去首页和资源中心，看到喜欢的内容点 ❤️ 即可收藏'}
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 14,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          background: '#fff', border: '1px solid #f1f5f9',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ height: 4, background: '#e2e8f0' }} />
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f1f5f9' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: 40, height: 12, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ width: '90%', height: 14, background: '#f1f5f9', borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: '70%', height: 10, background: '#f1f5f9', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}