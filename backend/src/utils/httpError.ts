interface HttpError extends Error {
  statusCode: number;
  message: string;
}

function httpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.message = message;
  return error;
}

export default httpError;
