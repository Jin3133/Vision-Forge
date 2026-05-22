# 📜 Vision-Forge数据交互契约 (API Schema Contract)

- **修订说明**: 本文件为前后端数据交互的唯一标准。

---

## 1. 全局定义：算子节点白名单字典 (Node Type Dictionary)

前端画布允许存在的节点类型（`type`）及其具体名称（`name`），必须严格限制在以下枚举白名单中。这决定了后端教研智能体去哪里读取源码，以及评估智能体去哪里匹配消融实验数据。
> 难度分级：★ 入门必学 | ★★ 进阶应用 | ★★★ 高阶拓展

---

## 1.1 BACKBONE视觉主干
| 大类(type) | 算子名称(name) | 描述说明                      | 必填参数(data 字段) |
| :--- | :--- |:--------------------------| :--- |
| BACKBONE | SAM_ViT_H | ★★★ SAM强力版(Huge)视觉主干      | img_size (int), freeze (bool) |
| BACKBONE | SAM_ViT_B | ★★ SAM基础版(Base)视觉主干       | img_size (int), freeze (bool) |
| BACKBONE | MobileSAM | ★★ 移动端优化版轻量级SAM底座         | weight_path (str) |
| BACKBONE | FastSAM | ★★ 高速轻量化SAM底座             | input_resolution (int) |
| BACKBONE | DINO_v2 | ★★★ 自监督视觉特征提取基座           | patch_size (int) |
| BACKBONE | Swin_Transformer | ★★ 移动窗口式视觉骨干网络            | window_size (int) |
| BACKBONE | ViT_Base | ★ 基础版视觉Transformer | img_size (int), patch_size (int) |
| BACKBONE | ResNet50 | ★ CNN经典残差网络        | freeze (bool), out_indices (list) |
| BACKBONE | EfficientNetV2 | ★★ 轻量高效视觉主干       | model_size (str: s/m/l) |

---

## 1.2 ADAPTER参数高效微调模块
| 大类(type) | 算子名称(name) | 描述说明 | 必填参数(data 字段) |
| :--- | :--- | :--- | :--- |
| ADAPTER | LoRA_Sampler | ★★ 低秩自适应微调模块 | rank (int), alpha (int) |
| ADAPTER | Conv_Adapter | ★★ 卷积形式参数高效微调层 | down_sample_rate (int) |
| ADAPTER | IA3 | ★★ 极致轻量化激活值缩放微调 | scaling_init (float) |
| ADAPTER | AdapterFormer | ★★★ Transformer专用注意力适配器 | hidden_dim (int) |
| ADAPTER | BitFit | ★ 仅偏置微调 | bias_lr (float) |

---

## 1.3 NECK特征融合颈部
| 大类(type) | 算子名称(name) | 描述说明 | 必填参数(data 字段) |
| :--- | :--- | :--- | :--- |
| NECK | Feature_Pyramid | ★ 经典FPN特征金字塔网络 | out_channels (int) |
| NECK | BiFPN | ★★ 加权双向特征金字塔 | levels (int), out_channels (int) |
| NECK | ASPP | ★★ 空洞空间金字塔池化 | atrous_rates (list), out_channels (int) |
| NECK | PPM | ★★ 金字塔池化模块 | pool_sizes (list), out_channels (int) |
| NECK | PAN | ★★ 路径聚合网络| in_channels (list), out_channels (int) |

---

## 1.4 HEAD任务输出头
| 大类(type) | 算子名称(name) | 描述说明 | 必填参数(data 字段) |
| :--- | :--- | :--- | :--- |
| HEAD | Classification_Head | ★图像分类头 | num_classes (int), in_channels (int) |
| HEAD | Instance_Segmentor | ★★ 实例分割任务专用预测头 | num_classes (int) |
| HEAD | Semantic_Segmentor | ★★ 语义分割头（遥感/医学影像专用） | num_classes (int) |
| HEAD | YOLO_Detect_Head | ★★ 工业界主流目标检测头 | num_classes (int), confidence_threshold (float) |
| HEAD | BBox_Predictor | ★ 边界框预测基础头 | confidence_threshold (float) |
| HEAD | Anomaly_Detector | ★★ 工业缺陷/异常检测专用头 | threshold (float) |
| HEAD | Keypoint_Detector | ★★ 关键点检测头（农业/医学专用） | num_keypoints (int) |
| HEAD | Mask_Decoder | ★★ SAM系列掩码解码器 | num_classes (int) |

