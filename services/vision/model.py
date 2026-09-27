"""
Neural network architecture definition for ScrapTrace e-waste image classification.
Leverages modern lightweight backbones (MobileNetV3, EfficientNet) via timm.
"""

import timm
import torch
import torch.nn as nn

from services.vision.config import DEFAULT_MODEL_NAME, NUM_CLASSES


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


def load_checkpoint(
    checkpoint_path: str,
    model_name: str = DEFAULT_MODEL_NAME,
    device: str = "cpu",
    expected_categories: tuple[str, ...] | None = None,
):
    """
    Loads model weights from a checkpoint file.
    """
    state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
    resolved_model_name = model_name
    if isinstance(state_dict, dict) and "model_name" in state_dict:
        resolved_model_name = state_dict["model_name"]

    if resolved_model_name != model_name:
        raise ValueError(
            "The checkpoint architecture does not match the model manifest."
        )
    if expected_categories is not None:
        checkpoint_categories = (
            state_dict.get("categories") if isinstance(state_dict, dict) else None
        )
        if (
            checkpoint_categories is not None
            and tuple(checkpoint_categories) != expected_categories
        ):
            raise ValueError(
                "The checkpoint class mapping does not match the model manifest."
            )

    model = build_model(model_name=resolved_model_name, pretrained=False)
    if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
        model.load_state_dict(state_dict["model_state_dict"], strict=True)
    else:
        model.load_state_dict(state_dict, strict=True)
    model.to(device)
    model.eval()
    return model
