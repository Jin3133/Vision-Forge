"""
MOSS-TTS-Realtime 高质量知性女声配置
推荐参数配置 - 优化音频清晰度
"""

from pathlib import Path

# 项目根目录（tts_server_system的父目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 模型路径
MODEL_PATH = str(PROJECT_ROOT / "MOSS-TTS" / "models" / "openmoss" / "MOSS-TTS-Realtime")
CODEC_PATH = "OpenMOSS-Team/MOSS-Audio-Tokenizer"

# 参考音频路径 - 知性女声
REFERENCE_AUDIO = str(PROJECT_ROOT / "MOSS-TTS" / "assets" / "audio" / "reference_zh_2.wav")

# 高质量生成参数配置
GENERATION_CONFIG = {
    "temperature": 0.5,          # 降低随机性，更稳定清晰
    "top_p": 0.7,                # 稍微提高多样性
    "top_k": 20,                 # 限制候选词数量
    "repetition_penalty": 1.05,  # 轻微惩罚重复
    "repetition_window": 50,     # 重复窗口大小
    "max_length": 5000,          # 最大生成长度
}

# Codec 解码参数
CODEC_DECODE_CONFIG = {
    "chunk_duration": 4,         # 减小 chunk 大小，更精细处理
}

# 音频采样率
SAMPLE_RATE = 24000

# 人设名称
VOICE_NAME = "知性女声"

# 示例文本
SAMPLE_TEXT = "你好，我是你的AI助手，很高兴为你服务。"

# 热启动配置
WARM_START_CONFIG = {
    "enabled": True,                    # 是否启用热启动
    "preload_on_import": False,         # 导入时是否预加载
    "device": "cuda",                   # 运行设备
    "dtype": "bfloat16",                # 数据类型
}

# 性能优化配置 - 基于性能测试结果调整
PERFORMANCE_CONFIG = {
    # 并发控制
    "max_concurrency": 2,               # 最大并发数（根据测试结果：2并发时性能最佳）
    "recommended_batch_size": 1,        # 批处理大小（当前不支持批处理）
    
    # 超时配置（基于平均响应时间调整）
    "timeout_short": 15,                # 短文本超时（短文本平均7.23s，留有余量）
    "timeout_medium": 60,               # 中文本超时（中文本平均33.43s）
    "timeout_long": 180,                # 长文本超时（长文本超过120s）
    
    # 缓存配置
    "enable_caching": False,            # 是否启用缓存
    "cache_size": 100,                  # 缓存大小
    "cache_ttl": 3600,                  # 缓存过期时间（秒）
    
    # 资源限制
    "max_text_length": 5000,            # 最大文本长度
    "max_gpu_memory_percent": 90,       # GPU显存使用上限
    
    # 性能指标（基于测试结果）
    "expected_latency_short": 7.0,      # 短文本预期响应时间
    "expected_latency_medium": 35.0,    # 中文本预期响应时间
    "expected_latency_long": 120.0,     # 长文本预期响应时间
    "expected_rps": 0.12,               # 预期RPS（单用户）
}
