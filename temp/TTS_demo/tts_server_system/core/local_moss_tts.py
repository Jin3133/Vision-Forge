"""
本地 MOSS-TTS 封装模块
提供热启动和音频生成功能
"""

import os
import sys
import time
from pathlib import Path

import torch
import numpy as np
import soundfile as sf

# 添加 moss_tts_realtime 到路径
MOSS_TTS_PATH = Path(__file__).parent.parent.parent / "MOSS-TTS" / "moss_tts_realtime"
sys.path.insert(0, str(MOSS_TTS_PATH))

from transformers import AutoTokenizer, AutoModel
from mossttsrealtime.modeling_mossttsrealtime import MossTTSRealtime
from inferencer import MossTTSRealtimeInference

from tts_config import (
    MODEL_PATH, CODEC_PATH, REFERENCE_AUDIO,
    GENERATION_CONFIG, WARM_START_CONFIG, SAMPLE_RATE
)

# 导入量化配置
try:
    from quantization_config import (
        QUANTIZATION_CONFIG, 
        get_quantization_config, 
        apply_quantization,
        get_comparison_audio_path
    )
    QUANTIZATION_AVAILABLE = True
except ImportError:
    QUANTIZATION_AVAILABLE = False
    print("[警告] 量化配置模块未找到，量化功能不可用")


