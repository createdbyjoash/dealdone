/**
 * DealDone Notification Service
 * Handles real-time notifications and unread message badges
 */

// Initialize notification badge
async function initNotificationBadge() {
    const user = window.dealDone.auth.getUser();
    if (!user) return;

    const bellBtn = document.getElementById('notification-bell');
    if (!bellBtn) return;

    // Get initial unread count
    await updateUnreadBadge();

    // Subscribe to real-time message updates
    const channel = window.dealDone.db.subscribeToMessages(user.id, async (newMessage) => {
        // Update badge count
        await updateUnreadBadge();

        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            new Notification('New Message on DealDone', {
                body: newMessage.content.substring(0, 50) + '...',
                icon: '/favicon.ico'
            });
        }
    });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (channel) window.dealDone.db.unsubscribe(channel);
    });
}

// Update the unread message badge
async function updateUnreadBadge() {
    const user = window.dealDone.auth.getUser();
    if (!user) return;

    const { count } = await window.dealDone.db.getUnreadCount(user.id);

    const bellBtn = document.getElementById('notification-bell');
    if (!bellBtn) return;

    // Remove existing badge
    const existingBadge = bellBtn.querySelector('.notification-badge');
    if (existingBadge) existingBadge.remove();

    // Add badge if there are unread messages
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'notification-badge';
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.cssText = `
            position: absolute;
            top: -4px;
            right: -4px;
            background: var(--danger);
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 0.625rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        bellBtn.style.position = 'relative';
        bellBtn.appendChild(badge);
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Export functions
window.dealDoneNotifications = {
    init: initNotificationBadge,
    updateBadge: updateUnreadBadge,
    requestPermission: requestNotificationPermission
};
