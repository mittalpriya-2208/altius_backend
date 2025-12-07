import { dataLayer } from '../data';
import { IncidentReport, TicketFilters, PaginatedResponse, StatusUpdatePayload, TicketActivity, TicketAttachment } from '../types';

export const getTickets = async (
  filters: TicketFilters
): Promise<PaginatedResponse<IncidentReport>> => {
  const { page = 1, limit = 20 } = filters;
  const result = await dataLayer.getFilteredTickets(filters);

  return {
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  };
};

export const getTicketByTTNumber = async (
  ttNumber: string
): Promise<IncidentReport | null> => {
  return dataLayer.getTicketByTTNumber(ttNumber);
};

export const acknowledgeTicket = async (
  ttNumber: string,
  username: string
): Promise<IncidentReport | null> => {
  const ticket = await dataLayer.getTicketByTTNumber(ttNumber);
  if (!ticket) return null;

  const oldStatus = ticket.status;

  const updatedTicket = await dataLayer.updateTicket(ttNumber, {
    status: 'Assigned',
  });

  // Log activity
  await dataLayer.addActivity({
    ttNumber,
    activityType: 'acknowledged',
    oldValue: oldStatus,
    newValue: 'Assigned',
    remarks: 'Ticket acknowledged and assigned',
    createdBy: username,
  });

  return updatedTicket;
};

export const updateTicketStatus = async (
  ttNumber: string,
  payload: StatusUpdatePayload,
  username: string
): Promise<{ ticket: IncidentReport | null; activity: TicketActivity | null }> => {
  const { status, remarks, attachment_id } = payload;

  const ticket = await dataLayer.getTicketByTTNumber(ttNumber);
  if (!ticket) return { ticket: null, activity: null };

  const oldStatus = ticket.status;

  const updates: Partial<IncidentReport> = {
    status,
  };

  // Append remarks to system_rca
  if (remarks) {
    const timestamp = new Date().toISOString();
    const existingRca = ticket.system_rca || '';
    updates.system_rca = `${existingRca}\n[${timestamp}]: ${remarks}`.trim();
  }

  // Set cleared_date if closing
  if (status === 'Closed') {
    updates.cleared_date = new Date();
  }

  const updatedTicket = await dataLayer.updateTicket(ttNumber, updates);

  // Log activity - Status Update action
  const activity = await dataLayer.addActivity({
    ttNumber,
    activityType: 'status_update',
    oldValue: oldStatus,
    newValue: status,
    remarks: remarks || null,
    attachmentId: attachment_id || null,
    createdBy: username,
  });

  return { ticket: updatedTicket, activity };
};

export const addRemarks = async (
  ttNumber: string,
  remarks: string,
  username: string,
  attachmentId?: number
): Promise<{ ticket: IncidentReport | null; activity: TicketActivity | null }> => {
  const ticket = await dataLayer.getTicketByTTNumber(ttNumber);
  if (!ticket) return { ticket: null, activity: null };

  const timestamp = new Date().toISOString();
  const existingRca = ticket.system_rca || '';
  const newRca = `${existingRca}\n[${timestamp} - ${username}]: ${remarks}`.trim();

  const updatedTicket = await dataLayer.updateTicket(ttNumber, {
    system_rca: newRca,
  });

  // Log activity - Add Remark action
  const activity = await dataLayer.addActivity({
    ttNumber,
    activityType: 'add_remark',
    remarks,
    attachmentId: attachmentId || null,
    createdBy: username,
  });

  return { ticket: updatedTicket, activity };
};

// ============================================
// TIMELINE
// ============================================

export const getTicketTimeline = async (
  ttNumber: string
): Promise<TicketActivity[]> => {
  return dataLayer.getTicketTimeline(ttNumber);
};

// ============================================
// ATTACHMENTS
// ============================================

export const getTicketAttachments = async (
  ttNumber: string
): Promise<TicketAttachment[]> => {
  return dataLayer.getTicketAttachments(ttNumber);
};

export const addAttachment = async (
  ttNumber: string,
  attachmentData: {
    originalFilename: string;
    storedFilename: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
  },
  username: string
): Promise<TicketAttachment> => {
  // Save attachment to database only
  // Activity logging is done when the attachment is linked to a remark or status update
  const attachment = await dataLayer.addAttachment({
    ttNumber,
    ...attachmentData,
    uploadedBy: username,
  });

  return attachment;
};
