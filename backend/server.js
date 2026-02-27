const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'bd_horyslavets'
};

app.get('/', (req, res) => {
    res.send('API працює');
});

app.post('/api/query', async (req, res) => {
    try {
        const { action, tableName, data, recordId } = req.body;
        const connection = await mysql.createConnection(dbConfig);
        
        let result;
        
        switch (action) {
            case 'getTables':
                const [tableRows] = await connection.execute('SHOW TABLES');
                result = tableRows.map(row => Object.values(row)[0]);
                break;
                
            case 'getStructure':
                const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
                result = columns;
                break;
                
            case 'getData':
                const [tableData] = await connection.execute(`SELECT * FROM ${tableName}`);
                result = tableData;
                break;
                
            case 'insert':
                const cols = Object.keys(data).join(', ');
                const placeholders = Object.keys(data).map(() => '?').join(', ');
                const values = Object.values(data);
                const insertQuery = `INSERT INTO ${tableName} (${cols}) VALUES (${placeholders})`;
                const [insertResult] = await connection.execute(insertQuery, values);
                result = { success: true, insertId: insertResult.insertId };
                break;
                
            case 'update':
                const [updateColumns] = await connection.execute(`DESCRIBE ${tableName}`);
                const primaryKey = updateColumns.find(col => col.Key === 'PRI')?.Field;
                
                if (!primaryKey) {
                    throw new Error('Не знайдено первинний ключ');
                }
                
                const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
                const updateValues = [...Object.values(data), recordId];
                const updateQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ?`;
                await connection.execute(updateQuery, updateValues);
                result = { success: true };
                break;
                
            case 'delete':
                const [deleteColumns] = await connection.execute(`DESCRIBE ${tableName}`);
                const deletePK = deleteColumns.find(col => col.Key === 'PRI')?.Field;
                
                if (!deletePK) {
                    throw new Error('Не знайдено первинний ключ');
                }
                
                const deleteQuery = `DELETE FROM ${tableName} WHERE ${deletePK} = ?`;
                await connection.execute(deleteQuery, [recordId]);
                result = { success: true };
                break;
                
            default:
                throw new Error('Невідома дія');
        }
        
        await connection.end();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(5000, () => console.log('Backend running on http://127.0.0.1:5000'));