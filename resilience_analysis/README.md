# Resilience Analysis

`resilience_analysis` is now split into three parts:

- `pilot/`: the current bark-beetle pilot design and pilot-only analysis scripts
- `legacy/`: the older full resilience analysis scripts and config
- root: shared utilities used by both tracks

## Shared

- `extract_resilience_data.py`: config-driven extractor for combined runner outputs

## Pilot workflow

```bash
python resilience_analysis/pilot/clean_outputs.py --config resilience_analysis/pilot/config.toml
python runner/01_generate_run_table.py --config resilience_analysis/pilot/config.toml
python runner/02_run_parallel.py --table runner/run_table_pilot.csv --config resilience_analysis/pilot/config.toml --limit 12
python resilience_analysis/extract_resilience_data.py --config resilience_analysis/pilot/config.toml
Rscript resilience_analysis/pilot/analysis/run_all.R
```

Pilot outputs are written to:

- `output/pilot_resilience/`
- `resilience_analysis/pilot/data/`
- `resilience_analysis/pilot/figures/`

## Legacy workflow

```bash
python runner/01_generate_run_table.py --config resilience_analysis/legacy/config.toml
python runner/02_run_parallel.py --table runner/run_table.csv --config resilience_analysis/legacy/config.toml
python resilience_analysis/extract_resilience_data.py --config resilience_analysis/legacy/config.toml
Rscript resilience_analysis/legacy/analysis/run_all.R
```

Legacy outputs are expected under:

- `resilience_analysis/legacy/data/`
- `resilience_analysis/legacy/figures/`
