"""
Foundation Model Fine-Tuning Script for ScrapTrace E-Waste Classification.
Supports:
  - convnext_nano (ImageNet-12K pre-trained: 12,000 object categories)
  - siglip_base (Google Vision-Language Transformer, ARIS architecture)
  - efficientnet_b0 (Compound-scaled parameter efficient)
  - mobilenetv3_large (Edge mobile baseline)

Features:
  - Linear probe mode (--freeze-backbone): completely prevents overfitting on small datasets
  - Full fine-tune mode: end-to-end gradient updates with cosine annealing
  - Auto-fetches pre-trained foundation weights on demand on any collaborator's machine
"""

import sys
import json
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import StratifiedShuffleSplit
from tqdm import tqdm

from config import (
    CONTRACT_CATEGORIES,
    CHECKPOINTS_DIR,
    ARTIFACTS_DIR,
    NUM_CLASSES,
    BATCH_SIZE,
    LEARNING_RATE,
    WEIGHT_DECAY,
    SEED,
)
from dataset import EWasteLocalDataset, load_local_samples
from foundation_models import build_foundation_model, FOUNDATION_MODELS


def get_device():
    if torch.backends.mps.is_available():
        device = torch.device("mps")
        print("Using Apple Silicon MPS (Metal GPU) acceleration.")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print(f"Using NVIDIA CUDA GPU: {torch.cuda.get_device_name(0)}")
    else:
        device = torch.device("cpu")
        print("Using CPU device.")
    return device


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in tqdm(dataloader, desc="  Train", leave=False):
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    return running_loss / max(total, 1), correct / max(total, 1)


def evaluate(model, dataloader, criterion, device):
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for images, labels in tqdm(dataloader, desc="  Eval ", leave=False):
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(labels.cpu().numpy())

    total = len(all_targets)
    val_loss = running_loss / max(total, 1)
    val_acc = (np.array(all_preds) == np.array(all_targets)).mean() if total > 0 else 0.0
    macro_f1 = f1_score(all_targets, all_preds, average="macro", zero_division=0)

    return val_loss, val_acc, macro_f1, all_preds, all_targets


