/** Pre-written assistant answers shown in visitor (demo) mode, always ending with the trial signup link. */
export const VISITOR_TRIAL_LINK = "/essai-gratuit";

const CTA =
  `\n\n---\n**Envie d'essayer avec vos propres données ?** Profitez de **10 jours d'essai gratuit** : [Créer mon compte d'essai](${VISITOR_TRIAL_LINK})`;

const ANSWERS: Array<{ keys: RegExp; text: string }> = [
  {
    keys: /planning|rdv|rendez|demain|agenda|semaine/i,
    text: "Dans votre compte, je vous donne votre planning en une phrase : heures, adresses et type de rendez-vous. Je peux aussi déplacer un RDV, en créer un ou vous envoyer un briefing chaque matin sur WhatsApp.",
  },
  {
    keys: /vente|stat|chiffre|commission|mois|perf/i,
    text: "Avec votre compte, je calcule vos ventes du mois, votre taux de transformation et vos commissions par régie, puis je vous les résume en quelques lignes.",
  },
  {
    keys: /client|recherch|dossier|contact/i,
    text: "Je retrouve n'importe quel client par nom, ville ou téléphone, avec son historique de rendez-vous, ses études et ses documents.",
  },
  {
    keys: /frais|ticket|facture|d[ée]pense|essence|resto/i,
    text: "Envoyez-moi simplement la photo d'un ticket : je lis le montant, la date et la catégorie, puis j'enregistre le frais dans vos finances.",
  },
  {
    keys: /[ée]tude|pv|pac|ite|solaire|rapport|pdf/i,
    text: "Le formulaire d'étude garde tout ce qui a été vu et dit pendant le rendez-vous. En fin de RDV, le rapport PDF complet est envoyé et le récapitulatif part sur WhatsApp.",
  },
];

const DEFAULT =
  "Je suis votre assistant personnel DébalePro : planning, clients, ventes, frais et études, directement depuis l'app ou WhatsApp. En mode visiteur, mes réponses sont des exemples.";

export function getVisitorAssistantReply(text: string): string {
  const match = ANSWERS.find((a) => a.keys.test(text));
  return (match?.text ?? DEFAULT) + CTA;
}
