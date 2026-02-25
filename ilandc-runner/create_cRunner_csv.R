# Set working directory to source file location 
setwd(dirname(rstudioapi::getActiveDocumentContext()$path))

# library
library(dplyr)


# Generel simulation options ---------
Simulation.Years <- 80
Replics <- 5


# define scenarios -------------------
Clusters <- c(2,3,4,5,6,7,8,10,11,12,13,14)
Climate.Models <- c("ICHEC-EC-EARTH", "MPI-M-MPI-ESM-LR", "NCC-NorESM1-M")
Climate.Scenarios <- c("historical", "rcp26", "rcp45", "rcp85")
Structure.Types <- c("low-structure", "medium-structure", "high-structure")
Target.Species <- c("No", "IST", "PNV-hist", "Productive", "PNV-45")
Replicates <- 1:Replics

scenarios <- expand.grid(
  Cluster = Clusters,
  Climate.Model = Climate.Models,
  Climate.Scenario = Climate.Scenarios,
  Structure.Type = Structure.Types,
  Target.Specie = Target.Species,
  Replicate = Replicates
) %>%
  rbind(
    expand.grid(
      Cluster = Clusters,
      Climate.Model = Climate.Models,
      Climate.Scenario = Climate.Scenarios,
      Structure.Type = "no-mgmt",
      Target.Specie = "No",
      Replicate = Replicates
    )
  )


# add climate points -------------------
climate.points <- read.csv("F:/Projects/FutureForest/FF_main/04_work/jonas/svd_training_data/code_other/data_barkbeetle_avg_climate.csv")

# rename columns
climate.points <- climate.points %>%
  dplyr::rename(Cluster = cluster_id,
                Climate.Model = climate_model,
                system.database.climate = sqlite_file,
                modules.barkbeetle.referenceClimate.tableName = barkbeetle.referenceClimate.tableName,
                modules.barkbeetle.referenceClimate.seasonalPrecipSum = barkbeetle.referenceClimate.seasonalPrecipSum,
                modules.barkbeetle.referenceClimate.seasonalTemperatureAverage = barkbeetle.referenceClimate.seasonalTemperatureAverage)

# combine scenarios and climate points 
scenarios <- scenarios %>% dplyr::left_join(climate.points)


# add columns needed ------------------

scenarios <- scenarios %>%
  dplyr::mutate(project_file = dplyr::case_when(Climate.Scenario == "historical" ~ "historical.xml",
                                                Climate.Scenario %in% c("rcp26", "rcp45", "rcp85") ~ "climate_rcp.xml",
                                                TRUE ~ "Error"),
                sim_years = Simulation.Years,
                user.Scenario = paste(paste0("Cluster-", Cluster), 
                                      Climate.Model, 
                                      Climate.Scenario, 
                                      paste0("Structure-", Structure.Type), 
                                      paste0("Species-", Target.Specie), 
                                      paste0("Repl-", Replicate), sep="_"),
                output_sqlite = paste0(user.Scenario, ".sqlite"),
                system.logging.logFile = paste0("log/", user.Scenario, ".txt"),
                model.world.environmentFile = paste(paste0("init/env_file_CLUSTER", sprintf("%02d", Cluster)), paste0("REPL", Replicate), Climate.Model, paste0(Climate.Scenario, ".csv"), sep="_"),
                model.world.environmentGrid = paste(paste0("init/env_grid_CLUSTER", sprintf("%02d", Cluster)), paste0("REPL", Replicate, ".asc"), sep="_"),
                model.world.standGrid.fileName = model.world.environmentGrid,
                model.world.timeEventsFile = paste0("wind_Events/Scaled_cl", Cluster, "_repl", Replicate, ".txt"),
                model.initialization.file = paste0("trees_CLUSTER", sprintf("%02d", Cluster), ".csv"),
                model.initialization.saplingFile = paste0("saplings_CLUSTER", sprintf("%02d", Cluster), ".csv"),
                model.management.abe.agentDataFile = paste0("abe/CLUSTER", sprintf("%02d", Cluster), "_", Structure.Type, "_", Target.Specie, ".csv"),
                modules.wind.topoGridFile = paste0("gis/WindModifier_cl", Cluster, ".asc")
  )


# write scenarios ----------------------
scenarios %>%
  dplyr::select(project_file, 
                sim_years,
                output_sqlite,
                system.database.climate,
                system.logging.logFile,
                model.world.environmentFile,
                model.world.environmentGrid,
                model.world.standGrid.fileName,
                model.world.timeEventsFile,
                model.initialization.file,
                model.initialization.saplingFile,
                model.management.abe.agentDataFile,
                modules.wind.topoGridFile,
                modules.barkbeetle.referenceClimate.tableName,
                modules.barkbeetle.referenceClimate.seasonalPrecipSum,
                modules.barkbeetle.referenceClimate.seasonalTemperatureAverage,
                user.Scenario) %>% 
  write.table(file="../cRunner.csv", sep=";", row.names = FALSE, col.names = TRUE)



#### IGNORE ####

