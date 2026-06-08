"""
配置模块单元测试
"""

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from spark_animation_generator.config import SparkConfig
from spark_animation_generator.exceptions import ConfigurationError


class TestSparkConfig(unittest.TestCase):
    """测试 SparkConfig 配置类"""
    
    def test_default_values(self):
        """测试默认值"""
        config = SparkConfig(
            app_id="test_app_id",
            api_key="test_api_key",
            api_secret="test_api_secret"
        )
        
        self.assertEqual(config.app_id, "test_app_id")
        self.assertEqual(config.api_key, "test_api_key")
        self.assertEqual(config.api_secret, "test_api_secret")
        self.assertEqual(config.gpt_url, "wss://spark-api.xf-yun.com/v3.5/chat")
        self.assertEqual(config.domain, "generalv3.5")
        self.assertEqual(config.temperature, 0.5)
        self.assertEqual(config.max_tokens, 4096)
    
    def test_custom_values(self):
        """测试自定义值"""
        config = SparkConfig(
            app_id="custom_app_id",
            api_key="custom_api_key",
            api_secret="custom_api_secret",
            gpt_url="wss://custom.url/chat",
            domain="custom_domain",
            temperature=0.8,
            max_tokens=2048
        )
        
        self.assertEqual(config.gpt_url, "wss://custom.url/chat")
        self.assertEqual(config.domain, "custom_domain")
        self.assertEqual(config.temperature, 0.8)
        self.assertEqual(config.max_tokens, 2048)
    
    @patch.dict(os.environ, {
        "SPARK_APP_ID": "env_app_id",
        "SPARK_API_KEY": "env_api_key",
        "SPARK_API_SECRET": "env_api_secret"
    }, clear=True)
    def test_from_env_success(self):
        """测试从环境变量读取配置成功"""
        config = SparkConfig.from_env()
        
        self.assertEqual(config.app_id, "env_app_id")
        self.assertEqual(config.api_key, "env_api_key")
        self.assertEqual(config.api_secret, "env_api_secret")
    
    @patch.dict(os.environ, {}, clear=True)
    def test_from_env_missing_all(self):
        """测试环境变量全部缺失"""
        with self.assertRaises(ConfigurationError) as context:
            SparkConfig.from_env()
        
        self.assertIn("SPARK_APP_ID", context.exception.missing_keys)
        self.assertIn("SPARK_API_KEY", context.exception.missing_keys)
        self.assertIn("SPARK_API_SECRET", context.exception.missing_keys)
    
    @patch.dict(os.environ, {
        "SPARK_APP_ID": "env_app_id",
        "SPARK_API_KEY": "env_api_key"
    }, clear=True)
    def test_from_env_missing_one(self):
        """测试部分环境变量缺失"""
        with self.assertRaises(ConfigurationError) as context:
            SparkConfig.from_env()
        
        self.assertIn("SPARK_API_SECRET", context.exception.missing_keys)
        self.assertNotIn("SPARK_APP_ID", context.exception.missing_keys)
        self.assertNotIn("SPARK_API_KEY", context.exception.missing_keys)
    
    def test_validate_success(self):
        """测试配置验证成功"""
        config = SparkConfig(
            app_id="test_app_id",
            api_key="test_api_key",
            api_secret="test_api_secret"
        )
        
        # 应该不抛出异常
        config.validate()
    
    def test_validate_empty_app_id(self):
        """测试 app_id 为空"""
        config = SparkConfig(
            app_id="",
            api_key="test_api_key",
            api_secret="test_api_secret"
        )
        
        with self.assertRaises(ConfigurationError) as context:
            config.validate()
        
        self.assertIn("app_id", context.exception.missing_keys)


if __name__ == "__main__":
    unittest.main()
