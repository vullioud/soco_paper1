# Set working directory to source file location 
setwd(dirname(rstudioapi::getActiveDocumentContext()$path))

# library
library(ggplot2)
library(dplyr)

# load data
file_list <- list.files("SVD_wind/", full.names = TRUE)

NYears <- 200
scaling.factor.mean <- 0.3
scaling.factor.sd <- 3 # not needed anymore

# set seed for reproducability
set.seed(42)

# Decide for cluster ---------------------
cluster <- 12

# get cluster size data 
cluster.size <- read.csv("cluster_size.csv")

# Day of Year -------------------------
MeanDay <- 340  # Day of the year with highest probability
sdDay <- 50
hist(round(rnorm(200000, mean=MeanDay, sd=sdDay)) %% 366, breaks=730)

dayOfYear <- round(rnorm(NYears, mean=MeanDay, sd=sdDay)) %% 366


# Wind speeds ---------------------------
# helper function
draw_wind_speed <- function(n, scaling.factor.sd, cluster_ID) {
  if (n == 0) {
    speed <- 0
    return(speed)
  } else {
    tmp.data <- dplyr::filter(wind.data, cluster_id == cluster_ID)
    speeds <- rnorm(n, mean(tmp.data$mean_wind_speed), scaling.factor.sd * sd(tmp.data$mean_wind_speed))
    speed <- max(speeds)
    return(speed)
  }
}

draw_wind_speed2 <- function(n, distribution) {
  if (n == 0) {
    speed <- 0
    return(speed)
  } else {
    speed <- sample(distribution, 1)
    return(speed)
  }
}

# load data
wind.data <- data.frame()
for(i in 1:length(file_list)) {
  new.data <- cbind(read.csv(file_list[i]), Run = i)
  
  wind.data <- rbind(wind.data, new.data)
}


# check for normality
hist(wind.data$mean_wind_speed, breaks=30, freq=FALSE)
lines(cbind((1:10000)/100, dnorm((1:10000)/100, mean(wind.data$mean_wind_speed), sd(wind.data$mean_wind_speed))))


ggplot(wind.data, aes(x=mean_wind_speed, fill=as.factor(cluster_id)))+
  geom_histogram(alpha=0.6)+
  facet_wrap(~cluster_id, scales="free")+
  theme_bw()


# calculate frequency of extreme Events assuming 100 years in each sample
frequency <- wind.data %>%
  dplyr::left_join(cluster.size) %>%
  dplyr::mutate(prop.affected = number_of_cells/n_10km_cells ) %>% 
  dplyr::group_by(Run, year, cluster_id) %>%
  dplyr::summarise( prop.in.year = sum(prop.affected) ) %>%
  dplyr::group_by(Run, cluster_id) %>%
  dplyr::summarise( freq = sum(prop.in.year)/100 ) %>% # 100 years in sample 
  dplyr::group_by(cluster_id) %>%
  dplyr::summarise(freq.mean = mean(freq),
                   freq.sd = sd(freq))

# Pick frequency for cluster
cl.frequency <- dplyr::filter(frequency, cluster_id == cluster)$freq.mean

# draw wind events from poisson distribution
cl.nEvents <- rpois(NYears, cl.frequency) 


# find fitting log normal distribution
obs.speeds <- wind.data %>%
  dplyr::group_by(cluster_id) %>%
  dplyr::summarise(minSpeed = min(mean_wind_speed),
                   meanSpeed = mean(mean_wind_speed))

obs.speed <- dplyr::filter(obs.speeds, cluster_id == cluster)$meanSpeed

N.draws <- 100000
set.seed(42)
dist <- rlnorm(N.draws, 2.4, 0.4)
hist(dist, breaks=100)
mean(dist)
sum(dist>obs.speed)/N.draws

speeds <- dist[dist>obs.speed]


# create wind speed distribution
obs.speeds <- wind.data %>%
  dplyr::group_by(cluster_id) %>%
  dplyr::summarise(minSpeed = min(mean_wind_speed),
                   meanSpeed = mean(mean_wind_speed))



# draw wind speeds for each wind event
cl.windspeeds <- apply(as.matrix(cl.nEvents), 1, draw_wind_speed2, speeds)
cl.windspeeds <- cl.windspeeds * scaling.factor.mean
hist(cl.windspeeds[cl.windspeeds>0])
# Wind direction --------------------------
MainDirection <- 240
sdDirection <- 60
hist(round(rnorm(200000, mean=MainDirection, sd=sdDirection)) %% 360, breaks=720)

windDirection  <- round(rnorm(NYears, mean=MainDirection, sd=sdDirection)) %% 360

# Export data -----------------------------
winds <- cbind(year = 1:NYears, 
      modules.wind.dayOfYear = dayOfYear,
      modules.wind.speed = cl.windspeeds,
      modules.wind.direction = windDirection)

write.table(winds, file="../scripts/wind_Events.txt", row.names = FALSE, col.names = TRUE, quote=FALSE)


# Loop over each cluster and do some replicates --------------

# N years
NYears <- 200

# Day of Year for wind event
MeanDay <- 340  # Day of the year with highest probability
sdDay <- 50

# Wind direction
MainDirection <- 240
sdDirection <- 60

clusters <- unique(wind.data$cluster_id)
replicas <- 1:10
scaling.factor.mean <- 0.7

for (cl in clusters) {
  cl.frequency <- dplyr::filter(frequency, cluster_id == cl)$freq.mean
  
  for (repl in replicas) {
    # set seed 
    set.seed(cl*100+repl)
    
    # draw day of Year
    dayOfYear <- round(rnorm(NYears, mean=MeanDay, sd=sdDay)) %% 366
    
    # draw wind events from poisson distribution
    cl.nEvents <- rpois(NYears, cl.frequency) 
    
    # draw wind direction
    windDirection  <- round(rnorm(NYears, mean=MainDirection, sd=sdDirection)) %% 360
    
    # create wind speed distribution
    cl.speed <- dplyr::filter(obs.speeds, cluster_id == cl)$meanSpeed
    
    N.draws <- 100000
    dist <- rlnorm(N.draws, 2.4, 0.4)
    speeds <- dist[dist>cl.speed]
    
    # draw wind speeds for each wind event without scaling
    cl.windspeeds <- apply(as.matrix(cl.nEvents), 1, draw_wind_speed2, speeds)
    
    # Export data
    winds <- cbind(year = 1:NYears, 
                   modules.wind.dayOfYear = dayOfYear,
                   modules.wind.speed = cl.windspeeds,
                   modules.wind.direction = windDirection)
    
    write.table(winds, file=paste0("../scripts/wind_Events/cl", cl, "_repl", repl, ".txt"), row.names = FALSE, col.names = TRUE, quote=FALSE)
    
    # draw wind speeds for each wind event without scaling
    cl.windspeeds <- cl.windspeeds * scaling.factor.mean
    
    # Export data
    winds <- cbind(year = 1:NYears, 
                   modules.wind.dayOfYear = dayOfYear,
                   modules.wind.speed = cl.windspeeds,
                   modules.wind.direction = windDirection)
    
    write.table(winds, file=paste0("../scripts/wind_Events/Scaled_cl", cl, "_repl", repl, ".txt"), row.names = FALSE, col.names = TRUE, quote=FALSE)
  }
}
