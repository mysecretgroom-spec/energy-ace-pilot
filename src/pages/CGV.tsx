import { Link } from "react-router-dom";
import { LegalPage, Section, Mail, SELLER } from "@/components/legal/LegalPage";

const CGV = () => (
  <LegalPage title="Conditions Générales" short="Conditions générales" updated="15 octobre 2026">
    <Section title="1. Le vendeur">
      <p>
        Le service {SELLER.trading} est édité et vendu par la société <strong>{SELLER.name}</strong>, sise{" "}
        {SELLER.address} (nom commercial : {SELLER.trading}). En utilisant le service, vous contractez avec{" "}
        {SELLER.name}. Contact : <Mail />.
      </p>

    </Section>
    <Section title="2. Acceptation">
      <p>En créant un compte ou en continuant à utiliser {SELLER.trading}, vous acceptez les présentes conditions. Si vous agissez pour une entreprise, vous déclarez avoir le pouvoir de l'engager ; si vous agissez à titre personnel, vous déclarez être majeur.</p>
    </Section>
    <Section title="3. Le service">
      <p>{SELLER.trading} est une application de gestion commerciale pour les professionnels de la rénovation énergétique : planning, clients, études (photovoltaïque, pompe à chaleur, isolation), documents, suivi des ventes et assistant IA.</p>
      <p>Vous êtes responsable de la confidentialité de vos identifiants, de l'activité réalisée sur votre compte et de l'exactitude des informations fournies.</p>
    </Section>
    <Section title="4. Utilisation interdite">
      <p>Il est interdit d'utiliser le service : à des fins illégales ; pour la fraude ou le spam ; pour porter atteinte aux droits de propriété intellectuelle d'autrui ; pour compromettre la sécurité (logiciels malveillants, tests d'intrusion, extraction automatisée de données) ; pour décompiler, revendre ou contourner les limites techniques du service.</p>
    </Section>
    <Section title="5. Fonctions IA">
      <p>Les résultats générés par l'IA (estimations, visualisations, textes) peuvent être inexacts. Vous êtes responsable de vos demandes, des contenus que vous fournissez et de la vérification des résultats avant tout usage auprès de vos clients. Les contenus illicites, trompeurs ou portant atteinte aux droits d'autrui sont interdits ; {SELLER.name} peut retirer un contenu ou suspendre un compte en cas d'abus. Toute réclamation d'un titulaire de droits peut être adressée à <Mail />.</p>
    </Section>
    <Section title="6. Propriété intellectuelle">
      <p>{SELLER.name} reste propriétaire du service, du logiciel, de la documentation et de la marque {SELLER.trading}. Vous bénéficiez d'un droit d'utilisation limité, non exclusif et non transférable, dans le cadre de votre abonnement. Vous restez propriétaire de vos données ; vous nous autorisez à les héberger et les traiter uniquement pour fournir le service.</p>
    </Section>
    <Section title="7. Abonnements et paiement">
      <p>Notre processus de commande est assuré par notre revendeur en ligne Paddle.com. Paddle.com est le Merchant of Record (vendeur officiel) pour toutes nos commandes. Paddle assure le service client lié aux paiements et gère les retours.</p>
      <p>Les formules Classique et Premium sont proposées au mois ou à l'année, avec renouvellement automatique et résiliation possible à tout moment depuis la page Abonnement. Le paiement, la facturation, les taxes, l'annulation et les remboursements sont régis par les <a className="text-primary underline" href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer">conditions acheteur de Paddle</a> et notre <Link to="/remboursement" className="text-primary underline">politique de remboursement</Link>.</p>
    </Section>
    <Section title="8. Disponibilité et responsabilité">
      <p>Nous faisons notre possible pour assurer un service fiable, sans garantir un fonctionnement ininterrompu ou exempt d'erreurs. Dans la limite permise par la loi, la responsabilité de {SELLER.name} est limitée aux sommes payées au cours des 12 derniers mois et exclut les dommages indirects (perte de chiffre d'affaires, de données ou d'image), sauf fraude ou dommage corporel.</p>
    </Section>
    <Section title="9. Suspension et résiliation">
      <p>{SELLER.name} peut suspendre ou résilier l'accès en cas de manquement grave, de défaut de paiement, de risque de fraude ou de sécurité, ou de violations répétées de ces conditions. À la fin de l'accès, vous disposez de 30 jours pour demander l'export de vos données, après quoi elles sont supprimées.</p>
    </Section>
    <Section title="10. Droit applicable">
      <p>Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action devant les tribunaux compétents. Aucune des parties n'est responsable d'un retard dû à un cas de force majeure.</p>
    </Section>
  </LegalPage>
);

export default CGV;
