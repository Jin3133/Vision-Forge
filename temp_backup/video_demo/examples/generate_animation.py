"""
星火LLM动画生成示例

使用方法:
1. 确保已配置环境变量: SPARK_APP_ID, SPARK_API_KEY, SPARK_API_SECRET
2. 运行: python examples/generate_animation.py
"""

import os
import sys
import asyncio

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spark_animation_generator.llm_agent import SparkLLMAgent
from spark_animation_generator.prompts import PromptTemplate


def example_sync():
    """同步接口示例"""
    print("=" * 60)
    print("示例1: 同步接口生成动画")
    print("=" * 60)
    
    # 初始化 Agent
    agent = SparkLLMAgent()
    
    # 定义要生成的动画概念
    concept = "冒泡排序算法可视化"
    
    print(f"正在生成动画: {concept}")
    print("-" * 60)
    
    try:
        # 调用同步接口
        result = agent.generate_animation_html(concept)
        
        if result["success"]:
            print("✅ 生成成功!")
            print(f"Token使用情况: {result['usage']}")
            print("-" * 60)
            
            # 保存到output目录
            output_dir = os.path.join(os.path.dirname(__file__), "..", "output")
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "bubble_sort_animation.html")
            
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(result["content"])
            
            print(f"✅ 动画已保存到: {output_file}")
            print(f"文件大小: {len(result['content'])} 字符")
        else:
            print(f"❌ 生成失败: {result.get('error', '未知错误')}")
            
    except Exception as e:
        print(f"❌ 错误: {e}")


def example_sync_with_custom_template():
    """使用自定义模板的同步接口示例"""
    print("\n" + "=" * 60)
    print("示例2: 使用自定义模板生成动画")
    print("=" * 60)
    
    # 定义自定义模板
    custom_template = PromptTemplate(
        template="""你是一个专业的教育动画生成专家。请根据以下主题生成一个适合K12学生的教育动画。

主题: {description}

要求:
1. 使用简单易懂的语言和视觉效果
2. 包含逐步讲解的过程
3. 使用明亮活泼的配色方案
4. 添加适当的文字说明
5. 生成完整的HTML文件，包含所有CSS和JavaScript

请直接返回HTML代码。""",
        name="education_template"
    )
    
    agent = SparkLLMAgent()
    concept = "水的循环过程"
    
    print(f"正在生成教育动画: {concept}")
    print("-" * 60)
    
    try:
        result = agent.generate_animation_html(concept, template=custom_template)
        
        if result["success"]:
            print("✅ 生成成功!")
            
            # 保存到output目录
            output_dir = os.path.join(os.path.dirname(__file__), "..", "output")
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, "water_cycle_animation.html")
            
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(result["content"])
            print(f"✅ 动画已保存到: {output_file}")
        else:
            print(f"❌ 生成失败: {result.get('error', '未知错误')}")
            
    except Exception as e:
        print(f"❌ 错误: {e}")


def check_env():
    """检查环境变量是否配置"""
    required_vars = ["SPARK_APP_ID", "SPARK_API_KEY", "SPARK_API_SECRET"]
    missing = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print("❌ 缺少必要的环境变量:")
        for var in missing:
            print(f"   - {var}")
        print("\n请设置环境变量后再运行示例。")
        print("示例:")
        print("   export SPARK_APP_ID=your_app_id")
        print("   export SPARK_API_KEY=your_api_key")
        print("   export SPARK_API_SECRET=your_api_secret")
        return False
    
    print("✅ 环境变量检查通过")
    return True


if __name__ == "__main__":
    # 检查环境变量
    if not check_env():
        sys.exit(1)
    
    # 运行示例
    print("\n")
    
    # 示例1: 同步接口
    example_sync()
    
    # 示例2: 自定义模板
    example_sync_with_custom_template()
    
    print("\n" + "=" * 60)
    print("所有示例运行完成!")
    print("=" * 60)
