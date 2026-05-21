import { useState, useContext } from 'react'
import { UserContext } from '../App'
import { useNavigate, Link } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useContext(UserContext)
  const navigate = useNavigate()

  const handleLogin = () => {
    if (!username || !password) {
      alert('请填写用户名和密码')
      return
    }
    setLoading(true)
    setTimeout(() => {
      localStorage.setItem('isLoggedIn', 'true')
      setUser({
        name: username,
        studentId: '2022105430066',
        college: '计算机与软件学院',
        major: '软件工程',
        avatar: '👤'
      })
      setLoading(false)
      navigate('/')
    }, 1000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: '#fff',
        padding: '48px 40px',
        borderRadius: 24,
        width: 420,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔮</div>
          <h1 style={{ fontSize: 28, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Vision-Forge
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>视觉大模型多智能体辅导系统</p>
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>用户名</label>
          <input
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 14 }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>密码</label>
          <input
            type="password"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 14 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        
        <button onClick={handleLogin} style={{ width: '100%', padding: '14px', fontSize: 16, borderRadius: 12 }} disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
        
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
          <span style={{ color: '#64748b' }}>没有账号？</span>
          <Link to="/register" style={{ color: '#3b82f6', textDecoration: 'none', marginLeft: 4 }}>立即注册</Link>
        </div>
        
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          演示账号: 任意用户名/密码
        </div>
      </div>
    </div>
  )
}