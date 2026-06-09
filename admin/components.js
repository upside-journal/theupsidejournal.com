/* ═══════════════════════════════════════════════════
   MISSION CONTROL — Shared UI Components
   Reusable HTML generators and utilities.
   ═══════════════════════════════════════════════════ */

const UI = {
    // Toast notification
    toast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Loading spinner
    loading(text = 'Loading...') {
        return `<div class="page-loading"><div class="spinner"></div><p style="margin-top:12px">${text}</p></div>`;
    },

    // Empty state
    empty(icon, title, text) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-text">${text}</div>
            </div>`;
    },

    // Stat card
    statCard(label, value, change = null) {
        let changeHtml = '';
        if (change) {
            const cls = change.startsWith('+') ? 'up' : change.startsWith('-') ? 'down' : 'neutral';
            changeHtml = `<div class="stat-change ${cls}">${change}</div>`;
        }
        return `
            <div class="stat-card">
                <div class="stat-label">${label}</div>
                <div class="stat-value">${value}</div>
                ${changeHtml}
            </div>`;
    },

    // Card wrapper
    card(title, body, headerActions = '', footer = '') {
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">${title}</span>
                    <div style="display:flex;gap:6px">${headerActions}</div>
                </div>
                <div class="card-body">${body}</div>
                ${footer ? `<div class="card-footer">${footer}</div>` : ''}
            </div>`;
    },

    // Badge
    badge(text, color = 'slate') {
        return `<span class="badge badge-${color}">${text}</span>`;
    },

    // Button
    btn(text, cls = 'btn-secondary', attrs = '') {
        return `<button class="btn ${cls}" ${attrs}>${text}</button>`;
    },

    // Table
    table(headers, rows) {
        const ths = headers.map(h => `<th>${h}</th>`).join('');
        const trs = rows.map(row => {
            const tds = row.map(cell => `<td>${cell}</td>`).join('');
            return `<tr>${tds}</tr>`;
        }).join('');
        return `
            <table class="data-table">
                <thead><tr>${ths}</tr></thead>
                <tbody>${trs}</tbody>
            </table>`;
    },

    // Tab bar
    tabs(items, activeId) {
        return `<div class="tabs">${items.map(i =>
            `<div class="tab ${i.id === activeId ? 'active' : ''}" data-tab="${i.id}">${i.label}</div>`
        ).join('')}</div>`;
    },

    // Section header
    sectionHeader(title, subtitle = '', actions = '') {
        return `
            <div class="section-header">
                <div>
                    <div class="section-title">${title}</div>
                    ${subtitle ? `<div class="section-subtitle">${subtitle}</div>` : ''}
                </div>
                <div style="display:flex;gap:8px">${actions}</div>
            </div>`;
    },

    // Simple bar chart
    barChart(data, maxH = 120) {
        const max = Math.max(...data.map(d => d.value), 1);
        const bars = data.map(d => {
            const h = Math.max((d.value / max) * maxH, 4);
            return `<div class="bar-col" style="height:${h}px" title="${d.label}: ${d.value}">
                <span class="bar-label">${d.label}</span>
            </div>`;
        }).join('');
        return `<div class="bar-chart" style="height:${maxH + 24}px">${bars}</div>`;
    },

    // Escape HTML
    esc(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Format number
    num(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    },

    // Time ago
    timeAgo(dateStr) {
        const now = new Date();
        const d = new Date(dateStr);
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    },

    // Truncate text
    truncate(str, len = 60) {
        return str.length > len ? str.substring(0, len) + '...' : str;
    },
};
