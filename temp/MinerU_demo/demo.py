"""
MinerU 多模态文档解析 - 端到端演示

使用方法:
    python demo.py <file_path> [--language LANGUAGE] [--timeout TIMEOUT]

示例:
    python demo.py test_files/2406010330_许赵泓.docx
    python demo.py test_files/2025-TDAG_*.pdf --language en --timeout 180
"""

import os
import sys
import argparse
import time

# 确保能在本目录下直接运行
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

from mineru_api import mineru_parse, MinerUApiError, MinerURateLimitError, MinerUTimeoutError


def main():
    parser = argparse.ArgumentParser(description="MinerU 多模态文档解析演示")
    parser.add_argument("file_path", help="待解析的文件路径")
    parser.add_argument("--language", default="ch", help="文档语言（默认: ch）")
    parser.add_argument("--enable-table", default=True, action="store_true", help="启用表格识别")
    parser.add_argument("--enable-formula", default=True, action="store_true", help="启用公式识别")
    parser.add_argument("--is-ocr", action="store_true", help="启用 OCR")
    parser.add_argument("--timeout", type=int, default=120, help="轮询超时秒数（默认: 120）")
    parser.add_argument("--output", "-o", default=None, help="输出文件路径（默认: 自动生成）")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    args = parser.parse_args()

    file_path = args.file_path
    if not os.path.exists(file_path):
        # 尝试从 test_files 目录加载
        test_path = os.path.join(SCRIPT_DIR, "test_files", file_path)
        if os.path.exists(test_path):
            file_path = test_path
        else:
            print(f"[ERROR] 文件不存在: {file_path}")
            sys.exit(1)

    fsize = os.path.getsize(file_path)
    fname = os.path.basename(file_path)

    print(f"[1/3] 读取文件: {fname} ({fsize/1024:.1f} KB)")

    start = time.time()
    try:
        content = mineru_parse(
            file_path,
            language=args.language,
            enable_table=args.enable_table,
            enable_formula=args.enable_formula,
            is_ocr=args.is_ocr,
            timeout=args.timeout,
            poll_interval=2,
        )
        elapsed = time.time() - start

        print(f"[2/3] MinerU 解析完成! 耗时 {elapsed:.1f}s, 内容 {len(content)} 字符")

        out_path = args.output
        if out_path is None:
            basename = os.path.splitext(fname)[0]
            out_path = os.path.join(SCRIPT_DIR, "output", f"{basename}_result.txt")

        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"[3/3] 结果已保存: {out_path}")

        if args.verbose:
            print(f"\n{'─'*60}")
            print("内容预览（前 1000 字符）:")
            print(f"{'─'*60}")
            print(content[:1000])
            print(f"\n... (共 {len(content)} 字符)")

    except MinerURateLimitError as e:
        print(f"[FAIL] MinerU API 限频: {e}")
        print("      请等待一段时间后重试。")
        sys.exit(2)
    except MinerUTimeoutError as e:
        print(f"[FAIL] MinerU API 超时: {e}")
        sys.exit(3)
    except MinerUApiError as e:
        print(f"[FAIL] MinerU API 错误: {e}")
        sys.exit(4)


if __name__ == "__main__":
    main()