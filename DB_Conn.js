var mysql = require('mysql');

// Create connection
const con = mysql.createConnection({
  host: "localhost",        // Database host, usually localhost
  user: "root",             // MySQL user (default is 'root')
  password: "root1",         // MySQL password (make sure it's correct)
  database: "db1"        // The name of the database you want to use
});

// Connect to MySQL
con.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    return;
  }
  console.log("Connected to MySQL Database 'db1' successfully!");
});

// Export the connection for use in other files
module.exports = con;
