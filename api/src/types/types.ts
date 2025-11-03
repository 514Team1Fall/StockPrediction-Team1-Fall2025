declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
                notificationEnabled: boolean;
                createdAt: Date;
                updatedAt: Date | null;
            };
        }
    }
}