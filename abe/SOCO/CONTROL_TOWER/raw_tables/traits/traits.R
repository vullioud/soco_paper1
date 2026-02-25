# Define Agent Traits by Behavioral Type (Paper 1 - Sotirov Types)
# type | pref_prod | pref_bio | pref_co2 | pref_nomgmt | res_alpha | res_beta | adhere_alpha | adhere_beta | risk_alpha | risk_beta
trait_data <- tribble(
  ~type, ~pref_prod, ~pref_bio, ~pref_co2, ~pref_nomgmt, ~res_alpha, ~res_beta, ~adhere_alpha, ~adhere_beta, ~risk_alpha, ~risk_beta,
  "MF",  3,          6,         5,         0.5,           8,          3,          9,              1,            2,           8,
  "OP",  8,          1,         3,         0.5,           9,          2,          4,              6,            6,           4,
  "TR",  3,          4,         2,         2,             3,          6,          3,              7,            1,           9,
  "PA",  1,          2,         1,         8,             1,          9,          1,              9,            1,           9,
  "EN",  1,          9,         3,         5,             4,          5,          6,              4,            6,           4
) %>%
  mutate(
    vector_str = paste(pref_prod, pref_bio, pref_co2, pref_nomgmt, sep="/"),
    res_str = paste(res_alpha, res_beta, sep="/"),
    adhere_str = paste(adhere_alpha, adhere_beta, sep="/"),
    risk_str = paste(risk_alpha, risk_beta, sep="/")
  )
