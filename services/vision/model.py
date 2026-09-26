"""
Neural network architecture definition for ScrapTrace e-waste image classification.
Leverages modern lightweight backbones (MobileNetV3, EfficientNet) via timm.
"""

import torch
import torch.nn as nn
import timm

from config import DEFAULT_MODEL_NAME, NUM_CLASSES

def build_model(
    model_name: str = DEFAULT_MODEL_NAME,
    num_classes: int = NUM_CLASSES,
    pretrained: bool = True,
    dropout: float = 0.2,
) -> nn.Module:
    """
    Constructs a vision classification model with transfer learning.
    Default backbone: MobileNetV3-Large (high accuracy, ultra-fast on mobile/edge devices).
    """
    model = timm.create_model(
        model_name,
        pretrained=pretrained,
        num_classes=num_classes,
        drop_rate=dropout,
    )
    return model

def load_checkpoint(checkpoint_path: str, model_name: str = DEFAULT_MODEL_NAME, device: str = "cpu"):
    """
    Loads model weights from a checkpoint file.
    """
    state_dict = torch.load(checkpoint_path, map_location=device, weights_only=False)
    resolved_model_name = model_name
    if isinstance(state_dict, dict) and "model_name" in state_dict:
        resolved_model_name = state_dict["model_name"]

    model = build_model(model_name=resolved_model_name, pretrained=False)
    if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
        model.load_state_dict(state_dict["model_state_dict"])
    else:
        model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model
