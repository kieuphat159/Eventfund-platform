export const dbErrorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Lỗi hệ thống, vui lòng thử lại sau.";

  // Duplicate key (unique index)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];

    statusCode = 400;
    message = `${field} '${value}' đã tồn tại.`;
  }

  // Validation error từ Mongoose
  else if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => err.message);

    statusCode = 400;
    message = errors.join(", ");
  }

  // Sai ObjectId
  else if (error.name === "CastError") {
    statusCode = 400;
    message = "ID không hợp lệ.";
  }

  console.error(error);

  return res.status(statusCode).json({
    success: false,
    message,
    stack: error.stack,
  });
};
