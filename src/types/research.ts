export interface AgribalyseItem {
  Code_AGB: string;
  Code_CIQUAL?: string;
  LCI_Name: string;
  Nom_du_Produit_en_Francais?: string;
  Nom_du_Produit_en_Français?: string;
  Groupe_aliment?: string;
  "Groupe_d'aliment"?: string;
  Sous_groupe_aliment?: string;
  "Sous-groupe_d'aliment"?: string;
  Score_unique_EF: number;
  Changement_climatique_kg_CO2eq?: number;
  Changement_climatique?: number;
  Eau_m3?: number;
  "Épuisement_des_ressources_eau"?: number;
  Sol_Pt?: number;
  Utilisation_du_sol?: number;
  Eutrophisation_terrestre: number;
  Acidification?: number;
  Acidification_terrestre_et_eaux_douces?: number;
}

export interface OFFProduct {
  code: string;
  name: string;
  brand: string;
  category: string;
  nutriscore_grade: string;
  nutriscore_score: number;
  ecoscore_grade: string;
  ecoscore_score: number;
  nova_group: number;
  primary_country?: string;
  countries?: string[];
  proteins_100g: number;
  energy_kcal_100g: number;
  fiber_100g: number;
  salt_100g: number;
  sugars_100g?: number;
  saturated_fat_100g?: number;
}

export interface EFSAFoodEx2Record {
  country_code: string;
  country_name: string;
  population_group: string;
  foodex2_code: string;
  foodex2_level1: string;
  foodex2_level2: string;
  nova_group: number;
  mean_intake_g_day: number;
  p95_intake_g_day: number;
  carbon_intensity_kg_co2_per_kg: number;
  daily_dietary_carbon_g_co2: number;
  daily_water_liters: number;
  land_use_pt_per_kg: number;
}

export interface EurostatCountryData {
  name: string;
  categories: Record<
    string,
    {
      label: string;
      series: Record<string, number>;
    }
  >;
}

export interface LiveResearchBundle {
  metadata: {
    generated_at: string;
    sources: string[];
  };
  agribalyse: AgribalyseItem[];
  agribalyse_count?: number;
  openfoodfacts: OFFProduct[];
  efsa_surveys?: EFSAFoodEx2Record[];
  openalex: Record<string, Record<string, number>>;
  eurostat: Record<string, EurostatCountryData>;
}

export interface CountryDietaryProfile {
  code: string;
  geoJsonName: string; // Matches world.geojson feature.properties.name
  name: string;
  region: 'Europe' | 'Global Benchmark';
  flag: string;
  eatLancetIndex: {
    redMeat: number;
    dairy: number;
    legumesNuts: number;
    wholeGrains: number;
    vegetablesFruits: number;
    ultraProcessedShare: number;
  };
  dailyCarbonKg: number;
  dailyWaterLiters: number;
  dailyLandM2: number;
  dailyBasketCostEur: number;
  sayDoGapScore: number;
  plantProteinSharePct: number;
}

