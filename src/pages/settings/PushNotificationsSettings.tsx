import { MobileLayout } from "@/components/layout/MobileLayout";
import { PushNotificationSettings } from "@/components/settings/PushNotificationSettings";

const PushNotificationsSettings = () => {
  return (
    <MobileLayout title="Notifications Push" showBackButton>
      <div className="p-4 space-y-4">
        <PushNotificationSettings />
      </div>
    </MobileLayout>
  );
};

export default PushNotificationsSettings;
