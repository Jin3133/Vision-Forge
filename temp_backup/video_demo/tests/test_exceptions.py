"""
异常模块单元测试
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spark_animation_generator.exceptions import LLMGenerationError, ConfigurationError, PromptTemplateError


class TestLLMGenerationError(unittest.TestCase):
    """测试 LLMGenerationError 异常"""
    
    def test_basic_exception(self):
        """测试基本异常抛出"""
        with self.assertRaises(LLMGenerationError) as context:
            raise LLMGenerationError("测试错误")
        
        self.assertEqual(str(context.exception), "测试错误")
        self.assertEqual(context.exception.message, "测试错误")
    
    def test_exception_with_error_code(self):
        """测试带错误码的异常"""
        error = LLMGenerationError("API调用失败", error_code="E001")
        
        self.assertEqual(error.message, "API调用失败")
        self.assertEqual(error.error_code, "E001")


class TestConfigurationError(unittest.TestCase):
    """测试 ConfigurationError 异常"""
    
    def test_exception_with_missing_keys(self):
        """测试带缺失键的异常"""
        missing = ["SPARK_APP_ID", "SPARK_API_KEY"]
        error = ConfigurationError("缺少环境变量", missing_keys=missing)
        
        self.assertEqual(error.message, "缺少环境变量")
        self.assertEqual(error.missing_keys, missing)


class TestPromptTemplateError(unittest.TestCase):
    """测试 PromptTemplateError 异常"""
    
    def test_exception_with_all_fields(self):
        """测试带所有字段的异常"""
        missing = ["description"]
        error = PromptTemplateError(
            "模板缺少必要变量",
            template_name="animation_template",
            missing_variables=missing
        )
        
        self.assertEqual(error.message, "模板缺少必要变量")
        self.assertEqual(error.template_name, "animation_template")
        self.assertEqual(error.missing_variables, missing)


if __name__ == "__main__":
    unittest.main()
