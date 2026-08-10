require('dotenv').config();
const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:database.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  await db.execute(`
      CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT DEFAULT '📚',
          color TEXT DEFAULT '#10b981',
          sort_order INTEGER DEFAULT 0
      )
  `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          departmentId TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT DEFAULT '📖',
          FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
      )
  `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          is_paid BOOLEAN DEFAULT 0,
          transaction_id TEXT,
          full_name TEXT,
          token_version INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
  `);
  await db.execute(`
      CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          departmentId TEXT NOT NULL,
          subjectId TEXT NOT NULL,
          question TEXT NOT NULL,
          options TEXT NOT NULL,
          correctAnswer INTEGER NOT NULL,
          explanation TEXT DEFAULT '',
          type TEXT NOT NULL DEFAULT 'mcq',
          year INTEGER
      )
  `);
}

initDb().catch(err => console.error("DB Init Error:", err));

function createUser(username, password, cb) {
    db.execute({ sql: 'INSERT INTO users (username, password) VALUES (?, ?)', args: [username, password] })
        .then(res => {
            getUserById(Number(res.lastInsertRowid), cb);
        })
        .catch(err => cb(err));
}

function getUserByUsername(username, cb) {
    db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] })
        .then(res => cb(null, res.rows[0]))
        .catch(err => cb(err));
}

function getUserById(id, cb) {
    db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] })
        .then(res => cb(null, res.rows[0]))
        .catch(err => cb(err));
}

function incrementTokenVersion(id, cb) {
    db.execute({ sql: 'UPDATE users SET token_version = token_version + 1 WHERE id = ?', args: [id] })
        .then(() => db.execute({ sql: 'SELECT token_version FROM users WHERE id = ?', args: [id] }))
        .then(res => cb(null, res.rows[0] ? res.rows[0].token_version : 0))
        .catch(err => cb(err));
}

function submitPayment(id, transactionId, fullName, cb) {
    db.execute({ sql: 'UPDATE users SET transaction_id = ?, full_name = ? WHERE id = ?', args: [transactionId, fullName, id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function approvePayment(id, cb) {
    db.execute({ sql: 'UPDATE users SET is_paid = 1 WHERE id = ?', args: [id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function revokeAccess(id, cb) {
    db.execute({ sql: 'UPDATE users SET is_paid = 0, token_version = token_version + 1 WHERE id = ?', args: [id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function getAllUsers(cb) {
    db.execute('SELECT id, username, is_paid, transaction_id, full_name, created_at FROM users')
        .then(res => cb(null, res.rows))
        .catch(err => cb(err));
}

function getDepartments(cb) {
    db.execute('SELECT * FROM departments ORDER BY sort_order ASC, name ASC')
        .then(deptRes => {
            db.execute('SELECT * FROM subjects ORDER BY name ASC')
                .then(subRes => {
                    const depsWithSubs = deptRes.rows.map(d => ({
                        ...d,
                        subjects: subRes.rows.filter(s => s.departmentId === d.id)
                    }));
                    cb(null, depsWithSubs);
                })
                .catch(err => cb(err));
        })
        .catch(err => cb(err));
}

function addDepartment(dept, cb) {
    const id = dept.id || crypto.randomUUID();
    db.execute({ sql: 'INSERT INTO departments (id, name, icon, color) VALUES (?, ?, ?, ?)', args: [id, dept.name, dept.icon, dept.color] })
        .then(() => cb(null, { id, ...dept }))
        .catch(err => cb(err));
}

function deleteDepartment(id, cb) {
    db.execute({ sql: 'DELETE FROM departments WHERE id = ?', args: [id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function addSubject(departmentId, subject, cb) {
    const id = subject.id || crypto.randomUUID();
    db.execute({ sql: 'INSERT INTO subjects (id, departmentId, name, icon) VALUES (?, ?, ?, ?)', args: [id, departmentId, subject.name, subject.icon] })
        .then(() => cb(null, { id, departmentId, ...subject }))
        .catch(err => cb(err));
}

function deleteSubject(id, cb) {
    db.execute({ sql: 'DELETE FROM subjects WHERE id = ?', args: [id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function getQuestions(filters, cb) {
    let query = 'SELECT * FROM questions WHERE 1=1';
    let args = [];
    
    if (filters.subjectId) { query += ' AND subjectId = ?'; args.push(filters.subjectId); }
    if (filters.type) { query += ' AND type = ?'; args.push(filters.type); }
    if (filters.year) { query += ' AND year = ?'; args.push(filters.year); }
    
    db.execute({ sql: query, args })
        .then(res => {
            const parsed = res.rows.map(q => ({
                ...q,
                options: JSON.parse(q.options)
            }));
            cb(null, parsed);
        })
        .catch(err => cb(err));
}

function addQuestion(q, cb) {
    const id = q.id || crypto.randomUUID();
    db.execute({ sql: 'INSERT INTO questions (id, departmentId, subjectId, question, options, correctAnswer, explanation, type, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [id, q.departmentId, q.subjectId, q.question, JSON.stringify(q.options), q.correctAnswer, q.explanation, q.type, q.year || null] })
        .then(() => cb(null, { id, ...q }))
        .catch(err => cb(err));
}

function updateQuestion(id, q, cb) {
    db.execute({ sql: 'UPDATE questions SET question=?, options=?, correctAnswer=?, explanation=?, type=?, year=? WHERE id=?', args: [q.question, JSON.stringify(q.options), q.correctAnswer, q.explanation, q.type, q.year || null, id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

function deleteQuestion(id, cb) {
    db.execute({ sql: 'DELETE FROM questions WHERE id = ?', args: [id] })
        .then(() => cb(null))
        .catch(err => cb(err));
}

module.exports = {
    createUser, getUserByUsername, getUserById, incrementTokenVersion,
    submitPayment, approvePayment, revokeAccess, getAllUsers,
    getDepartments, addDepartment, deleteDepartment, addSubject, deleteSubject,
    getQuestions, addQuestion, updateQuestion, deleteQuestion
};
