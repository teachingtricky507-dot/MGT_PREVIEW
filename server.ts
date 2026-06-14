import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// Helper function to send email with fallback to console logs
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.SMTP_FROM || '"MGT System" <no-reply@mgt.app>';
  const isSmtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (isSmtpConfigured) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(`[SMTP] Email successfully sent to ${to}. Subject: "${subject}"`);
      return;
    } catch (error) {
      console.error(`[SMTP ERROR] Failed to send email to ${to} via SMTP:`, error);
    }
  }

  // Fallback to console logs
  console.log("\n======================================================================");
  console.log(`📧 [EMAIL LOG] To: ${to}`);
  console.log(`📧 [EMAIL LOG] Subject: ${subject}`);
  console.log("----------------------------------------------------------------------");
  console.log(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300) + "...");
  console.log("----------------------------------------------------------------------");
  const match = html.match(/href="([^"]+)"/);
  if (match && match[1]) {
    console.log(`🔗 Link: ${match[1]}`);
  }
  console.log("======================================================================\n");
}


// Initialize SQLite database Sync connection
const dbObj = new DatabaseSync(path.join(process.cwd(), "database.sqlite"));

// Create tables schema
dbObj.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    displayName TEXT,
    photoURL TEXT,
    createdAt TEXT,
    emailVerified INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS credentials (
    email TEXT PRIMARY KEY,
    uid TEXT,
    password TEXT,
    FOREIGN KEY(uid) REFERENCES users(uid)
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    token TEXT PRIMARY KEY,
    email TEXT,
    expiresAt INTEGER,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS simulated_emails (
    id TEXT PRIMARY KEY,
    to_address TEXT,
    subject TEXT,
    bodyHtml TEXT,
    sentAt TEXT,
    read INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    key TEXT,
    description TEXT,
    ownerId TEXT,
    members TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    title TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    type TEXT,
    checklist TEXT,
    assigneeId TEXT,
    reporterId TEXT,
    dueDate TEXT,
    "order" INTEGER,
    timeSpent INTEGER,
    estimatedTime INTEGER,
    attachments TEXT,
    issueIndex INTEGER,
    sprintId TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    issueId TEXT,
    userId TEXT,
    type TEXT,
    oldValue TEXT,
    newValue TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    senderId TEXT,
    content TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    issueId TEXT,
    authorId TEXT,
    content TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS timelogs (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    issueId TEXT,
    userId TEXT,
    timeSpent INTEGER,
    description TEXT,
    date TEXT,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id TEXT PRIMARY KEY,
    projectId TEXT,
    name TEXT,
    status TEXT,
    startDate TEXT,
    endDate TEXT,
    createdAt TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth Registration
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, displayName } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const checkStmt = dbObj.prepare("SELECT * FROM credentials WHERE email = ?");
      const existing = checkStmt.get(normalizedEmail);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const uid = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4);

      // Save user profile
      const insertUser = dbObj.prepare("INSERT INTO users (uid, email, displayName, photoURL, createdAt, emailVerified) VALUES (?, ?, ?, ?, ?, ?)");
      insertUser.run(
        uid, 
        normalizedEmail, 
        displayName, 
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`, 
        new Date().toISOString(), 
        0
      );

      // Save credentials details
      const insertCred = dbObj.prepare("INSERT INTO credentials (email, uid, password) VALUES (?, ?, ?)");
      insertCred.run(normalizedEmail, uid, password);

      // Generate token
      const token = Math.random().toString(36).substr(2, 10) + Math.random().toString(36).substr(2, 10);
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
      const insertToken = dbObj.prepare("INSERT INTO verification_tokens (token, email, expiresAt, used) VALUES (?, ?, ?, 0)");
      insertToken.run(token, normalizedEmail, expiresAt);

      // Send verification email
      const appUrl = (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") 
        ? process.env.APP_URL.replace(/\/$/, "") 
        : "http://localhost:3000";
      
      const verificationLink = `${appUrl}/verify-email?token=${token}`;

      await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your email for MGT',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
            <h2 style="margin-top: 0; color: #0052CC;">Welcome to MGT!</h2>
            <p>Thank you for signing up. Please verify your email address and activate your account by clicking the button below:</p>
            <div style="margin: 24px 0;">
              <a href="${verificationLink}" style="background-color: #0052CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Verify Email Address</a>
            </div>
            <p style="font-size: 11px; color: #6B778C;">This link is valid for 2 hours. If you did not request this, you can safely ignore this email.</p>
          </div>
        `
      });

      res.json({ success: true, email: normalizedEmail });
    } catch (error: any) {
      console.error("Register Error:", error);
      res.status(500).json({ error: error.message || "Failed to register" });
    }
  });

  // Auth Login
  app.post("/api/auth/login", (req, res) => {
    const { identifier, password } = req.body;

    try {
      if (identifier.includes('@')) {
        const normalizedEmail = identifier.toLowerCase().trim();
        const credStmt = dbObj.prepare("SELECT * FROM credentials WHERE email = ?");
        const userCred: any = credStmt.get(normalizedEmail);

        if (!userCred || userCred.password !== password) {
          return res.status(400).json({ error: "Invalid email or password" });
        }

        const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
        const profile: any = userStmt.get(userCred.uid);

        if (profile && profile.emailVerified === 0) {
          return res.status(403).json({ error: "EMAIL_UNVERIFIED" });
        }

        res.json({ 
          uid: profile.uid, 
          email: profile.email, 
          displayName: profile.displayName, 
          photoURL: profile.photoURL, 
          createdAt: profile.createdAt,
          emailVerified: true 
        });
      } else {
        // Legacy login
        const uid = identifier.toLowerCase().replace(/\s+/g, '_');
        const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
        let profile: any = userStmt.get(uid);

        if (!profile) {
          profile = {
            uid,
            email: `${uid}@example.com`,
            displayName: identifier,
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
            createdAt: new Date().toISOString(),
            emailVerified: 1
          };
          const insertUser = dbObj.prepare("INSERT INTO users (uid, email, displayName, photoURL, createdAt, emailVerified) VALUES (?, ?, ?, ?, ?, ?)");
          insertUser.run(profile.uid, profile.email, profile.displayName, profile.photoURL, profile.createdAt, 1);
        } else {
          if (profile.emailVerified === 0) {
            const updateVer = dbObj.prepare("UPDATE users SET emailVerified = 1 WHERE uid = ?");
            updateVer.run(uid);
            profile.emailVerified = 1;
          }
        }
        res.json({
          uid: profile.uid,
          email: profile.email,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          createdAt: profile.createdAt,
          emailVerified: true
        });
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      res.status(500).json({ error: error.message || "Failed to login" });
    }
  });

  // Auth Resend Verification
  app.post("/api/auth/resend-verification", async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const credStmt = dbObj.prepare("SELECT * FROM credentials WHERE email = ?");
      const userCred: any = credStmt.get(normalizedEmail);

      if (!userCred) {
        return res.status(404).json({ error: "User not found" });
      }

      const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
      const profile: any = userStmt.get(userCred.uid);

      if (profile && profile.emailVerified === 1) {
        return res.status(400).json({ error: "Email already verified" });
      }

      const token = Math.random().toString(36).substr(2, 10) + Math.random().toString(36).substr(2, 10);
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;

      // Delete old tokens
      const deleteOld = dbObj.prepare("DELETE FROM verification_tokens WHERE email = ?");
      deleteOld.run(normalizedEmail);

      // Insert new token
      const insertToken = dbObj.prepare("INSERT INTO verification_tokens (token, email, expiresAt, used) VALUES (?, ?, ?, 0)");
      insertToken.run(token, normalizedEmail, expiresAt);

      // Send verification email
      const appUrl = (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") 
        ? process.env.APP_URL.replace(/\/$/, "") 
        : "http://localhost:3000";
      
      const verificationLink = `${appUrl}/verify-email?token=${token}`;

      await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your email for MGT',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
            <h2 style="margin-top: 0; color: #0052CC;">Welcome to MGT!</h2>
            <p>Thank you for signing up. Please verify your email address and activate your account by clicking the button below:</p>
            <div style="margin: 24px 0;">
              <a href="${verificationLink}" style="background-color: #0052CC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Verify Email Address</a>
            </div>
            <p style="font-size: 11px; color: #6B778C;">This link is valid for 2 hours. If you did not request this, you can safely ignore this email.</p>
          </div>
        `
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Resend Error:", error);
      res.status(500).json({ error: error.message || "Failed to resend verification" });
    }
  });

  // Auth Verify Email
  app.post("/api/auth/verify-email", (req, res) => {
    const { token } = req.body;

    try {
      const tokenStmt = dbObj.prepare("SELECT * FROM verification_tokens WHERE token = ?");
      const tokenData: any = tokenStmt.get(token);

      if (!tokenData) {
        return res.status(400).json({ error: "This verification link is invalid or has already been used." });
      }

      if (tokenData.used === 1) {
        return res.status(400).json({ error: "This verification link has already been used. Please log in." });
      }

      if (Date.now() > tokenData.expiresAt) {
        return res.status(400).json({ error: "LINK_EXPIRED", email: tokenData.email });
      }

      const userStmt = dbObj.prepare("SELECT * FROM users WHERE email = ?");
      const profile: any = userStmt.get(tokenData.email);

      if (profile) {
        const updateVer = dbObj.prepare("UPDATE users SET emailVerified = 1 WHERE uid = ?");
        updateVer.run(profile.uid);

        const updateTok = dbObj.prepare("UPDATE verification_tokens SET used = 1 WHERE token = ?");
        updateTok.run(token);

        res.json({ success: true, email: tokenData.email });
      } else {
        res.status(404).json({ error: "No user profile found matching this verification token." });
      }
    } catch (error: any) {
      console.error("Verify Email Error:", error);
      res.status(500).json({ error: error.message || "Failed to verify email" });
    }
  });

  // Auth Update Profile
  app.post("/api/auth/update-profile", (req, res) => {
    const { uid, displayName, photoURL } = req.body;

    try {
      const updateStmt = dbObj.prepare("UPDATE users SET displayName = ?, photoURL = ? WHERE uid = ?");
      updateStmt.run(displayName, photoURL, uid);

      const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
      const profile = userStmt.get(uid);

      res.json(profile);
    } catch (error: any) {
      console.error("Update Profile Error:", error);
      res.status(500).json({ error: error.message || "Failed to update profile" });
    }
  });

  // Fetch profiles for users in array
  app.post("/api/auth/profiles", (req, res) => {
    const { userIds } = req.body;

    try {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.json([]);
      }
      const placeholders = userIds.map(() => "?").join(",");
      const stmt = dbObj.prepare(`SELECT * FROM users WHERE uid IN (${placeholders})`);
      const profiles = stmt.all(...userIds);
      
      const result = profiles.map((p: any) => ({
        ...p,
        emailVerified: p.emailVerified === 1
      }));
      res.json(result);
    } catch (error: any) {
      console.error("Fetch Profiles Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch profiles" });
    }
  });

  // Get all user profiles (For client synchronization)
  app.get("/api/auth/profiles/all", (req, res) => {
    try {
      const stmt = dbObj.prepare("SELECT * FROM users");
      const profiles = stmt.all().map((p: any) => ({
        ...p,
        emailVerified: p.emailVerified === 1
      }));
      res.json(profiles);
    } catch (error: any) {
      console.error("Fetch All Profiles Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch profiles" });
    }
  });

  // Create new member endpoint
  app.post("/api/auth/create-member", (req, res) => {
    const { displayName, email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const checkStmt = dbObj.prepare("SELECT * FROM credentials WHERE email = ?");
      const existing = checkStmt.get(normalizedEmail);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const uid = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4);

      // Save user profile - set emailVerified = 1 so they can log in
      const insertUser = dbObj.prepare("INSERT INTO users (uid, email, displayName, photoURL, createdAt, emailVerified) VALUES (?, ?, ?, ?, ?, ?)");
      insertUser.run(
        uid,
        normalizedEmail,
        displayName,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        new Date().toISOString(),
        1
      );

      // Save default credentials (e.g. password is 'Password123!')
      const insertCred = dbObj.prepare("INSERT INTO credentials (email, uid, password) VALUES (?, ?, ?)");
      insertCred.run(normalizedEmail, uid, "Password123!");

      res.json({
        uid,
        email: normalizedEmail,
        displayName,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        createdAt: new Date().toISOString(),
        emailVerified: true
      });
    } catch (error: any) {
      console.error("Create Member Error:", error);
      res.status(500).json({ error: error.message || "Failed to create member" });
    }
  });

  // Delete user endpoint
  app.delete("/api/auth/users/:uid", (req, res) => {
    const { uid } = req.params;
    try {
      const selectUser = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
      const userToDelete: any = selectUser.get(uid);
      if (userToDelete && userToDelete.email === "deepeshkumarbarway@gmail.com") {
        return res.status(400).json({ error: "Cannot delete the Super Admin" });
      }

      const deleteCred = dbObj.prepare("DELETE FROM credentials WHERE uid = ?");
      deleteCred.run(uid);

      const deleteUser = dbObj.prepare("DELETE FROM users WHERE uid = ?");
      deleteUser.run(uid);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete User Error:", error);
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  // Projects Endpoints
  app.get("/api/projects", (req, res) => {
    const { userId } = req.query;
    try {
      const stmt = dbObj.prepare("SELECT * FROM projects");
      const allProjects = stmt.all();
      const filtered = allProjects
        .map((p: any) => ({
          ...p,
          members: JSON.parse(p.members || "[]")
        }))
        .filter((p: any) => !userId || p.members.includes(userId));
      res.json(filtered);
    } catch (error: any) {
      console.error("Get Projects Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:projectId", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM projects WHERE id = ?");
      const project: any = stmt.get(projectId);
      if (project) {
        project.members = JSON.parse(project.members || "[]");
        res.json(project);
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (error: any) {
      console.error("Get Project Detail Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", (req, res) => {
    const { id, name, key, description, ownerId, members, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO projects (id, name, key, description, ownerId, members, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, name, key, description, ownerId, JSON.stringify(members || []), createdAt);
      res.json({ id, name, key, description, ownerId, members, createdAt });
    } catch (error: any) {
      console.error("Create Project Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:projectId", (req, res) => {
    const { projectId } = req.params;
    const updates = req.body;
    try {
      const keys = Object.keys(updates);
      if (keys.length === 0) return res.json({ success: true });
      const setClause = keys.map(k => `"${k}" = ?`).join(", ");
      const vals = keys.map(k => k === "members" ? JSON.stringify(updates[k]) : updates[k]);
      
      const stmt = dbObj.prepare(`UPDATE projects SET ${setClause} WHERE id = ?`);
      stmt.run(...vals, projectId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Patch Project Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:projectId", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("DELETE FROM projects WHERE id = ?");
      stmt.run(projectId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Project Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Issues Endpoints
  app.get("/api/projects/:projectId/issues", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM issues WHERE projectId = ?");
      const issues = stmt.all(projectId).map((i: any) => ({
        ...i,
        checklist: JSON.parse(i.checklist || "[]"),
        attachments: JSON.parse(i.attachments || "[]"),
        order: Number(i.order),
        timeSpent: i.timeSpent ? Number(i.timeSpent) : undefined,
        estimatedTime: i.estimatedTime ? Number(i.estimatedTime) : undefined,
        issueIndex: i.issueIndex ? Number(i.issueIndex) : undefined
      }));
      res.json(issues);
    } catch (error: any) {
      console.error("Get Issues Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/issues", async (req, res) => {
    const { projectId } = req.params;
    const { id, title, description, status, priority, type, checklist, assigneeId, reporterId, dueDate, order, timeSpent, estimatedTime, attachments, issueIndex, sprintId, createdAt, updatedAt } = req.body;
    try {
      const stmt = dbObj.prepare(`
        INSERT INTO issues (
          id, projectId, title, description, status, priority, type, checklist, 
          assigneeId, reporterId, dueDate, "order", timeSpent, estimatedTime, 
          attachments, issueIndex, sprintId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id, projectId, title, description, status, priority, type, JSON.stringify(checklist || []),
        assigneeId || "", reporterId, dueDate || "", order || 0, timeSpent || 0, estimatedTime || 0,
        JSON.stringify(attachments || []), issueIndex || 0, sprintId || "", createdAt, updatedAt
      );



      // Trigger automatic email alert if task has an assignee
      if (assigneeId) {
        const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
        const user: any = userStmt.get(assigneeId);
        if (user && user.email) {
          const appUrl = (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") 
            ? process.env.APP_URL.replace(/\/$/, "") 
            : "http://localhost:3000";
          
          const taskLink = `${appUrl}/projects/${projectId}`;

          await sendEmail({
            to: user.email,
            subject: `Task Assigned: ${title}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
                <h2 style="margin-top: 0; color: #0052CC;">Task Assignment Notice</h2>
                <p>Hi <strong>${user.displayName}</strong>,</p>
                <p>A task has been assigned to you in the project workspace:</p>
                <div style="background-color: #F4F5F7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h3 style="margin: 0; font-size: 16px;">${title}</h3>
                  <p style="margin: 5px 0 0 0; font-size: 13px; color: #5E6C84;">Status: ${status} | Priority: ${priority}</p>
                </div>
                <div style="margin: 20px 0;">
                  <a href="${taskLink}" style="background-color: #0052CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">View Task in Workspace</a>
                </div>
                <p style="font-size: 11px; color: #6B778C;">Sent automatically by MGT Simple Project Intelligence.</p>
              </div>
            `
          });

          // Super Admin CC alert
          const SUPER_ADMIN_EMAIL = "deepeshkumarbarway@gmail.com";
          if (user.email !== SUPER_ADMIN_EMAIL) {
            await sendEmail({
              to: SUPER_ADMIN_EMAIL,
              subject: `[Admin Alert] Task Assigned: ${title}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
                  <h2 style="margin-top: 0; color: #E65100;">Admin Task Assignment Alert</h2>
                  <p>Hello Admin,</p>
                  <p>A task has been assigned to <strong>${user.displayName}</strong> (${user.email}) in the project workspace:</p>
                  <div style="background-color: #F4F5F7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="margin: 0; font-size: 16px;">${title}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #5E6C84;">Status: ${status} | Priority: ${priority}</p>
                  </div>
                  <div style="margin: 20px 0;">
                    <a href="${taskLink}" style="background-color: #E65100; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">View Task in Workspace</a>
                  </div>
                  <p style="font-size: 11px; color: #6B778C;">Sent automatically by MGT Simple Project Intelligence.</p>
                </div>
              `
            });
          }
        }
      }

      res.json({ id, projectId, title, description, status, priority, type, checklist, assigneeId, reporterId, dueDate, order, timeSpent, estimatedTime, attachments, issueIndex, sprintId, createdAt, updatedAt });
    } catch (error: any) {
      console.error("Create Issue Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:projectId/issues/:issueId", async (req, res) => {
    const { projectId, issueId } = req.params;
    const updates = req.body;
    try {
      // Get the existing issue assignee to verify changes
      const getIssueStmt = dbObj.prepare("SELECT * FROM issues WHERE id = ?");
      const existingIssue: any = getIssueStmt.get(issueId);
      const oldAssignee = existingIssue ? (existingIssue.assigneeId || "") : "";

      const keys = Object.keys(updates);
      if (keys.length === 0) return res.json({ success: true });
      
      const setClause = keys.map(k => `"${k}" = ?`).join(", ");
      const vals = keys.map(k => (k === "checklist" || k === "attachments") ? JSON.stringify(updates[k]) : updates[k]);
      
      const stmt = dbObj.prepare(`UPDATE issues SET ${setClause} WHERE id = ?`);
      stmt.run(...vals, issueId);

      // Check if assignee has changed and trigger task assignment email alert
      const newAssignee = updates.assigneeId;
      if (newAssignee !== undefined && newAssignee !== oldAssignee && newAssignee !== '') {
        const userStmt = dbObj.prepare("SELECT * FROM users WHERE uid = ?");
        const user: any = userStmt.get(newAssignee);
        const issueTitle = updates.title || (existingIssue ? existingIssue.title : "Untitled Issue");
        const issueStatus = updates.status || (existingIssue ? existingIssue.status : "TODO");
        const issuePriority = updates.priority || (existingIssue ? existingIssue.priority : "MEDIUM");
        
        if (user && user.email) {
          const appUrl = (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") 
            ? process.env.APP_URL.replace(/\/$/, "") 
            : "http://localhost:3000";
          
          const taskLink = `${appUrl}/projects/${projectId}`;

          await sendEmail({
            to: user.email,
            subject: `Task Assigned: ${issueTitle}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
                <h2 style="margin-top: 0; color: #0052CC;">Task Assignment Notice</h2>
                <p>Hi <strong>${user.displayName}</strong>,</p>
                <p>A task has been assigned to you in the project workspace:</p>
                <div style="background-color: #F4F5F7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h3 style="margin: 0; font-size: 16px;">${issueTitle}</h3>
                  <p style="margin: 5px 0 0 0; font-size: 13px; color: #5E6C84;">Status: ${issueStatus} | Priority: ${issuePriority}</p>
                </div>
                <div style="margin: 20px 0;">
                  <a href="${taskLink}" style="background-color: #0052CC; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">View Task in Workspace</a>
                </div>
                <p style="font-size: 11px; color: #6B778C;">Sent automatically by MGT Simple Project Intelligence.</p>
              </div>
            `
          });

          // Super Admin CC alert
          const SUPER_ADMIN_EMAIL = "deepeshkumarbarway@gmail.com";
          if (user.email !== SUPER_ADMIN_EMAIL) {
            await sendEmail({
              to: SUPER_ADMIN_EMAIL,
              subject: `[Admin Alert] Task Assigned: ${issueTitle}`,
              html: `
                <div style="font-family: sans-serif; padding: 20px; color: #172B4D;">
                  <h2 style="margin-top: 0; color: #E65100;">Admin Task Assignment Alert</h2>
                  <p>Hello Admin,</p>
                  <p>A task has been assigned to <strong>${user.displayName}</strong> (${user.email}) in the project workspace:</p>
                  <div style="background-color: #F4F5F7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="margin: 0; font-size: 16px;">${issueTitle}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #5E6C84;">Status: ${issueStatus} | Priority: ${issuePriority}</p>
                  </div>
                  <div style="margin: 20px 0;">
                    <a href="${taskLink}" style="background-color: #E65100; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">View Task in Workspace</a>
                  </div>
                  <p style="font-size: 11px; color: #6B778C;">Sent automatically by MGT Simple Project Intelligence.</p>
                </div>
              `
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Patch Issue Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:projectId/issues/:issueId", (req, res) => {
    const { issueId } = req.params;
    try {
      const stmt = dbObj.prepare("DELETE FROM issues WHERE id = ?");
      stmt.run(issueId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete Issue Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Activities Endpoints
  app.get("/api/projects/:projectId/activities", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM activities WHERE projectId = ? ORDER BY createdAt DESC");
      res.json(stmt.all(projectId));
    } catch (error: any) {
      console.error("Get Activities Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/activities", (req, res) => {
    const { projectId } = req.params;
    const { id, issueId, userId, type, oldValue, newValue, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO activities (id, projectId, issueId, userId, type, oldValue, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, projectId, issueId || "", userId, type, oldValue || "", newValue || "", createdAt);
      res.json({ id, projectId, issueId, userId, type, oldValue, newValue, createdAt });
    } catch (error: any) {
      console.error("Create Activity Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Comments Endpoints
  app.get("/api/issues/:issueId/comments", (req, res) => {
    const { issueId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM comments WHERE issueId = ? ORDER BY createdAt ASC");
      res.json(stmt.all(issueId));
    } catch (error: any) {
      console.error("Get Comments Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/issues/:issueId/comments", (req, res) => {
    const { issueId } = req.params;
    const { id, authorId, content, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO comments (id, issueId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, issueId, authorId, content, createdAt);
      res.json({ id, issueId, authorId, content, createdAt });
    } catch (error: any) {
      console.error("Create Comment Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Messages (Chat) Endpoints
  app.get("/api/projects/:projectId/messages", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM messages WHERE projectId = ? ORDER BY createdAt ASC");
      res.json(stmt.all(projectId));
    } catch (error: any) {
      console.error("Get Chat Messages Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/messages", (req, res) => {
    const { projectId } = req.params;
    const { id, senderId, content, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO messages (id, projectId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, projectId, senderId, content, createdAt);
      res.json({ id, projectId, senderId, content, createdAt });
    } catch (error: any) {
      console.error("Send Message Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // TimeLogs Endpoints
  app.get("/api/projects/:projectId/timelogs", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM timelogs WHERE projectId = ?");
      res.json(stmt.all(projectId));
    } catch (error: any) {
      console.error("Get TimeLogs Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/timelogs", (req, res) => {
    const { projectId } = req.params;
    const { id, issueId, userId, timeSpent, description, date, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO timelogs (id, projectId, issueId, userId, timeSpent, description, date, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      stmt.run(id, projectId, issueId, userId, timeSpent, description || "", date, createdAt);
      res.json({ id, projectId, issueId, userId, timeSpent, description, date, createdAt });
    } catch (error: any) {
      console.error("Create TimeLog Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sprints Endpoints
  app.get("/api/projects/:projectId/sprints", (req, res) => {
    const { projectId } = req.params;
    try {
      const stmt = dbObj.prepare("SELECT * FROM sprints WHERE projectId = ?");
      res.json(stmt.all(projectId));
    } catch (error: any) {
      console.error("Get Sprints Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/sprints", (req, res) => {
    const { projectId } = req.params;
    const { id, name, status, createdAt } = req.body;
    try {
      const stmt = dbObj.prepare("INSERT INTO sprints (id, projectId, name, status, createdAt) VALUES (?, ?, ?, ?, ?)");
      stmt.run(id, projectId, name, status, createdAt);
      res.json({ id, projectId, name, status, createdAt });
    } catch (error: any) {
      console.error("Create Sprint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/sprints/:sprintId/start", (req, res) => {
    const { projectId, sprintId } = req.params;
    const { durationWeeks } = req.body;
    try {
      const deact = dbObj.prepare("UPDATE sprints SET status = 'COMPLETED', endDate = ? WHERE projectId = ? AND status = 'ACTIVE'");
      deact.run(new Date().toISOString(), projectId);
      
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString();
      const act = dbObj.prepare("UPDATE sprints SET status = 'ACTIVE', startDate = ?, endDate = ? WHERE id = ?");
      act.run(startDate, endDate, sprintId);
      
      res.json({ success: true, startDate, endDate });
    } catch (error: any) {
      console.error("Start Sprint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:projectId/sprints/:sprintId/complete", (req, res) => {
    const { projectId, sprintId } = req.params;
    try {
      const comp = dbObj.prepare("UPDATE sprints SET status = 'COMPLETED', endDate = ? WHERE id = ?");
      comp.run(new Date().toISOString(), sprintId);
      
      const move = dbObj.prepare("UPDATE issues SET sprintId = '' WHERE projectId = ? AND sprintId = ? AND status != 'DONE'");
      move.run(projectId, sprintId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Complete Sprint Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 MGT Server is running!`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://127.0.0.1:${PORT}\n`);
  });
}

startServer();
