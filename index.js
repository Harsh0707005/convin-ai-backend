const express = require('express')
const sqlite = require('sqlite3').verbose();
const fs = require('fs');

if (!fs.existsSync("database.sqlite")) {
    fs.writeFile("database.sqlite", "", (err) => {
        if (err) {
            console.log("Error creating database file", err);
            return;
        }
        console.log("Database file created successfully");
    })
}

const db = new sqlite.Database('./database.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL
        )`)

    // db.run(`DROP TABLE expense`)
    db.run(`CREATE TABLE IF NOT EXISTS expense (
            exp_id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount TEXT NOT NULL,
            purpose TEXT,
            split INTEGER,
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )`);
})

const port = 3000

const app = express()

app.use(express.json())

app.post("/api/register/user", (req, res) => {
    const { name, email, phone } = req.body;

    const query = `INSERT INTO users(name, email, phone) values(?,?,?)`;
    db.run(query, [name, email, phone], function (err) {
        if (err) {
            console.log("Error 500: /api/register/user => db insert " + err.message);
            return res.status(500).json({ error: err.message })
        }
        return res.status(201).json({ message: "Registration successfull", userId: this.lastID })
    })
})

app.get("/api/user", (req, res) => {
    const email = req.query.email;
    const phone = req.query.phone;

    const query = `SELECT * FROM users WHERE email=? OR phone=?`;

    db.all(query, [email, phone], (err, rows) => {
        if (err) {
            console.log("Error 500: /api/user => db select " + err.message);
            return res.status(500).json({ error: err.message })
        }
        return res.status(200).json({ message: "Data fetched successfully", data: rows })
    })
})

app.post("/api/expense/add", (req, res) => {
    const { amount, purpose, split } = req.body;

    const query = `INSERT INTO expense(amount, purpose, split) values(?,?, ?)`

    db.run(query, [amount, purpose, JSON.stringify(split)], function (err) {
        if (err) {
            console.log("Error 500: /api/expense/add => db insert " + err.message);
            return res.status(500).json({ error: err.message })
        }
        return res.status(201).json({ message: "expense added successfully", expId: this.lastID });
    })
})

app.get("/api/s", (req, res)=>{
    const s = req.query.s;

    const query = `SELECT * FROM expense WHERE `
})

app.listen(port, () => {
    console.log("Listening on 3000")
})