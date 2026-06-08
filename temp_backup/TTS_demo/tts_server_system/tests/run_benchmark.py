"""
基准测试脚本
"""
import requests
import time
import json
import os
from datetime import datetime

BASE_URL = 'http://127.0.0.1:8080'

# 测试文本
test_texts = {
    'short': ['你好，我是AI助手。', '今天天气不错。', '请帮我查一下资料。'],
    'medium': ['人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。'],
    'long': ['Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。它由Guido van Rossum于1989年底发明，第一个公开发行版发行于1991年。Python源代码遵循GPL协议。']
}

results = {}

# 短文本测试
print('[基准测试] 短文本测试 (10次)...')
short_times = []
for i in range(10):
    text = test_texts['short'][i % len(test_texts['short'])]
    start = time.time()
    resp = requests.post(f'{BASE_URL}/tts', json={'text': text, 'output_format': 'base64'}, timeout=120)
    elapsed = time.time() - start
    if resp.status_code == 200:
        short_times.append(elapsed)
        print(f'  请求{i+1}: {elapsed:.2f}s')
    else:
        print(f'  请求{i+1}: 失败')

if short_times:
    results['short'] = {
        'avg': sum(short_times)/len(short_times),
        'min': min(short_times),
        'max': max(short_times)
    }
    print(f"[短文本] 平均: {results['short']['avg']:.2f}s, 最小: {results['short']['min']:.2f}s, 最大: {results['short']['max']:.2f}s")

# 中文本测试
print('\n[基准测试] 中文本测试 (5次)...')
medium_times = []
for i in range(5):
    text = test_texts['medium'][i % len(test_texts['medium'])]
    start = time.time()
    resp = requests.post(f'{BASE_URL}/tts', json={'text': text, 'output_format': 'base64'}, timeout=180)
    elapsed = time.time() - start
    if resp.status_code == 200:
        medium_times.append(elapsed)
        print(f'  请求{i+1}: {elapsed:.2f}s')
    else:
        print(f'  请求{i+1}: 失败')

if medium_times:
    results['medium'] = {
        'avg': sum(medium_times)/len(medium_times),
        'min': min(medium_times),
        'max': max(medium_times)
    }
    print(f"[中文本] 平均: {results['medium']['avg']:.2f}s, 最小: {results['medium']['min']:.2f}s, 最大: {results['medium']['max']:.2f}s")

# 长文本测试
print('\n[基准测试] 长文本测试 (3次)...')
long_times = []
for i in range(3):
    text = test_texts['long'][i % len(test_texts['long'])]
    start = time.time()
    resp = requests.post(f'{BASE_URL}/tts', json={'text': text, 'output_format': 'base64'}, timeout=300)
    elapsed = time.time() - start
    if resp.status_code == 200:
        long_times.append(elapsed)
        print(f'  请求{i+1}: {elapsed:.2f}s')
    else:
        print(f'  请求{i+1}: 失败')

if long_times:
    results['long'] = {
        'avg': sum(long_times)/len(long_times),
        'min': min(long_times),
        'max': max(long_times)
    }
    print(f"[长文本] 平均: {results['long']['avg']:.2f}s, 最小: {results['long']['min']:.2f}s, 最大: {results['long']['max']:.2f}s")

# 保存结果
os.makedirs('results', exist_ok=True)
with open(f"results/benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", 'w') as f:
    json.dump(results, f, indent=2)

print('\n[基准测试] 完成！')
