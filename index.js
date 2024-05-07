const cors = require("cors");
const express = require("express");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: ["http://localhost:5173"],
  }),
);



const port = 8000;
const secret = "mysecret";

let conn = null;

// function init connection mysql
const initMySQL = async () => {
  conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "tutorial",
  });
};


// อันนี้ลองregister
app.post('/api/register', async (req,res) => {
  try {
    const { username, password} = req.body
    const passwordHash = await bcrypt.hash(password, 10)
    const userData = {
      username,
      password: passwordHash
    }
    const [result] = await conn.query('INSERT INTO users SET ?',userData)
    res.json({
      message: 'insert ok la',
      result
    })
  } catch (error) {
    console.log('error', error);
    res.json({
      message: 'insert error la',
      error
    })
  }
})

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const [result] = await conn.query("SELECT * FROM users WHERE username = ?", [username]);
    if (!result.length) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).send({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ username, role: 'admin'}, secret, { expiresIn: '1h'});
    res.send({ message: "Login successful", token });
  } catch (error) {
    console.log('Error in /api/login:', error);
    res.status(500).send({ message: 'An error occurred while logging in' });
  }
});


app.get("/api/auth", async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token missing' });
    }

    const user = jwt.verify(token, secret);
    if (!user || !user.username) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch user data from the database
    const [checkResult] = await conn.query('SELECT * FROM users WHERE username = ?', user.username);
    if (!checkResult || !checkResult.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user exists, return user data
    const [result] = await conn.query('SELECT * FROM users');
    res.json({ users: result[0] });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Listen
app.listen(port, async () => {
  await initMySQL();
  console.log("Server started at port 8000");
});