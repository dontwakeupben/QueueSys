// API base URL - uses env var in production, localhost in dev
const API_URL = import.meta.env.VITE_API_URL || '';

export async function fetchApi(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    return response.json();
}

export default API_URL;
