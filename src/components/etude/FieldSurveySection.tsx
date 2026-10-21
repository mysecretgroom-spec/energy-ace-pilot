import { useEffect, useState } from "react";
import { ClipboardCheck, Plus, Trash2, Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QuickPhotoButton } from "@/components/scanner/QuickPhotoButton";
import { MediaPreview } from "@/components/documents/MediaPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { facadeAreas, newFacade, surveyPhotoSource, type FieldSurvey, type SurveyCheck } from "@/lib/fieldSurvey";

function CheckField({ label, value, onChange }: { label: string; value: SurveyCheck; onChange: (value: SurveyCheck) => void }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={(v) => onChange(v as SurveyCheck)}><SelectTrigger><SelectValue placeholder="À contrôler" /></SelectTrigger><SelectContent><SelectItem value="ok">Conforme</SelectItem><SelectItem value="attention">Point de vigilance</SelectItem><SelectItem value="na">Non concerné</SelectItem></SelectContent></Select></div>;
}

function SurveyPhotos({ clientId, etudeId, product, subject, title, onSaved }: { clientId: string | null; etudeId: string | null; product: "PAC" | "ITE"; subject: string; title: string; onSaved: () => void }) {
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<{ id: string; url: string; nom: string; mime_type: string | null }[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const source = surveyPhotoSource(product, subject);
  useEffect(() => {
    if (!clientId || !etudeId) return;
    let cancelled = false;
    supabase.from("documents").select("id,url,nom,mime_type").eq("client_id", clientId).eq("etude_id", etudeId).eq("context_source", source).order("created_at").then(({ data, error }) => {
      if (!cancelled) { setError(!!error); if (data) setPhotos(data); }
    });
    return () => { cancelled = true; };
  }, [clientId, etudeId, source, revision]);
  return <div className="space-y-2 pt-2">
    <Label className="flex items-center gap-2"><Camera className="h-4 w-4" />Photos légendées</Label>
    <Input aria-label={`Légende photo ${title}`} placeholder="Légende de la prochaine photo" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={160} />
    {clientId && etudeId ? <QuickPhotoButton clientId={clientId} etudeId={etudeId} category="autre" label={`Photo ${title}`} contextSource={source} documentName={`${product} · ${title}${caption.trim() ? ` · ${caption.trim()}` : ""}`} onPhotoSaved={() => { setRevision((n) => n + 1); onSaved(); }} /> : <p className="text-xs text-muted-foreground">Enregistrement de l’étude requis pour rattacher les photos.</p>}
    {error && <Button variant="ghost" onClick={() => setRevision((n) => n + 1)}>Recharger les photos</Button>}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{photos.map((photo, i) => <div key={photo.id} className="space-y-1">
      <Button variant="ghost" className="h-auto w-full p-0 overflow-hidden" onClick={() => setIndex(i)} aria-label={`Ouvrir ${photo.nom}`}><img src={photo.url} alt={photo.nom} className="aspect-[4/3] w-full object-cover rounded-md" /></Button>
      <Input aria-label={`Modifier légende ${i + 1} ${title}`} defaultValue={photo.nom.replace(/\.jpg$/i, "")} maxLength={180} onBlur={async (e) => {
        const nom = e.target.value.trim();
        if (!nom || `${nom}.jpg` === photo.nom) return;
        const { error } = await supabase.from("documents").update({ nom: `${nom}.jpg` }).eq("id", photo.id).eq("etude_id", etudeId || "");
        if (error) { toast.error("Légende non enregistrée"); return; }
        setRevision((n) => n + 1); onSaved();
      }} />
    </div>)}</div>
    <MediaPreview isOpen={index !== null} onClose={() => setIndex(null)} items={photos} initialIndex={index ?? 0} />
  </div>;
}

export function FieldSurveySection({ product, value, onChange, clientId, etudeId, onPhotoSaved }: { product: "PAC" | "ITE"; value: FieldSurvey; onChange: (value: FieldSurvey) => void; clientId: string | null; etudeId: string | null; onPhotoSaved: () => void }) {
  const pac = value.pac; const ite = value.ite;
  const reviewedAt = product === "PAC" ? pac.reviewedAt : ite.reviewedAt;
  const updatePac = (patch: Partial<FieldSurvey["pac"]>) => onChange({ ...value, pac: { ...pac, ...patch, reviewedAt: null } });
  const updateIte = (patch: Partial<FieldSurvey["ite"]>) => onChange({ ...value, ite: { ...ite, ...patch, reviewedAt: null } });
  const totals = ite.facades.reduce((sum, facade) => sum + facadeAreas(facade).net, 0);
  return <section aria-label={`Contrôle terrain ${product}`} className="space-y-4 border-y border-border py-5 mb-5">
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Contrôle terrain {product}</h3><Badge variant={reviewedAt ? "default" : "outline"}>{reviewedAt ? "Revu" : "À revoir"}</Badge></div>
    {product === "PAC" ? <>
      <div className="grid sm:grid-cols-2 gap-3">{([['emitters', 'Émetteurs et régime de chauffage'], ['network', 'État du réseau / désembouage'], ['electricity', 'Alimentation électrique'], ['location', 'Implantation et nuisances sonores'], ['drainage', 'Évacuation des condensats']] as const).map(([key, label]) => <CheckField key={key} label={label} value={pac[key]} onChange={(v) => updatePac({ [key]: v })} />)}
        <div className="space-y-1.5"><Label htmlFor="pac-water-temperature">Température de départ d’eau (°C)</Label><Input id="pac-water-temperature" type="number" min="0" value={pac.waterTemperature} onChange={(e) => updatePac({ waterTemperature: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pac-neighbour-distance">Distance voisinage (m)</Label><Input id="pac-neighbour-distance" type="number" min="0" step="0.1" value={pac.neighbourDistance} onChange={(e) => updatePac({ neighbourDistance: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })} /></div>
      </div>
      <Label htmlFor="pac-survey-notes">Observations terrain PAC</Label><Textarea id="pac-survey-notes" value={pac.notes} onChange={(e) => updatePac({ notes: e.target.value })} />
      <SurveyPhotos product="PAC" subject="installation" title="Installation" clientId={clientId} etudeId={etudeId} onSaved={onPhotoSaved} />
    </> : <>
      <div className="grid sm:grid-cols-2 gap-3"><CheckField label="Accès / échafaudage" value={ite.access} onChange={(access) => updateIte({ access })} /><CheckField label="Contraintes mairie / ABF" value={ite.urbanism} onChange={(urbanism) => updateIte({ urbanism })} /></div>
      {ite.facades.map((facade, i) => {
        const areas = facadeAreas(facade);
        const change = (patch: Partial<typeof facade>) => updateIte({ facades: ite.facades.map((f) => f.id === facade.id ? { ...f, ...patch } : f) });
        const title = facade.name || `Façade ${i + 1}`;
        return <div key={facade.id} className="border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between"><h4 className="font-medium">{title}</h4><Button variant="ghost" size="icon" title="Retirer la façade" aria-label={`Retirer ${title}`} onClick={() => updateIte({ facades: ite.facades.filter((f) => f.id !== facade.id) })}><Trash2 className="h-4 w-4" /></Button></div>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`facade-name-${facade.id}`}>Nom façade {i + 1}</Label><Input id={`facade-name-${facade.id}`} value={facade.name} onChange={(e) => change({ name: e.target.value })} placeholder="Jardin, rue…" /></div><div><Label>Orientation</Label><Select value={facade.orientation} onValueChange={(orientation) => change({ orientation })}><SelectTrigger><SelectValue placeholder="Orientation" /></SelectTrigger><SelectContent>{["N", "NE", "E", "SE", "S", "SO", "O", "NO"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="grid sm:grid-cols-3 gap-3">{([['width', 'Longueur (m)'], ['height', 'Hauteur (m)'], ['openings', 'Ouvertures (m²)']] as const).map(([key, label]) => <div key={key}><Label htmlFor={`${facade.id}-${key}`}>{label}</Label><Input id={`${facade.id}-${key}`} type="number" min="0" step="0.01" value={facade[key]} onChange={(e) => change({ [key]: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })} /></div>)}</div>
          <div className="text-sm tabular-nums">Brut {areas.gross.toFixed(2)} m² · Net {areas.net.toFixed(2)} m²</div>
          {areas.invalid && <p role="alert" className="text-sm text-destructive">Les ouvertures dépassent la surface de cette façade.</p>}
          <CheckField label={`État du support ${title}`} value={facade.condition} onChange={(condition) => change({ condition })} />
          <Textarea aria-label={`Observations ${title}`} placeholder="Fissures, humidité, soubassement…" value={facade.notes} onChange={(e) => change({ notes: e.target.value })} />
          <SurveyPhotos product="ITE" subject={facade.id} title={title} clientId={clientId} etudeId={etudeId} onSaved={onPhotoSaved} />
        </div>;
      })}
      <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" onClick={() => updateIte({ facades: [...ite.facades, newFacade()] })}><Plus className="h-4 w-4 mr-2" />Ajouter une façade</Button><span className="font-medium tabular-nums">Surface nette relevée : {totals.toFixed(2)} m²</span></div>
      <Label htmlFor="ite-survey-notes">Observations terrain ITE</Label><Textarea id="ite-survey-notes" value={ite.notes} onChange={(e) => updateIte({ notes: e.target.value })} />
    </>}
    <Button variant="outline" onClick={() => onChange({ ...value, [product === "PAC" ? "pac" : "ite"]: { ...value[product === "PAC" ? "pac" : "ite"], reviewedAt: reviewedAt ? null : new Date().toISOString() } })}><CheckCircle2 className="h-4 w-4 mr-2" />{reviewedAt ? "Rouvrir le contrôle" : "Marquer le contrôle comme revu"}</Button>
  </section>;
}