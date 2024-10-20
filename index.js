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
            split TEXT,
            option TEXT,
            created_by INTEGER,
            created_at DATETIME,
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
    const { amount, purpose, option, split } = req.body;
    let participants = Object.keys(split)
    const splitAmount = {}

    if (option === "equal") {
        participants.forEach((participant) => {
            splitAmount[participant] = amount / participants.length;
        })
    } else if (option === "exact") {
        if (Object.values(split).reduce((tempSum, item) => tempSum + item, 0) !== amount) {
            return res.status(400).json({ message: "Sum of split amount doesn't match total amount!" })
        }

        participants.forEach((participant) => {
            splitAmount[participant] = split[participant]
        })
    } else if (option === "percentage") {
        if (Object.values(split).reduce((tempSum, item) => tempSum + item, 0) !== 100) {
            return res.status(400).json({ message: "Sum of split percentages is not equal to 100!" })
        }
        participants.forEach((participant) => {
            splitAmount[participant] = (split[participant]/100)*amount;
        })
    } else {
        return res.status(400).json({ message: "Unknown option" })
    }
    
    const query = `INSERT INTO expense(amount, purpose, option, split, created_by, created_at) values(?, ?, ?, ?, ?, ?)`

    db.run(query, [amount, purpose, option, JSON.stringify(splitAmount), "101", new Date().toISOString()], function (err) {
        if (err) {
            console.log("Error 500: /api/expense/add => db insert " + err.message);
            return res.status(500).json({ error: err.message })
        }
        return res.status(201).json({ message: "Expense added successfully", expId: this.lastID });
    })
})

app.listen(port, () => {
    console.log("Listening on 3000")
})