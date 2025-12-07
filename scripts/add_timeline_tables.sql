-- ============================================
-- VNOC Timeline & Attachments Tables
-- Run this in PgAdmin on altius_vnoc database
-- ============================================

-- ============================================
-- 1. TICKET ATTACHMENTS TABLE (Create first for FK reference)
-- ============================================
DROP TABLE IF EXISTS vnoc.ticket_activities;
DROP TABLE IF EXISTS vnoc.ticket_attachments;

CREATE TABLE vnoc.ticket_attachments (
    attachment_id SERIAL PRIMARY KEY,
    tt_number VARCHAR(100) NOT NULL REFERENCES vnoc.incident_reports(tt_number) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster attachment queries
CREATE INDEX idx_attachments_tt_number ON vnoc.ticket_attachments(tt_number);

-- ============================================
-- 2. TICKET ACTIVITIES TABLE (For Timeline)
-- ============================================
CREATE TABLE vnoc.ticket_activities (
    activity_id SERIAL PRIMARY KEY,
    tt_number VARCHAR(100) NOT NULL REFERENCES vnoc.incident_reports(tt_number) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'status_update', 'add_remark', 'acknowledged', 'created'
    old_value TEXT,  -- For status_update: old status
    new_value TEXT,  -- For status_update: new status
    remarks TEXT,
    attachment_id INTEGER REFERENCES vnoc.ticket_attachments(attachment_id) ON DELETE SET NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster timeline queries
CREATE INDEX idx_activities_tt_number ON vnoc.ticket_activities(tt_number);
CREATE INDEX idx_activities_created_at ON vnoc.ticket_activities(created_at DESC);

-- ============================================
-- 3. INSERT SAMPLE ACTIVITY DATA
-- ============================================

-- Add creation activities for existing tickets
INSERT INTO vnoc.ticket_activities (tt_number, activity_type, new_value, remarks, created_by, created_at)
SELECT
    tt_number,
    'created',
    status,
    'Ticket created from NMS/monitoring system',
    COALESCE(user_name, 'system'),
    open_time
FROM vnoc.incident_reports
WHERE open_time IS NOT NULL;

-- Add acknowledgement activities for assigned/in-progress tickets
INSERT INTO vnoc.ticket_activities (tt_number, activity_type, old_value, new_value, remarks, created_by, created_at)
SELECT
    tt_number,
    'acknowledged',
    'Open',
    'Assigned',
    'Ticket acknowledged and assigned',
    COALESCE(technician, 'vnoc_user'),
    COALESCE(vnoc_tt_process_time, open_time + interval '10 minutes')
FROM vnoc.incident_reports
WHERE status IN ('Assigned', 'In Progress', 'Closed');

-- Add status change activities for in-progress tickets
INSERT INTO vnoc.ticket_activities (tt_number, activity_type, old_value, new_value, remarks, created_by, created_at)
SELECT
    tt_number,
    'status_update',
    'Assigned',
    'In Progress',
    'Started working on the issue',
    COALESCE(technician, 'vnoc_user'),
    COALESCE(escl_status_last_updated_date_time, open_time + interval '30 minutes')
FROM vnoc.incident_reports
WHERE status IN ('In Progress', 'Closed');

-- Add closure activities for closed tickets
INSERT INTO vnoc.ticket_activities (tt_number, activity_type, old_value, new_value, remarks, created_by, created_at)
SELECT
    tt_number,
    'status_update',
    'In Progress',
    'Closed',
    'Issue resolved and ticket closed',
    COALESCE(technician, 'vnoc_user'),
    COALESCE(cleared_date, escl_status_last_updated_date_time, open_time + interval '2 hours')
FROM vnoc.incident_reports
WHERE status = 'Closed';

-- Add some sample remarks for random tickets (Add Remark action)
INSERT INTO vnoc.ticket_activities (tt_number, activity_type, remarks, created_by, created_at)
SELECT
    tt_number,
    'add_remark',
    CASE (random() * 4)::int
        WHEN 0 THEN 'Contacted site technician, awaiting response'
        WHEN 1 THEN 'Spare parts ordered, expected delivery in 24 hours'
        WHEN 2 THEN 'Root cause identified: power supply issue'
        WHEN 3 THEN 'Escalated to L2 support for further analysis'
        ELSE 'Site visit scheduled for tomorrow'
    END,
    COALESCE(technician, 'vnoc_user'),
    open_time + (random() * interval '24 hours')
FROM vnoc.incident_reports
WHERE random() < 0.4;  -- Add remarks to 40% of tickets

-- ============================================
-- 4. VERIFY DATA
-- ============================================
SELECT 'Activities Table' as table_name, COUNT(*) as row_count FROM vnoc.ticket_activities
UNION ALL
SELECT 'Attachments Table', COUNT(*) FROM vnoc.ticket_attachments;

-- Show sample timeline for a ticket
SELECT
    a.activity_type,
    a.old_value,
    a.new_value,
    a.remarks,
    a.created_by,
    a.created_at
FROM vnoc.ticket_activities a
JOIN vnoc.incident_reports i ON a.tt_number = i.tt_number
WHERE i.status = 'In Progress'
ORDER BY a.created_at DESC
LIMIT 10;
