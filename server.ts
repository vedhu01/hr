import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hr.db");

// Drop ideas table if it has an outdated CHECK constraint (missing 'project_feedback')
const ideasTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ideas'").get() as { sql: string } | undefined;
if (ideasTableInfo && !ideasTableInfo.sql.includes("project_feedback")) {
  db.exec("DROP TABLE ideas");
}

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

// Seed data if empty
const employeeCount = db.prepare("SELECT COUNT(*) as count FROM employees").get() as { count: number };
if (employeeCount.count === 0) {
  const insertEmployee = db.prepare("INSERT INTO employees (name, role, department, email, avatar) VALUES (?, ?, ?, ?, ?)");
  insertEmployee.run("Vedha Manas", "Founder & CEO", "Leadership", "vedha@mvhr.ai", "https://i.pravatar.cc/150?u=vedha");
  insertEmployee.run("Sarah Chen", "Head of Product", "Product", "sarah@mvhr.ai", "https://i.pravatar.cc/150?u=sarah");
  insertEmployee.run("Jordan Smith", "Senior Engineer", "Engineering", "jordan@mvhr.ai", "https://i.pravatar.cc/150?u=jordan");
  insertEmployee.run("Maya Patel", "UX Designer", "Design", "maya@mvhr.ai", "https://i.pravatar.cc/150?u=maya");
  
  const insertAnnouncement = db.prepare("INSERT INTO announcements (title, content, type, author_id) VALUES (?, ?, ?, ?)");
  insertAnnouncement.run("Q1 Vision Update", "We are scaling our engineering team by 20% this quarter.", "formal", 1);
  insertAnnouncement.run("Friday Social", "Pizza and games at 5 PM in the lounge!", "informal", 2);

  const insertIdea = db.prepare("INSERT INTO ideas (title, content, type, is_anonymous, author_id) VALUES (?, ?, ?, ?, ?)");
  insertIdea.run("Hiking Trip", "Let's go for a team hike next month to the nearby trails.", "team_building", 0, 3);
  insertIdea.run("Coffee Machine Upgrade", "The current coffee machine is quite old, maybe we can get a new one?", "general", 1, 4);
  insertIdea.run("Project X Launch", "I feel Project X is a bit too advanced for the current public market. We should refine the UX first.", "project_feedback", 0, 2);

  const insertNotification = db.prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)");
  insertNotification.run(1, "New Idea Posted", "Jordan Smith posted a new idea in the Idea Box.", "idea");
  insertNotification.run(1, "Kudos Received", "Maya Patel gave you kudos!", "kudos");
}

// Re-seed ideas if the table was recreated due to schema migration
const ideasCount = db.prepare("SELECT COUNT(*) as count FROM ideas").get() as { count: number };
if (ideasCount.count === 0) {
  const insertIdea = db.prepare("INSERT INTO ideas (title, content, type, is_anonymous, author_id) VALUES (?, ?, ?, ?, ?)");
  insertIdea.run("Hiking Trip", "Let's go for a team hike next month to the nearby trails.", "team_building", 0, 3);
  insertIdea.run("Coffee Machine Upgrade", "The current coffee machine is quite old, maybe we can get a new one?", "general", 1, 4);
  insertIdea.run("Project X Launch", "I feel Project X is a bit too advanced for the current public market. We should refine the UX first.", "project_feedback", 0, 2);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // API Routes
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees").all();
    res.json(employees);
  });

  app.get("/api/announcements", (req, res) => {
    const announcements = db.prepare(`
      SELECT a.*, e.name as author_name 
      FROM announcements a 
      JOIN employees e ON a.author_id = e.id 
      ORDER BY created_at DESC
    `).all();
    res.json(announcements);
  });

  app.get("/api/ideas", (req, res) => {
    const ideas = db.prepare(`
      SELECT i.*, 
             CASE WHEN i.is_anonymous = 1 THEN 'Anonymous' ELSE e.name END as author_name,
             CASE WHEN i.is_anonymous = 1 THEN NULL ELSE e.avatar END as author_avatar
      FROM ideas i 
      LEFT JOIN employees e ON i.author_id = e.id 
      ORDER BY created_at DESC
    `).all();
    res.json(ideas);
  });

  app.get("/api/notifications/:user_id", (req, res) => {
    const notifications = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.user_id);
    res.json(notifications);
  });

  app.post("/api/notifications/read/:id", (req, res) => {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/ideas", (req, res) => {
    const { title, content, type, is_anonymous, author_id } = req.body;
    const result = db.prepare("INSERT INTO ideas (title, content, type, is_anonymous, author_id) VALUES (?, ?, ?, ?, ?)").run(title, content, type, is_anonymous ? 1 : 0, author_id);
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/messages/:channel", (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, e.name as sender_name, e.avatar as sender_avatar
      FROM messages m
      JOIN employees e ON m.sender_id = e.id
      WHERE m.channel = ?
      ORDER BY timestamp ASC
      LIMIT 50
    `).all(req.params.channel);
    res.json(messages);
  });

  app.get("/api/kudos", (req, res) => {
    const kudos = db.prepare(`
      SELECT k.*, f.name as from_name, t.name as to_name, t.avatar as to_avatar
      FROM kudos k
      JOIN employees f ON k.from_id = f.id
      JOIN employees t ON k.to_id = t.id
      ORDER BY timestamp DESC
    `).all();
    res.json(kudos);
  });

  app.post("/api/kudos", (req, res) => {
    const { from_id, to_id, message } = req.body;
    const result = db.prepare("INSERT INTO kudos (from_id, to_id, message) VALUES (?, ?, ?)").run(from_id, to_id, message);
    res.json({ id: result.lastInsertRowid });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_channel", (channel) => {
      socket.join(channel);
    });

    socket.on("send_message", (data) => {
      const { sender_id, content, channel } = data;
      const result = db.prepare("INSERT INTO messages (sender_id, content, channel) VALUES (?, ?, ?)").run(sender_id, content, channel);
      
      const message = db.prepare(`
        SELECT m.*, e.name as sender_name, e.avatar as sender_avatar
        FROM messages m
        JOIN employees e ON m.sender_id = e.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

      io.to(channel).emit("receive_message", message);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
