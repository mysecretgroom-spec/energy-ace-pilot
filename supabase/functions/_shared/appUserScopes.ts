// drive.file : l'app ne voit que les fichiers qu'elle crée elle-même dans le Drive.
export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/drive.file",
];
export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const DRIVE_CONNECTOR = "google_drive";
