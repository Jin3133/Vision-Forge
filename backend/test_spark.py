import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# 1. 定位并加载项目根目录的 .env 文件
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
load_dotenv(dotenv_path=root_dir / ".env")

# 2. 初始化客户端 (利用 OpenAI 的 SDK 调用星火，实现无缝兼容)
# SDK 会自动从环境变量中读取 OPENAI_API_KEY 和 OPENAI_API_BASE
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_API_BASE")
)


def test_chat():
    print("🚀 正在通过 OpenAI 兼容接口连接讯飞星火大模型...")

    try:
        # 获取模型版本，如果没有配置默认使用 general
        model_version = os.getenv("SPARK_MODEL_VERSION", "general")

        response = client.chat.completions.create(
            model=model_version,
            messages=[
                {"role": "system", "content": "你是一个专业的视觉大模型算法助教。"},
                {"role": "user", "content": "请用一句话简明扼要地解释什么是 SAM (Segment Anything Model)？"}
            ],
            temperature=0.7,
            max_tokens=200
        )
        print("\n✅ 连接成功！星火大模型的回复：\n")
        print(response.choices[0].message.content)
        print("\n" + "=" * 50)

    except Exception as e:
        print("\n❌ 连接失败！请检查以下几项：")
        print("1. .env 文件中的 API_KEY 是否完整（包含冒号）")
        print("2. 服务器是否能正常访问外网")
        print(f"具体错误信息：\n{e}")


if __name__ == "__main__":
    test_chat()