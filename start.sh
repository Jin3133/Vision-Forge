#!/bin/bash
# Vision-Forge 一键启动脚本
# 用法: ./start.sh [--build] [--port 17077]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD=false
PORT=17077

for arg in "$@"; do
    case $arg in
        --build) BUILD=true ;;
        --port=*) PORT="${arg#*=}" ;;
        --port) PORT="$2"; shift ;;
    esac
    shift 2>/dev/null || true
done

echo "========================================"
echo "  Vision-Forge 教研平台"
echo "========================================"

# 1. 检查 Python 环境
if ! command -v python3 &>/dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3.9+"
    exit 1
fi

cd "$SCRIPT_DIR/backend"

# 2. 安装后端依赖（如需要）
if [ ! -f ".deps_installed" ]; then
    echo "📦 安装后端依赖..."
    pip install -r requirements.txt -q
    touch .deps_installed
fi

# 3. 构建前端（如指定 --build）
if [ "$BUILD" = true ]; then
    echo "🔨 构建前端..."
    cd "$SCRIPT_DIR/frontend"
    if [ ! -d "node_modules" ]; then
        npm install --silent
    fi
    npm run build --silent
    # 将构建产物复制到后端静态目录
    rm -rf "$SCRIPT_DIR/backend/static"
    cp -r dist "$SCRIPT_DIR/backend/static"
    echo "✅ 前端已构建到 backend/static/"
fi

# 4. 启动后端（自动检测前端静态文件）
cd "$SCRIPT_DIR/backend"
echo ""
echo "🚀 启动服务 http://localhost:$PORT"
echo "   按 Ctrl+C 停止"
echo ""

# 设置环境变量让后端知道前端静态文件位置
export FRONTEND_STATIC_DIR="$SCRIPT_DIR/backend/static"

uvicorn main:app --host 0.0.0.0 --port "$PORT"
