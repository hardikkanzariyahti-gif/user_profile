"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const albumController_1 = __importDefault(require("../controllers/albumController"));
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const router = (0, express_1.Router)();
router.post('/', (0, asyncHandler_1.default)(albumController_1.default.create));
router.get('/', (0, asyncHandler_1.default)(albumController_1.default.list));
router.get('/:id', (0, asyncHandler_1.default)(albumController_1.default.getById));
router.get('/shared/:shareId', (0, asyncHandler_1.default)(albumController_1.default.getShared));
router.delete('/:id', (0, asyncHandler_1.default)(albumController_1.default.remove));
router.put('/:id', (0, asyncHandler_1.default)(albumController_1.default.update));
exports.default = router;
//# sourceMappingURL=albumRoutes.js.map