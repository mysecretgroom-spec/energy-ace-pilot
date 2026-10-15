import videoAsset from "@/assets/debalepro-video-v8.asset.json";

const PresentationVideo = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            DébalePro — Avant / Après
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Découvrez en 1 min 20 comment DébalePro transforme le quotidien d'un
            commercial terrain : planning intelligent avec distances et itinéraires,
            études automatisées avec sélection de toiture sur satellite, rapport de
            signature WhatsApp envoyé en sortant du RDV, suivi des commissions et des
            frais, et un agent WhatsApp personnel véritable bras droit.
          </p>
        </header>

        <div className="rounded-2xl overflow-hidden shadow-2xl border border-border bg-black">
          <video
            src={videoAsset.url}
            controls
            playsInline
            preload="metadata"
            className="w-full aspect-[9/16] object-contain"
          />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          L'application tout-en-un des commerciaux du solaire — debalepro.app
        </p>
      </div>
    </div>
  );
};

export default PresentationVideo;
