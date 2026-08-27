export type AnimalType =
  | 'dog_small'    // hond < 8kg
  | 'dog_large'    // hond > 8kg
  | 'cat'
  | 'rabbit'
  | 'bird'
  | 'reptile'
  | 'other'
  | 'horse';   // paard → doorverwijzing specialist

export type CabinResult = 'cabin' | 'hold' | 'not_allowed' | 'unknown';

export interface PetRule {
  airlineIata: string;        // bijv. 'TG'
  animalTypes: AnimalType[];
  cabinAllowed: boolean;
  holdAllowed: boolean;
  maxWeightCabin?: number;    // kg incl. drager
  maxWeightHold?: number;
  brachycephalicBanned: boolean;
  requirements: string[];
  warnings: string[];
  lastVerified: string;       // 'YYYY-MM-DD'
  sourceUrl: string;
  microchipRequired?: boolean;
  vaccinesRequired?: string[];
  quarantineDays?: number;
}

export interface PetCheckResult {
  allowed: CabinResult;
  airlineName: string;
  flightNumber: string;
  animal: AnimalType;
  requirements: string[];
  warnings: string[];
  lastVerified: string;
  sourceUrl: string;
}
