import { Request, Response, NextFunction } from 'express';
interface HttpError extends Error {
    statusCode?: number;
}
declare function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction): void;
export default errorHandler;
//# sourceMappingURL=errorHandler.d.ts.map