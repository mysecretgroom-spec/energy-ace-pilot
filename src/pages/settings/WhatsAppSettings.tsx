import { MobileLayout } from "@/components/layout/MobileLayout";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { WhatsAppTemplates } from "@/components/settings/WhatsAppTemplates";

const WhatsAppSettings = () => {
  return (
    <MobileLayout title="WhatsApp" showBackButton>
      <div className="p-4 pb-8 space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Envoi WhatsApp Confirmateur
          </h3>
          <NotificationSettings />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Modèles de Messages
          </h3>
          <WhatsAppTemplates />
        </div>
      </div>
    </MobileLayout>
  );
};

export default WhatsAppSettings;
