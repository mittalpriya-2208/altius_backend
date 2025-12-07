-- ============================================
-- VNOC Incident Reports Database Setup
-- Run this in PgAdmin to set up the local database
-- ============================================

-- Create database (run separately as superuser if needed)
-- CREATE DATABASE altius_vnoc;

-- Connect to the database first, then run the rest

-- Create schema
CREATE SCHEMA IF NOT EXISTS vnoc;

-- Drop table if exists (for clean setup)
DROP TABLE IF EXISTS vnoc.incident_reports;

-- Create the incident_reports table
CREATE TABLE vnoc.incident_reports (
    -- Unique Identifier / Primary Key
    tt_number VARCHAR(100) PRIMARY KEY,

    -- Basic Incident Details
    status VARCHAR(50),
    severity VARCHAR(100),
    event_name VARCHAR(200),
    source_input VARCHAR(100),
    system_rca TEXT,

    -- Timestamps
    open_time TIMESTAMP WITH TIME ZONE,
    cleared_date TIMESTAMP WITH TIME ZONE,
    tt_aging_minutes BIGINT,
    vnoc_tt_process_time TIMESTAMP WITH TIME ZONE,
    escl_status_last_updated_date_time TIMESTAMP WITH TIME ZONE,

    -- Location/Site Information
    circle VARCHAR(50),
    cluster VARCHAR(50),
    site_id VARCHAR(50),
    site_name VARCHAR(100),
    customer_site_id VARCHAR(50),
    site_classification VARCHAR(50),

    -- Site Master data
    user_name VARCHAR(300),
    technician VARCHAR(300),
    supervisior VARCHAR(300),
    cluster_engineer VARCHAR(300),
    cluster_incharge VARCHAR(300),
    comh VARCHAR(50),
    esclation_status VARCHAR(50)
);

-- Create indexes for better query performance
CREATE INDEX idx_incident_status ON vnoc.incident_reports(status);
CREATE INDEX idx_incident_severity ON vnoc.incident_reports(severity);
CREATE INDEX idx_incident_open_time ON vnoc.incident_reports(open_time);
CREATE INDEX idx_incident_circle ON vnoc.incident_reports(circle);
CREATE INDEX idx_incident_site_id ON vnoc.incident_reports(site_id);

-- ============================================
-- INSERT 100+ DUMMY TICKETS
-- ============================================

