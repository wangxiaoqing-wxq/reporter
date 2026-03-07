import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'reports.db'));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    companyName TEXT NOT NULL,
    website TEXT,
    description TEXT,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export const getReports = () => {
  return db.prepare('SELECT * FROM reports ORDER BY createdAt DESC').all();
};

export const getReportById = (id: number) => {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
};

export const createReport = (data: { companyName: string; website?: string; description?: string; content: string }) => {
  const stmt = db.prepare('INSERT INTO reports (companyName, website, description, content) VALUES (?, ?, ?, ?)');
  const info = stmt.run(data.companyName, data.website || null, data.description || null, data.content);
  return { id: info.lastInsertRowid, ...data };
};

export const deleteReport = (id: number) => {
  return db.prepare('DELETE FROM reports WHERE id = ?').run(id);
};

export const searchReports = (query: string) => {
  return db.prepare('SELECT * FROM reports WHERE companyName LIKE ? ORDER BY createdAt DESC').all(`%${query}%`);
};
