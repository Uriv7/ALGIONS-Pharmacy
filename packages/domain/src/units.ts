/**
 * ALGIONS Pharmacy - Pack and Unit Conversion Model (strip/tablet conversions)
 * Handles fractional sales, loose tablets, and full packs.
 */

export interface PackConversionResult {
  fullPacks: number;
  looseUnits: number;
  totalLooseUnits: number;
}

export function packToLoose(packs: number, unitsPerPack: number): number {
  if (unitsPerPack <= 0) throw new Error('unitsPerPack must be positive');
  return Math.round(packs * unitsPerPack);
}

export function looseToPack(looseUnits: number, unitsPerPack: number): PackConversionResult {
  if (unitsPerPack <= 0) throw new Error('unitsPerPack must be positive');
  const fullPacks = Math.floor(looseUnits / unitsPerPack);
  const remainderLoose = looseUnits % unitsPerPack;
  return {
    fullPacks,
    looseUnits: remainderLoose,
    totalLooseUnits: looseUnits,
  };
}

export function formatPackQuantity(totalLooseUnits: number, unitsPerPack: number, packLabel = 'Strip', unitLabel = 'Tab'): string {
  if (unitsPerPack <= 1) {
    return `${totalLooseUnits} ${unitLabel}${totalLooseUnits !== 1 ? 's' : ''}`;
  }
  const { fullPacks, looseUnits } = looseToPack(totalLooseUnits, unitsPerPack);
  if (fullPacks === 0) {
    return `${looseUnits} ${unitLabel}${looseUnits !== 1 ? 's' : ''}`;
  }
  if (looseUnits === 0) {
    return `${fullPacks} ${packLabel}${fullPacks !== 1 ? 's' : ''}`;
  }
  return `${fullPacks} ${packLabel}${fullPacks !== 1 ? 's' : ''} ${looseUnits} ${unitLabel}${looseUnits !== 1 ? 's' : ''}`;
}

export function calculateLooseUnitPricePaise(packPricePaise: number, unitsPerPack: number): number {
  if (unitsPerPack <= 0) throw new Error('unitsPerPack must be positive');
  // Precision division: round half up to nearest paise
  return Math.round(packPricePaise / unitsPerPack);
}
