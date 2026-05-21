import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    college: '',
    major: ''
  })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = () => {
    if (!form.username || !form.password) {
      alert('请填写必填信息')
      return
    }
    if (form.password !== form.confirmPassword) {
      alert('两次密码不一致')
      return
    }
    setLoading(true)
    setTimeout(() => {
      alert('注册成功！请登录')
      setLoading(false)
      navigate('/login')
    }, 1000)
  }

  const fields = [
    { label: '用户名', key: 'username', required: true, placeholder: '请输入用户名' },
    { label: '密码', key: 'password', type: 'password', required: true, placeholder: '请输入密码' },
    { label: '确认密码', key: 'confirmPassword', type: 'password', required: true, placeholder: '请再次输入密码' },
    { label: '学号', key: 'studentId', placeholder: '请输入学号' },
    { label: '学院', key: 'college', placeholder: '请输入学院名称' },
    { label: '专业', key: 'major', placeholder: '请输入专业名称' },
  ]

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
        padding: '40px 36px',
        borderRadius: 24,
        width: 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
          <h2 style={{ fontSize: 24, color: '#1e293b' }}>注册账号</h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>加入 Vision-Forge，开启智能学习之旅</p>
        </div>

        {fields.map((field) => (
          <div key={field.key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#334155' }}>
              {field.label}{field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <input
              type={field.type || 'text'}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }}
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              placeholder={field.placeholder}
            />
          </div>
        ))}

        <button onClick={handleRegister} style={{ width: '100%', padding: '12px', fontSize: 15, borderRadius: 10, marginTop: 8 }} disabled={loading}>
          {loading ? '注册中...' : '注册'}
        </button>
        
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <span style={{ color: '#64748b' }}>已有账号？</span>
          <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none', marginLeft: 4 }}>立即登录</Link>
        </div>
      </div>
    </div>
  )
}