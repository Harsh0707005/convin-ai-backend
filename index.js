const exp = require('constants');
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
    db.run("PRAGMA foreign_keys = ON");
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
            return res.status(500).json({ message: "Internal Server Error" })
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
            return res.status(500).json({ message: "Internal Server Error" })
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
            splitAmount[participant] = (split[participant] / 100) * amount;
        })
    } else {
        return res.status(400).json({ message: "Unknown option" })
    }

    const query = `INSERT INTO expense(amount, purpose, option, split, created_by, created_at) values(?, ?, ?, ?, ?, ?)`

    db.run(query, [amount, purpose, option, JSON.stringify(splitAmount), "1", new Date().toISOString()], function (err) {
        if (err) {
            console.log("Error 500: /api/expense/add => db insert " + err.message);
            return res.status(500).json({ message: "Internal Server Error" })
        }
        return res.status(201).json({ message: "Expense added successfully", expId: this.lastID });
    })
})

app.get("/api/expense/user", (req, res) => {
    const userId = req.query.userId;

    checkExistence(userId, "id", "users", (err, resCheckUser) => {
        if (err) {
            return res.status(500).json({ message: "Internal Server Error" });
        } else if (resCheckUser.length === 0) {
            return res.status(400).json({ message: "User not found" });
        }

        const expense = { "total": 0, "details": [] };

        const query = `SELECT * FROM expense WHERE split LIKE ?`;
        db.all(query, [`%"${userId}"%`], (err, rows) => {
            if (err) {
                console.log("Error 500: /api/expense/user => db select " + err.message);
                return res.status(500).json({ message: "Internal Server Error" });
            } else if (rows.length === 0) {
                return res.status(200).json({ message: "No expenditures found" });
            }

            rows.forEach((exp) => {
                let spent = JSON.parse(exp.split)[userId];
                expense["total"] += spent;
                expense["details"].push({ purpose: exp.purpose, amount: spent });
            });

            return res.status(200).json({ message: "Expenses fetched successfully", data: expense });
        });
    });
});

app.get("/api/expense", (req, res)=>{
    const expId = req.query.expId;

    checkExistence(expId, "exp_id", "expense", (err, resCheckExpense)=>{
        if (err) {
            return res.status(500).json({ message: "Internal Server Error" });
        } else if (resCheckExpense.length === 0) {
            return res.status(400).json({ message: "Expense not found" });
        }
        
        resCheckExpense[0].split = JSON.parse(resCheckExpense[0].split);

        return res.status(200).send(resCheckExpense)
    })

})

app.get("/api/expenses/overall", (req, res) => {
    const userExpenses = {};

    const query = `SELECT * FROM expense`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.log("Error 500: /api/expenses/overall => db select " + err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }
        
        if (rows.length === 0) {
            return res.status(200).json({ message: "No expenses found", data: {} });
        }

        rows.forEach((exp) => {
            const splitAmounts = JSON.parse(exp.split); // Parse the split JSON field
            
            Object.keys(splitAmounts).forEach(userId => {
                if (!userExpenses[userId]) {
                    userExpenses[userId] = 0;  // Initialize if not already present
                }
                userExpenses[userId] += splitAmounts[userId]; // Add up the expenses
            });
        });

        const userQuery = `SELECT id, name, email FROM users WHERE id IN (${Object.keys(userExpenses).join(",")})`;
        
        db.all(userQuery, [], (err, users) => {
            if (err) {
                console.log("Error 500: /api/expenses/overall => db select users " + err.message);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            const result = users.map(user => ({
                userId: user.id,
                name: user.name,
                email: user.email,
                totalOwed: userExpenses[user.id]
            }));

            return res.status(200).json({ message: "Overall expenses fetched successfully", data: result });
        });
    });
});



function checkExistence(id, column, table, callback) {
    const query = `SELECT * FROM ${table} WHERE ${column} = ?`;
    db.all(query, [id], (err, rows) => {
        if (err) {
            console.log("Error: checkExistence => db select " + err.message);
            return callback(err, null);
        }
        return callback(null, rows);
    });
}

app.listen(port, () => {
    console.log("Listening on 3000")
})