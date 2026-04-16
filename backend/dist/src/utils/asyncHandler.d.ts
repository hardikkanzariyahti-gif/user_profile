import { Request, Response, NextFunction } from 'express';
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;
declare function asyncHandler(fn: AsyncHandler): (req: Request, res: Response, next: NextFunction) => void;
export default asyncHandler;
//# sourceMappingURL=asyncHandler.d.ts.map