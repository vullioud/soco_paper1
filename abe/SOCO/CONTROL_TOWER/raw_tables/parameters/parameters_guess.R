library(tibble)

# ==============================================================================
# PARAMETER DISTRIBUTIONS (Keys aligned with Activity Options)
# ==============================================================================

raw_params <- tribble(
  ~activity,       ~param_name,          ~pref,          ~func,    ~mean, ~sd,  ~lambda, ~alpha, ~beta, ~shape, ~scale, ~profile,
  
  # ============================================================================
  # A. HARVESTING ACTIVITIES
  # ============================================================================
  
  # --- Clearcut ---
  "clearcut",      "execution_schedule", "Production",   "normal",  90,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  "clearcut",      "execution_schedule", "Biodiversity", "normal",  140,   20,   NA,      NA,     NA,    NA,     NA,     NA,
  "clearcut",      "execution_schedule", "CO2",          "normal",  120,   15,   NA,      NA,     NA,    NA,     NA,     NA,
  
  # --- Shelterwood ---
  "shelterwood",   "execution_schedule", "Production",   "normal",  90,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "execution_schedule", "Biodiversity", "normal",  120,   15,   NA,      NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "execution_schedule", "CO2",          "normal",  100,   12,   NA,      NA,     NA,    NA,     NA,     NA,
  
  "shelterwood",   "times",              "Production",   "poisson", NA,    NA,   2,       NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "times",              "Biodiversity", "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "times",              "CO2",          "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  
  "shelterwood",   "interval",           "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "interval",           "Biodiversity", "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "interval",           "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "shelterwood",   "nTrees",             "Production",   "poisson", NA,    NA,   30,      NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "nTrees",             "Biodiversity", "poisson", NA,    NA,   60,      NA,     NA,    NA,     NA,     NA,
  "shelterwood",   "nTrees",             "CO2",          "poisson", NA,    NA,   45,      NA,     NA,    NA,     NA,     NA,
  
  "shelterwood",   "species_profile",    "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "shelterwood",   "species_profile",    "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "shelterwood",   "species_profile",    "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  
  # --- Femel (Gap) ---
  "femel",         "execution_schedule", "Production",   "normal",  90,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "femel",         "execution_schedule", "Biodiversity", "normal",  100,   15,   NA,      NA,     NA,    NA,     NA,     NA,
  "femel",         "execution_schedule", "CO2",          "normal",  100,   12,   NA,      NA,     NA,    NA,     NA,     NA,
  
  "femel",         "times",              "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "femel",         "times",              "Biodiversity", "poisson", NA,    NA,   6,       NA,     NA,    NA,     NA,     NA,
  "femel",         "times",              "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "femel",         "interval",           "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "femel",         "interval",           "Biodiversity", "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "femel",         "interval",           "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "femel",         "initial_size",       "Production",   "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  "femel",         "initial_size",       "Biodiversity", "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  "femel",         "initial_size",       "CO2",          "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  
  "femel",         "growth_width",       "Production",   "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  "femel",         "growth_width",       "Biodiversity", "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  "femel",         "growth_width",       "CO2",          "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  
  # --- Target DBH (Correctly Named) ---
  "targetDBH",     "execution_schedule", "Production",   "normal",  70,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "execution_schedule", "Biodiversity", "normal",  90,    15,   NA,      NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "execution_schedule", "CO2",          "normal",  80,    12,   NA,      NA,     NA,    NA,     NA,     NA,
  
  "targetDBH",     "targetDBH",          "Production",   "normal",  25,    5,    NA,      NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "targetDBH",          "Biodiversity", "normal",  85,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "targetDBH",          "CO2",          "normal",  80,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  
  "targetDBH",     "interval",           "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "interval",           "Biodiversity", "poisson", NA,    NA,   3,      NA,     NA,    NA,     NA,     NA,
  "targetDBH",     "interval",           "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "targetDBH",     "dbhListProfile",     "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "production_standard",
  "targetDBH",     "dbhListProfile",     "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "biodiversity_mix",
  "targetDBH",     "dbhListProfile",     "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "co2_storage",
  
  # --- Plenter Harvest (RENAMED from 'plenter') ---
  "plenter_harvest", "execution_schedule", "Production",   "normal",  120,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "plenter_harvest", "execution_schedule", "Biodiversity", "normal",  120,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  "plenter_harvest", "execution_schedule", "CO2",          "normal",  120,    10,   NA,      NA,     NA,    NA,     NA,     NA,
  
  "plenter_harvest", "interval",           "Production",   "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "plenter_harvest", "interval",           "Biodiversity", "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "plenter_harvest", "interval",           "CO2",          "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  
  "plenter_harvest", "plenterCurve",       "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_prod",
  "plenter_harvest", "plenterCurve",       "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_bio",
  "plenter_harvest", "plenterCurve",       "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_co2",
  
  # --- Plenter Thinning (NEW ENTRIES copied for safety) ---
  "plenter_thinning", "execution_schedule", "Production",   "normal",  50,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  "plenter_thinning", "execution_schedule", "Biodiversity", "normal",  50,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  "plenter_thinning", "execution_schedule", "CO2",          "normal",  50,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  
  "plenter_thinning", "interval",           "Production",   "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "plenter_thinning", "interval",           "Biodiversity", "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "plenter_thinning", "interval",           "CO2",          "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  
  "plenter_thinning", "plenterCurve",       "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_prod",
  "plenter_thinning", "plenterCurve",       "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_bio",
  "plenter_thinning", "plenterCurve",       "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "plenter_co2",
  
  # ============================================================================
  # B. THINNING ACTIVITIES
  # ============================================================================
  
  # --- From Below (RENAMED from 'thinningFromBelow') ---
  "fromBelow",     "execution_schedule", "Production",   "normal",  35,    5,    NA,      NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "execution_schedule", "Biodiversity", "normal",  40,    8,    NA,      NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "execution_schedule", "CO2",          "normal",  35,    6,    NA,      NA,     NA,    NA,     NA,     NA,
  
  "fromBelow",     "times",              "Production",   "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "times",              "Biodiversity", "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "times",              "CO2",          "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  
  "fromBelow",     "interval",           "Production",   "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "interval",           "Biodiversity", "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  "fromBelow",     "interval",           "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "fromBelow",     "thinningShare",      "Production",   "beta",    NA,    NA,   NA,      5,      2,     NA,     NA,     NA,
  "fromBelow",     "thinningShare",      "Biodiversity", "beta",    NA,    NA,   NA,      2,      5,     NA,     NA,     NA,
  "fromBelow",     "thinningShare",      "CO2",          "beta",    NA,    NA,   NA,      3,      4,     NA,     NA,     NA,
  
  "fromBelow",     "species_profile",    "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "fromBelow",     "species_profile",    "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "fromBelow",     "species_profile",    "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  
  # --- Selective Thinning ---
  "selectiveThinning", "execution_schedule", "Production",   "normal",  35,    5,    NA,      NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "execution_schedule", "Biodiversity", "normal",  45,    2,    NA,      NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "execution_schedule", "CO2",          "normal",  40,    6,    NA,      NA,     NA,    NA,     NA,     NA,
  
  "selectiveThinning", "times",              "Production",   "poisson", NA,    NA,   6,       NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "times",              "Biodiversity", "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "times",              "CO2",          "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  
  "selectiveThinning", "interval",           "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "interval",           "Biodiversity", "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "interval",           "CO2",          "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  
  "selectiveThinning", "nTrees",             "Production",   "poisson", NA,    NA,   100,     NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "nTrees",             "Biodiversity", "poisson", NA,    NA,   70,      NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "nTrees",             "CO2",          "poisson", NA,    NA,   80,      NA,     NA,    NA,     NA,     NA,
  
  "selectiveThinning", "nCompetitors",       "Production",   "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "nCompetitors",       "Biodiversity", "poisson", NA,    NA,   2,       NA,     NA,    NA,     NA,     NA,
  "selectiveThinning", "nCompetitors",       "CO2",          "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  
  "selectiveThinning", "species_profile",    "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "selectiveThinning", "species_profile",    "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "selectiveThinning", "species_profile",    "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  
  # ============================================================================
  # C. TENDING & PLANTING
  # ============================================================================
  
  # --- Tending ---
  "tending",       "execution_schedule", "Production",   "normal",  18,    3,    NA,      NA,     NA,    NA,     NA,     NA,
  "tending",       "execution_schedule", "Biodiversity", "normal",  24,    5,    NA,      NA,     NA,    NA,     NA,     NA,
  "tending",       "execution_schedule", "CO2",          "normal",  20,    4,    NA,      NA,     NA,    NA,     NA,     NA,
  
  "tending",       "times",              "Production",   "poisson", NA,    NA,   4,       NA,     NA,    NA,     NA,     NA,
  "tending",       "times",              "Biodiversity", "poisson", NA,    NA,   2,       NA,     NA,    NA,     NA,     NA,
  "tending",       "times",              "CO2",          "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  
  "tending",       "interval",           "Production",   "poisson", NA,    NA,   3,       NA,     NA,    NA,     NA,     NA,
  "tending",       "interval",           "Biodiversity", "poisson", NA,    NA,   6,       NA,     NA,    NA,     NA,     NA,
  "tending",       "interval",           "CO2",          "poisson", NA,    NA,   5,       NA,     NA,    NA,     NA,     NA,
  
  "tending",       "intensity",          "Production",   "poisson", NA,    NA,   15,      NA,     NA,    NA,     NA,     NA,
  "tending",       "intensity",          "Biodiversity", "poisson", NA,    NA,   8,       NA,     NA,    NA,     NA,     NA,
  "tending",       "intensity",          "CO2",          "poisson", NA,    NA,   10,      NA,     NA,    NA,     NA,     NA,
  
  "tending",       "species_profile",    "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "tending",       "species_profile",    "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "tending",       "species_profile",    "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  
  # --- Planting ---
  "planting",      "execution_schedule", "Production",   "poisson", NA,    NA,   1,       NA,     NA,    NA,     NA,     NA,
  "planting",      "execution_schedule", "Biodiversity", "poisson", NA,    NA,   1,       NA,     NA,    NA,     NA,     NA,
  "planting",      "execution_schedule", "CO2",          "poisson", NA,    NA,   1,       NA,     NA,    NA,     NA,     NA,
  
  "planting",      "species_profile",    "Production",   "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "planting",      "species_profile",    "Biodiversity", "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles",
  "planting",      "species_profile",    "CO2",          "lookup",  NA,    NA,   NA,      NA,     NA,    NA,     NA,     "species_profiles"
)