class MossTTSManager:
    """MOSS-TTS 管理器 - 单例模式"""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.model = None
        self.tokenizer = None
        self.codec = None
        self.inferencer = None
        self.device = WARM_START_CONFIG.get("device", "cuda")
        self.dtype = torch.bfloat16 if self.device == "cuda" else torch.float32
        self.is_loaded = False
        self.reference_audio = REFERENCE_AUDIO
        
        # 量化相关属性
        self.quantization_enabled = False
        self.quantization_method = None
        self.original_model = None  # 保存原始模型用于对比
        
        self._initialized = True
    
    def warm_start(self, quantization_method=None):
        """
        热启动：预加载所有模型
        
        Args:
            quantization_method: 量化方法 (None, "fp16", "bf16", "int8")
        """
        if self.is_loaded:
            print("[MossTTS] 模型已加载，跳过热启动")
            return True
        
        print("[MossTTS] 开始热启动...")
        if quantization_method:
            print(f"[MossTTS] 使用量化方法: {quantization_method}")
        
        start_time = time.time()
        
        try:
            # 加载 TTS 模型
            print(f"[MossTTS] 加载 TTS 模型: {MODEL_PATH}")
            self.model = MossTTSRealtime.from_pretrained(
                MODEL_PATH,
                attn_implementation="sdpa",
                torch_dtype=self.dtype,
            ).to(self.device)
            self.model.eval()
            
            # 应用量化（如果指定）
            if quantization_method and QUANTIZATION_AVAILABLE:
                self._apply_quantization(quantization_method)
            
            # 加载 Tokenizer
            print(f"[MossTTS] 加载 Tokenizer")
            self.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            
            # 加载 Codec 模型
            print(f"[MossTTS] 加载 Codec 模型: {CODEC_PATH}")
            self.codec = AutoModel.from_pretrained(
                CODEC_PATH, trust_remote_code=True
            ).eval().to(self.device)
            
            # 创建推理器
            self.inferencer = MossTTSRealtimeInference(
                self.model,
                self.tokenizer,
                max_length=GENERATION_CONFIG["max_length"],
                codec=self.codec,
                codec_sample_rate=SAMPLE_RATE,
                codec_encode_kwargs={"chunk_duration": 4},
            )
            
            self.is_loaded = True
            load_time = time.time() - start_time
            print(f"[MossTTS] 热启动完成！耗时: {load_time:.2f}s")
            return True
            
        except Exception as e:
            print(f"[MossTTS] 热启动失败: {e}")
            return False
    
    def _apply_quantization(self, method):
        """应用量化"""
        if not QUANTIZATION_AVAILABLE:
            print("[警告] 量化不可用，跳过量化")
            return
        
        try:
            print(f"[MossTTS] 应用 {method} 量化...")
            config = get_quantization_config(method)
            
            # 保存原始模型（用于对比）
            if QUANTIZATION_CONFIG.get("save_comparison_audio", False):
                self.original_model = self.model
            
            # 应用量化
            self.model = apply_quantization(self.model, method)
            self.quantization_enabled = True
            self.quantization_method = method
            
            print(f"[MossTTS] 量化完成: {config['description']}")
            print(f"[MossTTS] 预期加速: {config['expected_speedup']}x")
            
        except Exception as e:
            print(f"[MossTTS] 量化失败: {e}")
            self.quantization_enabled = False
    
    def unload_model(self):
        """卸载模型，释放资源"""
        if not self.is_loaded:
            return
        
        print("[MossTTS] 卸载模型...")
        
        # 释放模型
        self.model = None
        self.tokenizer = None
        self.codec = None
        self.inferencer = None
        self.original_model = None
        
        # 清空 CUDA 缓存
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            print("[MossTTS] CUDA 缓存已清空")
        
        self.is_loaded = False
        self.quantization_enabled = False
        self.quantization_method = None
        
        print("[MossTTS] 模型已卸载")
    
    def generate(self, text, output_path, save_comparison=False, text_type="short"):
        """
        生成音频
        
        Args:
            text: 要转换的文本
            output_path: 输出音频文件路径
            save_comparison: 是否保存对比音频（用于量化测试）
            text_type: 文本类型（short, medium, long）
            
        Returns:
            bool: 是否成功
        """
        if not self.is_loaded:
            print("[MossTTS] 模型未加载，自动执行热启动...")
            if not self.warm_start():
                return False
        
        try:
            # 调用模型生成
            result = self.inferencer.generate(
                text=[text],
                reference_audio_path=[self.reference_audio],
                temperature=GENERATION_CONFIG["temperature"],
                top_p=GENERATION_CONFIG["top_p"],
                top_k=GENERATION_CONFIG["top_k"],
                repetition_penalty=GENERATION_CONFIG["repetition_penalty"],
                repetition_window=GENERATION_CONFIG["repetition_window"],
                device=self.device,
            )
            
            # 解码并保存
            generated_tokens = result[0]
            output_tensor = torch.tensor(generated_tokens).to(self.device)
            decode_result = self.codec.decode(
                output_tensor.permute(1, 0), 
                chunk_duration=4
            )
            wav = decode_result["audio"][0].cpu().detach()
            
            if wav.ndim == 1:
                wav = wav.unsqueeze(0)
            
            # 音频后处理 - 归一化
            wav_np = wav.squeeze().numpy()
            max_val = np.max(np.abs(wav_np))
            if max_val > 0:
                wav_np = wav_np / max_val * 0.95
            
            # 保存音频
            sf.write(output_path, wav_np, SAMPLE_RATE, subtype='PCM_16')
            
            # 保存对比音频（用于量化测试）
            if save_comparison and QUANTIZATION_AVAILABLE and QUANTIZATION_CONFIG.get("save_comparison_audio", False):
                self._save_comparison_audio(text, text_type, wav_np)
            
            return True
            
        except Exception as e:
            print(f"[MossTTS] 生成失败: {e}")
            return False
    
    def _save_comparison_audio(self, text, text_type, wav_np):
        """保存对比音频"""
        try:
            if self.quantization_enabled and self.quantization_method:
                # 保存量化后的音频
                quantized_path = get_comparison_audio_path(
                    text_type, self.quantization_method, is_original=False
                )
                sf.write(quantized_path, wav_np, SAMPLE_RATE, subtype='PCM_16')
                print(f"[MossTTS] 量化音频已保存: {quantized_path}")
                
                # 如果有原始模型，也生成原始音频进行对比
                if self.original_model is not None:
                    print("[MossTTS] 生成原始模型音频用于对比...")
                    # 临时切换回原始模型
                    temp_model = self.model
                    self.model = self.original_model
                    
                    result = self.inferencer.generate(
                        text=[text],
                        reference_audio_path=[self.reference_audio],
                        temperature=GENERATION_CONFIG["temperature"],
                        top_p=GENERATION_CONFIG["top_p"],
                        top_k=GENERATION_CONFIG["top_k"],
                        repetition_penalty=GENERATION_CONFIG["repetition_penalty"],
                        repetition_window=GENERATION_CONFIG["repetition_window"],
                        device=self.device,
                    )
                    
                    generated_tokens = result[0]
                    output_tensor = torch.tensor(generated_tokens).to(self.device)
                    decode_result = self.codec.decode(
                        output_tensor.permute(1, 0), 
                        chunk_duration=4
                    )
                    wav_orig = decode_result["audio"][0].cpu().detach()
                    
                    if wav_orig.ndim == 1:
                        wav_orig = wav_orig.unsqueeze(0)
                    
                    wav_orig_np = wav_orig.squeeze().numpy()
                    max_val = np.max(np.abs(wav_orig_np))
                    if max_val > 0:
                        wav_orig_np = wav_orig_np / max_val * 0.95
                    
                    original_path = get_comparison_audio_path(
                        text_type, self.quantization_method, is_original=True
                    )
                    sf.write(original_path, wav_orig_np, SAMPLE_RATE, subtype='PCM_16')
                    print(f"[MossTTS] 原始音频已保存: {original_path}")
                    
                    # 恢复量化模型
                    self.model = temp_model
                    
        except Exception as e:
            print(f"[MossTTS] 保存对比音频失败: {e}")


# 全局实例
moss_tts = MossTTSManager()

# 兼容讯飞TTS的接口
def text_to_speech(text, output_path, voice=None):
    """
    兼容原 text_to_speech 接口
    voice 参数保留但不使用（MOSS-TTS通过参考音频控制音色）
    """
    return moss_tts.generate(text, output_path)
