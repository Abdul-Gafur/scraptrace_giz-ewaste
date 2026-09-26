"""
PyTorch Dataset and data transforms for ScrapTrace e-waste image classification.
Supports on-the-fly augmentation (lighting, angles, background variations) to reflect scrapyard reality.
"""

import torch
from torch.utils.data import Dataset
from torchvision import transforms
from PIL import Image

from config import (
    IMAGE_SIZE,
    CATEGORY_TO_IDX,
    HF_LABEL_MAPPING,
)

def get_transforms(is_train: bool = True):
    """
    Data transforms for training and evaluation.
    Scrapyard images have variations in lighting, dirt/weather, angles, and smartphone sensors.
    """
    if is_train:
        return transforms.Compose([
            transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.2),
            transforms.RandomRotation(degrees=15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

class EWasteDataset(Dataset):
    """
    Dataset wrapper compatible with Hugging Face dataset or local PIL images and category labels.
    """
    def __init__(self, data_source, is_train: bool = True):
        self.data_source = data_source
        self.transform = get_transforms(is_train=is_train)

    def __len__(self):
        return len(self.data_source)

    def __getitem__(self, idx):
        item = self.data_source[idx]

        # Handle image column
        img = item.get("image") or item.get("img")
        if not isinstance(img, Image.Image):
            # If path string
            img = Image.open(img).convert("RGB")
        else:
            img = img.convert("RGB")

        # Handle label column
        raw_label = item.get("label") or item.get("category")
        if isinstance(raw_label, int) and hasattr(self.data_source, "features") and "label" in self.data_source.features:
            label_name = self.data_source.features["label"].names[raw_label]
        else:
            label_name = str(raw_label)

        # Normalize and map to contract category
        norm_label = label_name.lower().strip()
        contract_cat = HF_LABEL_MAPPING.get(norm_label, norm_label)
        target_idx = CATEGORY_TO_IDX.get(contract_cat, CATEGORY_TO_IDX.get("mixed_scrap", 6))

        transformed_img = self.transform(img)
        return transformed_img, torch.tensor(target_idx, dtype=torch.long)
