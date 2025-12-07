export interface IncidentReport {
  tt_number: string;
  status: string | null;
  severity: string | null;
  event_name: string | null;
  source_input: string | null;
  system_rca: string | null;
  open_time: Date | null;
  cleared_date: Date | null;
  tt_aging_minutes: number | null;
  vnoc_tt_process_time: Date | null;
  escl_status_last_updated_date_time: Date | null;
  circle: string | null;
  cluster: string | null;
  site_id: string | null;
  site_name: string | null;
  customer_site_id: string | null;
  site_classification: string | null;
  user_name: string | null;
  technician: string | null;
  supervisior: string | null;
  cluster_engineer: string | null;
  cluster_incharge: string | null;
  comh: string | null;
  esclation_status: string | null;
}

export interface DashboardStats {
  total: number;
  critical: number;
  emergency: number;
  major: number;
}

export interface TicketFilters {
  status?: string[];
  severity?: string[];
  age?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'most_critical' | 'least_critical';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StatusUpdatePayload {
  status: string;
  remarks?: string;
  attachment_id?: number; // Optional attachment linked to this status change
}

export interface AddRemarkPayload {
  remarks: string;
  attachment_id?: number; // Optional attachment linked to this remark
}

export interface TicketActivity {
  activity_id: number;
  tt_number: string;
  activity_type: string; // 'status_update' | 'add_remark' | 'acknowledged' | 'created'
  old_value: string | null;  // For status_update: old status
  new_value: string | null;  // For status_update: new status
  remarks: string | null;
  attachment_id: number | null; // Link to attachment if any
  created_by: string;
  created_at: Date;
}

export interface TicketAttachment {
  attachment_id: number;
  tt_number: string;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: Date;
}

export interface CognitoUser {
  sub: string;
  email: string;
  username: string;
  'cognito:username': string;
  'custom:role'?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: CognitoUser;
    startTime?: number;
  }
}
