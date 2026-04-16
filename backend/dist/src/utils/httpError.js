"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.message = message;
    return error;
}
exports.default = httpError;
//# sourceMappingURL=httpError.js.map