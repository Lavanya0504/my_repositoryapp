const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const nodemailer = require('nodemailer');
const db = require('./DB_Conn.js'); // Your MySQL connection

const app = express();
const PORT = 5000;

// 📁 Paths
const publicPath = path.join(__dirname, 'public');
const uploadDir = path.join(__dirname, 'uploads');

// 🔐 Session Setup
app.use(session({
  secret: 'mySecretKey123',
  resave: false,
  saveUninitialized: true,
}));

// 🧠 Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(publicPath));
app.use('/uploads', express.static(uploadDir));

// 📂 Ensure uploads folder exists
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 🎞️ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'audio/mpeg', 'audio/mp3',
      'application/pdf', 'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// 📄 Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'Login.html'));
});

app.get('/Registration', (req, res) => {
  res.sendFile(path.join(publicPath, 'Registration.html'));
});

app.get('/home.html', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(publicPath, 'home.html'));
  } else {
    res.redirect('/');
  }
});

// 👤 Registration
app.post('/RegistrationValidation', (req, res) => {
  const { name, email, psw: password, cpass, address } = req.body;

  if (password !== cpass) {
    return res.status(400).send('Passwords do not match');
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).send('Hashing error');

    db.query(
      'INSERT INTO resort (name, email, password, address) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, address],
      (err) => {
        if (err) return res.status(500).send('Database error');
        res.redirect('/');
      }
    );
  });
});

// 🔑 Login
app.post('/LoginValidation', (req, res) => {
  const { username: email, password } = req.body;

  db.query('SELECT * FROM resort WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).send('Database error');
    if (results.length === 0) return res.status(401).send('Invalid email or password');

    const storedHash = results[0].password;
    bcrypt.compare(password, storedHash, (err, isMatch) => {
      if (err) return res.status(500).send('Compare error');
      if (isMatch) {
        req.session.loggedIn = true;
        res.redirect('/home.html');
      } else {
        res.status(401).send('Invalid email or password');
      }
    });
  });
});

// 📦 Get Portfolio
app.get('/api/portfolio', (req, res) => {
  db.query('SELECT * FROM portfolio ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'Fetch failed' });
    res.json(results);
  });
});

// 📤 Upload Portfolio
app.post('/api/portfolio', upload.single('media'), (req, res) => {
  const { title } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'File missing' });

  const mediaPath = '/uploads/' + file.filename;

  db.query(
    'INSERT INTO portfolio (title, media_path) VALUES (?, ?)',
    [title, mediaPath],
    (err) => {
      if (err) return res.status(500).json({ error: 'Insert failed' });
      res.json({ message: 'Uploaded successfully' });
    }
  );
});

// 🗑 Delete Portfolio
app.delete('/api/portfolio/:id', (req, res) => {
  const id = req.params.id;

  db.query('SELECT media_path FROM portfolio WHERE id = ?', [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Item not found' });

    const filePath = path.join(__dirname, results[0].media_path);
    db.query('DELETE FROM portfolio WHERE id = ?', [id], (err) => {
      if (err) return res.status(500).json({ error: 'Delete failed' });

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ message: 'Deleted successfully' });
    });
  });
});

// 📧 Contact Form: Send Email + Save to DB
app.post('/contact', async (req, res) => {
  const { name, email, message, recipientEmail } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lavanyahegde05@gmail.com',
      pass: 'ilmnwlxjdqkdrpag' // App password
    }
  });

  const mailOptions = {
    from: email,
    to: recipientEmail,
    subject: `New Contact Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await transporter.sendMail(mailOptions);

    // Save message to DB
    db.query(
      'INSERT INTO contact_messages (name, email, message, recipient_email) VALUES (?, ?, ?, ?)',
      [name, email, message, recipientEmail],
      (err) => {
        if (err) console.error('❌ Failed to save contact message:', err);
      }
    );

    res.status(200).json({ message: 'Message sent and stored successfully!' });
  } catch (err) {
    console.error('❌ Email failed:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 🔚 Fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'Pagenotfound.html'));
});

// 🚀 Start Server
app.listen(5000, () => {
  console.log(`✅ Server running at http://localhost:${5000}`);
});
