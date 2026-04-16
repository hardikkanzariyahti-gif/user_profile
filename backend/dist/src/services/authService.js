"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const userValidators_1 = require("../validators/userValidators");
const serializers_1 = require("../utils/serializers");
const httpError_1 = __importDefault(require("../utils/httpError"));
const authService = {
    async login(body) {
        const { email, password } = (0, userValidators_1.validateLoginInput)(body);
        const user = await userRepository_1.default.findByEmail(email);
        if (!user || user.password !== password) {
            throw (0, httpError_1.default)(401, 'Invalid email or password');
        }
        return {
            message: 'Login successful',
            user: (0, serializers_1.toUserResponse)(user),
        };
    },
};
exports.default = authService;
//# sourceMappingURL=authService.js.map