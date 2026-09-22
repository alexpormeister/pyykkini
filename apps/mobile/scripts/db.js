const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres.mgdvyfvcdivwzjxgrggv:yrvRa8aVY3Hkq0MO@aws-0-eu-north-1.pooler.supabase.com:5432/postgres';

async function runSql(sqlOrFile) {
    let sql = sqlOrFile;
    if (fs.existsSync(sqlOrFile)) {
        sql = fs.readFileSync(sqlOrFile, 'utf8');
    }

    sql = sql.replace(/^\uFEFF/, '');

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL database.');
        const res = await client.query(sql);
        console.log('SQL executed successfully!');
        if (Array.isArray(res)) {
            res.forEach((r, i) => {
                if (r.command) console.log(`Result ${i + 1}: ${r.command} (rowCount: ${r.rowCount})`);
            });
        } else if (res.command) {
            console.log(`Result: ${res.command} (rowCount: ${res.rowCount})`);
        }
        return res;
    } catch (err) {
        console.error('SQL Execution Error:', err);
        throw err;
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    const target = process.argv[2];
    if (!target) {
        console.log('Usage: node scripts/db.js <sql_file_or_query>');
        process.exit(1);
    }
    runSql(target).catch(() => process.exit(1));
}

module.exports = { runSql };
