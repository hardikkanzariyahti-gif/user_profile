"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function notFound(req, res) {
    res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
}
exports.default = notFound;
//# sourceMappingURL=notFound.js.map