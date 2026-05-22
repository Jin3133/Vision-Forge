import logging
import sys
import os
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import time

def setup_logger():
    # 创建日志目录
    if not os.path.exists("logs"):
        os.makedirs("logs")

    logger = logging.getLogger("VisionForge")
    logger.setLevel(logging.INFO)
    logger.propagate = False  # 避免重复输出

    # 格式：时间-级别-消息
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 按启动时间生成新日志文件
    start_time = time.strftime("%Y%m%d_%H%M%S")
    startup_file_handler = logging.FileHandler(
        f"logs/workflow_{start_time}.log",
        encoding="utf-8"
    )
    startup_file_handler.setFormatter(formatter)
    logger.addHandler(startup_file_handler)

    # 按大小+时间滚动（避免单文件过大）
    rotating_handler = RotatingFileHandler(
        "logs/workflow_rolling.log",
        maxBytes=50 * 1024 * 1024,  # 单个文件最大50MB
        backupCount=10,  # 保留最近10个滚动文件
        encoding="utf-8"
    )
    rotating_handler.setFormatter(formatter)
    logger.addHandler(rotating_handler)

    return logger

# 全局单例
logger = setup_logger()