import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync('studycue.db');


  // WAL is ideal on native, but can break SQLite WASM workers on web.
  if (Platform.OS !== 'web') {
    await db.execAsync(`PRAGMA journal_mode = WAL;`);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users_local (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firebaseUserId TEXT UNIQUE,
      displayName TEXT,
      email TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      subjectId INTEGER,
      title TEXT,
      weekday TEXT,
      startTime TEXT,
      endTime TEXT,
      location TEXT,
      notes TEXT,
      recurrence TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      subjectId INTEGER,
      title TEXT,
      examDate TEXT,
      examTime TEXT,
      coverage TEXT,
      priority INTEGER,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      categoryId INTEGER,
      subjectId INTEGER,
      title TEXT,
      dueAt TEXT,
      estimatedMinutes INTEGER,
      difficulty TEXT,
      priority INTEGER,
      status TEXT,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      subjectId INTEGER,
      taskId INTEGER,
      startedAt TEXT,
      endedAt TEXT,
      focusMinutes INTEGER,
      breakMinutes INTEGER,
      sessionType TEXT,
      completed BOOLEAN,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER UNIQUE,
      preferredFocusMinutes INTEGER DEFAULT 25,
      preferredBreakMinutes INTEGER DEFAULT 5,
      dailyGoalMinutes INTEGER DEFAULT 120,
      energyMode TEXT DEFAULT 'normal',
      offlineModelInstalled BOOLEAN DEFAULT 0,
      offlineModelVersion TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations — safe to re-run (ALTER TABLE errors are caught)
  try {
    await db.execAsync(`ALTER TABLE classes ADD COLUMN eventType TEXT DEFAULT 'class'`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`ALTER TABLE classes ADD COLUMN specificDate TEXT`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`ALTER TABLE tasks ADD COLUMN categoryId INTEGER`);
  } catch (_) {
    // Column already exists
  }
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_task_categories_user_slug ON task_categories (userId, slug)`);
  } catch (_) {
    // Ignore index creation issues
  }
  try {
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_tasks_user_category ON tasks (userId, categoryId)`);
  } catch (_) {
    // Ignore index creation issues
  }
  
  return db;
}
