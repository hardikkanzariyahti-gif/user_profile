interface HttpError extends Error {
    statusCode: number;
    message: string;
}
declare function httpError(statusCode: number, message: string): HttpError;
export default httpError;
//# sourceMappingURL=httpError.d.ts.map