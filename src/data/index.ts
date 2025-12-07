import { IncidentReport, TicketActivity, TicketAttachment } from '../types';
import mockTickets from './mock-tickets.json';
import { query } from '../config/database';

// Check if we should use mock data
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

console.log(`[Data Layer] Using ${USE_MOCK_DATA ? 'MOCK DATA' : 'DATABASE'}`);

// In-memory store for mock data (allows mutations during testing)
let ticketsStore: IncidentReport[] = JSON.parse(JSON.stringify(mockTickets));

// Reset mock data (useful for testing)
export const resetMockData = () => {
  ticketsStore = JSON.parse(JSON.stringify(mockTickets));
};

// ============================================
// DATA ACCESS LAYER
// ============================================

export const dataLayer = {
  // Check mode
  isMockMode: () => USE_MOCK_DATA,

  // ============================================
  // TICKETS
  // ============================================

  getAllTickets: async (): Promise<IncidentReport[]> => {
    if (USE_MOCK_DATA) {
      return ticketsStore;
    }
    const result = await query('SELECT * FROM vnoc.incident_reports');
    return result.rows;
  },

  getTicketByTTNumber: async (ttNumber: string): Promise<IncidentReport | null> => {
    if (USE_MOCK_DATA) {
      return ticketsStore.find((t) => t.tt_number === ttNumber) || null;
    }
    const result = await query(
      'SELECT * FROM vnoc.incident_reports WHERE tt_number = $1',
      [ttNumber]
    );
    return result.rows[0] || null;
  },

  updateTicket: async (
    ttNumber: string,
    updates: Partial<IncidentReport>
  ): Promise<IncidentReport | null> => {
    if (USE_MOCK_DATA) {
      const index = ticketsStore.findIndex((t) => t.tt_number === ttNumber);
      if (index === -1) return null;

      ticketsStore[index] = {
        ...ticketsStore[index],
        ...updates,
        escl_status_last_updated_date_time: new Date(),
      } as IncidentReport;

      return ticketsStore[index] as IncidentReport;
    }

    // Build dynamic update query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields
      .map((field, i) => `${field} = $${i + 1}`)
      .join(', ');

    const result = await query(
      `UPDATE vnoc.incident_reports
       SET ${setClause}, escl_status_last_updated_date_time = NOW()
       WHERE tt_number = $${fields.length + 1}
       RETURNING *`,
      [...values, ttNumber]
    );
    return result.rows[0] || null;
  },

  // ============================================
  // DASHBOARD QUERIES
  // ============================================

  getDashboardStats: async () => {
    if (USE_MOCK_DATA) {
      const activeTickets = ticketsStore.filter(
        (t) => t.status !== 'Closed' && t.status !== 'Resolved'
      );
      return {
        total: activeTickets.length,
        critical: activeTickets.filter(
          (t) => t.severity?.toLowerCase() === 'critical'
        ).length,
        emergency: activeTickets.filter(
          (t) => t.severity?.toLowerCase() === 'emergency'
        ).length,
        major: activeTickets.filter(
          (t) => t.severity?.toLowerCase() === 'major'
        ).length,
      };
    }

    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE LOWER(severity) = 'critical') as critical,
        COUNT(*) FILTER (WHERE LOWER(severity) = 'emergency') as emergency,
        COUNT(*) FILTER (WHERE LOWER(severity) = 'major') as major
      FROM vnoc.incident_reports
      WHERE status NOT IN ('Closed', 'Resolved')
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      critical: parseInt(row.critical) || 0,
      emergency: parseInt(row.emergency) || 0,
      major: parseInt(row.major) || 0,
    };
  },

  getNeedsAcknowledgement: async (limit = 10): Promise<IncidentReport[]> => {
    if (USE_MOCK_DATA) {
      const severityOrder: Record<string, number> = {
        critical: 1,
        emergency: 2,
        major: 3,
      };

      return ticketsStore
        .filter((t) => t.status === 'Open' || t.status === null)
        .sort((a, b) => {
          const aSev = severityOrder[a.severity?.toLowerCase() || ''] || 4;
          const bSev = severityOrder[b.severity?.toLowerCase() || ''] || 4;
          if (aSev !== bSev) return aSev - bSev;
          return (
            new Date(b.open_time || 0).getTime() -
            new Date(a.open_time || 0).getTime()
          );
        })
        .slice(0, limit);
    }

    const result = await query(
      `
      SELECT *
      FROM vnoc.incident_reports
      WHERE status = 'Open' OR status IS NULL
      ORDER BY
        CASE
          WHEN LOWER(severity) = 'critical' THEN 1
          WHEN LOWER(severity) = 'emergency' THEN 2
          WHEN LOWER(severity) = 'major' THEN 3
          ELSE 4
        END,
        open_time DESC
      LIMIT $1
    `,
      [limit]
    );

    return result.rows;
  },

  getRecentUpdates: async (
    page = 1,
    limit = 20
  ): Promise<{ data: IncidentReport[]; total: number }> => {
    if (USE_MOCK_DATA) {
      const sorted = [...ticketsStore].sort((a, b) => {
        const aDate =
          a.escl_status_last_updated_date_time || a.open_time || new Date(0);
        const bDate =
          b.escl_status_last_updated_date_time || b.open_time || new Date(0);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      const start = (page - 1) * limit;
      return {
        data: sorted.slice(start, start + limit),
        total: ticketsStore.length,
      };
    }

    const countResult = await query(
      'SELECT COUNT(*) as total FROM vnoc.incident_reports'
    );

    const offset = (page - 1) * limit;
    const result = await query(
      `
      SELECT *
      FROM vnoc.incident_reports
      ORDER BY COALESCE(escl_status_last_updated_date_time, open_time) DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].total) || 0,
    };
  },

  // ============================================
  // FILTERED QUERIES
  // ============================================

  getFilteredTickets: async (filters: {
    status?: string[];
    severity?: string[];
    age?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'newest' | 'oldest' | 'most_critical' | 'least_critical';
  }): Promise<{ data: IncidentReport[]; total: number }> => {
    const {
      status,
      severity,
      age,
      search,
      page = 1,
      limit = 20,
      sortBy = 'newest',
    } = filters;

    if (USE_MOCK_DATA) {
      let filtered = [...ticketsStore];

      // Status filter
      if (status && status.length > 0) {
        filtered = filtered.filter((t) => status.includes(t.status || ''));
      }

      // Severity filter
      if (severity && severity.length > 0) {
        filtered = filtered.filter((t) =>
          severity.map((s) => s.toLowerCase()).includes(t.severity?.toLowerCase() || '')
        );
      }

      // Age filter
      if (age) {
        const now = new Date().getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        filtered = filtered.filter((t) => {
          const ticketAge = now - new Date(t.open_time || 0).getTime();
          switch (age) {
            case '<1 day':
              return ticketAge < dayMs;
            case '1-5 days':
              return ticketAge >= dayMs && ticketAge < 5 * dayMs;
            case '5-10 days':
              return ticketAge >= 5 * dayMs && ticketAge < 10 * dayMs;
            case '>10 days':
              return ticketAge >= 10 * dayMs;
            default:
              return true;
          }
        });
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.tt_number?.toLowerCase().includes(searchLower) ||
            t.site_name?.toLowerCase().includes(searchLower) ||
            t.event_name?.toLowerCase().includes(searchLower)
        );
      }

      // Sorting
      const severityOrder: Record<string, number> = {
        critical: 1,
        emergency: 2,
        major: 3,
      };

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return (
              new Date(a.open_time || 0).getTime() -
              new Date(b.open_time || 0).getTime()
            );
          case 'most_critical':
            return (
              (severityOrder[a.severity?.toLowerCase() || ''] || 4) -
              (severityOrder[b.severity?.toLowerCase() || ''] || 4)
            );
          case 'least_critical':
            return (
              (severityOrder[b.severity?.toLowerCase() || ''] || 4) -
              (severityOrder[a.severity?.toLowerCase() || ''] || 4)
            );
          case 'newest':
          default:
            return (
              new Date(b.open_time || 0).getTime() -
              new Date(a.open_time || 0).getTime()
            );
        }
      });

      const total = filtered.length;
      const start = (page - 1) * limit;

      return {
        data: filtered.slice(start, start + limit),
        total,
      };
    }

    // Database implementation (same as before in tickets.service.ts)
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status && status.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(status);
      paramIndex++;
    }

    if (severity && severity.length > 0) {
      conditions.push(`LOWER(severity) = ANY($${paramIndex})`);
      params.push(severity.map((s) => s.toLowerCase()));
      paramIndex++;
    }

    if (age) {
      const now = new Date();
      switch (age) {
        case '<1 day':
          conditions.push(`open_time >= $${paramIndex}`);
          params.push(new Date(now.getTime() - 24 * 60 * 60 * 1000));
          paramIndex++;
          break;
        case '1-5 days':
          conditions.push(
            `open_time BETWEEN $${paramIndex} AND $${paramIndex + 1}`
          );
          params.push(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
          params.push(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000));
          paramIndex += 2;
          break;
        case '5-10 days':
          conditions.push(
            `open_time BETWEEN $${paramIndex} AND $${paramIndex + 1}`
          );
          params.push(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
          params.push(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000));
          paramIndex += 2;
          break;
        case '>10 days':
          conditions.push(`open_time < $${paramIndex}`);
          params.push(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
          paramIndex++;
          break;
      }
    }

    if (search) {
      conditions.push(
        `(tt_number ILIKE $${paramIndex} OR site_name ILIKE $${paramIndex} OR event_name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy: string;
    switch (sortBy) {
      case 'oldest':
        orderBy = 'open_time ASC';
        break;
      case 'most_critical':
        orderBy = `CASE WHEN LOWER(severity) = 'critical' THEN 1 WHEN LOWER(severity) = 'emergency' THEN 2 WHEN LOWER(severity) = 'major' THEN 3 ELSE 4 END ASC, open_time DESC`;
        break;
      case 'least_critical':
        orderBy = `CASE WHEN LOWER(severity) = 'critical' THEN 4 WHEN LOWER(severity) = 'emergency' THEN 3 WHEN LOWER(severity) = 'major' THEN 2 ELSE 1 END ASC, open_time DESC`;
        break;
      default:
        orderBy = 'open_time DESC';
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM vnoc.incident_reports ${whereClause}`,
      params
    );

    const offset = (page - 1) * limit;
    const dataResult = await query(
      `SELECT * FROM vnoc.incident_reports ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total) || 0,
    };
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================

  getPendingActions: async (): Promise<IncidentReport[]> => {
    if (USE_MOCK_DATA) {
      const now = new Date().getTime();
      const hourMs = 60 * 60 * 1000;

      return ticketsStore.filter((t) => {
        if (t.status === 'Closed') return false;

        const lastUpdate = new Date(
          t.escl_status_last_updated_date_time || t.open_time || 0
        ).getTime();
        const hoursSinceUpdate = (now - lastUpdate) / hourMs;

        // Overdue: Open for more than 24 hours
        if ((t.status === 'Open' || !t.status) && hoursSinceUpdate > 24)
          return true;
        // Due soon: Assigned but stale for 4+ hours
        if (t.status === 'Assigned' && hoursSinceUpdate > 4) return true;
        // Action required: In Progress but stale for 6+ hours
        if (t.status === 'In Progress' && hoursSinceUpdate > 6) return true;
        // Pending closure
        if (t.status === 'Resolved') return true;

        return false;
      });
    }

    const result = await query(`
      SELECT *
      FROM vnoc.incident_reports
      WHERE status NOT IN ('Closed')
        AND (
          (status IN ('Open') AND open_time < NOW() - INTERVAL '24 hours')
          OR (status = 'Assigned' AND escl_status_last_updated_date_time < NOW() - INTERVAL '4 hours')
          OR (status = 'In Progress' AND escl_status_last_updated_date_time < NOW() - INTERVAL '6 hours')
          OR status = 'Resolved'
        )
      ORDER BY open_time ASC
      LIMIT 50
    `);

    return result.rows;
  },

  // ============================================
  // TIMELINE / ACTIVITIES
  // ============================================

  getTicketTimeline: async (ttNumber: string): Promise<TicketActivity[]> => {
    if (USE_MOCK_DATA) {
      // Return empty array for mock mode
      return [];
    }

    const result = await query(
      `SELECT
        a.activity_id,
        a.tt_number,
        a.activity_type,
        a.old_value,
        a.new_value,
        a.remarks,
        a.attachment_id,
        a.created_by,
        a.created_at,
        att.original_filename as attachment_filename,
        att.file_path as attachment_path
      FROM vnoc.ticket_activities a
      LEFT JOIN vnoc.ticket_attachments att ON a.attachment_id = att.attachment_id
      WHERE a.tt_number = $1
      ORDER BY a.created_at DESC`,
      [ttNumber]
    );

    return result.rows;
  },

  addActivity: async (activity: {
    ttNumber: string;
    activityType: string;
    oldValue?: string | null;
    newValue?: string | null;
    remarks?: string | null;
    attachmentId?: number | null;
    createdBy: string;
  }): Promise<TicketActivity> => {
    if (USE_MOCK_DATA) {
      // Return mock activity
      return {
        activity_id: Date.now(),
        tt_number: activity.ttNumber,
        activity_type: activity.activityType,
        old_value: activity.oldValue || null,
        new_value: activity.newValue || null,
        remarks: activity.remarks || null,
        attachment_id: activity.attachmentId || null,
        created_by: activity.createdBy,
        created_at: new Date(),
      };
    }

    const result = await query(
      `INSERT INTO vnoc.ticket_activities
        (tt_number, activity_type, old_value, new_value, remarks, attachment_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        activity.ttNumber,
        activity.activityType,
        activity.oldValue || null,
        activity.newValue || null,
        activity.remarks || null,
        activity.attachmentId || null,
        activity.createdBy,
      ]
    );

    return result.rows[0];
  },

  // ============================================
  // ATTACHMENTS
  // ============================================

  getTicketAttachments: async (ttNumber: string): Promise<TicketAttachment[]> => {
    if (USE_MOCK_DATA) {
      return [];
    }

    const result = await query(
      `SELECT
        attachment_id,
        tt_number,
        original_filename,
        stored_filename,
        file_path,
        file_size,
        mime_type,
        uploaded_by,
        uploaded_at
      FROM vnoc.ticket_attachments
      WHERE tt_number = $1
      ORDER BY uploaded_at DESC`,
      [ttNumber]
    );

    return result.rows;
  },

  addAttachment: async (attachment: {
    ttNumber: string;
    originalFilename: string;
    storedFilename: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }): Promise<TicketAttachment> => {
    if (USE_MOCK_DATA) {
      return {
        attachment_id: Date.now(),
        tt_number: attachment.ttNumber,
        original_filename: attachment.originalFilename,
        stored_filename: attachment.storedFilename,
        file_path: attachment.filePath,
        file_size: attachment.fileSize,
        mime_type: attachment.mimeType,
        uploaded_by: attachment.uploadedBy,
        uploaded_at: new Date(),
      };
    }

    const result = await query(
      `INSERT INTO vnoc.ticket_attachments
        (tt_number, original_filename, stored_filename, file_path, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        attachment.ttNumber,
        attachment.originalFilename,
        attachment.storedFilename,
        attachment.filePath,
        attachment.fileSize,
        attachment.mimeType,
        attachment.uploadedBy,
      ]
    );

    return result.rows[0];
  },
};

export default dataLayer;
