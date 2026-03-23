import * as SQLite from 'expo-sqlite';

export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync('studycue.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

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
  
  return db;
}
