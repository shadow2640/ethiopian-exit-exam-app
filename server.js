const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const JWT_SECRET = 'your-super-secret-jwt-key';

function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username, token_version: user.token_version }, JWT_SECRET);
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Invalid token' });
        
        db.getUserById(decoded.id, (err, user) => {
            if (err || !user) return res.status(401).json({ error: 'User not found' });
            
            if (user.token_version !== decoded.token_version) {
                return res.status(403).json({ error: 'SESSION_EXPIRED', message: 'Logged in from another device' });
            }
            
            req.user = user;
            next();
        });
    });
}

// Auth Routes
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    db.createUser(username, password, (err, user) => {
        if (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Username already exists. Please choose another one.' });
            }
            return res.status(400).json({ error: err.message });
        }
        res.json({ token: generateToken(user), user: { id: user.id, username: user.username, is_paid: user.is_paid, must_change_password: user.must_change_password, free_questions_used: user.free_questions_used } });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.getUserByUsername(username, (err, user) => {
        if (err || !user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
        
        db.incrementTokenVersion(user.id, (err, newVersion) => {
            if (err) return res.status(500).json({ error: 'Server error' });
            user.token_version = newVersion;
            res.json({ token: generateToken(user), user: { id: user.id, username: user.username, is_paid: user.is_paid, must_change_password: user.must_change_password, free_questions_used: user.free_questions_used } });
        });
    });
});

app.get('/api/user/me', authenticate, (req, res) => {
    res.json({ user: { id: req.user.id, username: req.user.username, is_paid: req.user.is_paid, transaction_id: req.user.transaction_id, token_version: req.user.token_version, must_change_password: req.user.must_change_password, free_questions_used: req.user.free_questions_used } });
});

app.post('/api/user/payment', authenticate, (req, res) => {
    const { transactionId, fullName } = req.body;
    if (!transactionId || !fullName) return res.status(400).json({ error: 'Full name and Transaction ID are required' });
    db.submitPayment(req.user.id, transactionId, fullName, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.post('/api/user/change-password', authenticate, (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    
    db.changePassword(req.user.id, newPassword, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.post('/api/user/track-usage', authenticate, (req, res) => {
    const { count } = req.body;
    if (!count || count <= 0) return res.json({ success: true });
    
    db.incrementFreeQuestions(req.user.id, count, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

// Student Routes
app.get('/api/departments', (req, res) => {
    db.getDepartments((err, deps) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ departments: deps });
    });
});

app.get('/api/questions', authenticate, (req, res) => {
    const { subjectId, type, year } = req.query;
    db.getQuestions({ subjectId, type, year: year ? parseInt(year) : undefined }, (err, questions) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        
        if (!req.user.is_paid) {
            const used = req.user.free_questions_used || 0;
            const remaining = Math.max(0, 10 - used);
            if (remaining === 0) {
                return res.status(403).json({ error: 'Free trial limit reached' });
            }
            return res.json({ questions: questions.slice(0, remaining) });
        }
        
        res.json({ questions });
    });
});

// Admin Routes (no auth check implemented per prompt, but would typically have one)
app.get('/api/admin/users', (req, res) => {
    db.getAllUsers((err, users) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ users });
    });
});

app.post('/api/admin/reset-password/:id', (req, res) => {
    const tempPassword = 'reset' + Math.floor(1000 + Math.random() * 9000);
    db.resetPassword(req.params.id, tempPassword, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ tempPassword });
    });
});

app.post('/api/admin/approve-payment', (req, res) => {
    const { userId } = req.body;
    db.approvePayment(userId, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/revoke-user', (req, res) => {
    const { userId } = req.body;
    db.revokeAccess(userId, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.get('/api/admin/departments', (req, res) => {
    db.getDepartments((err, deps) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ departments: deps });
    });
});

app.post('/api/admin/departments', (req, res) => {
    db.addDepartment(req.body, (err, dept) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(dept);
    });
});

app.delete('/api/admin/departments/:id', (req, res) => {
    db.deleteDepartment(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/departments/:id/subjects', (req, res) => {
    db.addSubject(req.params.id, req.body, (err, subject) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(subject);
    });
});

app.delete('/api/admin/subjects/:id', (req, res) => {
    db.deleteSubject(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

app.get('/api/admin/questions', (req, res) => {
    db.getQuestions({}, (err, questions) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ questions });
    });
});

app.post('/api/admin/questions', (req, res) => {
    db.addQuestion(req.body, (err, q) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(q);
    });
});

app.put('/api/admin/questions/:id', (req, res) => {
    db.updateQuestion(req.params.id, req.body, (err, q) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(q);
    });
});

app.delete('/api/admin/questions/:id', (req, res) => {
    db.deleteQuestion(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json({ success: true });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 Ethiopian Exit Exam App Server`);
    console.log(`📡 Listening on http://localhost:${PORT}`);
    console.log(`=========================================\n`);
});
