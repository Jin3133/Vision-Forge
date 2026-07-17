"""
Vision-Forge 打包入口（PyInstaller）
运行: ./VisionForge.exe  或  python run.py
"""
import sys
import os

# PyInstaller 打包后，sys._MEIPASS 指向临时解压目录
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
else:
    bundle_dir = os.path.dirname(os.path.abspath(__file__))

# 静态文件路径（前端构建产物）
static_dir = os.path.join(bundle_dir, 'static')
if os.path.isdir(static_dir):
    os.environ['FRONTEND_STATIC_DIR'] = static_dir

# 确保 backend 目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from main import app

if __name__ == '__main__':
    print("=" * 50)
    print("  Vision-Forge 教研平台")
    print(f"  静态文件: {static_dir if os.path.isdir(static_dir) else '未找到（仅 API 模式）'}")
    print(f"  访问地址: http://localhost:17077")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=17077)
