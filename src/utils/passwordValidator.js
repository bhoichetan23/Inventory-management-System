const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push("Password must have minimum 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must have at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must have at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must have at least one number");
  }

  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
    errors.push("Password must have at least one special character");
  }

  return errors;
};

module.exports = validatePassword;
