import mysql from 'mysql2/promise';
import formidable from 'formidable';
import fs from 'fs/promises';
import { Readable } from 'stream';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const form = formidable({
        keepExtensions: true,
        maxFileSize: 25 * 1024 * 1024, // 25MB limit (Discord's limit is usually 25MB)
    });

    try {
        const [fields, files] = await form.parse(req);
        
        // Flatten fields (formidable returns arrays)
        const data = {};
        for (const key in fields) {
            data[key] = fields[key][0];
        }

        const username = data.username || 'Unknown';
        const discord = data.discord || 'Unknown';
        const type = data['app-type'] || 'General';

        // 1. Send to Discord Webhook
        const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordForm = new FormData();
                
                const embed = {
                    title: `New ${type} Application`,
                    color: 0xFFA500,
                    fields: Object.entries(data).map(([key, value]) => ({
                        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                        value: value || 'N/A',
                        inline: false
                    })),
                    timestamp: new Date().toISOString()
                };

                discordForm.append('payload_json', JSON.stringify({ embeds: [embed] }));

                // Add files to Discord request
                for (const key in files) {
                    const fileArray = files[key];
                    for (let i = 0; i < fileArray.length; i++) {
                        const file = fileArray[i];
                        const fileContent = await fs.readFile(file.filepath);
                        const blob = new Blob([fileContent], { type: file.mimetype });
                        discordForm.append(`file${i}`, blob, file.originalFilename);
                    }
                }

                await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    body: discordForm
                });
            } catch (discordError) {
                console.error('Discord Webhook Error:', discordError);
            }
        }

        // 2. Save to MySQL
        let connection;
        try {
            if (process.env.MYSQL_HOST) {
                connection = await mysql.createConnection({
                    host: process.env.MYSQL_HOST,
                    user: process.env.MYSQL_USER,
                    password: process.env.MYSQL_PASSWORD,
                    database: process.env.MYSQL_DATABASE,
                    port: process.env.MYSQL_PORT || 3306,
                });

                await connection.execute(`
                    CREATE TABLE IF NOT EXISTS applications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        type VARCHAR(255) NOT NULL,
                        username VARCHAR(255) NOT NULL,
                        discord VARCHAR(255) NOT NULL,
                        form_data JSON NOT NULL,
                        has_files BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                await connection.execute(
                    'INSERT INTO applications (type, username, discord, form_data, has_files) VALUES (?, ?, ?, ?, ?)',
                    [type, username, discord, JSON.stringify(data), Object.keys(files).length > 0]
                );
            }
        } catch (dbError) {
            console.error('Database Error:', dbError);
        } finally {
            if (connection) await connection.end();
        }

        res.status(200).json({ message: 'Application submitted successfully' });

    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ 
            error: 'Failed to process application', 
            message: error.message 
        });
    }
}
