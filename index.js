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


//add license plate
app.post('/api/addLicense', async (req, res) => {
  try {
    const { first_name, last_name, license_number, province_id } = req.body; 
    
    // Check if the provided province ID is valid
    const [existingProvince] = await conn.query('SELECT * FROM provinces WHERE id = ?', [province_id]);
    if (existingProvince.length === 0) {
      return res.status(400).json({ message: 'Invalid province ID' });
    }

    // Check if the provided license number already exists for the given province
    const [existingLicense] = await conn.query('SELECT * FROM license_plate WHERE license_number = ? AND province_id = ?', [license_number, province_id]);
    if (existingLicense.length > 0) {
      return res.status(400).json({ message: 'License number already exists for this province' });
    }

    const licenseData = {
      first_name,
      last_name,
      license_number,
      province_id
    };

    const [result] = await conn.query('INSERT INTO license_plate SET ?', licenseData);
    res.json({
      message: 'License plate inserted successfully',
      result
    });
  } catch (error) {
    console.error('Error inserting license plate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



// Get license plates with province names
app.get('/api/licensePlates', async (req, res) => {
  try {
    const query = `
      SELECT lp.*, p.province
      FROM license_plate lp
      JOIN provinces p ON lp.province_id = p.id
    `;
    const [result] = await conn.query(query);
    res.json(result);
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Delete license plate by ID
app.delete('/api/deleteLicense/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting license plate with ID:', id); // Add logging statement
    const [result] = await conn.query('DELETE FROM license_plate WHERE id = ?', id);
    console.log('Query result:', result); // Add logging statement
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'License plate not found' });
    }
    res.json({ message: 'License plate deleted successfully' });
  } catch (error) {
    console.log('Error deleting license plate:', error); // Add logging statement
    res.status(500).json({ error: 'Internal server error' });
  }
});





//add province

app.post("/api/addProvince", async (req, res) => {
  try {
    const provincesList = [
      "กระบี่", "กรุงเทพมหานคร", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น",
      "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่",
      "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม",
      "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ",
      "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา	", "พะเยา",
      "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่",
      "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง",
      "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร",
      "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว",
      "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู",
      "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"
    ];
    const values = provincesList.map((province) => [province]);
    const [result] = await conn.query("INSERT INTO provinces (province) VALUES ?", [values]);
    res.json({ message: "Provinces added successfully", result });
  } catch (error) {
      console.log('Error:', error);
      res.json({ error });
  }
});


app.get("/api/province", async (req, res) =>{
  try {
    const [result] = await conn.query('SELECT * FROM provinces');
    res.json({ users: result });
  } catch (error) {
    console.log('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})


// Listen
app.listen(port, async () => {
  await initMySQL();
  console.log("Server started at port 8000");
});