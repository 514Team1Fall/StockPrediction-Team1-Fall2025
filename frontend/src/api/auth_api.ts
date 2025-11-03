import type { User } from "../../../src/db/schema";

const BACKEND_URL = (window as Window & typeof globalThis & { BACKEND_URL: string }).BACKEND_URL

export async function checkSession(): Promise<User | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
            credentials: "include",
        });
        console.log('res data: ', res)
        if (!res.ok) {
            return null;
        }

        const data: User = await res.json();
        console.log('session data:', data);

        return data
    } catch (error) {
        console.error("Session check error:", error);
        return null;
    }
}

export async function logout(): Promise<void> {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
        credentials: "include",
        method: "POST"
    });
}
