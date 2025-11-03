import * as client from "openid-client";
/**
 * Configuration for the OpenID Connect client
 **/
export const clientConfig = {
    issuer: process.env.AUTH_ISSUER_URL!,
    audience: process.env.APP_URL!,
    client_id: process.env.AUTH_CLIENT_ID!,
    client_secret: process.env.AUTH_CLIENT_SECRET!,
    scope: "email openid profile",
    redirect_uri: `${process.env.APP_URL!}/api/auth/callback/`,
    post_logout_redirect_uri: `${process.env.APP_URL!}`,
    response_type: "code",
    grant_type: "authorization_code",
    post_login_route: `${process.env.APP_URL!}`,
    code_challenge_method: "S256",
};

export interface SessionData {
    user: {
        uuid: string;
        username: string;
        picture: string;
        permission: number;
    };
}

export const sessionOptions = {
    cookieName: "stocksession",
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
    },
    ttl: 60 * 60 * 24 * 7, // 1 week
    maxSessions: 5, // Maximum number of sessions per user. old sessions will be deleted
};

/**
 * Function to get the OpenID Connect client configuration from the issuer
 * @returns The OpenID Connect client configuration
 **/
export async function getClientConfig() {
    console.log(clientConfig.client_secret)
    return await client.discovery(
        new URL(clientConfig.issuer),
        clientConfig.client_id,
        clientConfig.client_secret,
    );
}
