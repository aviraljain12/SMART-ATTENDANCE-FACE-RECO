export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

export function isValidEmployeeId(id) {
  return typeof id === 'string' && id.trim().length >= 2;
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}
