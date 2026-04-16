"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authService_1 = __importDefault(require("../services/authService"));
const authController = {
    async login(req, res) {
        const result = await authService_1.default.login(req.body);
        res.json(result);
    },
};
exports.default = authController;
//# sourceMappingURL=authController.js.map