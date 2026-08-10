const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const crypto = require('crypto');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        db.run('PRAGMA journal_mode = WAL;');
        db.run('PRAGMA foreign_keys = ON;');
        db.exec(`
            CREATE TABLE IF NOT EXISTS departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '📚',
                color TEXT DEFAULT '#10b981',
                sort_order INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS subjects (
                id TEXT PRIMARY KEY,
                departmentId TEXT NOT NULL,
                name TEXT NOT NULL,
                icon TEXT DEFAULT '📖',
                FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_paid BOOLEAN DEFAULT 0,
                transaction_id TEXT,
                full_name TEXT,
                token_version INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

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
            );
        `);
    }
});

function createUser(username, password, cb) {
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], function(err) {
        if (err) return cb(err);
        getUserById(this.lastID, cb);
    });
}

function getUserByUsername(username, cb) {
    db.get('SELECT * FROM users WHERE username = ?', [username], cb);
}

function getUserById(id, cb) {
    db.get('SELECT * FROM users WHERE id = ?', [id], cb);
}

function incrementTokenVersion(id, cb) {
    db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id], function(err) {
        if (err) return cb(err);
        db.get('SELECT token_version FROM users WHERE id = ?', [id], (err, row) => {
            if (err) return cb(err);
            cb(null, row ? row.token_version : 0);
        });
    });
}

function submitPayment(id, transactionId, fullName, cb) {
    db.run('UPDATE users SET transaction_id = ?, full_name = ? WHERE id = ?', [transactionId, fullName, id], cb);
}

function approvePayment(id, cb) {
    db.run('UPDATE users SET is_paid = 1 WHERE id = ?', [id], cb);
}

function revokeAccess(id, cb) {
    db.run('UPDATE users SET is_paid = 0, token_version = token_version + 1 WHERE id = ?', [id], cb);
}

function getAllUsers(cb) {
    db.all('SELECT id, username, is_paid, transaction_id, full_name, created_at FROM users', cb);
}

function getDepartments(cb) {
    db.all('SELECT * FROM departments ORDER BY sort_order ASC, name ASC', (err, departments) => {
        if (err) return cb(err);
        db.all('SELECT * FROM subjects ORDER BY name ASC', (err, subjects) => {
            if (err) return cb(err);
            const depsWithSubs = departments.map(d => ({
                ...d,
                subjects: subjects.filter(s => s.departmentId === d.id)
            }));
            cb(null, depsWithSubs);
        });
    });
}

function addDepartment(dept, cb) {
    const id = dept.id || crypto.randomUUID();
    db.run('INSERT INTO departments (id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)', 
        [id, dept.name, dept.icon, dept.color, dept.sort_order || 0], 
        function(err) {
            if (err) return cb(err);
            db.get('SELECT * FROM departments WHERE id = ?', [id], cb);
        }
    );
}

function deleteDepartment(id, cb) {
    db.run('DELETE FROM departments WHERE id = ?', [id], cb);
}

function addSubject(departmentId, subject, cb) {
    const id = subject.id || crypto.randomUUID();
    db.run('INSERT INTO subjects (id, departmentId, name, icon) VALUES (?, ?, ?, ?)',
        [id, departmentId, subject.name, subject.icon],
        function(err) {
            if (err) return cb(err);
            db.get('SELECT * FROM subjects WHERE id = ?', [id], cb);
        }
    );
}

function deleteSubject(id, cb) {
    db.run('DELETE FROM subjects WHERE id = ?', [id], cb);
}

function getQuestions(filters, cb) {
    let query = 'SELECT * FROM questions WHERE 1=1';
    let params = [];
    if (filters.subjectId) {
        query += ' AND subjectId = ?';
        params.push(filters.subjectId);
    }
    if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
    }
    if (filters.year) {
        query += ' AND year = ?';
        params.push(filters.year);
    }
    db.all(query, params, (err, rows) => {
        if (err) return cb(err);
        const questions = rows.map(r => ({
            ...r,
            options: JSON.parse(r.options)
        }));
        cb(null, questions);
    });
}

function addQuestion(q, cb) {
    const id = q.id || crypto.randomUUID();
    const optionsStr = typeof q.options === 'string' ? q.options : JSON.stringify(q.options);
    db.run('INSERT INTO questions (id, departmentId, subjectId, question, options, correctAnswer, explanation, type, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, q.departmentId, q.subjectId, q.question, optionsStr, q.correctAnswer, q.explanation || '', q.type || 'mcq', q.year || null],
        function(err) {
            if (err) return cb(err);
            db.get('SELECT * FROM questions WHERE id = ?', [id], cb);
        }
    );
}

function updateQuestion(id, q, cb) {
    const optionsStr = typeof q.options === 'string' ? q.options : JSON.stringify(q.options);
    db.run('UPDATE questions SET departmentId = ?, subjectId = ?, question = ?, options = ?, correctAnswer = ?, explanation = ?, type = ?, year = ? WHERE id = ?',
        [q.departmentId, q.subjectId, q.question, optionsStr, q.correctAnswer, q.explanation, q.type, q.year, id],
        function(err) {
            if (err) return cb(err);
            db.get('SELECT * FROM questions WHERE id = ?', [id], cb);
        }
    );
}

function deleteQuestion(id, cb) {
    db.run('DELETE FROM questions WHERE id = ?', [id], cb);
}

module.exports = {
    db,
    createUser,
    getUserByUsername,
    getUserById,
    incrementTokenVersion,
    submitPayment,
    approvePayment,
    revokeAccess,
    getAllUsers,
    getDepartments,
    addDepartment,
    deleteDepartment,
    addSubject,
    deleteSubject,
    getQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion
};
