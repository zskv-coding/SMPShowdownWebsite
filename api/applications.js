import mysql from 'mysql2/promise';
import formidable from 'formidable';
import fs from 'fs/promises';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    // 1. IMPROVED CORS HEADERS
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const form = formidable({
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024,
        allowEmptyFiles: true,
        minFileSize: 0
    });

    try {
        const [fields, files] = await form.parse(req);
        
        const data = {};
        for (const key in fields) {
            data[key] = fields[key][0];
        }

        const username = data.username || data.mc_name || 'Unknown';
        const discord = data.discord || data.discord_name || 'Unknown';
        const type = data['app-type'] || 'General';
        const formStructure = data.form_structure ? JSON.parse(data.form_structure) : null;

        // 2. DISCORD WEBHOOK
        const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordForm = new FormData();
                
                const formatValue = (val) => {
                    const str = String(val || 'N/A');
                    return str.length > 1020 ? str.substring(0, 1020) + '...' : str;
                };

                // Create Embeds based on Form Structure
                const embeds = [];
                
        // Header Embed
        const headerEmbed = {
            title: `📢 New ${type} Application`,
            description: `**From:** ${username} (${discord})\n**Time:** ${new Date().toLocaleString()}`,
            color: 0xFFA500,
        };

        if (data.drive_folder_url) {
            headerEmbed.description += `\n\n📁 **[View Uploaded Files in Google Drive](${data.drive_folder_url})**`;
        }

        embeds.push(headerEmbed);

                if (formStructure) {
                    formStructure.forEach(section => {
                        const fields = section.fields
                            .map(f => {
                                const answer = data[f.name];
                                if (!answer) return null;
                                return {
                                    name: f.label,
                                    value: formatValue(answer),
                                    inline: false
                                };
                            })
                            .filter(f => f !== null);

                        if (fields.length > 0) {
                            embeds.push({
                                title: section.title,
                                color: 0xFFA500,
                                fields: fields
                            });
                        }
                    });
                } else {
                    // Fallback to simple list if structure is missing
                    embeds.push({
                        title: "Application Details",
                        color: 0xFFA500,
                        fields: Object.entries(data)
                            .filter(([key]) => !['app-type', 'form_structure'].includes(key))
                            .map(([key, value]) => ({
                                name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                                value: formatValue(value),
                                inline: false
                            }))
                    });
                }

                discordForm.append('payload_json', JSON.stringify({ embeds }));

                // 3. ATTACH REMAINING BINARY FILES (if any)
                let fileIndex = 0;
                for (const key in files) {
                    const fileArray = Array.isArray(files[key]) ? files[key] : [files[key]];
                    for (const file of fileArray) {
                        // Only attach if it's a real file and not an empty placeholder
                        // (If it was uploaded to Drive, 'data[key]' contains the string note, 
                        // and 'files[key]' might still exist but shouldn't be attached if we want to save bandwidth)
                        const wasUploadedToDrive = typeof data[key] === 'string' && data[key].includes('UPLOADED TO DRIVE');
                        
                        if (file && file.filepath && file.size > 0 && !wasUploadedToDrive) {
                            const fileContent = await fs.readFile(file.filepath);
                            const blob = new Blob([fileContent], { type: file.mimetype });
                            discordForm.append(`file${fileIndex}`, blob, file.originalFilename || 'upload.png');
                            fileIndex++;
                        }
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

        // 3. Save to MySQL
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

        return res.status(200).json({ success: true, message: 'Application submitted successfully' });

    } catch (error) {
        console.error('Processing Error:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Failed to process application', 
            message: error.message 
        });
    }
}
