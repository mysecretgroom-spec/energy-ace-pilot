import { LegalPage, Section, Mail, SELLER } from "@/components/legal/LegalPage";

const Confidentialite = () => (
  <LegalPage title="Politique de confidentialité" short="Confidentialité" updated="15 octobre 2026">
    <Section title="Responsable du traitement">
      <p>La société <strong>{SELLER.name}</strong>, sise {SELLER.address} (nom commercial : {SELLER.trading}), est responsable du traitement de vos données personnelles. Contact : <Mail />.</p>
    </Section>
    <Section title="Données collectées et finalités">
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Compte</strong> (nom, e-mail, téléphone, identifiants) : création et gestion du compte — exécution du contrat.</li>
        <li><strong>Données métier</strong> (clients, rendez-vous, adresses, études, documents, photos) : fourniture du service — exécution du contrat.</li>
        <li><strong>Messages au support et à l'assistant</strong> : assistance et fonctions IA — exécution du contrat.</li>
        <li><strong>Données techniques</strong> (adresse IP, appareil, journaux d'utilisation) : sécurité, prévention de la fraude et amélioration du service — intérêt légitime.</li>
        <li><strong>Notifications</strong> (push, WhatsApp) : alertes et récapitulatifs — consentement, retirable à tout moment.</li>
      </ul>
      <p>Les données de paiement sont collectées directement par Paddle et ne nous sont pas transmises.</p>
    </Section>
    <Section title="Destinataires">
      <ul className="list-disc pl-5 space-y-1">
        <li>Prestataires techniques : hébergement, base de données, traitement IA, envoi de messages (WhatsApp, notifications) et cartographie.</li>
        <li>Paddle.com, Merchant of Record : vente, gestion des abonnements, paiements, taxes et facturation.</li>
        <li>Conseillers professionnels (juridique, comptable).</li>
        <li>Autorités, lorsque la loi l'exige.</li>
      </ul>
      <p>Certains prestataires peuvent traiter des données hors de l'Union européenne ; ces transferts sont encadrés par des décisions d'adéquation ou les clauses contractuelles types de la Commission européenne.</p>
    </Section>
    <Section title="Conservation">
      <p>Les données sont conservées pendant la durée de votre compte, puis supprimées ou anonymisées dans un délai de 30 jours après sa clôture, sauf obligation légale (pièces comptables : 10 ans).</p>
    </Section>
    <Section title="Vos droits">
      <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition, ainsi que du droit de retirer votre consentement. Écrivez à <Mail /> ; nous répondons sous un mois. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
    </Section>
    <Section title="Sécurité et cookies">
      <p>Nous appliquons des mesures techniques et organisationnelles adaptées : chiffrement des échanges, contrôle d'accès par compte, double authentification. L'application n'utilise que des cookies et stockages locaux essentiels (session, mode hors ligne), sans cookies publicitaires.</p>
    </Section>
  </LegalPage>
);

export default Confidentialite;
