from datetime import datetime
from pydantic import BaseModel
from typing import Optional

# ✅ 登录请求体模型
class UserLogin(BaseModel):
    username: str
    password: str

# ✅ 登录成功后返回给前端的模型 (已修复字段缺失问题)
class Token(BaseModel):
    id: int
    username: str
    name: str          # 👈 补上了 name，完美对齐 api/v1/user.py 的 return
    access_token: str
    token_type: str
    role: str

# ✅ 当前用户信息展示模型
class UserInfo(BaseModel):
    id: int
    username: str
    name: str
    role: str
    class_name: Optional[str] = None  # 👈 补上了班级，完美对齐 models/user.py
    create_time: datetime
    last_login: Optional[datetime] = None
    login_ip: Optional[str] = None

    class Config:
        from_attributes = True

# ✅ 内部使用模型
class UserInDB(UserInfo):
    password: str