---

## 1.5 PROCESSING 预处理/后处理算子

| 大类(type) | 算子名称(name) | 描述说明     | 必填参数(data 字段) |
| :--- | :--- |:---------| :--- |
| PROCESSING | Resize | 图像尺寸缩放   | target_size (int), keep_ratio (bool) |
| PROCESSING | Normalize | 图像归一化    | mean (list), std (list) |
| PROCESSING | Random_Flip | 图像翻转数据增强 | flip_mode (str: horizontal/vertical) |
| PROCESSING | NMS | 非极大值抑制   | iou_threshold (float) |

> ⚠️ **前端开发注意**：请使用上述 `type` 和 `name` 属性配置 React Flow / Vue Flow 的 Custom Nodes。

---

## 2. 统一响应规范
### 2.1 成功响应基础格式
```json
{
  "status": "success",
  "data": {}  // 业务数据，各接口自定义
}
```

### 2.2 失败响应基础格式
```json
{
  "status": "error",
  "error_code": "INVALID_NODE_TYPE",  // 错误码
  "message": "节点类型不在白名单内",  // 前端可直接展示的报错信息
  "details": {}  // 额外调试信息
}
```

## 3. 核心接口1：沙盒配置评估 (Sandbox Evaluation)

**应用场景**：用户在前端沙盒完成连线，点击“提交配置”按钮。前端将画布状态发送至后端，触发评估智能体（Evaluator Agent）。

- **请求路径**: `POST /api/v1/agent/evaluate`
- **请求头**: `Content-Type: application/json`

### 3.1 请求体格式 (Request Body)（必填字段标★）
前端可直接通过连线库的 `toObject()` 方法导出 `nodes` 和 `edges`。
```json
{
  "session_id": "session_uuid_12345", // ★ 会话唯一ID
  "user_intent": "农业病斑特征提取", // ★ 用户输入的需求文本
  "sandbox_config": {
    "nodes": [
      {
        "id": "node_1", // ★ 节点唯一ID
        "type": "BACKBONE", // ★ 大类
        "name": "SAM_ViT_B", // ★ 算子名
        "data": { "freeze_weights": true } // 对应算子的必填参数
      }
    ],
    "edges": [
      {
        "source": "node_1", // ★ 源节点ID
        "target": "node_2" // ★ 目标节点ID
      }
    ]
  }
}
```

### 3.2 响应体 data 字段
```json
{
  "is_valid": true, // 配置是否合法
  "estimated_metrics": {
    "metric_name": " ", 
    "baseline_value": " ", 
    "optimized_value": " "
  },
  "feedback": {
    "strengths": [" "],
    "warnings": [" "],
    "learning_suggestions": [" "]
  },
  "matched_experiment_file": "assets/experiment_results/agri_sam_ablation_2023.json"
}
```


## 4. 核心接口：算子源码教研解析 (Code Tutoring)

**应用场景**：用户在画布上点击了某个算子节点（如 MAFE_Module）的“查看底层原理”按钮。前端向后端请求真实工程源码，触发教研智能体（Tutor Agent）。

- **请求路径**: `POST /api/v1/agent/tutor/code`
- **请求头**：Content-Type: application/json

### 3.1 请求体格式 (Request Body)（必填字段标★）
前端可直接通过连线库的 `toObject()` 方法导出 `nodes` 和 `edges`。
```json
{
  "session_id": "session_uuid_12345", // ★ 会话唯一ID
  "target_node": "MAFE_Module" // ★ 目标算子name，必须在白名单内
}
```
### 3.2 响应体data字段
```json
{
  "node_name": "xx_Module",
  "language": "python",
  "raw_code_snippet": " ",
  "tutor_explanation": " "
}
```