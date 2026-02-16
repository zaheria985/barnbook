-- Default user for first-run convenience
-- Password: barnbook123 (bcrypt hash)
INSERT INTO users (email, password_hash, name)
VALUES (
  'rider@barnbook.local',
  '$2b$10$4032.OVffM4Et.W49j719ecEWMyoosPWUwGxNzsobLKcPQ/ebEwYS',
  'Rider'
)
ON CONFLICT (email) DO NOTHING;
