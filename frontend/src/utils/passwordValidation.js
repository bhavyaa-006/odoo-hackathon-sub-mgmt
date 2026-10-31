export const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'More than 8 characters (at least 9)',
    test: (pw) => (pw ? pw.length > 8 : false),
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter (A-Z)',
    test: (pw) => /[A-Z]/.test(pw || ''),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter (a-z)',
    test: (pw) => /[a-z]/.test(pw || ''),
  },
  {
    id: 'special',
    label: 'At least one special character (!@#$%^&*...)',
    test: (pw) => /[^A-Za-z0-9]/.test(pw || ''),
  },
];

export const isPasswordCompliant = (password) => {
  if (!password) return false;
  return PASSWORD_RULES.every((rule) => rule.test(password));
};
