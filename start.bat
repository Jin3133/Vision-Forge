@echo off
chcp 65001 >nul
title Vision-Forge 教研平台
echo ========================================
echo   Vision-Forge 教研平台（免打包版）
echo ========================================

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    echo 下载: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查前端是否已构建
if not exist "backend\static\index.html" (
    echo [提示] 首次运行，正在构建前端...
    cd frontend
    call npm install
    call npm run build
    cd ..
    xcopy /E /Y frontend\dist\* backend\static\
)

:: 安装后端依赖（如需要）
if not exist "backend\.deps_installed" (
    echo [提示] 正在安装后端依赖...
    pip install fastapi uvicorn pydantic pydantic-settings sqlalchemy openai python-jose passlib bcrypt chromadb -q
    type nul > backend\.deps_installed
)

:: 启动服务
echo.
echo   服务启动中...
echo   浏览器打开: http://localhost:17077
echo   按 Ctrl+C 停止
echo.

cd backend
set FRONTEND_STATIC_DIR=static
python run.py

pause
