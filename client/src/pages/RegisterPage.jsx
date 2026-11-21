import { Link, useLocation } from 'react-router';
import AuthLayout from '@/components/AuthLayout.jsx';
import Button from '@/components/ui/Button.jsx';
import FormError from '@/components/FormError.jsx';
import FormField from '@/components/ui/FormField.jsx';
import { useApiForm } from '@/hooks/useApiForm.js';
import { useAuthStore } from '@/store/authStore.js';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const location = useLocation();
  // "Settings" in the ghost note: GuestRoute sends the new account there right after signup.
  const settingsAfterSignup = location.state?.from?.pathname === '/settings';
  // On success the store flips to "authenticated" and GuestRoute redirects.
  const { values, fieldErrors, formError, submitting, handleChange, handleSubmit } = useApiForm(
    { username: '', email: '', password: '' },
    register,
  );

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Pick a name your opponents will remember."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormError>{formError}</FormError>
        <FormField
          label="Username"
          name="username"
          autoComplete="username"
          autoFocus
          hint="3–20 characters: letters, numbers and underscores."
          value={values.username}
          onChange={handleChange}
          error={fieldErrors.username}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange}
          error={fieldErrors.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.password}
          onChange={handleChange}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-xs leading-relaxed text-ink-subtle" data-testid="ghost-note">
          Your ranked runs may be replayed as ghosts for other players (your username and progress,
          never your code). You can turn this off anytime in{' '}
          <Link
            to="/register"
            replace
            state={{ ...location.state, from: { pathname: '/settings' } }}
            className="font-medium text-emerald-400 underline-offset-2 hover:underline"
          >
            Settings
          </Link>
          .
          {settingsAfterSignup && (
            <span className="mt-1 block text-emerald-300" role="status">
              Settings will open right after you create your account.
            </span>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
