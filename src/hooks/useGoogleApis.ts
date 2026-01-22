import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL;

// Helper to call edge functions with auth
async function callGoogleFunction(functionName: string, action: string, params?: Record<string, string>, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const queryParams = new URLSearchParams({ action, ...params });
  const url = `${FUNCTIONS_URL}/functions/v1/${functionName}?${queryParams}`;

  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || "API call failed");
  }

  return data;
}

// ==================== GOOGLE CALENDAR ====================

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: { email: string }[];
  htmlLink?: string;
}

export const googleCalendar = {
  // List upcoming events
  async listEvents(options?: { 
    timeMin?: string; 
    timeMax?: string; 
    maxResults?: number;
  }): Promise<{ items: CalendarEvent[] }> {
    return callGoogleFunction("google-calendar", "list", {
      timeMin: options?.timeMin || new Date().toISOString(),
      ...(options?.timeMax && { timeMax: options.timeMax }),
      maxResults: String(options?.maxResults || 10),
    });
  },

  // Create a new event
  async createEvent(event: {
    summary: string;
    description?: string;
    start: string; // ISO datetime
    end: string;   // ISO datetime
    attendees?: string[];
  }): Promise<CalendarEvent> {
    return callGoogleFunction("google-calendar", "create", undefined, event);
  },

  // Delete an event
  async deleteEvent(eventId: string): Promise<{ success: boolean }> {
    return callGoogleFunction("google-calendar", "delete", { eventId });
  },
};

// ==================== GOOGLE GMAIL ====================

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject?: string;
  from?: string;
  date?: string;
}

export const googleGmail = {
  // List recent emails
  async listMessages(options?: {
    maxResults?: number;
    query?: string;
    labelIds?: string;
  }): Promise<{ messages: GmailMessage[]; resultSizeEstimate: number }> {
    return callGoogleFunction("google-gmail", "list", {
      maxResults: String(options?.maxResults || 20),
      ...(options?.query && { q: options.query }),
      labelIds: options?.labelIds || "INBOX",
    });
  },

  // Get a specific email
  async getMessage(messageId: string): Promise<object> {
    return callGoogleFunction("google-gmail", "get", { messageId });
  },

  // Send an email
  async sendEmail(email: {
    to: string;
    subject: string;
    message: string; // HTML content
  }): Promise<{ id: string }> {
    return callGoogleFunction("google-gmail", "send", undefined, email);
  },
};

// ==================== GOOGLE DRIVE ====================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

export const googleDrive = {
  // List files
  async listFiles(options?: {
    pageSize?: number;
    folderId?: string;
    mimeType?: string;
    pageToken?: string;
  }): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    return callGoogleFunction("google-drive", "list", {
      pageSize: String(options?.pageSize || 20),
      ...(options?.folderId && { folderId: options.folderId }),
      ...(options?.mimeType && { mimeType: options.mimeType }),
      ...(options?.pageToken && { pageToken: options.pageToken }),
    });
  },

  // Get file metadata
  async getFile(fileId: string): Promise<DriveFile> {
    return callGoogleFunction("google-drive", "get", { fileId });
  },

  // Upload a file (content should be base64 encoded)
  async uploadFile(file: {
    name: string;
    mimeType: string;
    content: string; // base64 encoded
    folderId?: string;
  }): Promise<DriveFile> {
    return callGoogleFunction("google-drive", "upload", undefined, file);
  },

  // Create a folder
  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    return callGoogleFunction("google-drive", "createFolder", undefined, { name, parentId });
  },

  // Delete a file
  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    return callGoogleFunction("google-drive", "delete", { fileId });
  },

  // Get download URL (returns a fetch to the download endpoint)
  getDownloadUrl(fileId: string): string {
    return `${FUNCTIONS_URL}/functions/v1/google-drive?action=download&fileId=${fileId}`;
  },
};

// ==================== CONNECTION STATUS ====================

export async function checkGoogleConnection(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from("google_tokens")
      .select("id, expires_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    return !!data && !error;
  } catch {
    return false;
  }
}
