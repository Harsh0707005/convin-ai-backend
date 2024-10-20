const exp = require('constants');
const express = require('express')
const sqlite = require('sqlite3').verbose();
const fs = require('fs');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const path = require('path');

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

app.use('/reports', express.static(path.join(__dirname, 'reports')));

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

app.get("/api/expense", (req, res) => {
    const expId = req.query.expId;

    checkExistence(expId, "exp_id", "expense", (err, resCheckExpense) => {
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
            const splitAmounts = JSON.parse(exp.split);

            Object.keys(splitAmounts).forEach(userId => {
                if (!userExpenses[userId]) {
                    userExpenses[userId] = 0;
                }
                userExpenses[userId] += splitAmounts[userId];
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

app.get("/api/generate-balance-sheet", (req, res) => {
    const userExpenses = {};

    const expenseQuery = `SELECT * FROM expense`;

    db.all(expenseQuery, [], (err, expenseRows) => {
        if (err) {
            console.log("Error 500: /api/expenses/pdf => db select " + err.message);
            return res.status(500).json({ message: "Internal Server Error" });
        }

        if (expenseRows.length === 0) {
            return res.status(200).json({ message: "No expenses found" });
        }

        expenseRows.forEach((exp) => {
            const splitAmounts = JSON.parse(exp.split);

            Object.keys(splitAmounts).forEach(userId => {
                if (!userExpenses[userId]) {
                    userExpenses[userId] = { total: 0, expenses: [] };
                }
                userExpenses[userId].total += splitAmounts[userId];
                userExpenses[userId].expenses.push({
                    purpose: exp.purpose,
                    amount: splitAmounts[userId]
                });
            });
        });

        const userQuery = `SELECT id, name, email FROM users WHERE id IN (${Object.keys(userExpenses).join(",")})`;

        db.all(userQuery, [], (err, userRows) => {
            if (err) {
                console.log("Error 500: /api/expenses/pdf => db select users " + err.message);
                return res.status(500).json({ message: "Internal Server Error" });
            }

            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text("Expense Report", 14, 20);

            let currentY = 30;
            userRows.forEach((user) => {
                const userId = user.id;
                const individualExpenses = userExpenses[userId].expenses;

                doc.setFontSize(12);
                doc.text(`Expenses for ${user.name} (${user.email})`, 14, currentY);

                const expenseTableData = individualExpenses.map((exp, index) => [index + 1, exp.purpose, exp.amount]);

                doc.autoTable({
                    startY: currentY + 10, // Give some space after title
                    head: [['#', 'Purpose', 'Amount']],
                    body: expenseTableData,
                });

                currentY = doc.lastAutoTable.finalY + 10;
                doc.text(`Total for ${user.name}: ${userExpenses[userId].total}`, 14, currentY);

                currentY += 20;
            });

            const spaceNeeded = currentY + 40;
            if (spaceNeeded > doc.internal.pageSize.height) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(16);
            doc.text("Overall Expenses", 14, currentY);
            currentY += 10;

            const overallExpenseTable = userRows.map(user => [
                user.name,
                user.email,
                userExpenses[user.id].total
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Name', 'Email', 'Total Owed']],
                body: overallExpenseTable,
            });

            if (!fs.existsSync('./reports')) {
                fs.mkdirSync('./reports');
            }

            const pdfPath = `reports/expense_report_${Date.now()}.pdf`;
            doc.save(pdfPath);

            // can be used when connected with frontend
            // res.download(pdfPath, (err) => {
            //     if (err) {
            //         console.log("Error 500: /api/expenses/pdf => PDF download " + err.message);
            //         return res.status(500).json({ message: "Error generating PDF" });
            //     }
            // });

            res.status(200).json({ message: "PDF generated successfully", filePath: `http://127.0.0.1:${port}/${pdfPath}` });
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