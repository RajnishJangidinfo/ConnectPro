import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}
export declare const authenticateJWT: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
