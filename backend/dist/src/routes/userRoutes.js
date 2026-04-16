"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = __importDefault(require("../controllers/userController"));
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const upload_1 = __importDefault(require("../config/upload"));
const router = (0, express_1.Router)();
router.post('/', (0, asyncHandler_1.default)(userController_1.default.create));
router.get('/', (0, asyncHandler_1.default)(userController_1.default.list));
router.get('/:id', (0, asyncHandler_1.default)(userController_1.default.getById));
router.put('/:id', upload_1.default.single('profilePicture'), (0, asyncHandler_1.default)(userController_1.default.update));
router.delete('/:id', (0, asyncHandler_1.default)(userController_1.default.remove));
exports.default = router;
//# sourceMappingURL=userRoutes.js.map