const db = require('./database');
const crypto = require('crypto');

const depts = [
    { id: 'dept-eng', name: 'Engineering & Technology', icon: '⚙️', color: '#10b981' },
    { id: 'dept-bus', name: 'Business & Economics', icon: '📊', color: '#f59e0b' },
    { id: 'dept-hlth', name: 'Health Sciences', icon: '🏥', color: '#ef4444' },
    { id: 'dept-soc', name: 'Social Sciences & Humanities', icon: '📚', color: '#3b82f6' }
];

const subjects = [
    // Engineering
    { id: 'sub-se', departmentId: 'dept-eng', name: 'Software Engineering', icon: '💻' },
    { id: 'sub-cs', departmentId: 'dept-eng', name: 'Computer Science', icon: '🖥️' },
    { id: 'sub-ce', departmentId: 'dept-eng', name: 'Civil Engineering', icon: '🏗️' },
    { id: 'sub-ee', departmentId: 'dept-eng', name: 'Electrical Engineering', icon: '⚡' },
    { id: 'sub-me', departmentId: 'dept-eng', name: 'Mechanical Engineering', icon: '⚙️' },
    // Business
    { id: 'sub-acc', departmentId: 'dept-bus', name: 'Accounting', icon: '📈' },
    { id: 'sub-mgt', departmentId: 'dept-bus', name: 'Management', icon: '💼' },
    { id: 'sub-eco', departmentId: 'dept-bus', name: 'Economics', icon: '📉' },
    { id: 'sub-mkt', departmentId: 'dept-bus', name: 'Marketing', icon: '🎯' },
    // Health
    { id: 'sub-pha', departmentId: 'dept-hlth', name: 'Pharmacy', icon: '💊' },
    { id: 'sub-nur', departmentId: 'dept-hlth', name: 'Nursing', icon: '🩺' },
    { id: 'sub-ph', departmentId: 'dept-hlth', name: 'Public Health', icon: '⚕️' },
    { id: 'sub-ml', departmentId: 'dept-hlth', name: 'Medical Lab', icon: '🔬' },
    // Social
    { id: 'sub-civ', departmentId: 'dept-soc', name: 'Civics', icon: '⚖️' },
    { id: 'sub-soc', departmentId: 'dept-soc', name: 'Sociology', icon: '🤝' },
    { id: 'sub-psy', departmentId: 'dept-soc', name: 'Psychology', icon: '🧠' },
    { id: 'sub-his', departmentId: 'dept-soc', name: 'History', icon: '🏛️' },
    { id: 'sub-eng', departmentId: 'dept-soc', name: 'English', icon: '📝' }
];

const types = ['mcq', 'previous', 'mock'];
const years = [2015, 2016, 2017, null, null];

const generateQuestions = () => {
    const qs = [];
    for (const sub of subjects) {
        for (let i = 0; i < 5; i++) {
            const type = types[i % types.length];
            const year = type === 'previous' ? years[i % 3] : null;
            qs.push({
                id: crypto.randomUUID(),
                departmentId: sub.departmentId,
                subjectId: sub.id,
                question: `Sample ${type} question ${i + 1} for ${sub.name}`,
                options: JSON.stringify(['Option A', 'Option B', 'Option C', 'Option D']),
                correctAnswer: i % 4,
                explanation: `Detailed explanation for question ${i + 1} of ${sub.name}`,
                type: type,
                year: year
            });
        }
    }
    return qs;
};

const questions = generateQuestions();

const util = require('util');
const addDept = util.promisify(db.addDepartment);
const addSubj = util.promisify(db.addSubject);
const addQues = util.promisify(db.addQuestion);

async function seed() {
    console.log('Waiting 2 seconds for DB init...');
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('Seeding departments...');
    for (const d of depts) {
        await addDept(d).catch(e => console.log('Skip:', e.message));
    }
    
    console.log('Seeding subjects...');
    for (const s of subjects) {
        await addSubj(s.departmentId, s).catch(e => console.log('Skip:', e.message));
    }
    
    console.log('Seeding questions...');
    for (const q of questions) {
        await addQues(q).catch(e => console.log('Skip:', e.message));
    }
    
    console.log('Seeding complete! You can start the server now.');
    process.exit(0);
}

seed();
