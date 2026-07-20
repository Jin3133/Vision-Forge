/**
 * 管理员 API 封装
 * 需要有效的 JWT Token（admin 角色）
 */

const getAuthHeaders = () => {
  const token = localStorage.getItem('mock_token') || sessionStorage.getItem('mock_token') || ''
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

/** 获取用户列表（分页+搜索+角色筛选） */
export const fetchUsers = async ({ keyword = '', role = '', page = 1, pageSize = 15 } = {}) => {
  const params = new URLSearchParams()
  if (keyword) params.set('keyword', keyword)
  if (role) params.set('role', role)
  params.set('page', String(page))
  params.set('page_size', String(pageSize))

  const res = await fetch(`/api/users/search?${params.toString()}`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 获取用户列表（简单分页） */
export const fetchUserList = async ({ role = '', page = 1, pageSize = 15 } = {}) => {
  const params = new URLSearchParams()
  if (role) params.set('role', role)
  params.set('page', String(page))
  params.set('page_size', String(pageSize))

  const res = await fetch(`/api/users/list?${params.toString()}`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 添加用户 */
export const addUser = async ({ username, password, name, role, className = '' }) => {
  const res = await fetch('/api/users/add', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username, password, name, role, class_name: className }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 修改用户角色 */
export const updateUserRole = async (username, role) => {
  const res = await fetch('/api/users/update-role', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username, role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 删除用户 */
export const deleteUser = async (username) => {
  const res = await fetch('/api/users/delete', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 重置用户密码 */
export const resetUserPassword = async (username) => {
  const res = await fetch('/api/users/reset-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 获取管理员仪表盘统计数据 */
export const fetchAdminStats = async () => {
  const res = await fetch('/api/users/admin/stats', {
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

/** 获取算子节点白名单 */
export const fetchNodeCatalog = async () => {
  const res = await fetch('/api/admin/node-catalog', { headers: getAuthHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
  return res.json()
}

/** 获取源码文件列表 */
export const fetchCodeFiles = async () => {
  const res = await fetch('/api/admin/code-files', { headers: getAuthHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
  return res.json()
}

/** 获取消融实验数据列表 */
export const fetchExperimentData = async () => {
  const res = await fetch('/api/admin/experiment-data', { headers: getAuthHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
  return res.json()
}

/** 获取最近生成资源 */
export const fetchRecentMaterials = async () => {
  const res = await fetch('/api/admin/recent-materials', { headers: getAuthHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
  return res.json()
}

/** 获取系统信息 */
export const fetchSystemInfo = async () => {
  const res = await fetch('/api/admin/system-info', { headers: getAuthHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `HTTP ${res.status}`)
  return res.json()
}
