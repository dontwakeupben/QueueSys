-- =====================================================
-- Live Show Flat Queue System - Database Setup
-- Run this script in MySQL to create the database
-- =====================================================

-- Create the database
CREATE DATABASE IF NOT EXISTS queue_system;
USE queue_system;

-- =====================================================
-- ENUMS (stored as VARCHARs in MySQL, Prisma handles this)
-- =====================================================

-- AgentStatus: AVAILABLE, UNAVAILABLE, OFFLINE
-- WalkInStatus: PENDING, CALLED, ASSIGNED, FAILED
-- FailPolicy: SAME_AGENCY_THEN_NEXT, SKIP_AGENCY
-- CallResult: ACCEPTED, TIMED_OUT, DECLINED

-- =====================================================
-- TABLES
-- =====================================================

-- ShowFlat: The venue/property being shown
CREATE TABLE IF NOT EXISTS ShowFlat (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    rotation_order JSON NOT NULL COMMENT 'Array of agency codes in rotation order, e.g. ["A", "B", "C"]',
    pointer_index INT NOT NULL DEFAULT 0 COMMENT 'Current position in rotation_order for round-robin',
    timeout_seconds INT NOT NULL DEFAULT 30 COMMENT 'Seconds before call attempt times out',
    fail_policy ENUM('SAME_AGENCY_THEN_NEXT', 'SKIP_AGENCY') NOT NULL DEFAULT 'SAME_AGENCY_THEN_NEXT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Agency: Real estate agencies
CREATE TABLE IF NOT EXISTS Agency (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE COMMENT 'Short code like A, B, C',
    show_flat_id VARCHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (show_flat_id) REFERENCES ShowFlat(id) ON DELETE CASCADE
);

-- Agent: Individual real estate agents
CREATE TABLE IF NOT EXISTS Agent (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    status ENUM('AVAILABLE', 'UNAVAILABLE', 'OFFLINE') NOT NULL DEFAULT 'OFFLINE',
    agency_id VARCHAR(36) NOT NULL,
    socket_id VARCHAR(255) NULL COMMENT 'Current socket connection ID',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (agency_id) REFERENCES Agency(id) ON DELETE CASCADE
);

-- AgentQueue: FIFO queue for available agents (unique constraint ensures agent appears only once)
CREATE TABLE IF NOT EXISTS AgentQueue (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    agency_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'Agent can only be in queue once',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Sort by this for FIFO',
    FOREIGN KEY (agency_id) REFERENCES Agency(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES Agent(id) ON DELETE CASCADE,
    INDEX idx_agency_fifo (agency_id, joined_at ASC)
);

-- WalkIn: Customer walk-in records
CREATE TABLE IF NOT EXISTS WalkIn (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    status ENUM('PENDING', 'CALLED', 'ASSIGNED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    show_flat_id VARCHAR(36) NOT NULL,
    assigned_agent_id VARCHAR(36) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (show_flat_id) REFERENCES ShowFlat(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES Agent(id) ON DELETE SET NULL
);

-- CallAttempt: Audit log for each call attempt
CREATE TABLE IF NOT EXISTS CallAttempt (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    walkin_id VARCHAR(36) NOT NULL,
    agency_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(36) NOT NULL,
    called_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME NULL,
    result ENUM('ACCEPTED', 'TIMED_OUT', 'DECLINED') NULL,
    FOREIGN KEY (walkin_id) REFERENCES WalkIn(id) ON DELETE CASCADE,
    FOREIGN KEY (agency_id) REFERENCES Agency(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES Agent(id) ON DELETE CASCADE,
    INDEX idx_walkin_attempts (walkin_id, called_at DESC)
);

-- =====================================================
-- SEED DATA (Sample ShowFlat with 3 Agencies)
-- =====================================================

-- Insert a sample ShowFlat
INSERT IGNORE INTO ShowFlat (id, name, rotation_order, pointer_index, timeout_seconds, fail_policy)
VALUES ('sf-001', 'Sunrise Residences', '["A", "B", "C"]', 0, 30, 'SAME_AGENCY_THEN_NEXT');

-- Insert 3 Agencies
INSERT IGNORE INTO Agency (id, name, code, show_flat_id) VALUES
('agency-a', 'Alpha Realty', 'A', 'sf-001'),
('agency-b', 'Beta Properties', 'B', 'sf-001'),
('agency-c', 'Century Homes', 'C', 'sf-001');

-- Insert sample Agents (6 agents, 2 per agency)
INSERT IGNORE INTO Agent (id, name, status, agency_id) VALUES
('agent-a1', 'Alice Wong', 'OFFLINE', 'agency-a'),
('agent-a2', 'Andrew Tan', 'OFFLINE', 'agency-a'),
('agent-b1', 'Ben Lee', 'OFFLINE', 'agency-b'),
('agent-b2', 'Betty Chen', 'OFFLINE', 'agency-b'),
('agent-c1', 'Charlie Lim', 'OFFLINE', 'agency-c'),
('agent-c2', 'Cathy Ng', 'OFFLINE', 'agency-c');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables created
SELECT 'ShowFlat' as TableName, COUNT(*) as `Rows` FROM ShowFlat
UNION ALL SELECT 'Agency', COUNT(*) FROM Agency
UNION ALL SELECT 'Agent', COUNT(*) FROM Agent
UNION ALL SELECT 'AgentQueue', COUNT(*) FROM AgentQueue
UNION ALL SELECT 'WalkIn', COUNT(*) FROM WalkIn
UNION ALL SELECT 'CallAttempt', COUNT(*) FROM CallAttempt;

-- Show the rotation order
SELECT sf.name as ShowFlat, sf.rotation_order, sf.pointer_index,
       GROUP_CONCAT(a.code ORDER BY a.code) as Agencies
FROM ShowFlat sf
LEFT JOIN Agency a ON a.show_flat_id = sf.id
GROUP BY sf.id;

-- Show agents by agency
SELECT a.code as Agency, ag.name as Agent, ag.status
FROM Agent ag
JOIN Agency a ON ag.agency_id = a.id
ORDER BY a.code, ag.name;
