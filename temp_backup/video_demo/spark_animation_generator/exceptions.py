"""
Spark Animation Generator 异常定义模块
"""


class LLMGenerationError(Exception):
    """LLM生成过程中的错误"""
    
    def __init__(self, message: str, error_code: str = None, details: dict = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}


class ConfigurationError(Exception):
    """配置错误"""
    
    def __init__(self, message: str, missing_keys: list = None):
        super().__init__(message)
        self.message = message
        self.missing_keys = missing_keys or []


class PromptTemplateError(Exception):
    """提示词模板错误"""
    
    def __init__(self, message: str, template_name: str = None, missing_variables: list = None):
        super().__init__(message)
        self.message = message
        self.template_name = template_name
        self.missing_variables = missing_variables or []
