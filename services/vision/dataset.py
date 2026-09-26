"""
PyTorch Dataset and data transforms for ScrapTrace e-waste image classification.
Supports on-the-fly augmentation (lighting, angles, background variations) to reflect scrapyard reality.
"""

import torch
from torch.utils.data import Dataset
from torchvision import transforms
from PIL import Image
from pathlib import Path

from config import (
    IMAGE_SIZE,
    CATEGORY_TO_IDX,
    CONTRACT_CATEGORIES,
    PROCESSED_DATA_DIR,
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


class EWasteLocalDataset(Dataset):
    """
    Loads pre-cropped 224x224 images from data/processed/<category>/*.jpg.
    """
    def __init__(self, samples: list, is_train: bool = True):
        """
        Args:
            samples: list of (image_path, label_idx) tuples
            is_train: whether to apply training augmentations
        """
        self.samples = samples
        self.transform = get_transforms(is_train=is_train)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label_idx = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img = self.transform(img)
        return img, torch.tensor(label_idx, dtype=torch.long)


def load_local_samples(data_dir: Path = None):
    """
    Scan data/processed/<category>/ directories and return list of (path, label_idx).
    """
    if data_dir is None:
        data_dir = PROCESSED_DATA_DIR

    samples = []
    for cat in CONTRACT_CATEGORIES:
        cat_dir = data_dir / cat
        if not cat_dir.exists():
            continue
        for img_path in sorted(cat_dir.glob("*.jpg")):
            samples.append((str(img_path), CATEGORY_TO_IDX[cat]))

    return samples
