# 端到端验证总结报告

**Run ID**: 20260609_125915
**执行时间**: 2026-06-09T13:12:15.098760
**总场景数**: 5
**通过**: 5
**失败**: 0

## 验证场景

### test_report_intent_e2e
- **状态**: [PASS]
- **耗时**: 81.7s
- **返回数据 keys**: learner_profile, sandbox_config, parsed_document_content, evaluation_report, tutor_response, final_report_html, animation_html, intent, confidence, dialogue_turn
- **意图分类**: report_generation (confidence=1.0)
- **保存文件**:
  - llm_intermediates: `test_report_intent_e2e_llm_intermediates.json`
  - report: `test_report_intent_e2e_report.html`

---

### test_animation_intent_e2e
- **状态**: [PASS]
- **耗时**: 95.8s
- **返回数据 keys**: learner_profile, sandbox_config, parsed_document_content, evaluation_report, tutor_response, final_report_html, animation_html, intent, confidence, dialogue_turn
- **意图分类**: animation_generation (confidence=1.0)
- **保存文件**:
  - llm_intermediates: `test_animation_intent_e2e_llm_intermediates.json`
  - animation: `test_animation_intent_e2e_animation.html`

---

### test_mixed_intent_e2e
- **状态**: [PASS]
- **耗时**: 190.7s
- **返回数据 keys**: learner_profile, sandbox_config, parsed_document_content, evaluation_report, tutor_response, final_report_html, animation_html, intent, confidence, dialogue_turn
- **意图分类**: mixed_generation (confidence=0.95)
- **保存文件**:
  - llm_intermediates: `test_mixed_intent_e2e_llm_intermediates.json`
  - animation: `test_mixed_intent_e2e_animation.html`
  - report: `test_mixed_intent_e2e_report.html`

---

### test_multi_turn_dialogue_e2e
- **状态**: [PASS]
- **耗时**: 142.8s
- **第一轮意图**: report_generation
- **第二轮意图**: animation_generation
- **dialogue_turn**: 2
- **保存文件**:
  - turn1_llm: `multi_turn_turn1_llm_intermediates.json`
  - turn1_report: `multi_turn_turn1_report.html`
  - turn2_llm: `multi_turn_turn2_llm_intermediates.json`
  - turn2_animation: `multi_turn_turn2_animation.html`

---

### test_topic_switch_e2e
- **状态**: [PASS]
- **耗时**: 268.9s
- **第一轮意图**: mixed_generation
- **第二轮意图**: animation_generation
- **dialogue_turn**: 2
- **保存文件**:
  - turn1_llm: `topic_switch_turn1_llm_intermediates.json`
  - turn1_report: `topic_switch_turn1_report.html`
  - turn1_animation: `topic_switch_turn1_animation.html`
  - turn2_llm: `topic_switch_turn2_llm_intermediates.json`
  - turn2_animation: `topic_switch_turn2_animation.html`

---

## 文件输出结构

```
output/run_20260609_125915/
  llm_intermediates/    # LLM 中间结果（意图、tutor、evaluator）
    {scenario}_llm_intermediates.json
  animations/           # 生成的动画 HTML
    {scenario}_animation.html
  reports/              # 生成的报告 HTML
    {scenario}_report.html
  SUMMARY.md            # 本文档
  e2e_validation_report.json  # 完整 JSON 报告
```