-- Helper function to generate realistic data
DO $$
DECLARE
    i INTEGER;
    statuses TEXT[] := ARRAY['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
    severities TEXT[] := ARRAY['Critical', 'Emergency', 'Major', 'Minor'];
    circles TEXT[] := ARRAY['North', 'South', 'East', 'West', 'Central', 'Northeast', 'Northwest', 'Southeast', 'Southwest'];
    clusters TEXT[] := ARRAY['Cluster-A', 'Cluster-B', 'Cluster-C', 'Cluster-D', 'Cluster-E', 'Cluster-F'];
    event_types TEXT[] := ARRAY[
        'Power Outage - Site Down',
        'High Temperature Alert',
        'Network Connectivity Loss',
        'Battery Backup Failure',
        'Generator Malfunction',
        'Security Breach Alert',
        'Fiber Cut Detected',
        'Equipment Overheating',
        'UPS Failure',
        'AC Unit Malfunction',
        'Door Sensor Triggered',
        'Voltage Fluctuation',
        'Transmission Degradation',
        'Link Down',
        'Hardware Failure',
        'Software Crash',
        'Capacity Threshold Exceeded',
        'Latency Spike Detected',
        'Packet Loss Alert',
        'CPU Utilization High'
    ];
    sources TEXT[] := ARRAY['NMS', 'Manual', 'Auto-Detect', 'Customer', 'NOC', 'Monitoring Tool'];
    classifications TEXT[] := ARRAY['Platinum', 'Gold', 'Silver', 'Bronze', 'Standard'];
    technicians TEXT[] := ARRAY['Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Neha Singh', 'Vikram Reddy', 'Sanjay Gupta', 'Anjali Mehta', 'Rajesh Verma', 'Kavita Nair', 'Deepak Joshi'];
    supervisors TEXT[] := ARRAY['Suresh Rao', 'Meena Iyer', 'Arun Krishnan', 'Lakshmi Devi', 'Mohan Das'];
    engineers TEXT[] := ARRAY['Kiran Patil', 'Ravi Shankar', 'Pooja Desai', 'Vinod Shetty', 'Sunita Roy'];
    incharges TEXT[] := ARRAY['Ramesh Kumar', 'Anita Sharma', 'Vijay Singh', 'Rekha Gupta', 'Manoj Tiwari'];

    random_status TEXT;
    random_severity TEXT;
    random_circle TEXT;
    random_cluster TEXT;
    random_event TEXT;
    random_source TEXT;
    random_classification TEXT;
    random_technician TEXT;
    random_supervisor TEXT;
    random_engineer TEXT;
    random_incharge TEXT;
    open_timestamp TIMESTAMP WITH TIME ZONE;
    cleared_timestamp TIMESTAMP WITH TIME ZONE;
    aging_minutes BIGINT;
    tt_num TEXT;
    site_prefix TEXT;
BEGIN
    FOR i IN 1..120 LOOP
        -- Random selections
        random_status := statuses[1 + floor(random() * array_length(statuses, 1))::int];
        random_severity := severities[1 + floor(random() * array_length(severities, 1))::int];
        random_circle := circles[1 + floor(random() * array_length(circles, 1))::int];
        random_cluster := clusters[1 + floor(random() * array_length(clusters, 1))::int];
        random_event := event_types[1 + floor(random() * array_length(event_types, 1))::int];
        random_source := sources[1 + floor(random() * array_length(sources, 1))::int];
        random_classification := classifications[1 + floor(random() * array_length(classifications, 1))::int];
        random_technician := technicians[1 + floor(random() * array_length(technicians, 1))::int];
        random_supervisor := supervisors[1 + floor(random() * array_length(supervisors, 1))::int];
        random_engineer := engineers[1 + floor(random() * array_length(engineers, 1))::int];
        random_incharge := incharges[1 + floor(random() * array_length(incharges, 1))::int];

        -- Generate open_time (within last 30 days)
        open_timestamp := NOW() - (random() * interval '30 days');

        -- Generate aging in minutes
        aging_minutes := EXTRACT(EPOCH FROM (NOW() - open_timestamp)) / 60;

        -- Generate cleared_date only for Closed/Resolved tickets
        IF random_status IN ('Closed', 'Resolved') THEN
            cleared_timestamp := open_timestamp + (random() * interval '5 days');
            IF cleared_timestamp > NOW() THEN
                cleared_timestamp := NOW();
            END IF;
        ELSE
            cleared_timestamp := NULL;
        END IF;

        -- Generate TT number
        tt_num := 'TT' || TO_CHAR(NOW(), 'YYYYMM') || LPAD(i::text, 6, '0');

        -- Generate site prefix based on circle
        site_prefix := UPPER(LEFT(random_circle, 2));

        INSERT INTO vnoc.incident_reports (
            tt_number,
            status,
            severity,
            event_name,
            source_input,
            system_rca,
            open_time,
            cleared_date,
            tt_aging_minutes,
            vnoc_tt_process_time,
            escl_status_last_updated_date_time,
            circle,
            cluster,
            site_id,
            site_name,
            customer_site_id,
            site_classification,
            user_name,
            technician,
            supervisior,
            cluster_engineer,
            cluster_incharge,
            comh,
            esclation_status
        ) VALUES (
            tt_num,
            random_status,
            random_severity,
            random_event,
            random_source,
            CASE
                WHEN random() > 0.5 THEN 'Initial analysis: ' || random_event || '. Technician dispatched.'
                ELSE NULL
            END,
            open_timestamp,
            cleared_timestamp,
            aging_minutes,
            open_timestamp + interval '5 minutes',
            CASE
                WHEN random_status != 'Open' THEN open_timestamp + (random() * interval '2 days')
                ELSE NULL
            END,
            random_circle,
            random_cluster,
            site_prefix || '-SITE-' || LPAD((100 + floor(random() * 900))::text, 3, '0'),
            random_circle || ' Tower Site ' || (100 + floor(random() * 900))::int,
            'CUST-' || site_prefix || '-' || LPAD((1000 + floor(random() * 9000))::text, 4, '0'),
            random_classification,
            'vnoc_user_' || (1 + floor(random() * 10))::int,
            random_technician,
            random_supervisor,
            random_engineer,
            random_incharge,
            'COMH-' || (1 + floor(random() * 5))::int,
            CASE
                WHEN random_severity = 'Critical' AND random_status NOT IN ('Closed', 'Resolved') THEN 'L1 Escalated'
                WHEN random_severity = 'Emergency' AND random_status NOT IN ('Closed', 'Resolved') THEN 'L2 Escalated'
                ELSE 'Normal'
            END
        );
    END LOOP;
END $$;

-- Add a few specific critical tickets for testing
INSERT INTO vnoc.incident_reports (
    tt_number, status, severity, event_name, source_input, system_rca,
    open_time, circle, cluster, site_id, site_name, customer_site_id,
    site_classification, technician, supervisior, cluster_engineer, cluster_incharge, esclation_status
) VALUES
(
    'TT202412CRIT001',
    'Open',
    'Critical',
    'Complete Site Down - Power Failure',
    'NMS',
    'Critical: Complete power outage detected. Emergency backup failed. Immediate attention required.',
    NOW() - interval '2 hours',
    'North',
    'Cluster-A',
    'NO-SITE-001',
    'North Primary Hub',
    'CUST-NO-0001',
    'Platinum',
    'Rahul Sharma',
    'Suresh Rao',
    'Kiran Patil',
    'Ramesh Kumar',
    'L1 Escalated'
),
(
    'TT202412CRIT002',
    'Open',
    'Critical',
    'Fiber Cut - Multiple Links Down',
    'Auto-Detect',
    'Critical: Fiber cut detected affecting 15 downstream sites.',
    NOW() - interval '30 minutes',
    'South',
    'Cluster-B',
    'SO-SITE-042',
    'South Backbone Node',
    'CUST-SO-0042',
    'Platinum',
    'Priya Patel',
    'Meena Iyer',
    'Ravi Shankar',
    'Anita Sharma',
    'L1 Escalated'
),
(
    'TT202412EMRG001',
    'Assigned',
    'Emergency',
    'High Temperature - Equipment at Risk',
    'Monitoring Tool',
    'Temperature exceeding 45C. AC unit failure suspected.',
    NOW() - interval '4 hours',
    'East',
    'Cluster-C',
    'EA-SITE-156',
    'East Data Center',
    'CUST-EA-0156',
    'Gold',
    'Amit Kumar',
    'Arun Krishnan',
    'Pooja Desai',
    'Vijay Singh',
    'L2 Escalated'
),
(
    'TT202412EMRG002',
    'In Progress',
    'Emergency',
    'Battery Backup Critical - 15% Remaining',
    'NMS',
    'Battery backup at critical level. Generator not starting.',
    NOW() - interval '1 hour',
    'West',
    'Cluster-D',
    'WE-SITE-089',
    'West Regional Hub',
    'CUST-WE-0089',
    'Platinum',
    'Neha Singh',
    'Lakshmi Devi',
    'Vinod Shetty',
    'Rekha Gupta',
    'L2 Escalated'
),
(
    'TT202412MAJ001',
    'Open',
    'Major',
    'Network Latency Spike - 500ms+',
    'Customer',
    'Customer reported high latency affecting business applications.',
    NOW() - interval '6 hours',
    'Central',
    'Cluster-E',
    'CE-SITE-234',
    'Central Exchange',
    'CUST-CE-0234',
    'Gold',
    'Vikram Reddy',
    'Mohan Das',
    'Sunita Roy',
    'Manoj Tiwari',
    'Normal'
);

-- Verify the data
SELECT
    'Total Tickets' as metric,
    COUNT(*)::text as value
FROM vnoc.incident_reports
UNION ALL
SELECT
    'Open Tickets',
    COUNT(*)::text
FROM vnoc.incident_reports WHERE status = 'Open'
UNION ALL
SELECT
    'Critical Tickets',
    COUNT(*)::text
FROM vnoc.incident_reports WHERE severity = 'Critical'
UNION ALL
SELECT
    'Emergency Tickets',
    COUNT(*)::text
FROM vnoc.incident_reports WHERE severity = 'Emergency';

-- Show sample data
SELECT tt_number, status, severity, event_name, circle, site_name, open_time
FROM vnoc.incident_reports
ORDER BY open_time DESC
LIMIT 10;
