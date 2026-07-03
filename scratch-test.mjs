import fs from 'fs'

async function checkBackup() {
    const backupPath = 'scratch/db-backup-latest.json'
    if (!fs.existsSync(backupPath)) {
        console.log('Backup file not found at:', backupPath)
        return
    }

    const content = fs.readFileSync(backupPath, 'utf8')
    const backup = JSON.parse(content)
    console.log('Backup timestamp:', backup.timestamp)
    console.log('Keys in backup:', Object.keys(backup))
    
    if (backup.menus) console.log('Menus count:', backup.menus.length)
    if (backup.profiles) console.log('Profiles count:', backup.profiles.length)
    if (backup.customer_feedback) console.log('Feedback count:', backup.customer_feedback.length)
    if (backup.audit_logs) {
        console.log('Audit logs count:', backup.audit_logs.length)
        if (backup.audit_logs.length > 0) {
            console.log('Sample audit logs:')
            console.log(JSON.stringify(backup.audit_logs.slice(0, 5), null, 2))
        }
    }
}

checkBackup()
