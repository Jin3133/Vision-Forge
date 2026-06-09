"""
Spark Animation Generator 核心模块 (DeepSeek API 版本)
"""

import os
import sys
from typing import Dict, Any, Optional

import openai

from exceptions import LLMGenerationError
from prompts import PromptTemplate


class SparkLLMAgent:
    """动画生成 Agent (使用 DeepSeek API)"""

    def __init__(self, api_key: Optional[str] = None, temperature: float = 0.7):
        """
        初始化 LLM Agent

        Args:
            api_key: DeepSeek API Key，如果为 None 则从环境变量 DEEPSEEK_API_KEY 读取
            temperature: 生成温度
        """
        api_key = api_key or os.environ.get("DEEPSEEK_API_KEY")
        if not api_key:
            print("错误：未找到环境变量 DEEPSEEK_API_KEY")
            print("请设置：$env:DEEPSEEK_API_KEY='your-api-key'  (PowerShell)")
            sys.exit(1)

        self.client = openai.OpenAI(
            base_url="https://api.deepseek.com/v1",
            api_key=api_key,
        )
        self.model = "deepseek-v4-flash"
        self.temperature = temperature

    def generate_animation_html(
        self,
        description: str,
        template: Optional[PromptTemplate] = None
    ) -> Dict[str, Any]:
        """
        同步接口：生成动画HTML

        Args:
            description: 用户描述的动画需求
            template: 自定义提示词模板，如果为 None 则使用默认模板

        Returns:
            包含生成结果的字典
            {
                "content": str,      # 生成的HTML代码
                "usage": dict,       # Token使用情况
                "success": bool,     # 是否成功
                "error": str         # 错误信息（如果失败）
            }

        Raises:
            LLMGenerationError: 当生成过程中发生错误时
        """
        if not description or not description.strip():
            raise LLMGenerationError("描述不能为空")

        prompt_template = template or PromptTemplate.default_animation()
        prompt = prompt_template.render(description=description)

        messages = [
            {"role": "system", "content": "你是一个专业的HTML动画生成专家，擅长创建精美、动态、教育性的可视化动画。"},
            {"role": "user", "content": prompt}
        ]

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=100000,
                extra_body={"thinking_disable": True},
            )

            raw_content = response.choices[0].message.content or ""
            
            # 从 Markdown 代码块中提取 HTML
            content = self._extract_html_from_markdown(raw_content)
            
            usage = {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }

            return {
                "content": content,
                "usage": usage,
                "success": True,
                "error": None
            }

        except openai.APIError as e:
            raise LLMGenerationError(f"API调用失败: {str(e)}")
        except Exception as e:
            raise LLMGenerationError(f"请求错误: {str(e)}")

    def _extract_html_from_markdown(self, text: str) -> str:
        """
        从 Markdown 代码块中提取 HTML 代码
        
        Args:
            text: 包含 Markdown 代码块的文本
            
        Returns:
            纯 HTML 代码
        """
        import re
        
        text = text.strip()
        
        # 查找 ```html 或 ``` 开头的代码块
        code_block_pattern = r'```(?:html)?\s*\n(.*?)```'
        matches = re.findall(code_block_pattern, text, re.DOTALL)
        
        if matches:
            # 取最后一个代码块（通常是实际内容）
            for match in reversed(matches):
                content = match.strip()
                if '<html' in content or '<!DOCTYPE' in content:
                    return content
            # 如果没有找到包含 HTML 标签的，返回最后一个
            return matches[-1].strip()
        
        # 如果没有找到代码块，检查是否以 <!DOCTYPE 或 <html 开头
        if '<!DOCTYPE' in text or '<html' in text:
            doctype_pos = text.find('<!DOCTYPE')
            html_pos = text.find('<html')
            start_pos = min(pos for pos in [doctype_pos, html_pos] if pos != -1)
            return text[start_pos:].strip()
        
        # 如果都不匹配，返回原文本
        return text
