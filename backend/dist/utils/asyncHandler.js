"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.default = asyncHandler;
//# sourceMappingURL=asyncHandler.js.map