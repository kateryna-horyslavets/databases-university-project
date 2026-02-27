const API_URL = 'http://127.0.0.1:5000/api/query';

let currentTable = '';
let currentOperation = '';
let tableStructure = [];
let tableData = [];

async function init() {
    await loadTables();
    setupEventListeners();
}

async function postRequest(action, params = {}) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...params })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Помилка сервера');
        }
        
        return await res.json();
    } catch (err) {
        throw err;
    }
}

async function loadTables() {
    try {
        const tables = await postRequest('getTables');
        const tableSelect = document.getElementById('tableSelect');
        tableSelect.innerHTML = '<option value="">-- Оберіть таблицю --</option>';
        
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            tableSelect.appendChild(option);
        });
    } catch (err) {
        showError('Помилка завантаження таблиць: ' + err.message);
    }
}

function setupEventListeners() {
    document.getElementById('tableSelect').addEventListener('change', handleTableChange);
    document.getElementById('operationSelect').addEventListener('change', handleOperationChange);
    document.getElementById('executeBtn').addEventListener('click', handleExecute);
}

async function handleTableChange(e) {
    currentTable = e.target.value;
    document.getElementById('operationSelect').value = '';
    currentOperation = '';
    clearAreas();
    
    if (currentTable) {
        await loadTableStructure();
    }
}

function handleOperationChange(e) {
    currentOperation = e.target.value;
    clearAreas();
}

async function loadTableStructure() {
    try {
        tableStructure = await postRequest('getStructure', { tableName: currentTable });
    } catch (err) {
        showError('Помилка завантаження структури: ' + err.message);
    }
}

async function loadTableData() {
    try {
        tableData = await postRequest('getData', { tableName: currentTable });
        return tableData;
    } catch (err) {
        showError('Помилка завантаження даних: ' + err.message);
        return [];
    }
}

async function handleExecute() {
    if (!currentTable) {
        showError('Оберіть таблицю!');
        return;
    }
    
    if (!currentOperation) {
        showError('Оберіть операцію!');
        return;
    }
    
    clearAreas();
    
    switch (currentOperation) {
        case 'select':
            await showSelectResults();
            break;
        case 'insert':
            showInsertForm();
            break;
        case 'update':
            await showUpdateForm();
            break;
        case 'delete':
            await showDeleteForm();
            break;
    }
}

async function showSelectResults() {
    const data = await loadTableData();
    const resultArea = document.getElementById('resultArea');
    
    if (data.length === 0) {
        resultArea.innerHTML = '<div class="info-message">Таблиця порожня</div>';
        return;
    }
    
    let html = `
        <div class="table-card">
            <div class="table-title">Результати: ${currentTable}</div>
            <div class="scroll-wrapper">
                <table>
                    <thead><tr>`;
    
    Object.keys(data[0]).forEach(key => {
        html += `<th>${key}</th>`;
    });
    html += `</tr></thead><tbody>`;
    
    data.forEach(row => {
        html += `<tr>`;
        Object.values(row).forEach(val => {
            html += `<td>${formatValue(val)}</td>`;
        });
        html += `</tr>`;
    });
    
    html += `</tbody></table></div></div>`;
    resultArea.innerHTML = html;
}

function showInsertForm() {
    const formArea = document.getElementById('formArea');
    
    let html = `
        <div class="form-card">
            <div class="form-title">Додати новий запис</div>
            <form id="insertForm" class="data-form">`;
    
    tableStructure.forEach(col => {
        if (col.Extra === 'auto_increment') return;
        
        const required = col.Null === 'NO' ? 'required' : '';
        const fieldType = getInputType(col.Type);
        
        html += `
            <div class="form-group">
                <label for="${col.Field}">${col.Field}:</label>
                <input 
                    type="${fieldType}" 
                    id="${col.Field}" 
                    name="${col.Field}" 
                    ${required}
                    placeholder="Введіть ${col.Field}">
            </div>`;
    });
    
    html += `
                <button type="submit" class="btn-submit">Додати запис</button>
            </form>
        </div>`;
    
    formArea.innerHTML = html;
    
    document.getElementById('insertForm').addEventListener('submit', handleInsert);
}

async function showUpdateForm() {
    const data = await loadTableData();
    
    if (data.length === 0) {
        showError('Таблиця порожня. Немає записів для оновлення.');
        return;
    }
    
    const primaryKey = tableStructure.find(col => col.Key === 'PRI')?.Field;
    
    const formArea = document.getElementById('formArea');
    
    let html = `
        <div class="form-card">
            <div class="form-title">Оновити запис</div>
            <div class="form-group">
                <label for="recordSelect">Оберіть запис для оновлення:</label>
                <select id="recordSelect" class="record-select">
                    <option value="">-- Оберіть запис --</option>`;
    
    data.forEach(row => {
        const displayText = Object.entries(row)
            .slice(0, 3)
            .map(([key, val]) => `${key}: ${formatValue(val)}`)
            .join(' | ');
        html += `<option value="${row[primaryKey]}">${displayText}</option>`;
    });
    
    html += `
                </select>
            </div>
            <div id="updateFormFields"></div>
        </div>`;
    
    formArea.innerHTML = html;
    
    document.getElementById('recordSelect').addEventListener('change', function(e) {
        if (e.target.value) {
            showUpdateFields(e.target.value, data);
        }
    });
}

