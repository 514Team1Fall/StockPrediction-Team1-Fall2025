import type { UserWatchlist } from "../../../api/src/db/schema";

const USER_API_ROUTE = '/api/users';
export interface WatchlistItem extends UserWatchlist {
    symbol: string,
    type: "stock" | "crypto";
}

export async function addToUserWatchlist(symbol: string, type?: "stock" | "crypto" ) {
    const response = await fetch(`${USER_API_ROUTE}/watchlist`, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        credentials: "include",
        body: JSON.stringify({  
            symbol,type,notificationEnabled: true
        })
    });

    if (!response.ok) throw new Error("fail to add to watchlist");

    return response.json();
}

export async function removeFromUserWatchlist(symbol: string) {
// frontend action --> make func to handle  endpoint call (Errors, and paramters if needed) --> insert necessary info for backend to do work
    const response = await fetch(`${USER_API_ROUTE}/watchlist/${symbol}`, {
        method: "DELETE",
        headers: {"Content-type": "application/json"},
        credentials: "include",
    });

    if (!response.ok) throw new Error("fail to remove from watchlist");

    return response.json();
}


export async function toggledNotifications(symbol: string, enabled: boolean, type: "stock" | "crypto") {
    const response = await fetch(`${USER_API_ROUTE}/watchlist/${symbol}/notifications`, {
        method: "PATCH",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify({ enabled, type }),
        credentials: "include",
    });
  
    if (!response.ok) throw new Error("failed to toggle notifications");
    
    return response.json();
}

/**
 * by default we're always marking an adding ticker as enabled so I will handle it as such since it's not included in response
 * @returns userwatchlist tickers
 */
export async function getUserWatchlist() {
    const response = await fetch(`${USER_API_ROUTE}/watchlist`, {
        credentials: "include",
    });

    if (!response.ok) throw new Error('failed to get user watchlist');
    const res = response.json();
    console.log("watchlist: ",res);
    return res;
}