# Write ABE files -------------------------------------
Mgmt.Scenarios <- scenarios %>%
  dplyr::select(Structure.Type, Target.Specie) %>%
  dplyr::distinct()

# load stand grid
cl <- 10
stand.grid <- terra::rast(paste0("../init/env_grid_CLUSTER", cl, "_REPL1.asc"))
Stand.IDs <- sort(unique(terra::values(stand.grid)))

for (i in 1:nrow(Mgmt.Scenarios)){
  tmp.structure <- as.character(Mgmt.Scenarios[i,1])
  tmp.specie <- as.character(Mgmt.Scenarios[i,2])
  
  # trees
  tree.file.path <- paste0("../init/trees_CLUSTER", cl, ".csv")
  tree.file <- read.csv(tree.file.path)
  
  # write Abe stand files
  abe.data <- tree.file %>% 
    as.data.frame() %>%
    dplyr::mutate(basalarea = ((dbh_to + dbh_from)/2/200)**2*pi) %>%
    dplyr::group_by(stand_id, species) %>%
    dplyr::summarise(BA = sum(basalarea*count)) %>%
    dplyr::group_by(stand_id) %>%
    dplyr::filter(BA == max(BA)) %>%
    dplyr::mutate(isConifer = species %in% c("piab", "abal", "lade", "pisy", "psme", "pini", "pice", "pimu"),
                  U = dplyr::case_when(species == "piab" ~ 80,
                                       species == "abal" ~ 80,
                                       species == "lade" ~ 100,
                                       species == "pisy" ~ 100,
                                       species == "fasy" ~ 140,
                                       species == "quro" ~ 160,
                                       species == "acps" ~ 140,
                                       species == "frex" ~ 140,
                                       species == "cabe" ~ 140,
                                       species == "bepe" ~ 100,
                                       species == "alin" ~ 100,
                                       species == "qupe" ~ 160,
                                       species == "psme" ~ 80,
                                       species == "algl" ~ 100,
                                       species == "casa" ~ 100,
                                       species == "pini" ~ 80,
                                       species == "acca" ~ 140,
                                       species == "acpl" ~ 140,
                                       species == "qupu" ~ 160,
                                       species == "pice" ~ 120,
                                       species == "soau" ~ 100,
                                       species == "soar" ~ 100,
                                       species == "coav" ~ 100,
                                       species == "alvi" ~ 100,
                                       species == "potr" ~ 100,
                                       species == "poni" ~ 100,
                                       species == "tico" ~ 140,
                                       species == "tipl" ~ 140,
                                       species == "ulgl" ~ 100,
                                       species == "saca" ~ 100,
                                       species == "rops" ~ 100,
                                       species == "pimu" ~ 180),
                  nTrees = dplyr::case_when(species == "piab" ~ 120, # Waldbaukonzept_NRW
                                            species == "abal" ~ 100, # Baden-Württemberg
                                            species == "lade" ~ 100, # NRW
                                            species == "pisy" ~ 110, # Hessen
                                            species == "fasy" ~ 80, # NRW
                                            species == "quro" ~ 80, # NRW
                                            species == "qupu" ~ 80, # NRW
                                            species == "qupe" ~ 80, # NRW
                                            species == "psme" ~ 100, # NRW
                                            TRUE ~ 80),
                  nCompetitors = dplyr::case_when(species == "piab" ~ 10,
                                            species == "abal" ~ 10,
                                            species == "lade" ~ 12,
                                            species == "pisy" ~ 12,
                                            species == "fasy" ~ 14,
                                            species == "quro" ~ 8,
                                            species == "qupe" ~ 8,
                                            species == "qupu" ~ 8,
                                            species == "psme" ~ 12,
                                            TRUE ~ 8)) %>%
    dplyr::select(-BA) %>%
    dplyr::rename(id=stand_id) %>%
    dplyr::arrange(id)
  
  if (tmp.specie == "No") {
    if (tmp.structure == "low-structure") {
      tmpAbe <- abe.data %>%
        dplyr::mutate(stp=paste(ifelse(isConifer, "low-structure1", "low-structure2"), tmp.specie, sep="_")) %>%
        dplyr::select(id, stp, U)
    } else {
      tmpAbe <- abe.data %>%
        dplyr::mutate(stp=paste(tmp.structure, tmp.specie, sep="_")) %>%
        dplyr::select(id, stp, U)
    }
  } else {
    if (tmp.structure == "low-structure") {
      tmpAbe <- abe.data %>%
        dplyr::mutate(stp=paste(ifelse(isConifer, "low-structure1", "low-structure2"), "SC", sep="_"),
                      targetSpecies = tmp.specie) %>%
        dplyr::select(id, stp, targetSpecies, U)
    } else {
      tmpAbe <- abe.data %>%
        dplyr::mutate(stp=paste(tmp.structure, "SC", sep="_"),
                      targetSpecies = tmp.specie) %>%
        dplyr::select(id, stp, targetSpecies, U)
    }
  }
  write.table(tmpAbe, paste0("../abe/stand_files/Cluster", sprintf("%02d", cl), "_", tmp.structure, "_", tmp.specie, ".csv"), 
              quote=FALSE, sep=",", row.names=FALSE)
}