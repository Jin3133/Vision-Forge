"""
生成HTML动画示例 - 直接生成并保存到output目录
"""

import os
import sys
import time

# 添加当前目录到路径以支持绝对导入
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from llm_agent import SparkLLMAgent


# DeepSeek V4 Flash 价格 (元/百万tokens)
PRICING = {
    "input_cache_hit": 0.02,   # 缓存命中
    "input_cache_miss": 1.0,   # 缓存未命中
    "output": 2.0,             # 输出
}


def calculate_cost(usage: dict) -> dict:
    """计算API调用成本"""
    # 假设输入缓存未命中（保守估计）
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    
    # 计算成本 (元)
    input_cost = (input_tokens / 1_000_000) * PRICING["input_cache_miss"]
    output_cost = (output_tokens / 1_000_000) * PRICING["output"]
    total_cost = input_cost + output_cost
    
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
    }


def generate_and_save(concept: str, filename: str = None):
    """生成动画并保存到output文件夹"""
    # 确保output目录存在
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    if filename is None:
        filename = f"{concept.replace(' ', '_').replace('，', '_')}.html"
    
    # 完整输出路径
    filepath = os.path.join(output_dir, filename)
    
    print(f"正在生成: {concept}")
    print(f"模型: deepseek-v4-flash")
    print("-" * 60)
    
    agent = SparkLLMAgent()
    
    try:
        # 记录开始时间
        start_time = time.time()
        
        result = agent.generate_animation_html(concept)
        
        # 计算耗时
        elapsed_time = time.time() - start_time
        
        if result["success"]:
            html_content = result["content"]
            
            # 检查HTML完整性
            is_complete = "</html>" in html_content and "</body>" in html_content
            
            # 计算成本
            cost_info = calculate_cost(result["usage"])
            
            # 保存到output目录
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html_content)
            
            status = "[OK]" if is_complete else "[INCOMPLETE]"
            print(f"{status} 生成成功!")
            print(f"文件: {filepath}")
            print(f"大小: {len(html_content)} 字符")
            print(f"完整: {is_complete}")
            print(f"耗时: {elapsed_time:.2f} 秒")
            print(f"\nToken使用:")
            print(f"  - 输入: {cost_info['input_tokens']:,} tokens")
            print(f"  - 输出: {cost_info['output_tokens']:,} tokens")
            print(f"\n成本估算:")
            print(f"  - 输入成本: {cost_info['input_cost']:.6f} 元")
            print(f"  - 输出成本: {cost_info['output_cost']:.6f} 元")
            print(f"  - 总成本: {cost_info['total_cost']:.6f} 元")
            print()
            
            # 显示前300字符预览
            preview = html_content[:300].replace('\n', ' ')
            print(f"预览: {preview}...")
            
            return {
                "content": html_content,
                "time": elapsed_time,
                "cost": cost_info,
                "usage": result["usage"],
            }
        else:
            print(f"[FAIL] 生成失败: {result.get('error', '未知错误')}")
            return None
            
    except Exception as e:
        print(f"[ERROR] 错误: {e}")
        return None


if __name__ == "__main__":
    # 生成指定动画
    
    print("=" * 60)
    print("HTML动画生成演示 (DeepSeek V4 Flash)")
    print("=" * 60)
    print()
    
    results = []
    
    # 示例1: 语义分割
    result1 = generate_and_save("语义分割算法可视化", "semantic_segmentation.html")
    if result1:
        results.append(("语义分割", result1))
    
    print("\n" + "=" * 60 + "\n")
    
    # 示例2: 梯度下降
    result2 = generate_and_save("梯度下降算法可视化", "gradient_descent.html")
    if result2:
        results.append(("梯度下降", result2))
    
    # 汇总统计
    print("\n" + "=" * 60)
    print("生成汇总")
    print("=" * 60)
    
    total_time = 0
    total_cost = 0
    total_input_tokens = 0
    total_output_tokens = 0
    
    for name, result in results:
        print(f"\n{name}:")
        print(f"  耗时: {result['time']:.2f} 秒")
        print(f"  输入: {result['cost']['input_tokens']:,} tokens")
        print(f"  输出: {result['cost']['output_tokens']:,} tokens")
        print(f"  成本: {result['cost']['total_cost']:.6f} 元")
        total_time += result['time']
        total_cost += result['cost']['total_cost']
        total_input_tokens += result['cost']['input_tokens']
        total_output_tokens += result['cost']['output_tokens']
    
    print(f"\n总计:")
    print(f"  总耗时: {total_time:.2f} 秒")
    print(f"  总输入: {total_input_tokens:,} tokens")
    print(f"  总输出: {total_output_tokens:,} tokens")
    print(f"  总成本: {total_cost:.6f} 元 ({total_cost * 100:.4f} 分)")
    print("=" * 60)
