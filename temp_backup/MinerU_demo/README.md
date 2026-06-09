# 多模态文档解析器

将多种文件类型（PDF、PPT、Word、图片、文本等）转换为字符串结果的解析库。优先使用 MinerU Agent 轻量提取 API 作为主解析通道，对不支持的文件类型提供本地回退解析器。

## 快速使用

```bash
# 安装依赖
pip install -r requirements.txt

# 解析文件（自动选择解析通道）
python demo.py 文件路径

# 示例
python demo.py test_files/2406010330_许赵泓.docx
python demo.py test_files/2025-TDAG_*.pdf --language en --timeout 180

# 查看详细输出
python demo.py 文件路径 --verbose
```

## 主函数

```python
from mineru_demo import parse_document

content = parse_document(
    file_path,           # 待解析的文件路径
    language="ch",       # 文档语言
    enable_table=True,   # 启用表格识别
    enable_formula=True, # 启用公式识别
    is_ocr=False,        # 启用 OCR
    page_range=None,     # 页码范围，如 "1-5"
    timeout=120,         # MinerU API 轮询超时（秒）
    poll_interval=3,     # 轮询间隔（秒）
)
```

**返回值**：`str` — 解析后的 Markdown 内容字符串

## 支持的文件类型与通道优先级

### MinerU API 主通道（需要网络）

| 类别 | 扩展名 |
|---|---|
| PDF | `.pdf` |
| Word | `.doc`, `.docx` |
| PowerPoint | `.ppt`, `.pptx` |
| 图片 | `.png`, `.jpg`, `.jpeg`, `.jp2`, `.webp`, `.gif`, `.bmp` |

### 回退通道（本地解析，无需网络）

| 类别 | 扩展名 | 依赖 |
|---|---|---|
| 文本 | `.txt`, `.md`, `.log`, `.py`, `.js`, `.json`, `.xml`, `.html`, `.css`, `.yaml`, `.yml`, `.ini`, `.cfg`, `.conf`, `.sh`, `.bat`, `.sql`, `.r`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.ts`, `.tsx`, `.jsx`, `.vue`, `.svelte` | 无 |
| CSV | `.csv`, `.tsv` | 无 |
| Word（回退） | `.docx` | python-docx |
| PowerPoint（回退） | `.pptx` | python-pptx |
| 图片（回退） | `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp` | Pillow（返回元数据） |
| Excel | `.xlsx`, `.xls` | openpyxl |

### 降级逻辑

1. MinerU 支持的文件类型 → 优先尝试 MinerU API
2. MinerU API 失败（限流、超时、错误）→ 回退到本地解析器（如有）
3. 无可用回退解析器 → 抛出对应异常

## 函数参数

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `file_path` | str | （必填） | 待解析的文件路径 |
| `language` | str | `"ch"` | 文档语言，传递给 MinerU API |
| `enable_table` | bool | `True` | 启用表格识别 |
| `enable_formula` | bool | `True` | 启用公式识别 |
| `is_ocr` | bool | `False` | 启用 OCR |
| `page_range` | str | `None` | 页码范围，如 `"1-5"`（仅 URL 模式） |
| `timeout` | int | `120` | MinerU API 轮询超时时间（秒） |
| `poll_interval` | int | `3` | 轮询间隔（秒） |

## 返回值

返回 `str` 类型的解析内容。MinerU API 结果为 **Markdown 格式**（含表格、标题、列表等丰富结构）；回退解析器的输出格式因文件类型而异。

## 异常

| 异常 | 触发条件 |
|---|---|
| `FileNotFoundError` | 文件不存在 |
| `UnsupportedFileTypeError` | 文件类型无任何解析器支持 |
| `ParseTimeoutError` | MinerU API 超时且无回退解析器可用 |
| `MinerUApiError` | MinerU API 出错且无回退解析器可用 |
| `MinerURateLimitError` | MinerU API 限流且无回退解析器可用 |

## MinerU API 说明

- **无需认证**（基于 IP 限流）
- **调用流程**（实测，与官方文档不同）：
  1. `POST` JSON body 到 `/api/v1/agent/parse/file` → 获取 `task_id` + OSS 预签名上传地址
  2. `PUT` 文件二进制到 OSS 地址
  3. `GET /api/v1/agent/parse/{task_id}` 轮询 → 状态变化: `pending` → `running` → `done`
  4. 从响应 `markdown_url` 字段获取 Markdown CDN 链接，下载内容
- **文件大小限制**：≤ 10MB
- **页数限制**：≤ 20 页
- **输出格式**：Markdown

## 注意事项

### 1. 特殊字符问题

MinerU API 在解析 PDF 时，可能将 PDF 中使用的数学符号、特殊字体字符（如 LaTeX 数学符号、Unicode 数学字母）映射为 `?`。这是 OCR 精度限制，属于正常现象。例如：

```
Task ?? ← MainAgent.Decompose(?? )
```

其中 `??` 原本应为数学变量符号（如 `T`、`ts` 等）。

如需更精确的数学符号提取，建议使用专业的 PDF 解析器（如 Nougat、Grobid 等）对 MinerU 输出进行后处理。

### 2. 网络要求

MinerU API 需要网络访问，且存在 IP 限流机制。

### 3. 备用方案

`fallback_parsers.py` 提供的回退解析器仅提供基础文本提取，结果不如 MinerU API 丰富（例如图片回退只返回元数据，不进行 OCR）。

## 使用示例

### 1. 基本解析 PDF

```python
from mineru_demo import parse_document

content = parse_document("example.pdf")
print(content)
```

### 2. 指定语言解析 PPT

```python
content = parse_document("slides.pptx", language="en")
print(content)
```

### 3. 解析 TXT 文件

```python
content = parse_document("notes.txt")
print(content)
```

### 4. 异常处理

```python
from mineru_demo import parse_document
from mineru_demo.exceptions import (
    FileNotFoundError,
    UnsupportedFileTypeError,
    ParseTimeoutError,
    MinerUApiError,
    MinerURateLimitError,
)

try:
    content = parse_document("document.pdf", timeout=60)
except FileNotFoundError:
    print("文件不存在")
except UnsupportedFileTypeError:
    print("不支持的文件类型")
except ParseTimeoutError:
    print("解析超时")
except MinerURateLimitError:
    print("API 限流，请稍后重试")
except MinerUApiError as e:
    print(f"API 错误: {e}")
```

## 项目结构

```
MinerU_demo/
├── demo.py              # 端到端演示脚本（命令行入口）
├── parser.py            # 多模态解析主函数
├── mineru_api.py        # MinerU Agent 轻量解析 API 封装
├── fallback_parsers.py  # 本地回退解析方案
├── exceptions.py        # 异常类定义
├── requirements.txt     # 依赖列表
├── README.md            # 本文档
├── test_files/          # 测试文件目录
└── output/              # 解析结果输出目录
```

## 依赖

| 包名 | 用途 |
|---|---|
| `requests` | MinerU API 调用 |
| `python-pptx` | PPTX 回退解析 |
| `python-docx` | DOCX 回退解析 |
| `Pillow` | 图片回退解析 |
| `openpyxl` | Excel 解析 |