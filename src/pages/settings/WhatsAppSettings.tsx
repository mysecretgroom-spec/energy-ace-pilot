import { MobileLayout } from "@/components/layout/MobileLayout";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

const WhatsAppSettings = () => {
  return (
    <MobileLayout title="WhatsApp" showBackButton>
      <div className="p-4">
        <NotificationSettings />
      </div>
    </MobileLayout>
  );
};

export default WhatsAppSettings;
