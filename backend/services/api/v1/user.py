# 引入依赖库与工具
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from pydantic import BaseModel

# ✅ 1. 修正数据库导入
from core.database import get_db

# ✅ 2. 修正模型与 Pydantic 结构导入
from services.models.user import User
from services.schemas.user import UserLogin, Token, UserInfo

# ✅ 3. 修正认证服务导入 (确保你的 auth.py 放到了 services 目录下)
from services.biz_logic.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin,
    get_current_teacher,
    get_current_student
)

# 初始化路由器
router = APIRouter()

# ================= 以下业务逻辑代码 100% 完美，原封不动保留 =================

# ✅ 用户登录接口（返回JWT Token）
@router.post("/login", response_model=Token, summary="用户登录")
def login(user: UserLogin, request: Request, db: Session = Depends(get_db)):
    # 根据用户名查询用户
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # 记录登录IP与时间
    client_ip = request.client.host
    db_user.last_login = datetime.utcnow() + timedelta(hours=8)
    db_user.login_ip = client_ip
    db.commit()

    # 生成Token，包含用户名和角色
    token_data = {"sub": db_user.username, "role": db_user.role}
    token = create_access_token(token_data)

    return {
        "id": db_user.id,
        "username": db_user.username,
        "access_token": token,
        "name": db_user.name,
        "token_type": "bearer",
        "role": db_user.role
    }


# ✅ 公开注册接口（无需管理员权限）
class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str = ""
    role: str = "student"
    class_name: str = ""

@router.post("/register", summary="用户注册")
def register_user(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    new_user = User(
        username=data.username,
        password=hash_password(data.password),
        name=data.name or data.username,
        role=data.role if data.role in ["student", "teacher", "admin"] else "student",
        class_name=data.class_name,
        create_time=datetime.utcnow(),
    )
    db.add(new_user)
    db.commit()
    return {"message": f"注册成功", "username": data.username}


# ✅ 获取当前登录用户信息
@router.get("/me", response_model=UserInfo, summary="获取当前用户信息")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


# ✅ 仅管理员可访问接口
@router.get("/admin-only", summary="管理员访问接口")
def admin_only(current_user: User = Depends(get_current_admin)):
    return {"message": f"欢迎你，管理员 {current_user.username}"}

# ✅ 仅教师可访问接口
@router.get("/teacher-only", summary="教师访问接口")
def teacher_only(current_user: User = Depends(get_current_teacher)):
    return {"message": f"欢迎你，教师 {current_user.username}"}

# ✅ 仅学生可访问接口
@router.get("/student-only", summary="学生访问接口")
def student_only(current_user: User = Depends(get_current_student)):
    return {"message": f"欢迎你，学生 {current_user.username}"}


# ✅ 修改密码接口（当前用户）
class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password", summary="修改密码")
def change_password(
    data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user_token: User = Depends(get_current_user)
):
    # 再次从数据库获取当前用户信息
    user = db.query(User).filter(User.username == current_user_token.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not verify_password(data.old_password, user.password):
        raise HTTPException(status_code=400, detail="原密码不正确")

    # 设置新密码
    user.password = hash_password(data.new_password)
    db.commit()
    return {"message": "密码修改成功"}


# ✅ 管理员：查看用户列表
class UserListResponse(BaseModel):
    users: List[UserInfo]
    total: int

@router.get("/list", response_model=UserListResponse)
def list_users(
    page: int = 1,
    page_size: int = 15,
    role: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # 普通登录用户
):
    if role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权查看管理员信息")

    query = db.query(User)
    if role:
        query = query.filter(User.role == role)

    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"users": users, "total": total}


# ✅ 管理员：修改用户角色
class RoleUpdateRequest(BaseModel):
    user_id: int
    new_role: str

@router.post("/update-role", summary="管理员修改用户角色")
def update_user_role(
    data: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.role = data.new_role
    db.commit()
    return {"message": "用户角色已更新"}


# ✅ 管理员：删除用户
class UserDeleteRequest(BaseModel):
    user_id: int

@router.post("/delete", summary="管理员删除用户")
def delete_user(
    data: UserDeleteRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    db.delete(user)
    db.commit()
    return {"message": "用户删除成功"}


# ✅ 管理员：重置用户密码为其用户名
class ResetPasswordRequest(BaseModel):
    user_id: int

@router.post("/reset-password", summary="管理员重置用户密码为其用户名")
def reset_user_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.password = hash_password(user.username)
    db.commit()
    return {"message": f"密码已重置为用户名：{user.username}"}


# ✅ 管理员：添加新用户
class AddUserRequest(BaseModel):
    username: str
    name: str = ""
    role: str

@router.post("/add", summary="管理员添加新用户")
def add_user(
    data: AddUserRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # 检查用户名是否重复
    existing_user = db.query(User).filter(User.username == data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="该用户名已存在")

    new_user = User(
        username=data.username,
        name=data.name,
        role=data.role,
        password=hash_password(data.username),  # 默认密码 = 用户名
        last_login=None,
        login_ip=None
    )

    db.add(new_user)
    db.commit()
    return {"message": f"用户 {data.username} 添加成功，初始密码为其用户名"}


# ✅ 管理员：模糊搜索用户（支持用户名/姓名）
@router.get("/search", summary="模糊搜索用户名或姓名（分页）")
def search_users(
    keyword: str,
    page: int = 1,
    page_size: int = 15,
    role: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(User).filter(
        or_(
            User.username.ilike(f"%{keyword}%"),
            User.name.ilike(f"%{keyword}%")
        )
    )
    if role:
        query = query.filter(User.role == role)

    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"users": users, "total": total}


# ✅ 管理员：仪表盘统计数据
@router.get("/admin/stats", summary="管理员仪表盘统计")
def admin_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    total_users = db.query(User).count()
    admin_count = db.query(User).filter(User.role.in_(["admin", "管理员"])).count()
    teacher_count = db.query(User).filter(User.role.in_(["teacher", "教师"])).count()
    student_count = db.query(User).filter(User.role.in_(["student", "学生"])).count()
    recent_users = db.query(User).order_by(User.create_time.desc()).limit(5).all()

    return {
        "total_users": total_users,
        "by_role": {
            "admin": admin_count,
            "teacher": teacher_count,
            "student": student_count,
        },
        "recent_users": [
            {"id": u.id, "username": u.username, "name": u.name, "role": u.role, "create_time": u.create_time.isoformat() if u.create_time else None}
            for u in recent_users
        ],
    }