function showUpdateFields(recordId, data) {
    const record = data.find(row => {
        const primaryKey = tableStructure.find(col => col.Key === 'PRI')?.Field;
        return row[primaryKey] == recordId;
    });
    
    const updateFormFields = document.getElementById('updateFormFields');
    
    let html = `<form id="updateForm" class="data-form">`;
    
    tableStructure.forEach(col => {
        const fieldType = getInputType(col.Type);
        const value = formatValueForInput(record[col.Field]);
        
        html += `
            <div class="form-group">
                <label for="${col.Field}">${col.Field}:</label>
                <input 
                    type="${fieldType}" 
                    id="${col.Field}" 
                    name="${col.Field}" 
                    value="${value}"
                    ${col.Key === 'PRI' ? 'readonly' : ''}>
            </div>`;
    });
    
    html += `
            <button type="submit" class="btn-submit">Оновити запис</button>
        </form>`;
    
    updateFormFields.innerHTML = html;
    
    document.getElementById('updateForm').addEventListener('submit', function(e) {
        handleUpdate(e, recordId);
    });
}

async function showDeleteForm() {
    const data = await loadTableData();
    
    if (data.length === 0) {
        showError('Таблиця порожня. Немає записів для видалення.');
        return;
    }
    
    const primaryKey = tableStructure.find(col => col.Key === 'PRI')?.Field;
    
    const formArea = document.getElementById('formArea');
    
    let html = `
        <div class="form-card">
            <div class="form-title">Видалити запис</div>
            <div class="form-group">
                <label for="deleteSelect">Оберіть запис для видалення:</label>
                <select id="deleteSelect" class="record-select">
                    <option value="">-- Оберіть запис --</option>`;
    
    data.forEach(row => {
        const displayText = Object.entries(row)
            .slice(0, 3)
            .map(([key, val]) => `${key}: ${formatValue(val)}`)
            .join(' | ');
        html += `<option value="${row[primaryKey]}">${displayText}</option>`;
    });
    
    html += `
                </select>
            </div>
            <button id="deleteBtn" class="btn-delete" disabled>Видалити запис</button>
        </div>`;
    
    formArea.innerHTML = html;
    
    const deleteSelect = document.getElementById('deleteSelect');
    const deleteBtn = document.getElementById('deleteBtn');
    
    deleteSelect.addEventListener('change', function() {
        deleteBtn.disabled = !this.value;
    });
    
    deleteBtn.addEventListener('click', function() {
        handleDelete(deleteSelect.value);
    });
}

async function handleInsert(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value || null;
    }
    
    try {
        await postRequest('insert', { tableName: currentTable, data });
        showSuccess('Запис успішно додано!');
        e.target.reset();
        
        if (document.getElementById('resultArea').innerHTML) {
            await showSelectResults();
        }
    } catch (err) {
        showError('Помилка додавання: ' + err.message);
    }
}

async function handleUpdate(e, recordId) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        const col = tableStructure.find(c => c.Field === key);
        if (col && col.Key !== 'PRI') {
            data[key] = value || null;
        }
    }
    
    try {
        await postRequest('update', { tableName: currentTable, data, recordId });
        showSuccess('Запис успішно оновлено!');
        
        if (document.getElementById('resultArea').innerHTML) {
            await showSelectResults();
        }
    } catch (err) {
        showError('Помилка оновлення: ' + err.message);
    }
}

async function handleDelete(recordId) {
    if (!confirm('Ви впевнені, що хочете видалити цей запис?')) {
        return;
    }
    
    try {
        await postRequest('delete', { tableName: currentTable, recordId });
        showSuccess('Запис успішно видалено!');
        
        await showDeleteForm();
        
        if (document.getElementById('resultArea').innerHTML) {
            await showSelectResults();
        }
    } catch (err) {
        showError('Помилка видалення: ' + err.message);
    }
}

function getInputType(sqlType) {
    if (sqlType.includes('int')) return 'number';
    if (sqlType.includes('decimal') || sqlType.includes('float')) return 'number';
    if (sqlType.includes('date')) return 'date';
    return 'text';
}

function formatValue(val) {
    if (val === null || val === undefined) {
        return '<span class="null-val">NULL</span>';
    }
    if (typeof val === 'string' && val.includes('T') && val.endsWith('Z')) {
        const date = new Date(val);
        if (!isNaN(date)) {
            return date.toLocaleDateString('uk-UA');
        }
    }
    return val;
}

function formatValueForInput(val) {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    if (typeof val === 'string' && val.includes('T')) {
        const date = new Date(val);
        if (!isNaN(date)) {
            return date.toISOString().split('T')[0];
        }
    }
    return val;
}

function showError(message) {
    const resultArea = document.getElementById('resultArea');
    resultArea.innerHTML = `<div class="error-message"> ${message}</div>`;
}

function showSuccess(message) {
    const resultArea = document.getElementById('resultArea');
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = ` ${message}`;
    resultArea.insertBefore(successDiv, resultArea.firstChild);
    
    setTimeout(() => successDiv.remove(), 3000);
}

function clearAreas() {
    document.getElementById('resultArea').innerHTML = '';
    document.getElementById('formArea').innerHTML = '';
}

init();