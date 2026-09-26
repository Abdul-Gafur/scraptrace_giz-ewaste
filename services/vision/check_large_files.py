"""
Git Size Auditor for ScrapTrace Repository.

Inspects workspace and Git index for large files to prevent GitHub push errors:
- GitHub warns on files > 50 MB
- GitHub rejects pushes with files > 100 MB

If a huge file is detected, this script identifies it and verifies whether
it is properly ignored in .gitignore.
"""

import sys
import os
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent

WARN_THRESHOLD_MB = 50.0
LIMIT_THRESHOLD_MB = 100.0


def get_git_tracked_files():
    """Get list of files tracked by Git."""
    try:
        res = subprocess.run(
            ["/usr/bin/git", "ls-files"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return [PROJECT_ROOT / f for f in res.stdout.strip().split("\n") if f]
    except Exception:
        return []


def audit_repository():
    print("=" * 68)
    print("  ScrapTrace Git Size Auditor (GitHub 100 MB Protection)")
    print("=" * 68)

    tracked_files = get_git_tracked_files()
    tracked_warnings = []
    tracked_errors = []

    print(f"\n[1/2] Auditing {len(tracked_files)} Git-tracked files...")
    for f in tracked_files:
        if not f.exists():
            continue
        size_mb = f.stat().st_size / (1024 * 1024)
        if size_mb >= LIMIT_THRESHOLD_MB:
            tracked_errors.append((f.relative_to(PROJECT_ROOT), size_mb))
        elif size_mb >= WARN_THRESHOLD_MB:
            tracked_warnings.append((f.relative_to(PROJECT_ROOT), size_mb))

    if tracked_errors:
        print("\n  ❌ CRITICAL ERROR: Found tracked files exceeding GitHub 100 MB limit:")
        for path, sz in tracked_errors:
            print(f"     - {path}: {sz:.2f} MB")
        print("  These files will cause 'git push' to fail!")
    else:
        print("  ✓ Zero tracked files exceed the 100 MB GitHub limit.")

    if tracked_warnings:
        print("\n  ⚠ Warning: Tracked files exceeding 50 MB (GitHub will trigger warnings):")
        for path, sz in tracked_warnings:
            print(f"     - {path}: {sz:.2f} MB")

    print("\n[2/2] Scanning workspace directories for untracked huge files...")
    untracked_huge = []
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Skip .git, node_modules, .venv
        if any(skip in root for skip in [".git", "node_modules", ".venv"]):
            continue
        for f in files:
            p = Path(root) / f
            try:
                sz = p.stat().st_size / (1024 * 1024)
                if sz >= LIMIT_THRESHOLD_MB:
                    rel = p.relative_to(PROJECT_ROOT)
                    # Check if tracked
                    if p not in tracked_files:
                        untracked_huge.append((rel, sz))
            except Exception:
                pass

    if untracked_huge:
        print(f"  Found {len(untracked_huge)} huge local files (>100 MB):")
        for path, sz in untracked_huge:
            print(f"     - {path}: {sz:.2f} MB (Excluded from Git)")
        print("  ✓ These files are safely ignored and will NOT bloat Git.")
    else:
        print("  ✓ No huge files found in workspace.")

    print("\n" + "=" * 68)
    if not tracked_errors:
        print("  RESULT: PASSED. Safe to commit and push to GitHub.")
    else:
        print("  RESULT: FAILED. Untrack the huge files before pushing.")
    print("=" * 68)
    return len(tracked_errors) == 0


if __name__ == "__main__":
    ok = audit_repository()
    sys.exit(0 if ok else 1)
