import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

// Connection event handlers
socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error);
});

export default socket;
