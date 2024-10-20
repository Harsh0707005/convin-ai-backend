### Installation & Setup:
1. Clone the repository
   ```bash
   git clone https://github.com/Harsh0707005/convin-ai-backend
   cd convin-ai-backend
   ```

2. Install dependencies
   ```bash
   npm install
   ```
3. Start Server
   ```bash
   node index.js
   ```

<pre>Note: After installation register new users as the database will be empty on initial run</pre>

### API Doc:
<pre>https://app.swaggerhub.com/apis-docs/HARSHMASTER07705/Convin/1.0.0#/default/get_api_expenses_overall</pre>


### Endpoints:
   ```bash
   1. /api/register/user -> Register user
   2. /api/user -> Retrieve user details
   3. /api/expense/add -> Add Expense
   4. /api/expense/user -> Retrieve individual expense of specific user
   5. /api/expense -> Retrieve specific expense details
   6. /api/expenses/overall -> Retrieve overall expenses
   7. /api/generate-balance-sheet -> Generate balance sheet
   ```

### Example Images:
1. Register
   ![Register](/images/register.png)

2. Retrieve User
   ![Retrieve User](/images/retrieve_user.png)
     
3. Add Expense
   ![Add Expense](/images/add_expense.png)

4. Individual Expense
   ![Individual Expense](/images/individual_expense.png)

5. Overall Expense
   ![Overall Expense](/images/overall_expense.png)

6. Retrieve Expense
   ![Retrieve Expense](/images/retrieve_expense.png)
   
7. Balance Sheet (API Call)
   ![Balance Sheet](/images/balance_sheet.png)

8. Report (PDF)
   ![Report](/images/report.png)

