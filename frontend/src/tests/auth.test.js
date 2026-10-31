import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PASSWORD_RULES, isPasswordCompliant } from '../utils/passwordValidation.js';
import { PORTAL_CONFIG, ROLE_DESTINATIONS, ROUTES } from '../routes/routeConfig.js';

describe('Brightloop Phase 1: Authentication & Entry Flow Tests', () => {
  describe('Password Complexity Requirements (Playbook Rules)', () => {
    const [lengthRule, upperRule, lowerRule, specialRule] = PASSWORD_RULES;

    it('Rule 1: More than 8 characters (at least 9)', () => {
      assert.strictEqual(lengthRule.test('12345678'), false, '8 characters must fail');
      assert.strictEqual(lengthRule.test('123456789'), true, '9 characters must pass');
      assert.strictEqual(lengthRule.test('Short1!'), false, '7 characters must fail');
      assert.strictEqual(lengthRule.test('LongPassword123!'), true, '16 characters must pass');
    });

    it('Rule 2: At least one uppercase letter (A-Z)', () => {
      assert.strictEqual(upperRule.test('lowercaseonly1!'), false);
      assert.strictEqual(upperRule.test('Uppercase1!'), true);
      assert.strictEqual(upperRule.test('UPPERCASE1!'), true);
    });

    it('Rule 3: At least one lowercase letter (a-z)', () => {
      assert.strictEqual(lowerRule.test('UPPERCASEONLY1!'), false);
      assert.strictEqual(lowerRule.test('Uppercase1!'), true);
      assert.strictEqual(lowerRule.test('lowercase1!'), true);
    });

    it('Rule 4: At least one special character (!@#$%^&*...)', () => {
      assert.strictEqual(specialRule.test('NoSpecialChar123'), false);
      assert.strictEqual(specialRule.test('Special!123'), true);
      assert.strictEqual(specialRule.test('Special#123'), true);
      assert.strictEqual(specialRule.test('Special_123'), true);
      assert.strictEqual(specialRule.test('Special@123'), true);
    });

    it('isPasswordCompliant: requires ALL four rules simultaneously', () => {
      assert.strictEqual(isPasswordCompliant('Pass1!'), false, 'Fails on length < 9');
      assert.strictEqual(isPasswordCompliant('password123!'), false, 'Fails on uppercase missing');
      assert.strictEqual(isPasswordCompliant('PASSWORD123!'), false, 'Fails on lowercase missing');
      assert.strictEqual(isPasswordCompliant('Password123'), false, 'Fails on special char missing');
      assert.strictEqual(isPasswordCompliant('Password123!'), true, 'Satisfies all 4 criteria');
      assert.strictEqual(isPasswordCompliant('Secure#Loop2026'), true, 'Satisfies all 4 criteria');
    });
  });

  describe('Portal Configurations & Role Access Boundaries', () => {
    it('Customer Portal: allows only customer role', () => {
      const allowed = PORTAL_CONFIG.customer.allowedRoles;
      assert.deepStrictEqual(allowed, ['customer']);
      assert.strictEqual(allowed.includes('customer'), true);
      assert.strictEqual(allowed.includes('staff'), false);
      assert.strictEqual(allowed.includes('admin'), false);
    });

    it('Staff Workspace: allows staff and finance roles, rejects customer/admin', () => {
      const allowed = PORTAL_CONFIG.staff.allowedRoles;
      assert.strictEqual(allowed.includes('staff'), true);
      assert.strictEqual(allowed.includes('finance'), true);
      assert.strictEqual(allowed.includes('customer'), false);
      assert.strictEqual(allowed.includes('admin'), false);
    });

    it('Admin Console: allows only admin role, rejects customer/staff', () => {
      const allowed = PORTAL_CONFIG.admin.allowedRoles;
      assert.deepStrictEqual(allowed, ['admin']);
      assert.strictEqual(allowed.includes('admin'), true);
      assert.strictEqual(allowed.includes('customer'), false);
      assert.strictEqual(allowed.includes('staff'), false);
    });

    it('Role Destinations: maps roles to appropriate dashboards', () => {
      assert.strictEqual(ROLE_DESTINATIONS.customer, ROUTES.CUSTOMER_DASHBOARD);
      assert.strictEqual(ROLE_DESTINATIONS.staff, ROUTES.STAFF_DASHBOARD);
      assert.strictEqual(ROLE_DESTINATIONS.finance, ROUTES.STAFF_DASHBOARD);
      assert.strictEqual(ROLE_DESTINATIONS.admin, ROUTES.ADMIN_DASHBOARD);
    });
  });

  describe('Reset Password Token Extraction', () => {
    it('Parses token parameter correctly from URL search params', () => {
      const url = new URL('https://app.brightloop.io/reset-password?token=secure-token-abc-123');
      const token = url.searchParams.get('token');
      assert.strictEqual(token, 'secure-token-abc-123');
    });

    it('Handles missing token gracefully', () => {
      const url = new URL('https://app.brightloop.io/reset-password');
      const token = url.searchParams.get('token');
      assert.strictEqual(token, null);
    });
  });
});
