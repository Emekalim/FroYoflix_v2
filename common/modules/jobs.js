import { IPC } from '@/modules/bridge.js';
import { writable } from 'simple-store-svelte';
import { toast } from 'svelte-sonner';

// Active repairs (in-progress)
export const activeRepairs = writable([]);

// Queued repairs (waiting for a slot)
export const queuedRepairs = writable([]);

// Completed repairs (success) - session memory only
export const completedRepairs = writable([]);

// Failed repairs - maps hash to error info
export const repairErrors = writable({});

// Size in bytes of the froyo-repair persistent cache
export const repairCacheSize = writable(0);

let pollInterval = null;

// Initialize the store from the backend when the app loads
export async function initializeJobsStore() {
    try {
        const initialRepairs = await IPC.invoke('get-active-repairs');
        if (Array.isArray(initialRepairs)) {
            categorizeRepairs(initialRepairs);
        }

        const size = await IPC.invoke('get-repair-cache-size');
        repairCacheSize.value = size || 0;

        // Set up repair-progress listener and polling
        setupRepairProgressListener();
        startRepairPolling();
    } catch (e) {
        console.error('[JobsStore] Failed to initialize:', e);
        toast.error('Failed to load repair jobs', { description: e.message });
    }
}

function setupRepairProgressListener() {
    try {
        const { ipcRenderer } = window.require('electron');
        console.log('[JobsStore] Setting up ipcRenderer listener for repair-progress');
        ipcRenderer.on('repair-progress', (event, repairs) => {
            console.log('[JobsStore] Received repair-progress via event:', repairs);
            if (Array.isArray(repairs)) {
                categorizeRepairs(repairs);
            } else {
                console.warn('[JobsStore] repair-progress is not an array:', repairs);
            }
        });
    } catch (e) {
        console.error('[JobsStore] Failed to set up repair-progress listener:', e);
    }
}

function startRepairPolling() {
    // Also poll for repairs every 500ms as a fallback
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const repairs = await IPC.invoke('get-active-repairs');
            if (Array.isArray(repairs)) {
                categorizeRepairs(repairs);
            }
        } catch (e) {
            // Silent fail for polling
        }
    }, 500);
}

// Categorize repairs into active, queued, completed, and errors
function categorizeRepairs(repairs) {
    const active = [];
    const queued = [];
    const errors = {};

    repairs.forEach(repair => {
        if (repair.status === 'error') {
            errors[repair.id] = {
                error: repair.error || 'Unknown error',
                timestamp: Date.now()
            };
        } else if (repair.status === 'queued') {
            queued.push(repair);
        } else if (repair.status === 'complete') {
            // Don't show completed, they disappear after 2 seconds on backend
        } else {
            active.push(repair);
        }
    });

    activeRepairs.value = active;
    queuedRepairs.value = queued;
    repairErrors.value = errors;
}

// Function to trigger a cache refresh manually (after clear button clicked)
export async function refreshRepairCacheSize() {
    try {
        const size = await IPC.invoke('get-repair-cache-size');
        repairCacheSize.value = size || 0;
        return size;
    } catch (e) {
        console.error('[JobsStore] Failed to fetch cache size:', e);
        return 0;
    }
}

export async function clearRepairCache() {
    try {
        const response = await IPC.invoke('clear-repair-cache');
        if (response && response.success) {
            await refreshRepairCacheSize();
            return { success: true, count: response.clearedCount };
        }
        return { success: false, error: response?.error || 'Unknown error' };
    } catch (e) {
        console.error('[JobsStore] Failed to clear cache:', e);
        return { success: false, error: e.message };
    }
}

// Cancel a repair (queued or in-progress)
export async function cancelRepair(hash) {
    try {
        const response = await IPC.invoke('cancel-repair', hash);
        if (response?.success) {
            // Remove from stores
            activeRepairs.value = activeRepairs.value.filter(r => r.id !== hash);
            queuedRepairs.value = queuedRepairs.value.filter(r => r.id !== hash);
            return { success: true };
        }
        return { success: false, error: response?.error || 'Unknown error' };
    } catch (e) {
        console.error('[JobsStore] Failed to cancel repair:', e);
        return { success: false, error: e.message };
    }
}

