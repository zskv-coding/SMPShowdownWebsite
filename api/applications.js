import mysql from 'mysql2/promise';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const data = req.body;
    const { username, discord } = data;
    const type = data['app-type'];

    // 1. Send to Discord Webhook
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    if (DISCORD_WEBHOOK_URL) {
        try {
            const embed = {
                title: `New ${type} Application`,
                color: 0xFFA500,
                fields: Object.entries(data).map(([key, value]) => ({
                    name: key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' '),
                    value: value || 'N/A',
                    inline: false
                })),
                timestamp: new Date().toISOString()
            };

            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });
        } catch (discordError) {
            console.error('Discord Webhook Error:', discordError);
        }
    }

    // 2. Save to MySQL (recommended for "file to pull from")
    let connection;
    try {
        if (!process.env.MYSQL_HOST) throw new Error('MYSQL_HOST not configured');
        
        connection = await mysql.createConnection({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT || 3306,
        });

        // Ensure table exists
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                discord VARCHAR(255) NOT NULL,
                form_data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(
            'INSERT INTO applications (type, username, discord, form_data) VALUES (?, ?, ?, ?)',
            [type, username, discord, JSON.stringify(data)]
        );

        res.status(200).json({ message: 'Application submitted successfully' });
    } catch (error) {
        console.error('Database Error:', error);
        // If DB fails but Discord worked, we might still want to report success to the user 
        // but here we report error if DB fails as requested "to pull from a file (DB)"
        res.status(500).json({ 
            error: 'Failed to save application', 
            message: error.message 
        });
    } finally {
        if (connection) await connection.end();
    }
}
