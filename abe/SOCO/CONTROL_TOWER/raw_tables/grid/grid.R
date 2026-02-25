library(tibble)

# 1. LANDSCAPE DIMENSIONS
# Defines the window we want to Simulate/Manage agents on.
# New regular grid: 40x40 cells = 4000m x 4000m
# Each stand = 2x2 cells = 200m x 200m = 4 hectares
# Total stands = 20x20 = 400 stands
landscape_meta <- list(
  width  = 4000, # m (40 cells at 100m resolution)
  height = 4000, # m (40 cells at 100m resolution)
  x      = 0,    # offset x
  y      = 0     # offset y
)

# 2. TARGET PROPORTIONS (Small, State, Big)
target_proportions <- c(0.45, 0.30, 0.25)

# 3. CLUSTERING SCENARIOS
scenarios_config <- tribble(
  ~name,    ~cluster_coeff,
  "Random", 0.01,
  "Low",    0.03,
  "Medium", 0.08,
  "High",   1.0
)

# 4. AGENT SIZE PARAMETERS (ZTP)
agent_size_params <- list(
  small = list(lambda = 5,  max_stands = 20),
  state = list(lambda = 10, max_stands = 42),
  big   = list(lambda = 15, max_stands = 60)
)