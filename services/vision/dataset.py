"""
PyTorch Dataset and data transforms for ScrapTrace e-waste image classification.
Supports on-the-fly augmentation (lighting, angles, background variations, cutout)
and synthetic mixup for underrepresented classes (e.g. mixed_scrap).
"""

import random
from pathlib import Path
from PIL import Image

import torch
from torch.utils.data import Dataset
from torchvision import transforms

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
            transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.75, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.2),
            transforms.RandomRotation(degrees=20),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.08),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
            # Random Erasing (Cutout) to simulate partial occlusions, wires, and dirt
            transforms.RandomErasing(p=0.25, scale=(0.02, 0.25), value="random"),
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
    For training: supports oversampling minority classes and synthetic CutMix.
    """
    def __init__(self, samples: list, is_train: bool = True, oversample_minority: bool = False):
        """
        Args:
            samples: list of (image_path, label_idx) tuples
            is_train: whether to apply training augmentations
            oversample_minority: duplicate sparse classes with varied augmentations
        """
        self.is_train = is_train
        self.transform = get_transforms(is_train=is_train)

        mixed_scrap_idx = CATEGORY_TO_IDX["mixed_scrap"]

        if is_train and oversample_minority:
            augmented_samples = list(samples)
            # Find mixed_scrap samples
            mixed_samples = [s for s in samples if s[1] == mixed_scrap_idx]
            # Oversample mixed_scrap 6x so the model sees diverse augmentations
            if mixed_samples:
                for _ in range(5):
                    augmented_samples.extend(mixed_samples)

            self.samples = augmented_samples
        else:
            self.samples = samples

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
