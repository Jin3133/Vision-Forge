import { Link } from 'react-router-dom'

/**
 * PageHeader —— 所有页面统一的题头
 * 结构（按截图）：
 *   🧱 [主标题大字]   父级 / 当前页
 *
 * Props:
 *   icon         主标题左侧的 emoji 图标（如 🛠️ / 📚 / 📖）
 *   title        主标题文字（如「模型工坊」「我的学习」「资源中心」）
 *   parent       面包屑父级（可点击跳转），例：{ icon: '🛠️', label: '模型实践', path: '/canvas' }
 *   current      面包屑当前（不可点击），例：{ label: '模型工坊' }
 *   subtitle     可选 · 主标题下小字描述
 *
 * 使用：
 *   <PageHeader icon="🛠️" title="模型工坊"
 *     parent={{ icon: '🛠️', label: '模型实践', path: '/canvas' }}
 *     current={{ label: '模型工坊' }} />
 */
export default function PageHeader({ icon, title, parent, current, subtitle }) {
  return (
    <div style={{
      padding: '14px 0 12px',
      marginBottom: 14,
      borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
    }}>
      {/* 左侧：图标 + 主标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {icon && (
          <span style={{
            fontSize: 28, lineHeight: 1, flexShrink: 0,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
          }}>{icon}</span>
        )}
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 800,
          color: '#1e293b', letterSpacing: '-0.3px',
          background: 'linear-gradient(90deg, #1e293b 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{title}</h1>
        {subtitle && (
          <span style={{
            fontSize: 12, color: '#94a3b8',
            marginLeft: 8, whiteSpace: 'nowrap',
          }}>· {subtitle}</span>
        )}
      </div>

      {/* 右侧：面包屑 父级 / 当前 */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: '#64748b',
        background: '#f8fafc', padding: '5px 12px',
        borderRadius: 999, border: '1px solid #e2e8f0',
      }} aria-label="breadcrumb">
        {parent && parent.path ? (
          <Link
            to={parent.path}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              color: '#64748b', textDecoration: 'none', fontWeight: 500,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
          >
            {parent.icon && <span style={{ fontSize: 12 }}>{parent.icon}</span>}
            <span>{parent.label}</span>
          </Link>
        ) : parent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748b', fontWeight: 500 }}>
            {parent.icon && <span style={{ fontSize: 12 }}>{parent.icon}</span>}
            <span>{parent.label}</span>
          </span>
        ) : null}

        {parent && current && (
          <span style={{ color: '#cbd5e1', margin: '0 2px' }}>/</span>
        )}

        {current && (
          <span style={{
            color: '#3b82f6', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {current.icon && <span style={{ fontSize: 12 }}>{current.icon}</span>}
            <span>{current.label}</span>
          </span>
        )}
      </nav>
    </div>
  )
}