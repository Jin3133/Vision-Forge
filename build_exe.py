#!/usr/bin/env python3
"""
Vision-Forge 打包脚本
生成单个可执行文件（包含后端 + 前端）
用法: python build_exe.py
输出: dist/VisionForge (Linux) 或 dist/VisionForge.exe (Windows)
"""

import os, sys, shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / 'backend'
FRONTEND = ROOT / 'frontend'
STATIC = BACKEND / 'static'
DIST = ROOT / 'dist'

def step(msg):
    print(f"\n{'='*50}\n  {msg}\n{'='*50}")

# 1. 构建前端
step("1/3 构建前端...")
os.chdir(FRONTEND)
if not (FRONTEND / 'node_modules').exists():
    subprocess.run(['npm', 'install'], check=True)
subprocess.run(['npm', 'run', 'build'], check=True)

# 2. 复制前端产物到 backend/static
step("2/3 复制前端静态文件...")
if STATIC.exists():
    shutil.rmtree(STATIC)
shutil.copytree(FRONTEND / 'dist', STATIC)

# 3. PyInstaller 打包
step("3/3 PyInstaller 打包...")
os.chdir(BACKEND)

# Windows 用 ; 分隔 add-data，Linux/Mac 用 :
sep = ';' if sys.platform == 'win32' else ':'

pyi_cmd = [
    sys.executable, '-m', 'PyInstaller',
    '--onefile',           # 单文件输出
    '--name', 'VisionForge',
    '--add-data', f'static{sep}static',            # 前端静态文件
    '--add-data', f'assets/code_mirror{sep}assets/code_mirror',  # 源码资产
    '--add-data', f'assets/experiment_results{sep}assets/experiment_results',  # 消融数据
    '--add-data', f'assets/vector_database{sep}assets/vector_database',        # 向量库
    '--hidden-import', 'uvicorn.logging',
    '--hidden-import', 'uvicorn.loops.auto',
    '--hidden-import', 'uvicorn.protocols.http.auto',
    '--hidden-import', 'fastapi',
    '--hidden-import', 'pydantic',
    '--hidden-import', 'sqlalchemy',
    '--hidden-import', 'chromadb',
    '--clean',
    '--noconfirm',
    'run.py',
]

for ex in excludes:
    pyi_cmd.extend(['--exclude-module', ex])

subprocess.run(pyi_cmd, check=True)

# 4. 移到根目录 dist/
step("✅ 打包完成！")
DIST.mkdir(exist_ok=True)
exe = BACKEND / 'dist' / 'VisionForge'
if sys.platform == 'win32':
    exe = exe.with_suffix('.exe')

if exe.exists():
    dest = DIST / exe.name
    shutil.copy(exe, dest)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"\n{'='*50}")
    print(f"  可执行文件: {dest}")
    print(f"  大小: {size_mb:.0f} MB")
    print(f"  运行: {dest}")
    print(f"{'='*50}")
else:
    print("❌ 构建失败，请检查上方日志")
