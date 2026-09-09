/**
 * Filtres SVG de réfraction pour l'effet "Liquid Glass" (style Apple).
 * Inspiré de liquid-glass-react : une turbulence douce déplace le contenu
 * situé DERRIÈRE l'élément, ce qui produit la distorsion optique du verre.
 */
export const GlassFilterDefs = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
  >
    <defs>
      {/* Distorsion marquée : boutons, barres, éléments interactifs */}
      <filter id="lg-liquid" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="3" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      {/* Distorsion subtile : grandes surfaces (cartes, modales, feuilles) */}
      <filter id="lg-liquid-soft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.005 0.009" numOctaves="2" seed="3" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="4" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="14" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);

export default GlassFilterDefs;
