import { Request, Response, NextFunction } from 'express';
import JWT from 'jsonwebtoken';
import { config } from '@root/config';
import { NotAuthorizedError } from './error-handler';
import { AuthPayload } from '@auth/interfaces/auth.interface';

export class AuthMiddleware {
  public verifyUser(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void {
    const token = request.session?.jwt;
    if (!token) {
      throw new NotAuthorizedError(
        'Token is not available. Please log in again.',
      );
    }
    try {
      const payload: AuthPayload = JWT.verify(
        token,
        config.JWT_TOKEN!,
      ) as AuthPayload;
      request.currentUser = payload;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new NotAuthorizedError('Invalid token');
    }
    next();
  }

  public checkAuthentication(
    request: Request,
    _response: Response,
    next: NextFunction,
  ): void {
    if (!request.currentUser) {
      throw new NotAuthorizedError(
        'You must be logged in to access this route',
      );
    }
    next();
  }
}

export const authMiddleware = new AuthMiddleware();
