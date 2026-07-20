from datetime import datetime, timedelta
from typing import Generator

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

# ✅ 1. 彻底清除 app. 前缀，使用绝对平级路径
from core.config import settings
from core.database import SessionLocal
from services.models.user import User

# ✅ 创建密码加密上下文 (生产环境必须启用)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ 2. 修正 Swagger UI 的自动登录抓取地址
# 咱们刚才在 main.py 里把用户模块挂载到了 /api/users 下，所以登录接口是这个：
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")


# ------------------ 密码处理 ------------------

# 使用 bcrypt 哈希密码（已启用）
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, db_password: str) -> bool:
    # 兼容：如果数据库中的密码是明文（旧数据），做明文比对
    if db_password and not db_password.startswith('$2b$'):
        return plain_password == db_password
    return pwd_context.verify(plain_password, db_password)


# ------------------ JWT 令牌生成 ------------------

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


# ------------------ 获取数据库会话 ------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------ 当前登录用户解析 ------------------

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception

    return user


# ------------------ 角色鉴权封装 ------------------
# ✅ 做了微小优化：同时兼容中文和英文角色名

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["管理员", "admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可访问")
    return current_user


def get_current_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["教师", "teacher", "管理员", "admin"]: # 管理员通常也有教师权限
        raise HTTPException(status_code=403, detail="仅教师可访问")
    return current_user


def get_current_student(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["学生", "student", "教师", "teacher", "管理员", "admin"]:
        raise HTTPException(status_code=403, detail="无访问权限")
    return current_user