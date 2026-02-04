const validateEmail = (email) => {
  const errors = [];

  if (!email) {
    errors.push("Email is required");
    return errors;
  }

  const normalized = email.trim().toLowerCase();

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regex.test(normalized)) {
    errors.push("Invalid email format");
  }

  return errors;
};

module.exports = validateEmail;
