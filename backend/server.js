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
    res.send('API працює. Доступні endpoints: /api/tables, /api/table-structure/:name, /api/table-data/:name');
});

app.get('/api/tables', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [tableRows] = await connection.execute('SHOW TABLES');
        const tables = tableRows.map(row => Object.values(row)[0]);
        await connection.end();
        res.json(tables);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/table-structure/:name', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const tableName = req.params.name;
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        await connection.end();
        res.json(columns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/table-data/:name', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const tableName = req.params.name;
        const [data] = await connection.execute(`SELECT * FROM ${tableName}`);
        await connection.end();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/table-data/:name', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const tableName = req.params.name;
        const data = req.body;
        
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
        const [result] = await connection.execute(query, values);
        
        await connection.end();
        res.json({ success: true, insertId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/table-data/:name/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const tableName = req.params.name;
        const id = req.params.id;
        const data = req.body;

        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        const primaryKey = columns.find(col => col.Key === 'PRI')?.Field;
        
        if (!primaryKey) {
            throw new Error('Не знайдено первинний ключ в таблиці');
        }
        
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];
        
        const query = `UPDATE ${tableName} SET ${setClause} WHERE ${primaryKey} = ?`;
        await connection.execute(query, values);
        
        await connection.end();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/table-data/:name/:id', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const tableName = req.params.name;
        const id = req.params.id;

        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        const primaryKey = columns.find(col => col.Key === 'PRI')?.Field;
        
        if (!primaryKey) {
            throw new Error('Не знайдено первинний ключ в таблиці');
        }
        
        const query = `DELETE FROM ${tableName} WHERE ${primaryKey} = ?`;
        await connection.execute(query, [id]);
        
        await connection.end();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(5000, () => console.log('Backend running on http://127.0.0.1:5000'));