export async function writeAuditLog(description: string) {
    try {
        const response = await fetch('/api/audit-logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description }),
        })
        if (!response.ok) {
            console.error('Failed to write audit log:', await response.text())
        }
    } catch (error) {
        console.error('Error writing audit log:', error)
    }
}
