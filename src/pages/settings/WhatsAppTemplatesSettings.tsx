import { MobileLayout } from "@/components/layout/MobileLayout";
import { WhatsAppTemplates } from "@/components/settings/WhatsAppTemplates";

const WhatsAppTemplatesSettings = () => {
  return (
    <MobileLayout title="Messages WhatsApp" showBackButton>
      <div className="p-4">
        <WhatsAppTemplates />
      </div>
    </MobileLayout>
  );
};

export default WhatsAppTemplatesSettings;
