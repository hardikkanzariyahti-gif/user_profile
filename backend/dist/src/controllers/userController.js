"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userService_1 = __importDefault(require("../services/userService"));
const userController = {
    async create(req, res) {
        const user = await userService_1.default.createUser(req.body);
        res.json(user);
    },
    async list(req, res) {
        const users = await userService_1.default.listUsers();
        res.json(users);
    },
    async getById(req, res) {
        const user = await userService_1.default.getUserById(req.params.id);
        res.json(user);
    },
    async update(req, res) {
        const user = await userService_1.default.updateUser(req.params.id, req.body, req.file);
        res.json(user);
    },
    async remove(req, res) {
        const result = await userService_1.default.deleteUser(req.params.id);
        res.json(result);
    },
};
exports.default = userController;
//# sourceMappingURL=userController.js.map