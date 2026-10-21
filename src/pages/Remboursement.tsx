import { LegalPage, Section, Mail, SELLER } from "@/components/legal/LegalPage";

const Remboursement = () => (
  <LegalPage title="Politique de remboursement" short="Remboursement" updated="15 octobre 2026">
    <Section title="Satisfait ou remboursé 30 jours">
      <p>Si {SELLER.trading} ne vous convient pas, vous pouvez demander le remboursement intégral de votre achat (abonnement Classique ou Premium, mensuel ou annuel, ou recharge IA) dans les 30 jours suivant la date de la commande.</p>
      <p>Vendeur : {SELLER.name}, {SELLER.address}. Les commandes sont encaissées par Paddle, Merchant of Record.</p>

    </Section>
    <Section title="Comment demander un remboursement">
      <p>Les remboursements sont traités par notre revendeur Paddle, Merchant of Record de nos commandes. Rendez-vous sur <a className="text-primary underline" href="https://paddle.net" target="_blank" rel="noreferrer">paddle.net</a> avec l'adresse e-mail utilisée lors de l'achat, ou écrivez-nous à <Mail /> et nous transmettrons votre demande.</p>
      <p>Le remboursement est effectué sur le moyen de paiement d'origine. Voir aussi la <a className="text-primary underline" href="https://www.paddle.com/legal/refund-policy" target="_blank" rel="noreferrer">politique de remboursement de Paddle</a>.</p>
    </Section>
    <Section title="Résiliation">
      <p>Vous pouvez résilier à tout moment depuis la page Abonnement ; l'accès reste actif jusqu'à la fin de la période payée.</p>
    </Section>
  </LegalPage>
);

export default Remboursement;
