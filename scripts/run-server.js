import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("hr.db");

console.log("Creating database at:", dbPath);

const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar TEXT,
    join_date TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('formal', 'informal')) NOT NULL,
    author_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    content TEXT NOT NULL,
    channel TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS kudos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER,
    to_id INTEGER,
    message TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_id) REFERENCES employees(id),
    FOREIGN KEY(to_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('team_building', 'general', 'project_feedback')) NOT NULL,
    is_anonymous INTEGER DEFAULT 0,
    author_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES employees(id)
  );
`);

console.log("Tables created successfully.");

// Seed data if empty
const employeeCount = db.prepare("SELECT COUNT(*) as count FROM employees").get();
if (employeeCount.count === 0) {
  const insertEmployee = db.prepare("INSERT INTO employees (name, role, department, email, avatar) VALUES (?, ?, ?, ?, ?)");
  insertEmployee.run("Vedha Manas", "Founder & CEO", "Leadership", "vedha@mvhr.ai", "https://i.pravatar.cc/150?u=vedha");
  insertEmployee.run("Sarah Chen", "Head of Product", "Product", "sarah@mvhr.ai", "https://i.pravatar.cc/150?u=sarah");
  insertEmployee.run("Jordan Smith", "Senior Engineer", "Engineering", "jordan@mvhr.ai", "https://i.pravatar.cc/150?u=jordan");
  insertEmployee.run("Maya Patel", "UX Designer", "Design", "maya@mvhr.ai", "https://i.pravatar.cc/150?u=maya");
  console.log("Employees seeded.");

  const insertAnnouncement = db.prepare("INSERT INTO announcements (title, content, type, author_id) VALUES (?, ?, ?, ?)");
  insertAnnouncement.run("Q1 Vision Update", "We are scaling our engineering team by 20% this quarter.", "formal", 1);
  insertAnnouncement.run("Friday Social", "Pizza and games at 5 PM in the lounge!", "informal", 2);
  console.log("Announcements seeded.");

  const insertIdea = db.prepare("INSERT INTO ideas (title, content, type, is_anonymous, author_id) VALUES (?, ?, ?, ?, ?)");
  insertIdea.run("Hiking Trip", "Let's go for a team hike next month to the nearby trails.", "team_building", 0, 3);
  insertIdea.run("Coffee Machine Upgrade", "The current coffee machine is quite old, maybe we can get a new one?", "general", 1, 4);
  insertIdea.run("Project X Launch", "I feel Project X is a bit too advanced for the current public market. We should refine the UX first.", "project_feedback", 0, 2);
  console.log("Ideas seeded (including project_feedback type).");

  const insertNotification = db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)");
  insertNotification.run(1, "New Idea Posted", "Jordan Smith posted a new idea in the Idea Box.", "idea");
  insertNotification.run(1, "Kudos Received", "Maya Patel gave you kudos!", "kudos");
  console.log("Notifications seeded.");
} else {
  console.log("Database already has data, skipping seed.");
}

// Verify data
const employees = db.prepare("SELECT id, name, role, department FROM employees").all();
console.log("\n--- Employees ---");
employees.forEach(e => console.log(`  [${e.id}] ${e.name} - ${e.role} (${e.department})`));

const ideas = db.prepare("SELECT id, title, type, is_anonymous FROM ideas").all();
console.log("\n--- Ideas ---");
ideas.forEach(i => console.log(`  [${i.id}] "${i.title}" (type: ${i.type}, anonymous: ${i.is_anonymous ? 'yes' : 'no'})`));

const announcements = db.prepare("SELECT id, title, type FROM announcements").all();
console.log("\n--- Announcements ---");
announcements.forEach(a => console.log(`  [${a.id}] "${a.title}" (type: ${a.type})`));

const notifications = db.prepare("SELECT id, title, type FROM notifications").all();
console.log("\n--- Notifications ---");
notifications.forEach(n => console.log(`  [${n.id}] "${n.title}" (type: ${n.type})`));

console.log("\nAll tables created and seeded successfully. No CHECK constraint errors.");

db.close();
