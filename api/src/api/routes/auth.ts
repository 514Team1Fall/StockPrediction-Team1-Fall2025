import express, { type Request, type Response } from "express";

import * as client from 'openid-client'
import { clientConfig, getClientConfig, sessionOptions } from "../../lib/auth.js";
import { createSession, createUser, getSessionById, getUserByEmail } from "../../db/db_api.js";
import { randomUUID, randomBytes } from "crypto";
import { createSubscription } from "../../lib/sns.js";

export const authRouter = express.Router();

authRouter.get("/login", async (_req: Request, res: Response) => {
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const openIdClientConfig = await getClientConfig();
    const parameters: Record<string, string> = {
        redirect_uri: clientConfig.redirect_uri,
        scope: clientConfig.scope,
        code_challenge: codeChallenge,
        code_challenge_method: clientConfig.code_challenge_method,
    }

    let state!: string;
    if (!openIdClientConfig.serverMetadata().supportsPKCE()) {
        state = client.randomState();
        parameters.state = state;
    }

    const redirectTo = client.buildAuthorizationUrl(openIdClientConfig, parameters);

    // Store codeVerifier and state in session or database associated with the user
    res.cookie('code_verifier', codeVerifier, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
    if (state) {
        res.cookie('auth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
    }

    console.log("Redirecting to:", clientConfig.redirect_uri);

    res.redirect(redirectTo.toString());
});

authRouter.get("/callback", async (req: Request, res: Response) => {
    const authState = req.cookies['auth_state'];
    const codeVerifier = req.cookies['code_verifier'];

    if (!codeVerifier) {
        return res.status(400).send("Missing code verifier");
    }

    // Clean up cookies
    res.clearCookie('code_verifier');
    res.clearCookie('auth_state');

    const tokenSet = await getAuthorizationCode(req, codeVerifier, authState);

    const claims = tokenSet.claims();
    if (!claims?.email || typeof claims.email !== 'string') {
        return res.status(400).send("Email claim is missing in the token");
    }

    let dbUser = await getUserByEmail(claims.email);
    if (!dbUser) {
        const userId = randomUUID();
        dbUser = await createUser({
            userId,
            email: claims.email as string,
        })

        await createSubscription(claims.email as string, ['__NO_MATCH__']);
    }

    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionOptions.ttl * 1000); // 7 days

    await createSession(sessionToken, dbUser.userId, expiresAt);

    res.cookie(sessionOptions.cookieName, sessionToken, {
        httpOnly: true,
        secure: sessionOptions.cookieOptions.secure,
        maxAge: sessionOptions.ttl * 1000, // in milliseconds
        sameSite: 'lax',

    });
    return res.redirect(clientConfig.post_login_route);

});

authRouter.get("/session", async (req: Request, res: Response) => {
    const sessionToken = req.cookies[sessionOptions.cookieName];
    if (!sessionToken) {
        return res.status(401).json({ error: "No session" });
    }


    const session = await getSessionById(sessionToken);
    if (!session) {
        return res.status(401).json({ error: "Invalid session" });
    }

    if (session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Session expired" });
    }

    return res.json(session.user)
});

authRouter.post("/logout", async (req: Request, res: Response) => {
    res.clearCookie(sessionOptions.cookieName);
    // return res.redirect(clientConfig.post_logout_redirect_uri); Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource error so im just returning instead of redirecting
    return res.status(200).json({ success: true });
});


/**
 * Function to get the authorization code from the request
 * @param request The request object
 * @returns The token set
 **/
async function getAuthorizationCode(
    req: Request,
    codeVerifier?: string, state?: string,
) {
    const openIdClientConfig = await getClientConfig();

    // Get the current URL
    const host =
        req.get("x-forwarded-host") || req.get("host") || "localhost";
    const protocol = req.get("x-forwarded-proto") || process.env.NODE_ENV === "production"
        ? "https"
        : "http";
    const currentUrl = new URL(
        `${protocol}://${host}${req.originalUrl}`,
    );

    console.log("Current URL:", currentUrl.toString());

    try {
        const tokenSet = await client.authorizationCodeGrant(
            openIdClientConfig,
            currentUrl,
            {
                pkceCodeVerifier: codeVerifier!,
                expectedState: state!,
            },
        );
        return tokenSet;
    } catch (err: any) {
        if (err.response && err.body) {
            console.error("OAuth error response:", err.body);
        }
        console.error("Full error:", err);
        throw err;
    }
}

