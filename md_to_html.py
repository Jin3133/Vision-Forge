# -*- coding: utf-8 -*-
import markdown
import re
import sys

# 读取 md 文件
with open(r"E:\Obsidian\KnowledgeBase\其它\raw\软件杯.md", "r", encoding="utf-8") as f:
    md_content = f.read()

# 移除 Obsidian 图片引用（本地路径无法在浏览器显示）
md_content = re.sub(r'!\[.*?\]\(E:\\Obsidian\\.*?\)', '', md_content)

# Markdown 转 HTML
html_body = markdown.markdown(
    md_content,
    extensions=['tables', 'fenced_code', 'codehilite']
)

# 完整 HTML 模板
html_template = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vision-Forge 架构设计</title>
<style>
  body {{
    font-family: "Microsoft YaHei", "SimSun", sans-serif;
    line-height: 1.8;
    max-width: 900px;
    margin: 40px auto;
    padding: 20px;
    color: #333;
  }}
  h1 {{
    border-bottom: 3px solid #2c3e50;
    padding-bottom: 10px;
    color: #2c3e50;
  }}
  h2 {{
    border-left: 4px solid #3498db;
    padding-left: 10px;
    color: #2980b9;
    margin-top: 30px;
  }}
  h3 {{
    color: #27ae60;
    margin-top: 20px;
  }}
  pre {{
    background: #f6f8fa;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    border: 1px solid #e1e4e8;
  }}
  code {{
    background: #f6f8fa;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: "Consolas", monospace;
  }}
  pre code {{
    background: transparent;
    padding: 0;
  }}
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
  }}
  th, td {{
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: left;
  }}
  th {{
    background: #f8f9fa;
    font-weight: bold;
  }}
  blockquote {{
    border-left: 4px solid #e74c3c;
    margin: 15px 0;
    padding: 10px 15px;
    background: #fdf2f2;
  }}
  ul, ol {{
    padding-left: 25px;
  }}
  li {{
    margin: 5px 0;
  }}
  hr {{
    border: none;
    border-top: 1px solid #ddd;
    margin: 30px 0;
  }}
  strong {{
    color: #c0392b;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

# 写入 HTML 文件
output_path = r"E:\Obsidian\KnowledgeBase\其它\raw\软件杯_converted.html"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"SUCCESS: {output_path}")
