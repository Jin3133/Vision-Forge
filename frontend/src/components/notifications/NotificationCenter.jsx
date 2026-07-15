// src/components/notifications/NotificationCenter.jsx
//
// 顶栏右侧的通知入口
//   - 渲染一个铃铛按钮，带未读小红点
//   - 点击切换 NotificationDrawer 的开关
//   - 持续轮询（简化：每次打开或定时刷新）未读数，让红点保持新鲜

import { useEffect, useState, useCallback } from 'react'
import NotificationDrawer from './NotificationDrawer.jsx'
import { fetchNotifications } from '../../api/notifications.js'

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  /** 拉一次列表，统计未读 */
  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchNotifications()
      if (res?.code === 0) {
        const count = (res.data || []).filter((n) => !n.read).length
        setUnread(count)
      }
    } catch (e) {
      // 静默失败 —— 不打扰用户
      console.warn('[notification] refresh unread failed', e)
    }
  }, [])

  // 进入页面 / 抽屉关闭后刷新一次未读
  useEffect(() => { refreshUnread() }, [refreshUnread])
  useEffect(() => {
    if (!open) {
      // 关闭抽屉后立即刷新一次
      const t = setTimeout(refreshUnread, 300)
      return () => clearTimeout(t)
    }
  }, [open, refreshUnread])

  // 简单定时轮询：60 秒拉一次
  useEffect(() => {
    const id = setInterval(refreshUnread, 60_000)
    return () => clearInterval(id)
  }, [refreshUnread])

  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        title={open ? '关闭通知中心' : '通知中心'}
        aria-label="通知中心"
        style={{
          position: 'relative',
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? '#eff6ff' : '#f1f5f9',
          border: '1px solid',
          borderColor: open ? '#bfdbfe' : '#e2e8f0',
          borderRadius: 10,
          color: open ? '#3b82f6' : '#475569',
          cursor: 'pointer',
          fontSize: 15,
          transition: 'all 0.18s',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = '#e0e7ff'
            e.currentTarget.style.borderColor = '#c7d2fe'
            e.currentTarget.style.color = '#3b82f6'
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = '#f1f5f9'
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.color = '#475569'
          }
        }}
      >
        {/* 铃铛图标 */}
        <span style={{ display: 'inline-block', lineHeight: 1 }}>🔔</span>

        {/* 未读小红点 / 数字角标 */}
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 2px #ffffff',
            lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <NotificationDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}