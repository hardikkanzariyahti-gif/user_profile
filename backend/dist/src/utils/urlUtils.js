"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUploadUrl = buildUploadUrl;
const constants_1 = require("../config/constants");
/**
 * Builds a public URL for an uploaded file.
 */
function buildUploadUrl(filename) {
    return `${constants_1.APP_BASE_URL}/uploads/${filename}`;
}
//# sourceMappingURL=urlUtils.js.map