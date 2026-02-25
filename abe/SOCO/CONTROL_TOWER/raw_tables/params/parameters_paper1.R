# Paper 1: Parameter distributions by [activity][behavioral_type]
# Fixed values from abe-lib defaults. No execution_schedule, no sampling.

library(tidyverse)
library(jsonlite)

# Shelterwood: nTrees=40, nCompetitors=1000, interval=5, times=2 (all types)
# Femel: initial_size=3, growth_width=2, interval=10, times=2 (all types)
# TargetDBH: interval=5, times=5, dbhListProfile varies by type
# Plenter: interval=5, times=1000, plenterCurve varies by type
# FromBelow: thinningShare varies, interval=5, times=5
# SelectiveThinning: nTrees=80, nCompetitors=4, interval=5, times=5 (all types)
# Tending: intensity=10, interval=2, times=3 (all types)
# Planting: no special params
# Clearcut: no special params

# Export is done directly in JSON (config/tables/params/parameter_distributions.json)
# This R file documents the parameter rationale only.
