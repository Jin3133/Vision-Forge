"""
Vision-Forge 多模态报告生成系统 - 一键运行脚本
================================================

使用方法:
    python run.py

环境变量:
    DEEPSEEK_API_KEY - DeepSeek API 密钥
"""

import os
import sys
from datetime import datetime

# 确保 output 目录存在
os.makedirs("output", exist_ok=True)

# 导入 ReportAgent
from agent import ReportAgent


def build_context():
    """
    构建测试上下文数据

    这个函数演示了如何构造符合 Agent 输入格式的上下文字典
    实际使用时，可以从 Task_State.json 或其他数据源读取
    """
    return {
        "model_name": "SAM_ViT_B",
        "task": "农业遥感图像语义分割",
        "dataset": "Agriculture-Vision 2024 (玉米/大豆/小麦 三期遥感影像)",
        "img_size": 1024,
        "batch_size": 8,
        "epochs": 50,
        "learning_rate": 0.0001,
        "optimizer": "AdamW",
        "scheduler": "CosineAnnealingLR",
        "weight_decay": 0.01,
        "warmup_epochs": 5,
        "benchmark_metrics": {
            "models": ["SAM_ViT_B", "SAM_ViT_H", "GroundingDINO"],
            "metrics": {
                "mIoU": [0.72, 0.78, 0.69],
                "FPS": [45, 28, 52],
                "Params_M": [89, 256, 172],
                "训练时间_h": [2.25, 6.50, 3.80],
                "推理延迟_ms": [22, 35, 19]
            }
        },
        "training_history": {
            "epochs": list(range(1, 51)),
            "train_loss": [0.85 - i * 0.015 for i in range(50)],
            "val_mIoU": [0.38 + i * 0.007 for i in range(50)]
        },
        "source_code_examples": {
            "prompt_encoder": "class PromptEncoder(nn.Module):\n    def __init__(self, embed_dim):\n        super().__init__()\n        self.embed_dim = embed_dim",
            "mask_decoder": "class MaskDecoder(nn.Module):\n    def __init__(self, transformer_dim, num_mask_tokens):\n        super().__init__()\n        self.transformer_dim = transformer_dim"
        },
        "learning_progress": {
            "current_epoch": 50,
            "best_mIoU": 0.72,
            "total_time": "2h 15m",
            "knowledge_mastery": {
                "图像分割基础": 0.85,
                "注意力机制": 0.78,
                "模型微调技术": 0.92,
                "实验设计": 0.80
            }
        },
        "ablation_study": {
            "experiments": [
                {"name": "Baseline (no fine-tune)", "mIoU": 0.41},
                {"name": "仅微调 Mask Decoder", "mIoU": 0.58},
                {"name": "仅微调 Prompt Encoder", "mIoU": 0.63},
                {"name": "全参数微调", "mIoU": 0.72},
                {"name": "LoRA (rank=8)", "mIoU": 0.68},
                {"name": "添加Efficient Attention", "mIoU": 0.74}
            ]
        }
    }


def main():
    print("=" * 60)
    print("Vision-Forge 多模态报告生成系统")
    print("=" * 60)

    # 检查 API Key
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("\n错误：未设置 DEEPSEEK_API_KEY 环境变量")
        print("\n请运行以下命令设置 API Key (PowerShell):")
        print('  $env:DEEPSEEK_API_KEY = "your-api-key"')
        print("\n或运行以下命令设置 API Key (CMD):")
        print('  set DEEPSEEK_API_KEY=your-api-key')
        print("\n或运行以下命令设置 API Key (Bash/Linux):")
        print('  export DEEPSEEK_API_KEY="your-api-key"')
        sys.exit(1)

    print(f"\nAPI Key 已设置: {api_key[:8]}...{api_key[-4:]}")
    print("\n正在构建上下文数据...")

    # 构建上下文
    context = build_context()
    print(f"  模型: {context['model_name']}")
    print(f"  任务: {context['task']}")
    print(f"  数据集: {context['dataset']}")
    print(f"  训练轮数: {context['epochs']}")

    # 创建 Agent
    print("\n初始化 Report Agent...")
    agent = ReportAgent()

    # 生成报告
    print("\n开始生成报告 (这可能需要几分钟)...")
    print("-" * 40)

    try:
        html = agent.run(context)
    except Exception as e:
        print(f"\n错误：报告生成失败 - {e}")
        sys.exit(1)

    # 保存报告
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = f"output/report_{timestamp}.html"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    print("-" * 40)
    print(f"\n报告生成完成！")
    print(f"输出路径: {output_path}")
    print(f"文件大小: {len(html)} 字符")

    # 提示打开方式
    print("\n查看报告的方式:")
    print("  1. 双击打开 HTML 文件 (推荐使用 http.server):")
    print("     python -m http.server 8000")
    print("     然后访问 http://localhost:8000/output/")
    print("  2. 直接双击 HTML 文件 (图表可能无法加载)")


if __name__ == "__main__":
    main()
