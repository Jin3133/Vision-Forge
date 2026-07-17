"""
EfficientNetV2.py — EfficientNetV2 轻量级视觉骨干

论文: "EfficientNetV2: Smaller Models and Faster Training" (Tan & Le, ICML 2021)
核心创新:
  1. 复合缩放 (Compound Scaling): 同时调整网络宽度、深度和分辨率
  2. Fused-MBConv: 早期层用标准 3x3 卷积替代深度可分离卷积，训练加速 2-3x
  3. MBConv + SE + 随机深度: 后期层保留深度可分离卷积以控制参数总量

架构流程: Stem(3x3,stride=2,24ch) -> Fused-MBConv x10 -> MBConv x30 -> Head(1280ch+FC)
关键洞察: 深度可分离卷积在早期高分辨率层 GPU 利用率极低，Fused-MBConv 融合
expand+depthwise 为单次标准卷积; 随机深度线性递增(浅层 0 -> 深层 0.3)防止梯度消失。
"""

import torch
import torch.nn as nn


class SEBlock(nn.Module):
    """Squeeze-and-Excitation 通道注意力: 全局池化 -> FC降维 -> SiLU -> FC升维 -> Sigmoid"""
    def __init__(self, in_channels, reduction=4):
        super().__init__()
        mid = in_channels // reduction
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), nn.Flatten(),
            nn.Linear(in_channels, mid, bias=False), nn.SiLU(),
            nn.Linear(mid, in_channels, bias=False), nn.Sigmoid()
        )

    def forward(self, x):
        B, C, _, _ = x.shape
        return x * self.fc(x).view(B, C, 1, 1)


class StochasticDepth(nn.Module):
    """训练时以概率 drop_prob 丢弃整个残差分支, 推理时恒等; 除以 keep_prob 保持期望"""
    def __init__(self, drop_prob):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x):
        if not self.training or self.drop_prob == 0.0:
            return x
        keep = 1.0 - self.drop_prob
        shape = tuple([x.shape[0]] + [1] * (x.ndim - 1))
        m = torch.bernoulli(torch.full(shape, keep, device=x.device))
        return (x * m) / keep


class MBConv(nn.Module):
    """
    MBConv: 移动倒置瓶颈卷积 (Mobile Inverted Bottleneck)
    数据流: 1x1 expand -> depthwise 3x3 -> SE -> 1x1 project + 残差 + 随机深度
    倒残差: 中间通道 = 输入 x expand_ratio; 深度可分离卷积极大节省参数
    """
    def __init__(self, inp, outp, kernel_size, stride,
                 expand_ratio, se_ratio=0.25, sd_prob=0.0):
        super().__init__()
        self.use_res = (stride == 1 and inp == outp)
        mid = inp * expand_ratio
        layers = []
        if expand_ratio != 1:
            layers += [nn.Conv2d(inp, mid, 1, bias=False),
                        nn.BatchNorm2d(mid), nn.SiLU()]
        layers += [nn.Conv2d(mid, mid, kernel_size, stride,
                              padding=kernel_size // 2, groups=mid, bias=False),
                    nn.BatchNorm2d(mid), nn.SiLU(),
                    SEBlock(mid, reduction=4),
                    nn.Conv2d(mid, outp, 1, bias=False), nn.BatchNorm2d(outp)]
        self.conv = nn.Sequential(*layers)
        self.sd = StochasticDepth(sd_prob) if self.use_res else nn.Identity()

    def forward(self, x):
        out = self.conv(x)
        return self.sd(out) + x if self.use_res else out


class FusedMBConv(nn.Module):
    """
    Fused-MBConv: 融合卷积瓶颈 (早期层专用)
    数据流: 标准 3x3 conv(替代 expand+depthwise) -> SE -> 1x1 project + 残差 + 随机深度
    早期层 GPU 并行度低, 标准卷积融合两步, 牺牲少量参数换 2-3x 实际加速
    """
    def __init__(self, inp, outp, kernel_size, stride,
                 expand_ratio, se_ratio=0.25, sd_prob=0.0):
        super().__init__()
        self.use_res = (stride == 1 and inp == outp)
        mid = inp * expand_ratio
        layers = [nn.Conv2d(inp, mid, kernel_size, stride,
                             padding=kernel_size // 2, bias=False),
                   nn.BatchNorm2d(mid), nn.SiLU(),
                   SEBlock(mid, reduction=4),
                   nn.Conv2d(mid, outp, 1, bias=False), nn.BatchNorm2d(outp)]
        self.conv = nn.Sequential(*layers)
        self.sd = StochasticDepth(sd_prob) if self.use_res else nn.Identity()

    def forward(self, x):
        out = self.conv(x)
        return self.sd(out) + x if self.use_res else out


class EfficientNetV2(nn.Module):
    """
    EfficientNetV2: 复合缩放 + Fused-MBConv + MBConv
    缩放公式: d=alpha^phi, w=beta^phi, r=gamma^phi (alpha*beta^2*gamma^2≈2)
    默认 model_size='s', 不做预训练权重加载, 专注架构结构
    """
    CONFIGS = {"s": (1.0, 1.0, 0.2), "m": (1.1, 1.2, 0.3), "l": (1.4, 1.8, 0.4)}

    def __init__(self, model_size="s", num_classes=1000, in_channels=3):
        super().__init__()
        w, d, drop = self.CONFIGS.get(model_size, self.CONFIGS["s"])

        # 基础阶段: [type, blocks, out_c, stride, expand, kernel, se_ratio]
        base = [
            ("fused", 2,  24,  1, 1, 3, 0.25),
            ("fused", 4,  48,  2, 4, 3, 0.25),
            ("fused", 4,  64,  2, 4, 3, 0.25),
            ("mbconv", 6,  128, 2, 4, 3, 0.25),
            ("mbconv", 9,  160, 1, 6, 3, 0.25),
            ("mbconv", 15, 256, 2, 6, 3, 0.25),
        ]

        sc = self._round(24, w)
        self.stem = nn.Sequential(
            nn.Conv2d(in_channels, sc, 3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(sc), nn.SiLU()
        )

        total = sum(max(1, round(n * d)) for _, n, *_ in base)
        inp, idx, blocks = sc, 0, []
        for t, n, c, s, e, k, se in base:
            c, n = self._round(c, w), max(1, round(n * d))
            B = FusedMBConv if t == "fused" else MBConv
            for i in range(n):
                blocks.append(B(inp, c, k, s if i == 0 else 1, e, se,
                                (idx / total) * 0.3))
                inp, idx = c, idx + 1
        self.blocks = nn.Sequential(*blocks)

        hc = self._round(1280, w)
        self.head = nn.Sequential(
            nn.Conv2d(inp, hc, 1, bias=False), nn.BatchNorm2d(hc), nn.SiLU(),
            nn.AdaptiveAvgPool2d(1), nn.Flatten(),
            nn.Dropout(drop), nn.Linear(hc, num_classes)
        )
        self._init_weights()

    @staticmethod
    def _round(ch, mult, divisor=8):
        ch = int(ch * mult)
        return max(divisor, ch // divisor * divisor)

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def forward(self, x):
        return self.head(self.blocks(self.stem(x)))


if __name__ == "__main__":
    for size in ["s", "m", "l"]:
        model = EfficientNetV2(model_size=size, num_classes=1000)
        x = torch.randn(1, 3, 224, 224)
        y = model(x)
        params = sum(p.numel() for p in model.parameters()) / 1e6
        print(f"EfficientNetV2-{size.upper()}: "
              f"输入 {tuple(x.shape)} -> 输出 {tuple(y.shape)}, "
              f"参数量 {params:.1f}M")