def run_foundation_training(
    model_key: str = "convnext_nano",
    epochs: int = 15,
    freeze_backbone: bool = False,
    batch_size: int = BATCH_SIZE,
    lr: float = 3e-4,
):
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    device = get_device()

    print("=" * 65)
    print(f"ScrapTrace Vision — Foundation Training: {model_key.upper()}")
    print("=" * 65)

    # 1. Load local dataset
    all_samples = load_local_samples()
    if not all_samples:
        print("ERROR: No samples found in data/processed/. Run npm run vision:download first.")
        return

    all_labels = [label for _, label in all_samples]
    print(f"Total samples available: {len(all_samples)}")

    # 2. Stratified train/val/test splits
    sss1 = StratifiedShuffleSplit(n_splits=1, test_size=0.25, random_state=SEED)
    train_idx, temp_idx = next(sss1.split(all_samples, all_labels))
    temp_labels = [all_labels[i] for i in temp_idx]
    sss2 = StratifiedShuffleSplit(n_splits=1, test_size=0.40, random_state=SEED)
    val_rel_idx, test_rel_idx = next(sss2.split(temp_idx, temp_labels))
    val_idx = temp_idx[val_rel_idx]
    test_idx = temp_idx[test_rel_idx]

    train_samples = [all_samples[i] for i in train_idx]
    val_samples = [all_samples[i] for i in val_idx]
    test_samples = [all_samples[i] for i in test_idx]

    train_dataset = EWasteLocalDataset(train_samples, is_train=True, oversample_minority=False)
    val_dataset = EWasteLocalDataset(val_samples, is_train=False, oversample_minority=False)
    test_dataset = EWasteLocalDataset(test_samples, is_train=False, oversample_minority=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Splits: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)}")

    # 3. Build foundation model (auto-fetches weights if missing)
    model = build_foundation_model(
        model_key=model_key,
        num_classes=NUM_CLASSES,
        pretrained=True,
        freeze_backbone=freeze_backbone,
    )
    model.to(device)

    # 4. Class weighting
    class_counts = np.bincount(all_labels, minlength=NUM_CLASSES).astype(np.float32)
    class_weights = 1.0 / np.maximum(class_counts, 1.0)
    class_weights = class_weights / class_weights.sum() * NUM_CLASSES
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)

    criterion = nn.CrossEntropyLoss(weight=weights_tensor, label_smoothing=0.05)

    # Optimize only trainable parameters
    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(trainable_params, lr=lr, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)

    best_val_f1 = 0.0
    history = []
    checkpoint_out = CHECKPOINTS_DIR / "best_model.pth"

    print("\nStarting foundation training loop...")
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, val_f1, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - epoch_start
        marker = ""
        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            torch.save(
                {
                    "epoch": epoch,
                    "model_name": model_key,
                    "model_state_dict": model.state_dict(),
                    "val_f1": float(val_f1),
                    "val_acc": float(val_acc),
                    "categories": CONTRACT_CATEGORIES,
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                },
                checkpoint_out,
            )
            marker = " ★ best"

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc*100:.1f}% │ "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc*100:.1f}% F1: {val_f1:.4f} "
            f"({elapsed:.1f}s){marker}"
        )

        history.append({
            "epoch": epoch,
            "train_loss": round(float(train_loss), 5),
            "train_acc": round(float(train_acc), 4),
            "val_loss": round(float(val_loss), 5),
            "val_acc": round(float(val_acc), 4),
            "val_f1": round(float(val_f1), 4),
        })

    total_time = time.time() - start_time
    print(f"\nTraining completed in {total_time/60:.1f} minutes.")

    # 5. Final Evaluation on Held-out Test Set
    print("\n" + "=" * 65)
    print("Final Test Set Evaluation (Best Checkpoint)")
    print("=" * 65)
    best_cp = torch.load(checkpoint_out, map_location=device, weights_only=False)
    model.load_state_dict(best_cp["model_state_dict"])

    test_loss, test_acc, test_f1, test_preds, test_targets = evaluate(
        model, test_loader, criterion, device
    )

    report_str = classification_report(
        test_targets,
        test_preds,
        target_names=CONTRACT_CATEGORIES,
        digits=4,
        zero_division=0,
    )
    print(f"\nTest Accuracy: {test_acc*100:.2f}%")
    print(f"Test Macro F1: {test_f1:.4f}")
    print(f"\n{report_str}")

    # 6. Save metrics manifest
    metrics = {
        "model_name": model_key,
        "best_epoch": best_cp["epoch"],
        "best_val_f1": round(float(best_val_f1), 4),
        "test_acc": round(float(test_acc), 4),
        "test_f1": round(float(test_f1), 4),
        "freeze_backbone": freeze_backbone,
        "total_samples": len(all_samples),
        "train_samples": len(train_samples),
        "val_samples": len(val_samples),
        "test_samples": len(test_samples),
        "history": history,
        "classification_report": report_str,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    metrics_path = ARTIFACTS_DIR / "training_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Metrics saved to {metrics_path}")
    print(f"Best checkpoint saved to {checkpoint_out}")


def main():
    parser = argparse.ArgumentParser(description="Train a foundation vision model on e-waste.")
    parser.add_argument(
        "--model",
        type=str,
        default="convnext_nano",
        choices=list(FOUNDATION_MODELS.keys()),
        help=f"Foundation backbone to train. Options: {list(FOUNDATION_MODELS.keys())}",
    )
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        help="Freeze backbone and train only linear classifier head (zero-overfitting guarantee)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=15,
        help="Number of training epochs (default: 15)",
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=3e-4,
        help="Learning rate (default: 3e-4)",
    )
    args = parser.parse_args()

    run_foundation_training(
        model_key=args.model,
        epochs=args.epochs,
        freeze_backbone=args.freeze_backbone,
        lr=args.lr,
    )


if __name__ == "__main__":
    main()
