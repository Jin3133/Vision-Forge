"""
Prompt模板模块单元测试
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spark_animation_generator.prompts import PromptTemplate, DEFAULT_ANIMATION_PROMPT
from spark_animation_generator.exceptions import PromptTemplateError


class TestPromptTemplate(unittest.TestCase):
    """测试 PromptTemplate 类"""
    
    def test_init_with_default_name(self):
        """测试默认名称初始化"""
        template = PromptTemplate("Hello {name}")
        self.assertEqual(template.name, "default")
        self.assertEqual(template.template, "Hello {name}")
    
    def test_extract_variables_single(self):
        """测试提取单个变量"""
        template = PromptTemplate("Hello {name}")
        variables = template.get_variables()
        self.assertIn("name", variables)
        self.assertEqual(len(variables), 1)
    
    def test_extract_variables_multiple(self):
        """测试提取多个变量"""
        template = PromptTemplate("{greeting} {name}, welcome to {place}")
        variables = template.get_variables()
        self.assertIn("greeting", variables)
        self.assertIn("name", variables)
        self.assertIn("place", variables)
        self.assertEqual(len(variables), 3)
    
    def test_render_success(self):
        """测试模板渲染成功"""
        template = PromptTemplate("Hello {name}")
        result = template.render(name="Alice")
        self.assertEqual(result, "Hello Alice")
    
    def test_render_missing_variable(self):
        """测试缺少变量时抛出异常"""
        template = PromptTemplate("Hello {name}")
        
        with self.assertRaises(PromptTemplateError) as context:
            template.render()
        
        self.assertIn("name", context.exception.missing_variables)
    
    def test_default_animation_classmethod(self):
        """测试默认动画模板类方法"""
        template = PromptTemplate.default_animation()
        
        self.assertEqual(template.name, "default_animation")
        self.assertEqual(template.template, DEFAULT_ANIMATION_PROMPT)
        self.assertIn("description", template.get_variables())


if __name__ == "__main__":
    unittest.main()
