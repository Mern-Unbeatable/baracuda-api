export class ResponseUtil {
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data,
    });
  }

  static error(res, message, statusCode = 400, details = null) {
    const response = {
      success: false,
      statusCode,
      error: message,
    };
    if (details) response.details = details;
    
    return res.status(statusCode).json(response);
  }
}