export const COUNTRY_PROFILES: Record<string, CountryDietaryProfile> = {
  EU27_2020: {
    code: 'EU27_2020',
    geoJsonName: 'European Union',
    name: 'European Union (EU-27)',
    region: 'Europe',
    flag: '🇪🇺',
    eatLancetIndex: {
      redMeat: 285,
      dairy: 175,
      legumesNuts: 38,
      wholeGrains: 64,
      vegetablesFruits: 78,
      ultraProcessedShare: 31,
    },
    dailyCarbonKg: 4.85,
    dailyWaterLiters: 3120,
    dailyLandM2: 6.4,
    dailyBasketCostEur: 7.40,
    sayDoGapScore: 68,
    plantProteinSharePct: 39,
  },
  NL: {
    code: 'NL',
    geoJsonName: 'Netherlands',
    name: 'Netherlands',
    region: 'Europe',
    flag: '🇳🇱',
    eatLancetIndex: {
      redMeat: 295,
      dairy: 235,
      legumesNuts: 42,
      wholeGrains: 72,
      vegetablesFruits: 74,
      ultraProcessedShare: 37,
    },
    dailyCarbonKg: 5.15,
    dailyWaterLiters: 2980,
    dailyLandM2: 6.8,
    dailyBasketCostEur: 8.65,
    sayDoGapScore: 76,
    plantProteinSharePct: 41,
  },
  FR: {
    code: 'FR',
    geoJsonName: 'France',
    name: 'France',
    region: 'Europe',
    flag: '🇫🇷',
    eatLancetIndex: {
      redMeat: 310,
      dairy: 210,
      legumesNuts: 34,
      wholeGrains: 58,
      vegetablesFruits: 84,
      ultraProcessedShare: 31,
    },
    dailyCarbonKg: 5.30,
    dailyWaterLiters: 3340,
    dailyLandM2: 7.1,
    dailyBasketCostEur: 8.30,
    sayDoGapScore: 64,
    plantProteinSharePct: 37,
  },
  DE: {
    code: 'DE',
    geoJsonName: 'Germany',
    name: 'Germany',
    region: 'Europe',
    flag: '🇩🇪',
    eatLancetIndex: {
      redMeat: 305,
      dairy: 195,
      legumesNuts: 36,
      wholeGrains: 76,
      vegetablesFruits: 72,
      ultraProcessedShare: 39,
    },
    dailyCarbonKg: 5.05,
    dailyWaterLiters: 3050,
    dailyLandM2: 6.6,
    dailyBasketCostEur: 7.90,
    sayDoGapScore: 74,
    plantProteinSharePct: 40,
  },
  IT: {
    code: 'IT',
    geoJsonName: 'Italy',
    name: 'Italy',
    region: 'Europe',
    flag: '🇮🇹',
    eatLancetIndex: {
      redMeat: 240,
      dairy: 165,
      legumesNuts: 54,
      wholeGrains: 68,
      vegetablesFruits: 92,
      ultraProcessedShare: 18,
    },
    dailyCarbonKg: 4.45,
    dailyWaterLiters: 3410,
    dailyLandM2: 5.8,
    dailyBasketCostEur: 7.55,
    sayDoGapScore: 52,
    plantProteinSharePct: 45,
  },
  ES: {
    code: 'ES',
    geoJsonName: 'Spain',
    name: 'Spain',
    region: 'Europe',
    flag: '🇪🇸',
    eatLancetIndex: {
      redMeat: 275,
      dairy: 155,
      legumesNuts: 58,
      wholeGrains: 61,
      vegetablesFruits: 90,
      ultraProcessedShare: 22,
    },
    dailyCarbonKg: 4.65,
    dailyWaterLiters: 3520,
    dailyLandM2: 6.1,
    dailyBasketCostEur: 6.85,
    sayDoGapScore: 55,
    plantProteinSharePct: 44,
  },
  SE: {
    code: 'SE',
    geoJsonName: 'Sweden',
    name: 'Sweden',
    region: 'Europe',
    flag: '🇸🇪',
    eatLancetIndex: {
      redMeat: 265,
      dairy: 215,
      legumesNuts: 46,
      wholeGrains: 82,
      vegetablesFruits: 76,
      ultraProcessedShare: 41,
    },
    dailyCarbonKg: 4.90,
    dailyWaterLiters: 2890,
    dailyLandM2: 6.5,
    dailyBasketCostEur: 9.10,
    sayDoGapScore: 79,
    plantProteinSharePct: 42,
  },
  DK: {
    code: 'DK',
    geoJsonName: 'Denmark',
    name: 'Denmark',
    region: 'Europe',
    flag: '🇩🇰',
    eatLancetIndex: {
      redMeat: 290,
      dairy: 225,
      legumesNuts: 44,
      wholeGrains: 86,
      vegetablesFruits: 79,
      ultraProcessedShare: 36,
    },
    dailyCarbonKg: 5.10,
    dailyWaterLiters: 2940,
    dailyLandM2: 6.7,
    dailyBasketCostEur: 9.45,
    sayDoGapScore: 77,
    plantProteinSharePct: 41,
  },
  PL: {
    code: 'PL',
    geoJsonName: 'Poland',
    name: 'Poland',
    region: 'Europe',
    flag: '🇵🇱',
    eatLancetIndex: {
      redMeat: 315,
      dairy: 160,
      legumesNuts: 29,
      wholeGrains: 62,
      vegetablesFruits: 69,
      ultraProcessedShare: 28,
    },
    dailyCarbonKg: 4.95,
    dailyWaterLiters: 2850,
    dailyLandM2: 6.4,
    dailyBasketCostEur: 5.40,
    sayDoGapScore: 58,
    plantProteinSharePct: 36,
  },
  BE: {
    code: 'BE',
    geoJsonName: 'Belgium',
    name: 'Belgium',
    region: 'Europe',
    flag: '🇧🇪',
    eatLancetIndex: {
      redMeat: 295,
      dairy: 190,
      legumesNuts: 35,
      wholeGrains: 64,
      vegetablesFruits: 77,
      ultraProcessedShare: 35,
    },
    dailyCarbonKg: 5.00,
    dailyWaterLiters: 3110,
    dailyLandM2: 6.6,
    dailyBasketCostEur: 8.40,
    sayDoGapScore: 70,
    plantProteinSharePct: 38,
  },
  AT: {
    code: 'AT',
    geoJsonName: 'Austria',
    name: 'Austria',
    region: 'Europe',
    flag: '🇦🇹',
    eatLancetIndex: {
      redMeat: 300,
      dairy: 205,
      legumesNuts: 36,
      wholeGrains: 70,
      vegetablesFruits: 76,
      ultraProcessedShare: 33,
    },
    dailyCarbonKg: 5.08,
    dailyWaterLiters: 3080,
    dailyLandM2: 6.7,
    dailyBasketCostEur: 8.50,
    sayDoGapScore: 71,
    plantProteinSharePct: 38,
  },
  FI: {
    code: 'FI',
    geoJsonName: 'Finland',
    name: 'Finland',
    region: 'Europe',
    flag: '🇫🇮',
    eatLancetIndex: {
      redMeat: 270,
      dairy: 240,
      legumesNuts: 40,
      wholeGrains: 84,
      vegetablesFruits: 73,
      ultraProcessedShare: 38,
    },
    dailyCarbonKg: 4.95,
    dailyWaterLiters: 2880,
    dailyLandM2: 6.4,
    dailyBasketCostEur: 8.95,
    sayDoGapScore: 75,
    plantProteinSharePct: 40,
  },
  PT: {
    code: 'PT',
    geoJsonName: 'Portugal',
    name: 'Portugal',
    region: 'Europe',
    flag: '🇵🇹',
    eatLancetIndex: {
      redMeat: 265,
      dairy: 160,
      legumesNuts: 56,
      wholeGrains: 62,
      vegetablesFruits: 88,
      ultraProcessedShare: 24,
    },
    dailyCarbonKg: 4.70,
    dailyWaterLiters: 3390,
    dailyLandM2: 6.0,
    dailyBasketCostEur: 6.45,
    sayDoGapScore: 54,
    plantProteinSharePct: 43,
  },
  GR: {
    code: 'GR',
    geoJsonName: 'Greece',
    name: 'Greece',
    region: 'Europe',
    flag: '🇬🇷',
    eatLancetIndex: {
      redMeat: 250,
      dairy: 185,
      legumesNuts: 60,
      wholeGrains: 64,
      vegetablesFruits: 94,
      ultraProcessedShare: 21,
    },
    dailyCarbonKg: 4.55,
    dailyWaterLiters: 3480,
    dailyLandM2: 5.9,
    dailyBasketCostEur: 6.60,
    sayDoGapScore: 51,
    plantProteinSharePct: 45,
  },
  IE: {
    code: 'IE',
    geoJsonName: 'Ireland',
    name: 'Ireland',
    region: 'Europe',
    flag: '🇮🇪',
    eatLancetIndex: {
      redMeat: 325,
      dairy: 225,
      legumesNuts: 33,
      wholeGrains: 66,
      vegetablesFruits: 71,
      ultraProcessedShare: 44,
    },
    dailyCarbonKg: 5.45,
    dailyWaterLiters: 3150,
    dailyLandM2: 7.3,
    dailyBasketCostEur: 9.15,
    sayDoGapScore: 73,
    plantProteinSharePct: 36,
  },
  CZ: {
    code: 'CZ',
    geoJsonName: 'Czech Republic',
    name: 'Czechia',
    region: 'Europe',
    flag: '🇨🇿',
    eatLancetIndex: {
      redMeat: 320,
      dairy: 175,
      legumesNuts: 28,
      wholeGrains: 60,
      vegetablesFruits: 66,
      ultraProcessedShare: 30,
    },
    dailyCarbonKg: 5.12,
    dailyWaterLiters: 2910,
    dailyLandM2: 6.6,
    dailyBasketCostEur: 5.95,
    sayDoGapScore: 60,
    plantProteinSharePct: 35,
  },
  RO: {
    code: 'RO',
    geoJsonName: 'Romania',
    name: 'Romania',
    region: 'Europe',
    flag: '🇷🇴',
    eatLancetIndex: {
      redMeat: 280,
      dairy: 165,
      legumesNuts: 38,
      wholeGrains: 65,
      vegetablesFruits: 75,
      ultraProcessedShare: 23,
    },
    dailyCarbonKg: 4.60,
    dailyWaterLiters: 2820,
    dailyLandM2: 6.0,
    dailyBasketCostEur: 4.90,
    sayDoGapScore: 49,
    plantProteinSharePct: 41,
  },
  GBR: {
    code: 'GBR',
    geoJsonName: 'England',
    name: 'United Kingdom',
    region: 'Europe',
    flag: '🇬🇧',
    eatLancetIndex: {
      redMeat: 290,
      dairy: 200,
      legumesNuts: 39,
      wholeGrains: 68,
      vegetablesFruits: 72,
      ultraProcessedShare: 51,
    },
    dailyCarbonKg: 5.10,
    dailyWaterLiters: 3090,
    dailyLandM2: 6.7,
    dailyBasketCostEur: 8.20,
    sayDoGapScore: 78,
    plantProteinSharePct: 39,
  },
  NOR: {
    code: 'NOR',
    geoJsonName: 'Norway',
    name: 'Norway',
    region: 'Europe',
    flag: '🇳🇴',
    eatLancetIndex: {
      redMeat: 275,
      dairy: 220,
      legumesNuts: 42,
      wholeGrains: 83,
      vegetablesFruits: 75,
      ultraProcessedShare: 42,
    },
    dailyCarbonKg: 5.00,
    dailyWaterLiters: 2920,
    dailyLandM2: 6.5,
    dailyBasketCostEur: 10.40,
    sayDoGapScore: 77,
    plantProteinSharePct: 40,
  },
  CHE: {
    code: 'CHE',
    geoJsonName: 'Switzerland',
    name: 'Switzerland',
    region: 'Europe',
    flag: '🇨🇭',
    eatLancetIndex: {
      redMeat: 285,
      dairy: 230,
      legumesNuts: 41,
      wholeGrains: 74,
      vegetablesFruits: 81,
      ultraProcessedShare: 34,
    },
    dailyCarbonKg: 5.15,
    dailyWaterLiters: 3180,
    dailyLandM2: 6.8,
    dailyBasketCostEur: 11.20,
    sayDoGapScore: 74,
    plantProteinSharePct: 40,
  },
  USA: {
    code: 'USA',
    geoJsonName: 'USA',
    name: 'United States',
    region: 'Global Benchmark',
    flag: '🇺🇸',
    eatLancetIndex: {
      redMeat: 395,
      dairy: 210,
      legumesNuts: 31,
      wholeGrains: 42,
      vegetablesFruits: 59,
      ultraProcessedShare: 58,
    },
    dailyCarbonKg: 6.75,
    dailyWaterLiters: 3980,
    dailyLandM2: 9.4,
    dailyBasketCostEur: 9.80,
    sayDoGapScore: 81,
    plantProteinSharePct: 32,
  },
  JPN: {
    code: 'JPN',
    geoJsonName: 'Japan',
    name: 'Japan',
    region: 'Global Benchmark',
    flag: '🇯🇵',
    eatLancetIndex: {
      redMeat: 155,
      dairy: 85,
      legumesNuts: 88,
      wholeGrains: 74,
      vegetablesFruits: 82,
      ultraProcessedShare: 26,
    },
    dailyCarbonKg: 3.60,
    dailyWaterLiters: 2640,
    dailyLandM2: 4.3,
    dailyBasketCostEur: 7.20,
    sayDoGapScore: 41,
    plantProteinSharePct: 54,
  },
  BRA: {
    code: 'BRA',
    geoJsonName: 'Brazil',
    name: 'Brazil',
    region: 'Global Benchmark',
    flag: '🇧🇷',
    eatLancetIndex: {
      redMeat: 365,
      dairy: 145,
      legumesNuts: 92,
      wholeGrains: 58,
      vegetablesFruits: 68,
      ultraProcessedShare: 29,
    },
    dailyCarbonKg: 6.10,
    dailyWaterLiters: 3650,
    dailyLandM2: 8.6,
    dailyBasketCostEur: 4.85,
    sayDoGapScore: 56,
    plantProteinSharePct: 42,
  },
  CAN: {
    code: 'CAN',
    geoJsonName: 'Canada',
    name: 'Canada',
    region: 'Global Benchmark',
    flag: '🇨🇦',
    eatLancetIndex: {
      redMeat: 350,
      dairy: 195,
      legumesNuts: 38,
      wholeGrains: 54,
      vegetablesFruits: 66,
      ultraProcessedShare: 49,
    },
    dailyCarbonKg: 6.15,
    dailyWaterLiters: 3690,
    dailyLandM2: 8.5,
    dailyBasketCostEur: 9.10,
    sayDoGapScore: 76,
    plantProteinSharePct: 35,
  },
  AUS: {
    code: 'AUS',
    geoJsonName: 'Australia',
    name: 'Australia',
    region: 'Global Benchmark',
    flag: '🇦🇺',
    eatLancetIndex: {
      redMeat: 375,
      dairy: 205,
      legumesNuts: 36,
      wholeGrains: 58,
      vegetablesFruits: 70,
      ultraProcessedShare: 46,
    },
    dailyCarbonKg: 6.40,
    dailyWaterLiters: 3780,
    dailyLandM2: 8.9,
    dailyBasketCostEur: 9.35,
    sayDoGapScore: 75,
    plantProteinSharePct: 34,
  },
};

export interface CustomBasketItem {
  id: string;
  foodName: string;
  foodEx2Category: string;
  gramsPerDay: number;
  novaGroup: number;
  carbonPerKg: number;      // kg CO2eq / kg
  waterM3PerKg: number;     // m3 / kg
  landPtPerKg: number;      // Pt / kg
  kcalPer100g: number;
  proteinPer100g: number;
  costEurPerKg: number;
}
