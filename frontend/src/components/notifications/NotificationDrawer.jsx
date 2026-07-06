// src/components/notifications/NotificationDrawer.jsx
//
// 通知中心 Drawer —— 顶部右侧点击铃铛后弹出
//   - 5 类切换：全部 / 学习提醒 / AI 生成完成 / 实验完成 / 系统通知 / 资源更新
//   - 每条支持：标记已读、点击跳转、删除
//   - 顶部操作：全部已读、刷新
//
// 风格：与项目保持一致的 inline-style + Tailwind utility（不引入 AntD）

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  NOTIFICATION_CATEGORIES,
  formatRelativeTime,
} from '../../api/notifications.js'

/* 分类顺序：全部 + 5 类 */
const TABS = [
  { key: 'all', label: '全部', icon: '🔔', color: '#64748b' },
  ...Object.values(NOTIFICATION_CATEGORIES),
]

export default function NotificationDrawer({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('all')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  /* ───── 数据加载 ───── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchNotifications(activeTab === 'all' ? undefined : activeTab)
      if (res?.code === 0) setList(res.data || [])
    } catch (e) {
      console.error('加载通知失败：', e)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  /* Drawer 关闭时复位到「全部」Tab，避免下次打开陈旧状态 */
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => setActiveTab('all'), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  /* ───── 操作 ───── */
  const handleItemClick = async (item) => {
    if (!item.read) {
      try {
        await markNotificationRead(item.id)
      } catch (e) { console.error(e) }
      setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)))
    }
    /* 预留：跳转到对应业务页面 */
    if (item.meta?.link) {
      // window.location.hash = '#' + item.meta.link
      console.log('[notification] navigate →', item.meta.link)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteNotification(id)
    } catch (err) { console.error(err) }
    setList((prev) => prev.filter((n) => n.id !== id))
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(activeTab === 'all' ? undefined : activeTab)
      setList((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) { console.error(err) }
  }

  /* 当前 Tab 的未读数（用于 Tab 角标） */
  const unreadCount = useMemo(() => list.filter((n) => !n.read).length, [list])

  return (
    <>
      {/* 蒙层 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease', zIndex: 1100,
        }}
      />
      {/* Drawer 主体 */}
      <aside
        role="dialog"
        aria-label="通知中心"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 420, maxWidth: '94vw',
          background: '#ffffff',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.12)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          zIndex: 1101, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── 顶部 Header ── */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, #f8fafc, #ffffff)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🔔</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>通知中心</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                {unreadCount > 0 ? `${unreadCount} 条未读` : '已全部查看'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={load}
              title="刷新"
              style={iconBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >🔄</button>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              title="全部标记为已读"
              style={{
                ...iconBtnStyle,
                color: unreadCount === 0 ? '#cbd5e1' : '#3b82f6',
                fontWeight: 600,
                padding: '6px 12px',
              }}
              onMouseEnter={(e) => {
                if (unreadCount > 0) e.currentTarget.style.background = '#eff6ff'
              }}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >✓ 全部已读</button>
            <button
              onClick={onClose}
              title="关闭"
              style={iconBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >✕</button>
          </div>
        </div>

        {/* ── 分类 Tabs ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 14px',
          borderBottom: '1px solid #f1f5f9', overflowX: 'auto',
          background: '#ffffff',
        }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  border: '1px solid',
                  borderColor: active ? tab.color : '#e2e8f0',
                  background: active ? `${tab.color}15` : '#ffffff',
                  color: active ? tab.color : '#64748b',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.18s',
                }}
              >
                <span style={{ fontSize: 12 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── 列表区 ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 16px' }}>
          {loading && list.length === 0 ? (
            <EmptyState text="加载中…" />
          ) : list.length === 0 ? (
            <EmptyState
              text={
                activeTab === 'all'
                  ? '暂无通知'
                  : `${TABS.find((t) => t.key === activeTab)?.label || ''} 暂无通知`
              }
            />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {list.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                  onDelete={(e) => handleDelete(e, item.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ── 底部说明 ── */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid #f1f5f9',
          fontSize: 11, color: '#94a3b8', textAlign: 'center',
          background: '#fafbfc',
        }}>
          仅展示最近 30 天内的通知 · Mock 数据
        </div>
      </aside>
    </>
  )
}

/* ───────── 子组件 ───────── */

function NotificationItem({ item, onClick, onDelete }) {
  const cat = NOTIFICATION_CATEGORIES[item.category] || { icon: '🔔', color: '#64748b', label: '通知' }
  const [hover, setHover] = useState(false)

  return (
    <li
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex', gap: 12,
        padding: '12px 12px',
        marginTop: 6,
        borderRadius: 12,
        cursor: 'pointer',
        background: hover ? '#f8fafc' : (item.read ? '#ffffff' : '#f0f7ff'),
        border: '1px solid',
        borderColor: hover ? '#e2e8f0' : (item.read ? '#f1f5f9' : '#dbeafe'),
        transition: 'all 0.18s',
      }}
    >
      {/* 未读小红点 */}
      {!item.read && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          width: 8, height: 8, borderRadius: '50%',
          background: '#ef4444',
          boxShadow: '0 0 0 3px rgba(239,68,68,0.18)',
        }} />
      )}

      {/* 分类图标 */}
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 10,
        background: `${cat.color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>{cat.icon}</div>

      {/* 主体 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: '2px 7px', borderRadius: 999,
            background: `${cat.color}1a`, color: cat.color,
            flexShrink: 0,
          }}>{cat.label}</span>
          <span style={{
            fontSize: 13, fontWeight: item.read ? 500 : 600,
            color: '#1e293b',
            flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.title}</span>
        </div>
        <p style={{
          margin: '4px 0 6px', fontSize: 12, color: '#64748b',
          lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{item.description}</p>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          {formatRelativeTime(item.createdAt)}
        </div>
      </div>

      {/* 删除按钮（hover 时高亮） */}
      <button
        onClick={onDelete}
        title="删除通知"
        style={{
          flexShrink: 0, alignSelf: 'flex-start',
          width: 26, height: 26, borderRadius: 8,
          background: 'transparent', border: 'none',
          color: hover ? '#ef4444' : '#cbd5e1',
          cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >🗑</button>
    </li>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: '48px 20px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: '#f1f5f9', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>🔕</div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>{text}</div>
    </div>
  )
}

/* 通用 icon button 样式 */
const iconBtnStyle = {
  background: 'transparent', border: 'none',
  cursor: 'pointer', padding: '6px 10px',
  borderRadius: 8, fontSize: 12, color: '#64748b',
  transition: 'background 0.15s',
}