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
        const user = await userService_1.default.updateUser(req.params.id, req.body, req.files);
        res.json(user);
    },
    async remove(req, res) {
        const result = await userService_1.default.deleteUser(req.params.id);
        res.json(result);
    },
    async verifyQuality(req, res) {
        if (!req.file) {
            return res.status(400).json({ isValid: false, message: 'No image provided' });
        }
        const result = await userService_1.default.verifyFaceQuality(req.file);
        res.json(result);
    },
    async checkFrame(req, res) {
        if (!req.file)
            return res.status(400).json({ message: 'No frame' });
        if (!req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid frame payload',
            });
        }
        try {
            // Proxy to Python Lite check
            const formData = new FormData();
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
            formData.append('file', blob, 'frame.jpg');
            const angle = req.body.angle || req.query.angle || 'front';
            const pythonRes = await fetch(`http://localhost:8000/check_frame?angle=${encodeURIComponent(angle)}`, {
                method: 'POST',
                body: formData
            });
            if (!pythonRes.ok) {
                return res.status(pythonRes.status).json({
                    status: 'error',
                    message: 'AI Service error'
                });
            }
            const data = await pythonRes.json();
            res.json(data);
        }
        catch (err) {
            console.error('[checkFrame] Proxy error:', err.message);
            res.status(500).json({
                status: 'error',
                message: 'AI Service is currently unavailable'
            });
        }
    },
};
exports.default = userController;
//# sourceMappingURL=userController.js.map