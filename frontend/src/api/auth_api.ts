import { API_URL } from "@/assets/config";
import type { User } from "../../../api/src/db/schema";

export async function checkSession(): Promise<User | null> {

    const response = await fetch(`${API_URL}/api/auth/session`, {
        credentials: "include",
    });
    
    console.log('res data: ', response)
    
    if (!response.ok) {
        console.log("no active user session")
        return null;
    }

    const data: User = await response.json();
    console.log('session data:', data);

    return data

}

export async function logout(): Promise<void> {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
        credentials: "include",
        method: "POST"
    });

    if (!response.ok) throw Error(`logout failed, response stat: ${response.status}`)
}
