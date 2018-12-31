const express = require('express')
const app = express();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const uuid = require('uuid/v4');
const cookieParser = require('cookie-parser')

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true,
}));
app.use(cookieParser());

const db = mysql.createConnection({
  host: "0.0.0.0",
  port: "3307",
  user: "root",
  password: "password",
  database: 'ZC_CHAT'
});

const secret = speakeasy.generateSecret({ length: 20, name: 'ZCChat' });

db.connect(function (err) {
  if (err) throw err;
});

handleHomeIndex = (req, res) => {
  res.send('Hello World@@@');
}

handleLogin = (username, cb) => {
  db.query(`select * from users where username = "${username}"`, function (err, result) {
    if (err) cb(err, {});
    if (result[0]) return cb(null, {registered: true});
    const secret = speakeasy.generateSecret({ name: 'ZCChat', length: 20 });
    db.query(`insert into users (username, secret) values ("${username}", "${secret.base32}")`, function (err, result) {
      if (err) throw err;
      QRCode.toDataURL(secret.otpauth_url, function (err, image_data) {
        cb(null, { img: image_data }); // A data URI for the QR code image
      });
    });
  });
}

handleOtp = (req, res) => {
  const { username, otp } = req.body;
  console.log(12)

  if (!username) return res.status(400).json({
    status: 0,
    message: 'username required',
  });
  console.log(13)

  if (!otp) return handleLogin(username, (err, data) => {
    if (err) throw err;
    res.json(data);
  });
  console.log(14)

  db.query(`select id, secret from users where username = "${username}"`, (err, result) => {
    if (err) throw err;
    const user = result[0];
    if (!user) throw new Error("no user found");
    const verified = speakeasy.totp.verify({
      secret: user.secret,
      encoding: 'base32',
      token: otp,
    });


    if(verified) {
      const token = uuid();
      db.query(`insert into user_tokens (token, user_id) values ("${token}", ${user.id})`, (err) => {
        if (err) throw err;
        res.cookie('token', token, {
          path: '/',
        }).json({
          loggedin: verified
        });
      });
    } else {
      res.json({
        loggedin: false,
      });
    }

  });
}

checkLoginStatus = (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({status: 0});
  db.query(`select id from user_tokens where token = "${token}"`, (err, result) => {
    if (err) throw err;
    res.json({
      status: !!result[0],
      cookie: 'req.cookies',
    });
  })
}

app.get('/', handleHomeIndex);
app.post('/otp', handleOtp);
app.get('/is-logged-in', checkLoginStatus);

app.listen(3000, () => console.log('Example app listening on port 3000!'))
