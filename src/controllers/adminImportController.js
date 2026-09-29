import User from '../models/User.js';

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const splitRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = splitRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    return obj;
  });

  return { headers, rows };
};

const generatePassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 8; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd;
};

export const importUsers = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'No CSV file uploaded',
        requestId: req.id,
      });
    }

    const text = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(text);

    if (!headers.includes('email') || !headers.includes('name')) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'CSV must have at least "name" and "email" columns',
        requestId: req.id,
      });
    }

    const results = {
      total: rows.length,
      created: 0,
      failed: 0,
      errors: [],
      createdUsers: [],
    };

    const emailRegex = /^\S+@\S+\.\S+$/;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNumber = i + 2;

      try {
        const name = (row.name || '').trim();
        const email = (row.email || '').toLowerCase().trim();
        const role = (row.role || 'student').toLowerCase().trim();
        let password = (row.password || '').trim();

        if (!name) throw new Error('Missing name');
        if (!email) throw new Error('Missing email');
        if (!emailRegex.test(email)) throw new Error('Invalid email');

        const allowedRoles = ['student', 'instructor', 'admin'];
        if (!allowedRoles.includes(role)) {
          throw new Error(`Invalid role: ${role}`);
        }

        if (role === 'admin') {
          throw new Error('Admin accounts cannot be created via import');
        }

        const existing = await User.findOne({ email });
        if (existing) {
          throw new Error('Email already exists');
        }

        const generated = !password;
        if (generated) {
          password = generatePassword();
        } else if (password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }

        const user = await User.create({
          name,
          email,
          password,
          role,
          isEmailVerified: false,
          isInstructorApproved: role === 'instructor' ? false : true,
        });

        results.created++;
        results.createdUsers.push({
          line: lineNumber,
          name,
          email,
          role,
          password: generated ? password : '(provided)',
          generated,
        });
      } catch (err) {
        results.failed++;
        results.errors.push({
          line: lineNumber,
          email: row.email || '',
          message: err.message,
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const toCSV = (rows, headers) => {
  const headerLine = headers.map((h) => escapeCSV(h.label)).join(',');
  const bodyLines = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h.key])).join(',')
  );
  return [headerLine, ...bodyLines].join('\n');
};

export const exportUsersCSV = async (req, res, next) => {
  try {
    const users = await User.find({ isDeleted: false }).sort('-createdAt');

    const rows = users.map((u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      isEmailVerified: u.isEmailVerified ? 'yes' : 'no',
      isInstructorApproved: u.isInstructorApproved ? 'yes' : 'no',
      isActive: u.isActive ? 'yes' : 'no',
      createdAt: u.createdAt.toISOString(),
    }));

    const headers = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'isEmailVerified', label: 'Email Verified' },
      { key: 'isInstructorApproved', label: 'Instructor Approved' },
      { key: 'isActive', label: 'Active' },
      { key: 'createdAt', label: 'Created At' },
    ];

    const csv = toCSV(rows, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="learnhub-users-${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

export const exportEnrollmentsCSV = async (req, res, next) => {
  try {
    const Enrollment = (await import('../models/Enrollment.js')).default;

    const enrollments = await Enrollment.find({ status: 'active' })
      .populate('student', 'name email')
      .populate('course', 'title')
      .sort('-createdAt');

    const rows = enrollments.map((e) => ({
      studentName: e.student?.name || '',
      studentEmail: e.student?.email || '',
      courseTitle: e.course?.title || '',
      progress: `${e.progressPercent || 0}%`,
      completedLessons: e.completedCount || 0,
      totalLessons: e.totalLessons || 0,
      paid: e.paid ? 'yes' : 'no',
      paidAmount: e.paidAmount || 0,
      enrolledAt: e.createdAt.toISOString(),
    }));

    const headers = [
      { key: 'studentName', label: 'Student Name' },
      { key: 'studentEmail', label: 'Student Email' },
      { key: 'courseTitle', label: 'Course' },
      { key: 'progress', label: 'Progress' },
      { key: 'completedLessons', label: 'Completed Lessons' },
      { key: 'totalLessons', label: 'Total Lessons' },
      { key: 'paid', label: 'Paid' },
      { key: 'paidAmount', label: 'Paid Amount' },
      { key: 'enrolledAt', label: 'Enrolled At' },
    ];

    const csv = toCSV(rows, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="learnhub-enrollments-${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
};