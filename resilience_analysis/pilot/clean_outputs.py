#!/usr/bin/env python3
"""Clean the isolated pilot run namespace without touching legacy resilience outputs."""

import argparse
import shutil
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib


PROJECT_DIR = Path(__file__).parent.parent.parent.resolve()


def resolve_project_path(rel_path: str) -> Path:
    path = (PROJECT_DIR / rel_path).resolve()
    if PROJECT_DIR not in path.parents and path != PROJECT_DIR:
        raise ValueError(f"Refusing to clean path outside project: {path}")
    return path


def load_config(config_path: Path) -> dict:
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def remove_path(path: Path):
    if not path.exists():
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def main():
    parser = argparse.ArgumentParser(description="Clean pilot output namespace")
    parser.add_argument("--config", default=str(PROJECT_DIR / "resilience_analysis" / "pilot" / "config.toml"),
                        help="Path to pilot config")
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    paths_cfg = cfg.get("paths", {})

    targets = [
        resolve_project_path(paths_cfg.get("output_root", "output/pilot_resilience")),
        resolve_project_path(paths_cfg.get("log_dir", "runner/logs_pilot")),
        resolve_project_path(paths_cfg.get("status_dir", "runner/status_pilot")),
        resolve_project_path(paths_cfg.get("extracted_data_dir", "resilience_analysis/pilot/data")),
        resolve_project_path(paths_cfg.get("figures_dir", "resilience_analysis/pilot/figures")),
        resolve_project_path(paths_cfg.get("run_table", "runner/run_table_pilot.csv")),
    ]

    for target in targets:
        remove_path(target)
        print(f"Removed: {target}")


if __name__ == "__main__":
    main()
