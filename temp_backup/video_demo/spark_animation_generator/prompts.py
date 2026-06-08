"""
Spark Animation Generator 提示词模板模块
"""

import re
from typing import Dict, Any, Optional

from exceptions import PromptTemplateError


DEFAULT_ANIMATION_PROMPT = """请你生成一个动态动画,讲讲 {description}
要动态的,要像一个完整的,正在播放的视频。包含一个完整的过程，能把知识点讲清楚。
页面精美，有设计感，同时能够很好的传达知识。知识和图像要准确
附带一些旁白式的文字解说,从头到尾讲清楚一个小的知识点
不需要任何互动按钮,直接开始播放
使用和谐好看，广泛采用的浅色配色方案，使用丰富的视觉元素。双语字幕
**请保证任何一个元素都在一个2k分辨率的容器中被摆在了正确的位置，避免穿模，字幕遮挡，图形位置错误等等问题影响正确的视觉传达**
**重要：代码必须简洁高效，CSS和JavaScript要避免冗余，确保在8192 token限制内生成完整的HTML文件**
html+css+js+svg，放进一个html里，确保文件结构完整，包含闭合标签</html>"""


class PromptTemplate:
    """提示词模板类"""
    
    def __init__(self, template: str, name: str = "default"):
        """
        初始化模板
        
        Args:
            template: 模板字符串，使用 {variable} 作为占位符
            name: 模板名称
        """
        self.template = template
        self.name = name
        self._variables = self._extract_variables(template)
    
    def _extract_variables(self, template: str) -> list:
        """提取模板中的所有变量名"""
        pattern = r'\{([a-zA-Z_][a-zA-Z0-9_]*)\}'
        return list(set(re.findall(pattern, template)))
    
    def render(self, **kwargs) -> str:
        """
        渲染模板
        
        Args:
            **kwargs: 模板变量值
            
        Returns:
            渲染后的字符串
            
        Raises:
            PromptTemplateError: 当缺少必要变量时
        """
        missing = []
        for var in self._variables:
            if var not in kwargs:
                missing.append(var)
        
        if missing:
            raise PromptTemplateError(
                f"模板缺少必要变量: {', '.join(missing)}",
                template_name=self.name,
                missing_variables=missing
            )
        
        try:
            return self.template.format(**kwargs)
        except KeyError as e:
            raise PromptTemplateError(
                f"模板渲染失败: 未知变量 {e}",
                template_name=self.name
            )
        except Exception as e:
            raise PromptTemplateError(
                f"模板渲染失败: {str(e)}",
                template_name=self.name
            )
    
    def get_variables(self) -> list:
        """获取模板所需的所有变量名"""
        return self._variables.copy()
    
    @classmethod
    def default_animation(cls) -> "PromptTemplate":
        """获取默认动画模板"""
        return cls(DEFAULT_ANIMATION_PROMPT, name="default_animation")
