import { MobileLayout } from "@/components/layout/MobileLayout";
import { WhatsAppTemplates } from "@/components/settings/WhatsAppTemplates";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

const WhatsAppTemplatesSettings = () => {
  return (
    <MobileLayout title="Messages WhatsApp" showBackButton>
      <div className="p-4 space-y-4">
        <NotificationSettings />
        <WhatsAppTemplates />
      </div>
    </MobileLayout>
  );
};

export default WhatsAppTemplatesSettings;
