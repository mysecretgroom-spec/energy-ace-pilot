import { describe, it, expect } from "vitest";
import {
  calculerMensualiteAvecReport,
  calculerFinancementAvantApresAides,
} from "./financingCalculation";

/**
 * Règle métier : le calcul de rentabilité (bilan mensuel / transfert de charge)
 * doit toujours se faire sur la MENSUALITÉ AVANT AIDES (financement du montant
 * total hors aides), jamais sur la mensualité aides déduites, même lorsqu'une
 * mensualité après aides manuelle est saisie.
 */
const params = {
  tauxEffectifAnnuel: 5.9,
  dureeMois: 180,
  dureeReportMois: 6,
};

describe("Renta sur mensualité avant aides", () => {
  it("la mensualité avant aides porte sur le montant total hors aides", () => {
    const montantHorsAides = 20000;
    const aides = 8000;
    const resteACharge = montantHorsAides - aides;

    const avant = calculerMensualiteAvecReport({ montantTTC: montantHorsAides, ...params });
    const apres = calculerMensualiteAvecReport({ montantTTC: resteACharge, ...params });

    expect(avant.mensualiteAmortissement).toBeGreaterThan(apres.mensualiteAmortissement);
  });

  it("le bilan de renta compare les gains à la mensualité avant aides", () => {
    const gainsMensuels = 180;
    const { avantAides, apresAides } = calculerFinancementAvantApresAides(20000, 12000, params);

    const bilanAvantAides = gainsMensuels - avantAides.mensualiteAmortissement;
    const bilanSiApresAides = gainsMensuels - apresAides.mensualiteAmortissement;

    // La renta ne doit PAS être gonflée par les aides : elle est plus basse
    // calculée sur la mensualité avant aides qu'avec la mensualité après aides.
    expect(bilanAvantAides).toBeLessThan(bilanSiApresAides);
  });

  it("les deux mensualités sont calculées séparément (avant / après aides)", () => {
    const { avantAides, apresAides } = calculerFinancementAvantApresAides(24000, 9000, params);

    expect(avantAides.mensualiteAmortissement).toBeGreaterThan(0);
    expect(apresAides.mensualiteAmortissement).toBeGreaterThan(0);
    expect(apresAides.mensualiteAmortissement).toBeLessThan(avantAides.mensualiteAmortissement);
  });
});
