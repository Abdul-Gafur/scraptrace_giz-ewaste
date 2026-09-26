"""
Training script for ScrapTrace E-Waste Vision Classifier.
Trains on pre-cropped 224x224 images from data/processed/.
Supports Apple Silicon MPS, CUDA, and CPU.
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset
import numpy as np
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import StratifiedShuffleSplit
from tqdm import tqdm

from config import (
    CONTRACT_CATEGORIES,
    CHECKPOINTS_DIR,
    ARTIFACTS_DIR,
    DEFAULT_MODEL_NAME,
    NUM_CLASSES,
    BATCH_SIZE,
    NUM_EPOCHS,
    LEARNING_RATE,
    WEIGHT_DECAY,
    SEED,
)
from dataset import EWasteLocalDataset, load_local_samples
from model import build_model


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


def run_training(
    model_name: str = DEFAULT_MODEL_NAME,
    epochs: int = NUM_EPOCHS,
    batch_size: int = BATCH_SIZE,
    lr: float = LEARNING_RATE,
):
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    device = get_device()

    # Load all samples from data/processed/
    print("Loading local dataset from data/processed/...")
    all_samples = load_local_samples()
    if not all_samples:
        print("ERROR: No samples found in data/processed/. Run extract_crops.py first.")
        return

    all_labels = [label for _, label in all_samples]
    print(f"Total samples: {len(all_samples)}")
    for cat in CONTRACT_CATEGORIES:
        idx = CONTRACT_CATEGORIES.index(cat)
        count = all_labels.count(idx)
        print(f"  {cat}: {count}")

    # Stratified split: 75% train, 15% val, 10% test
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

    train_dataset = EWasteLocalDataset(train_samples, is_train=True)
    val_dataset = EWasteLocalDataset(val_samples, is_train=False)
    test_dataset = EWasteLocalDataset(test_samples, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"\nSplits: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)}")

    # Build model
    print(f"\nBuilding model: {model_name} (pretrained ImageNet weights)...")
    model = build_model(model_name=model_name, num_classes=NUM_CLASSES, pretrained=True)
    model.to(device)

    # Class weights for imbalanced data (mixed_scrap has only 16 samples)
    class_counts = np.bincount(all_labels, minlength=NUM_CLASSES).astype(np.float32)
    class_weights = 1.0 / np.maximum(class_counts, 1.0)
    class_weights = class_weights / class_weights.sum() * NUM_CLASSES
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32).to(device)
    print(f"Class weights: {dict(zip(CONTRACT_CATEGORIES, class_weights.tolist()))}")

    criterion = nn.CrossEntropyLoss(weight=weights_tensor)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_f1 = 0.0
    history = []

    print("\n" + "=" * 60)
    print("Starting training...")
    print("=" * 60)
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
            checkpoint_path = CHECKPOINTS_DIR / "best_model.pth"
            torch.save({
                "epoch": epoch,
                "model_name": model_name,
                "model_state_dict": model.state_dict(),
                "val_f1": val_f1,
                "val_acc": val_acc,
                "categories": CONTRACT_CATEGORIES,
                "trained_at": datetime.now(timezone.utc).isoformat(),
            }, checkpoint_path)
            marker = " ★ best"

        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc*100:.1f}% │ "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc*100:.1f}% F1: {val_f1:.4f} "
            f"({elapsed:.1f}s){marker}"
        )

        history.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 5),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 5),
            "val_acc": round(val_acc, 4),
            "val_f1": round(val_f1, 4),
        })

    total_time = time.time() - start_time
    print(f"\nTraining completed in {total_time/60:.1f} minutes.")

    # Final test evaluation with best checkpoint
    print("\n" + "=" * 60)
    print("Final Test Set Evaluation (best checkpoint)")
    print("=" * 60)
    best_cp = torch.load(CHECKPOINTS_DIR / "best_model.pth", map_location=device, weights_only=True)
    model.load_state_dict(best_cp["model_state_dict"])

    test_loss, test_acc, test_f1, test_preds, test_targets = evaluate(model, test_loader, criterion, device)

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

    # Save metrics
    metrics = {
        "model_name": model_name,
        "best_epoch": best_cp["epoch"],
        "best_val_f1": round(best_val_f1, 4),
        "test_acc": round(test_acc, 4),
        "test_f1": round(test_f1, 4),
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
    print(f"Best checkpoint at {CHECKPOINTS_DIR / 'best_model.pth'}")


if __name__ == "__main__":
    run_training()
