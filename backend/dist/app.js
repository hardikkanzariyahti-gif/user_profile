"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const routes_1 = __importDefault(require("./routes"));
const constants_1 = require("./config/constants");
const notFound_1 = __importDefault(require("./middlewares/notFound"));
const errorHandler_1 = __importDefault(require("./middlewares/errorHandler"));
try {
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === '@tensorflow/tfjs-node') {
            return require('@tensorflow/tfjs');
        }
        return originalLoad.call(this, request, parent, isMain);
    };
}
catch (err) {
    console.warn('AI Compatibility Hack: Could not patch tensorflow loader');
}
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(path.join(__dirname, '../uploads')));
app.get('/', (req, res) => {
    res.send(`Backend API is running at ${constants_1.APP_BASE_URL}`);
});
app.use('/api', routes_1.default);
app.use(notFound_1.default);
app.use(errorHandler_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map