# Define Agent Traits in a Master Table
trait_data <- tribble(
  ~owner,  ~pref_prod, ~pref_bio, ~pref_co2, ~res_alpha, ~res_beta, ~risk_alpha, ~risk_beta,
  "state", 3,         8,        5,        8,         3,         2,          8,
  "big",   8,         2,        3,        9,         2,         6,          4,
  "small", 4,         4,        2,        3,         6,         1,          9
) %>%
  # Helper columns for the ODD table
  mutate(
    vector_str = paste(pref_prod, pref_bio, pref_co2, sep="/"),
    res_str = paste(res_alpha, res_beta, sep="/"),
    risk_str = paste(risk_alpha, risk_beta, sep="/")
  )