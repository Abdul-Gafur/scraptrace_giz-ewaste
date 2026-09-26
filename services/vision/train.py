"""
Training script for ScrapTrace E-Waste Vision Classifier.
Supports Apple Silicon MPS, CUDA, and CPU.
Computes evaluation metrics (Loss, Accuracy, Macro F1, Per-Category Report).
"""

import os
import json
import time
from datetime import datetime
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
import numpy as np
from sklearn.metrics import classification_report, f1_score
from tqdm import tqdm

from config import (
    CONTRACT_CATEGORIES,
    CHECKPOINTS_DIR,
    ARTIFACTS_DIR,
    DEFAULT_MODEL_NAME,
    NUM_CLASSES,
    IMAGE_SIZE,
    BATCH_SIZE,
    NUM_EPOCHS,
    LEARNING_RATE,
    WEIGHT_DECAY,
    SEED,
)
from dataset import EWasteDataset
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

    for images, labels in tqdm(dataloader, desc="Training", leave=False):
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

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc

def evaluate(model, dataloader, criterion, device):
    model.eval()
    running_loss = 0.0
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for images, labels in tqdm(dataloader, desc="Evaluating", leave=False):
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
    dataset_source=None,
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

    # Load dataset
    if dataset_source is None:
        from datasets import load_dataset
        print("Loading dataset from Hugging Face (GIZ/E-Waste-Database)...")
        hf_ds = load_dataset("GIZ/E-Waste-Database")
        # Combine or use train split
        dataset_source = hf_ds["train"] if "train" in hf_ds else hf_ds[list(hf_ds.keys())[0]]

    total_samples = len(dataset_source)
    print(f"Total dataset samples: {total_samples}")

    train_size = int(0.75 * total_samples)
    val_size = int(0.15 * total_samples)
    test_size = total_samples - train_size - val_size

    full_train, full_val, full_test = random_split(
        dataset_source, [train_size, val_size, test_size],
        generator=torch.Generator().manual_seed(SEED)
    )

    train_dataset = EWasteDataset(full_train, is_train=True)
    val_dataset = EWasteDataset(full_val, is_train=False)
    test_dataset = EWasteDataset(full_test, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    print(f"Data splits: Train={train_size}, Val={val_size}, Test={test_size}")

    # Build model
    model = build_model(model_name=model_name, num_classes=NUM_CLASSES, pretrained=True)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=WEIGHT_DECAY)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_val_f1 = 0.0
    history = []

    print("\nStarting training loop...")
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        epoch_start = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, val_f1, _, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - epoch_start
        print(
            f"Epoch [{epoch:02d}/{epochs:02d}] "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc*100:.1f}% | "
            f"Val Loss: {val_loss:.4f} Acc: {val_acc*100:.1f}% F1: {val_f1:.4f} "
            f"({elapsed:.1f}s)"
        )

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "train_acc": train_acc,
            "val_loss": val_loss,
            "val_acc": val_acc,
            "val_f1": val_f1,
        })

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
                "trained_at": datetime.utcnow().isoformat(),
            }, checkpoint_path)
            print(f"  ★ New best model checkpoint saved: {checkpoint_path}")

    total_time = time.time() - start_time
    print(f"\nTraining completed in {total_time/60:.2f} minutes.")

    # Final test evaluation
    print("\n--- Final Test Set Evaluation ---")
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
    print(f"Test Accuracy: {test_acc*100:.2f}%, Test Macro F1: {test_f1:.4f}\n")
    print(report_str)

    # Save metrics
    metrics = {
        "model_name": model_name,
        "best_val_f1": best_val_f1,
        "test_acc": test_acc,
        "test_f1": test_f1,
        "history": history,
        "classification_report": report_str,
    }
    with open(ARTIFACTS_DIR / "training_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"Metrics saved to {ARTIFACTS_DIR / 'training_metrics.json'}")

if __name__ == "__main__":
    run_training()
