"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateUserInput = validateCreateUserInput;
exports.validateUpdateUserInput = validateUpdateUserInput;
exports.validateLoginInput = validateLoginInput;
const httpError_1 = __importDefault(require("../utils/httpError"));
function assertRequiredString(value, fieldName) {
    if (!value || typeof value !== 'string' || !value.trim()) {
        throw (0, httpError_1.default)(400, `${fieldName} is required`);
    }
}
function assertEmail(email) {
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
        throw (0, httpError_1.default)(400, 'Email is invalid');
    }
}
function validateCreateUserInput(body) {
    const { name, email, password } = body;
    assertRequiredString(name, 'Name');
    assertRequiredString(email, 'Email');
    assertRequiredString(password, 'Password');
    assertEmail(email.trim());
    if (password.trim().length < 6) {
        throw (0, httpError_1.default)(400, 'Password must be at least 6 characters');
    }
    return {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
    };
}
function validateUpdateUserInput(body) {
    const updates = {};
    if (body.name !== undefined) {
        assertRequiredString(body.name, 'Name');
        updates.name = body.name.trim();
    }
    if (body.email !== undefined) {
        assertRequiredString(body.email, 'Email');
        assertEmail(body.email.trim());
        updates.email = body.email.trim().toLowerCase();
    }
    if (body.password !== undefined && body.password !== '') {
        if (body.password.length < 6) {
            throw (0, httpError_1.default)(400, 'Password must be at least 6 characters');
        }
        updates.password = body.password;
    }
    return updates;
}
function validateLoginInput(body) {
    const { email, password } = body;
    assertRequiredString(email, 'Email');
    assertRequiredString(password, 'Password');
    return {
        email: email.trim().toLowerCase(),
        password,
    };
}
//# sourceMappingURL=userValidators.js.map