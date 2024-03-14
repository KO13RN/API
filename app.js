var express = require('express')
var cors = require('cors')
var app = express()
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
const bcrypt = require('bcrypt');
const saltRounds = 10;
var jwt = require('jsonwebtoken');
const secret = 'login-token'
const multer = require('multer');
const path = require('path');
app.use(express.json()); // built-in middleware for express

app.use(cors())
const mysql = require('mysql2');
// create the connection to database
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'mydb'
});


app.post('/register', jsonParser, function (req, res, next) {
  bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
    connection.execute(
      'INSERT INTO users (email, password, fname, lname) VALUES(?, ?, ?, ?)',
      [req.body.email, hash, req.body.fname, req.body.lname],
      function (err, results, fields) {
        if (err) {
          res.json({ status: 'error', message: err })
          return
        }
        res.json({ status: 'ok' })
      }
    );
  });
})




app.post('/login', jsonParser, function (req, res, next) {
  connection.execute(
    'SELECT * FROM users WHERE email=?',
    [req.body.email],
    function (err, users, fields) {
      if (err) { res.json({ status: 'error', message: err }); return }
      if (users.length == 0) { res.json({ status: 'error', message: 'no user found' }); return }
      bcrypt.compare(req.body.password, users[0].password, function (err, isLogin) {
        if (isLogin) {
          var token = jwt.sign({ email: users[0].email }, 'secret', { expiresIn: '24h' });
          res.json({ status: 'ok', massage: 'login success', token })
        } else {
          res.json({ status: 'error', massage: 'login failed' })
        }
      });
    }
  );
})

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads'); // Destination folder for storing images
  },
  filename: function (req, file, cb) {
    // Generating unique filename by appending current timestamp
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});


const upload = multer({ storage: storage });



app.use(express.static(path.join(__dirname, 'public'))); // Serving files from the 'public' folder



app.get('/search', function (req, res, next) {
  const searchTerm = req.query.q;

  if (!searchTerm) {
    res.status(400).json({ status: 'error', message: 'Search term is required' });
    return;
  }

  connection.execute(
    'SELECT id, name, data, pic_name FROM insects WHERE name LIKE ?',
    [`%${searchTerm}%`],
    function (err, results, fields) {
      if (err) {
        res.status(500).json({ status: 'error', message: err });
        return;
      }

      const resx = results.map(r => ({ id: r.id, name: r.name, data: r.data, pic_name: req.protocol + '://' + req.get('host') + req.baseUrl + '/uploads/' + r.pic_name }));
      res.json({ status: 'ok', insects: resx });
    }
  );
});





app.get('/insects', function (req, res, next) {
  connection.execute(
    'SELECT id, name, data, pic_name FROM insects',
    function (err, results, fields) {
      if (err) {
        res.json({ status: 'error', message: err });
        return;
      }
      const resx = results.map(r => ({ id: r.id, name: r.name, data: r.data, pic_name: req.protocol + '://' + req.get('host') + req.baseUrl + '/uploads/' + r.pic_name }));
      res.json({ status: 'ok', insects: resx });
    }
  );
});

app.get('/insects/:id', function (req, res, next) {
  const insectId = req.params.id;
  connection.execute(
    'SELECT id, name, data, pic_name FROM insects WHERE id = ?',
    [insectId],
    function (err, results, fields) {
      if (err) {
        res.json({ status: 'error', message: err });
        return;
      }
      if (results.length === 0) {
        res.json({ status: 'error', message: 'Insect not found' });
        return;
      }
      const resx = results.map(r => ({ id: r.id, name: r.name, data: r.data, pic_name: req.protocol + '://' + req.get('host') + req.baseUrl + '/uploads/' + r.pic_name }));
      res.json({ status: 'ok', insect: resx });
    }
  );
});


app.post('/upload', upload.single('image'), function (req, res, next) {

  const picName = req.file ? req.file.filename : null; // File name if uploaded, otherwise null

  res.json({ status: 'ok', data: picName });

});

app.post('/save_insects', function (req, res, next) {

  const name = req.body.Name;
  const data = req.body.Data || null; // Use null if data is not provided
  const pic_name = req.body.pic_name || null; // Use null if data is not provided

  // console.log(name);
  // console.log(data);
  // console.log(pic_name);

  if (!name) {
    return res.status(400).json({ status: 'error', message: 'Name field is required' });
  }

  connection.query(
    'INSERT INTO insects (name, data, pic_name) VALUES (?, ?, ?)',
    [name, data, pic_name],
    function (err, results, fields) {
      if (err) {
        return res.status(500).json({ status: 'error', message: err });
      }
      res.json({ status: 'ok', message: 'Data uploaded successfully' });
    }
  );
});


app.put('/insects/:id', jsonParser, function (req, res, next) {
  const insectId = req.params.id;
  const name = req.body.Name || null;
  const data = req.body.Data || null;
  const picName = req.body.pic_name ?? null

  // Add a validation check for the 'name' field
  if (!name) {
    res.status(400).json({ status: 'error', message: 'Name field is required' });
    return;
  }

  if (picName) { //Have
    connection.execute(
      'UPDATE insects SET name = ?, data = ?, pic_name = ? WHERE id = ?',
      [name, data, picName, insectId],
      function (err, results, fields) {
        if (err) {
          res.json({ status: 'error', message: err });
          return;
        }
        res.json({ status: 'ok', message: 'Insect data updated successfully' });
      }
    );
  } else { //Not Have
    connection.execute(
      'UPDATE insects SET name = ?, data = ? WHERE id = ?',
      [name, data, insectId],
      function (err, results, fields) {
        if (err) {
          res.json({ status: 'error', message: err });
          return;
        }
        res.json({ status: 'ok', message: 'Insect data updated successfully' });
      }
    );
  }



});


// // Add this route for editing an insect
// app.put('/edit/:id', jsonParser, upload.single('image'), function (req, res, next) {
//   const insectId = req.params.id;
//   const name = req.body.Name;
//   const data = req.body.Data || null;
//   const picName = req.file ? req.file.filename : null;

//   // Add a validation check for the 'name' field
//   if (!name) {
//     return res.status(400).json({ status: 'error', message: 'Name field is required' });
//   }

//   connection.execute(
//     'UPDATE insects SET name = ?, data = ?, pic_name = ? WHERE id = ?',
//     [name, data, picName, insectId],
//     function (err, results, fields) {
//       if (err) {
//         res.json({ status: 'error', message: err });
//         return;
//       }
//       res.json({ status: 'ok', message: 'Insect data updated successfully' });
//     }
//   );
// });



app.delete('/insects/:id', function (req, res, next) {
  const insectId = req.params.id;
  connection.execute(
    'DELETE FROM insects WHERE id = ?',
    [insectId],
    function (err, results, fields) {
      if (err) {
        res.status(500).json({ status: 'error', message: err });
        return;
      }
      res.json({ status: 'ok', message: 'Insect deleted successfully' });
    }
  );
});







app.post('/authen', jsonParser, function (req, res, next) {
  try {
    const token = req.headers.authorization.split(' ')[1]
    var decoded = jwt.verify(token, 'secret');
    res.json({ status: 'ok', decoded })
  } catch (err) {
    res.json({ status: 'error', massage: err.massage })
  }
})

app.listen(3333, function () {
  console.log('CORS-enabled web server listening on port 3333')
})