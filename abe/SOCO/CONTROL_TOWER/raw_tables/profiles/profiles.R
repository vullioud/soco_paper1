library(tibble)
library(dplyr)

# ==============================================================================
# A. TARGET DBH PROFILES
# ==============================================================================
# Names match 'parameters_guess.R': production_standard, biodiversity_mix, co2_storage

target_dbh_raw <- tribble(
  ~profile_name,          ~species, ~dbh_threshold,
  
  # --- 1. Production Standard (formerly conifer_production) ---
  "production_standard",  "piab",   40,
  "production_standard",  "pisy",   40,
  "production_standard",  "lade",   55,
  "production_standard",  "psme",   50,
  "production_standard",  "abal",   45,
  # Fallbacks for others
  "production_standard",  "fasy",   55,
  "production_standard",  "quro",   60,
  
  # --- 2. Biodiversity Mix (formerly broadleaf_conservation) ---
  "biodiversity_mix",     "fasy",   80,
  "biodiversity_mix",     "quro",   90,
  "biodiversity_mix",     "qupe",   90,
  "biodiversity_mix",     "frex",   70,
  "biodiversity_mix",     "acps",   70,
  "biodiversity_mix",     "piab",   60, # Longer rotation for conifers too
  
  # --- 3. CO2 Storage (formerly default_central_europe) ---
  "co2_storage",          "fasy",   65,
  "co2_storage",          "frex",   60,
  "co2_storage",          "piab",   45,
  "co2_storage",          "quro",   75,
  "co2_storage",          "pisy",   45,
  "co2_storage",          "lade",   65,
  "co2_storage",          "psme",   65,
  "co2_storage",          "abal",   45
)

# ==============================================================================
# B. PLENTER PROFILES
# ==============================================================================
# Names match 'parameters_guess.R': plenter_prod, plenter_bio, plenter_co2

plenter_raw <- tribble(
  ~profile_name,   ~dbh_class, ~stem_count,
  
  # --- 1. Plenter Prod (formerly production_spruce_plenter) ---
  "plenter_prod",  "10",       400,
  "plenter_prod",  "15",       250,
  "plenter_prod",  "20",       180,
  "plenter_prod",  "25",       120,
  "plenter_prod",  "30",       70,
  "plenter_prod",  "35",       40,
  "plenter_prod",  "40",       20,
  "plenter_prod",  "45",       10,
  "plenter_prod",  "50",       5,
  
  # --- 2. Plenter Bio (formerly biodiversity_uneven_aged) ---
  "plenter_bio",   "10",       300,
  "plenter_bio",   "15",       200,
  "plenter_bio",   "20",       140,
  "plenter_bio",   "25",       90,
  "plenter_bio",   "30",       60,
  "plenter_bio",   "35",       40,
  "plenter_bio",   "40",       30,
  "plenter_bio",   "45",       25,
  "plenter_bio",   "50",       20,
  "plenter_bio",   "60",       10,
  "plenter_bio",   "70",       5,
  
  # --- 3. Plenter CO2 (formerly classic_beech_plenter) ---
  "plenter_co2",   "10",       350,
  "plenter_co2",   "15",       220,
  "plenter_co2",   "20",       150,
  "plenter_co2",   "25",       105,
  "plenter_co2",   "30",       80,
  "plenter_co2",   "35",       50,
  "plenter_co2",   "40",       40,
  "plenter_co2",   "45",       25,
  "plenter_co2",   "50",       20
)