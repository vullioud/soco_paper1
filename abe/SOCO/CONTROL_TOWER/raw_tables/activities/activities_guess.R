# ==============================================================================
# SoCoABE Activity Distributions: EXPLICIT DEFINITION
# ==============================================================================
library(tidyverse)
library(jsonlite)
library(knitr)
library(kableExtra)

# 1. METADATA: Activity Order (Must match C++ Enums)
# ------------------------------------------------------------------------------
# H  = Harvesting [Shelterwood, TargetDBH, Clearcut, Plenter, Femel, NoMgmt]
# Th = Thinning   [Selective, FromBelow, PlenterThin, NoMgmt]
# Te = Tending    [Tending, NoMgmt]
# P  = Planting   [Planting, NoMgmt]

act_orders <- list(
  harvesting = c("shelterwood", "targetDBH", "clearcut", "plenter_harvest", "femel", "noManagement"),
  thinning   = c("selectiveThinning", "fromBelow", "plenter_thinning", "noManagement"),
  tending    = c("tending", "noManagement"),
  planting   = c("planting", "noManagement")
)

# 2. THE MASTER DATA TABLE (Fully Explicit)
# ------------------------------------------------------------------------------
# Every scenario is a distinct row.
# Modify specific rows here to create exceptions without side effects.

raw_activity <- tribble(
  ~owner,  ~phase,       ~pref,          ~struct,  ~vector_str,
  
  # ============================================================================
  # BIG COMPANY
  # ============================================================================
  
  # --- Harvesting ---
  "big",   "harvesting", "Production",   "high",   "1, 1, 5, 0, 1, 0",
  "big",   "harvesting", "Production",   "medium", "1, 1, 5, 0, 1, 0",
  "big",   "harvesting", "Production",   "low",    "1, 1, 5, 0, 1, 0",
  
  "big",   "harvesting", "Biodiversity", "high",   "2, 2, 6, 1, 1, 0",
  "big",   "harvesting", "Biodiversity", "medium", "2, 2, 6, 1, 1, 0",
  "big",   "harvesting", "Biodiversity", "low",    "2, 2, 6, 1, 1, 0",
  
  "big",   "harvesting", "CO2",          "high",   "2, 3, 3, 1, 1, 0", # Specific deviation
  "big",   "harvesting", "CO2",          "medium", "2, 3, 4, 1, 1, 0",
  "big",   "harvesting", "CO2",          "low",    "2, 3, 4, 1, 1, 0",
  
  # --- Thinning ---
  "big",   "thinning",   "Production",   "high",   "5, 8, 0, 0",
  "big",   "thinning",   "Production",   "medium", "5, 8, 0, 0",
  "big",   "thinning",   "Production",   "low",    "5, 8, 0, 0",
  
  "big",   "thinning",   "Biodiversity", "high",   "1, 2, 1, 0",
  "big",   "thinning",   "Biodiversity", "medium", "1, 2, 1, 0",
  "big",   "thinning",   "Biodiversity", "low",    "1, 2, 1, 0",
  
  "big",   "thinning",   "CO2",          "high",   "1, 3, 1, 0",
  "big",   "thinning",   "CO2",          "medium", "1, 3, 1, 0",
  "big",   "thinning",   "CO2",          "low",    "1, 3, 1, 0",
  
  # --- Tending ---
  "big",   "tending",    "Production",   "high",   "9, 1",
  "big",   "tending",    "Production",   "medium", "9, 1",
  "big",   "tending",    "Production",   "low",    "9, 1",
  # (Repeat for Bio/CO2 if they are the same, or different)
  "big",   "tending",    "Biodiversity", "high",   "9, 1",
  "big",   "tending",    "Biodiversity", "medium", "9, 1",
  "big",   "tending",    "Biodiversity", "low",    "9, 1",
  "big",   "tending",    "CO2",          "high",   "9, 1",
  "big",   "tending",    "CO2",          "medium", "9, 1",
  "big",   "tending",    "CO2",          "low",    "9, 1",
  
  # --- Planting ---
  "big",   "planting",   "Production",   "high",   "10, 0",
  "big",   "planting",   "Production",   "medium", "10, 0",
  "big",   "planting",   "Production",   "low",    "10, 0",
  
  "big",   "planting",   "Biodiversity", "high",   "9, 1",
  "big",   "planting",   "Biodiversity", "medium", "9, 1",
  "big",   "planting",   "Biodiversity", "low",    "9, 1",
  
  "big",   "planting",   "CO2",          "high",   "9, 1",
  "big",   "planting",   "CO2",          "medium", "9, 1",
  "big",   "planting",   "CO2",          "low",    "9, 1",
  
  # ============================================================================
  # STATE FOREST
  # ============================================================================
  
  # --- Harvesting ---
  "state", "harvesting", "Production",   "high",   "4, 3, 0, 3, 2, 0",
  "state", "harvesting", "Production",   "medium", "4, 3, 0, 3, 2, 0",
  "state", "harvesting", "Production",   "low",    "4, 3, 0, 3, 2, 0",
  
  "state", "harvesting", "Biodiversity", "high",   "4, 4, 0, 4, 4, 0",
  "state", "harvesting", "Biodiversity", "medium", "4, 4, 0, 4, 4, 0",
  "state", "harvesting", "Biodiversity", "low",    "4, 4, 0, 4, 4, 0",
  
  "state", "harvesting", "CO2",          "high",   "5, 1, 0, 4, 4, 0",
  "state", "harvesting", "CO2",          "medium", "5, 1, 0, 4, 4, 0",
  "state", "harvesting", "CO2",          "low",    "5, 1, 0, 4, 4, 0",
  
  # --- Thinning ---
  "state", "thinning",   "Production",   "high",   "5, 3, 2, 0",
  "state", "thinning",   "Production",   "medium", "5, 3, 2, 0",
  "state", "thinning",   "Production",   "low",    "5, 3, 2, 0",
  
  "state", "thinning",   "Biodiversity", "high",   "5, 1, 4, 0",
  "state", "thinning",   "Biodiversity", "medium", "5, 1, 4, 0",
  "state", "thinning",   "Biodiversity", "low",    "5, 1, 4, 0",
  
  "state", "thinning",   "CO2",          "high",   "5, 1, 4, 0",
  "state", "thinning",   "CO2",          "medium", "5, 1, 4, 0",
  "state", "thinning",   "CO2",          "low",    "5, 1, 4, 0",
  
  # --- Tending (Simplified: all same) ---
  "state", "tending",    "Production",   "high",   "5, 5",
  "state", "tending",    "Production",   "medium", "5, 5",
  "state", "tending",    "Production",   "low",    "5, 5",
  "state", "tending",    "Biodiversity", "high",   "5, 5",
  "state", "tending",    "Biodiversity", "medium", "5, 5",
  "state", "tending",    "Biodiversity", "low",    "5, 5",
  "state", "tending",    "CO2",          "high",   "5, 5",
  "state", "tending",    "CO2",          "medium", "5, 5",
  "state", "tending",    "CO2",          "low",    "5, 5",
  
  # --- Planting ---
  "state", "planting",   "Production",   "high",   "10, 0",
  "state", "planting",   "Production",   "medium", "10, 0",
  "state", "planting",   "Production",   "low",    "10, 0",
  "state", "planting",   "Biodiversity", "high",   "10, 0",
  "state", "planting",   "Biodiversity", "medium", "10, 0",
  "state", "planting",   "Biodiversity", "low",    "10, 0",
  "state", "planting",   "CO2",          "high",   "10, 0",
  "state", "planting",   "CO2",          "medium", "10, 0",
  "state", "planting",   "CO2",          "low",    "10, 0",
  
  # ============================================================================
  # SMALL PRIVATE
  # ============================================================================
  
  # --- Harvesting ---
  "small", "harvesting", "Production",   "high",   "1, 4, 0, 8, 6, 0",
  "small", "harvesting", "Production",   "medium", "1, 5, 0, 8, 5, 0",
  "small", "harvesting", "Production",   "low",    "1, 4, 1, 8, 5, 0",
  
  "small", "harvesting", "Biodiversity", "high",   "2, 3, 0, 6, 4, 0",
  "small", "harvesting", "Biodiversity", "medium", "1, 3, 0, 6, 4, 0",
  "small", "harvesting", "Biodiversity", "low",    "1, 3, 0, 6, 4, 0",
  
  "small", "harvesting", "CO2",          "high",   "2, 2, 1, 8, 4, 8",
  "small", "harvesting", "CO2",          "medium", "2, 3, 2, 8, 6, 0",
  "small", "harvesting", "CO2",          "low",    "1, 3, 0, 8, 5, 0",
  
  # --- Thinning ---
  "small", "thinning",   "Production",   "high",   "2, 2, 0, 7",
  "small", "thinning",   "Production",   "medium", "3, 3, 0, 5",
  "small", "thinning",   "Production",   "low",    "3, 4, 0, 4",
  
  "small", "thinning",   "Biodiversity", "high",   "2, 1, 6, 8",
  "small", "thinning",   "Biodiversity", "medium", "2, 2, 6, 6",
  "small", "thinning",   "Biodiversity", "low",    "2, 3, 6, 5",
  
  "small", "thinning",   "CO2",          "high",   "2, 1, 1, 8",
  "small", "thinning",   "CO2",          "medium", "3, 2, 0, 6",
  "small", "thinning",   "CO2",          "low",    "3, 3, 0, 4",
  
  # --- Tending ---
  "small", "tending",    "Production",   "high",   "4, 6",
  "small", "tending",    "Production",   "medium", "4, 6",
  "small", "tending",    "Production",   "low",    "4, 6",
  "small", "tending",    "Biodiversity", "high",   "4, 6",
  "small", "tending",    "Biodiversity", "medium", "4, 6",
  "small", "tending",    "Biodiversity", "low",    "4, 6",
  "small", "tending",    "CO2",          "high",   "4, 6",
  "small", "tending",    "CO2",          "medium", "4, 6",
  "small", "tending",    "CO2",          "low",    "4, 6",
  
  # --- Planting ---
  "small", "planting",   "Production",   "high",   "3, 7",
  "small", "planting",   "Production",   "medium", "3, 7",
  "small", "planting",   "Production",   "low",    "3, 7",
  "small", "planting",   "Biodiversity", "high",   "3, 7",
  "small", "planting",   "Biodiversity", "medium", "3, 7",
  "small", "planting",   "Biodiversity", "low",    "3, 7",
  "small", "planting",   "CO2",          "high",   "3, 7",
  "small", "planting",   "CO2",          "medium", "3, 7",
  "small", "planting",   "CO2",          "low",    "3, 7"
)
