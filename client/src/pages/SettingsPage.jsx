import { useId, useState } from 'react';
import FormError from '@/components/FormError.jsx';
import Button from '@/components/ui/Button.jsx';
import Card from '@/components/ui/Card.jsx';
import FormField from '@/components/ui/FormField.jsx';
import Modal from '@/components/ui/Modal.jsx';
import Select from '@/components/ui/Select.jsx';
import { useApiForm } from '@/hooks/useApiForm.js';
import { LANGUAGES } from '@/lib/verdicts.js';
import { useAuthStore } from '@/store/authStore.js';

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l.id, label: l.label }));

function Section({ title, description, children, danger }) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} className={danger ? 'border-red-500/25' : ''}>
      <div className="mb-5 space-y-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

function PreferencesForm() {
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const selectId = useId();
  const [language, setLanguage] = useState(user.preferredLanguage);
  const [status, setStatus] = useState({ saving: false, message: null, error: null });

  async function save(event) {
    event.preventDefault();
    setStatus({ saving: true, message: null, error: null });
    try {
      await updatePreferences({ preferredLanguage: language });
      setStatus({ saving: false, message: 'Preferences saved.', error: null });
    } catch (err) {
      setStatus({ saving: false, message: null, error: err.message });
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={selectId} className="block text-sm font-medium text-zinc-300">
          Default language
        </label>
        <Select
          id={selectId}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          options={LANGUAGE_OPTIONS}
          className="max-w-xs"
          data-testid="preferred-language"
        />
        <p className="text-xs text-ink-subtle">
          Used by the editor in practice and duels. You can still switch any time.
        </p>
      </div>
      <FormError tone="success">{status.message}</FormError>
      <FormError>{status.error}</FormError>
      <Button type="submit" loading={status.saving} disabled={language === user.preferredLanguage}>
        Save preferences
      </Button>
    </form>
  );
}

/** "Allow my ranked runs to be used as ghosts" (saved right away). */
function GhostToggle() {
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const id = useId();
  const [status, setStatus] = useState({ saving: false, message: null, error: null });

  async function toggle(event) {
    const allowGhosts = event.target.checked;
    setStatus({ saving: true, message: null, error: null });
    try {
      await updatePreferences({ allowGhosts });
      setStatus({
        saving: false,
        message: allowGhosts
          ? 'Your ranked runs can be replayed as ghosts.'
          : 'Your runs will no longer be used as ghosts.',
        error: null,
      });
    } catch (err) {
      setStatus({ saving: false, message: null, error: err.message });
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={user.allowGhosts !== false}
          onChange={toggle}
          disabled={status.saving}
          className="mt-0.5 size-5 shrink-0 accent-emerald-400"
          data-testid="allow-ghosts"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-200">
            Allow my ranked runs to be used as ghosts
          </span>
          <span className="block text-xs text-ink-subtle">
            Other players may race a replay of your past ranked runs: your username, rating at the
            time and progress (tests passed or score, at the same times). Never your code. Private
            matches are never used.
          </span>
        </span>
      </label>
      <FormError tone="success">{status.message}</FormError>
      <FormError>{status.error}</FormError>
    </div>
  );
}

function PasswordForm({ onChanged }) {
  const changePassword = useAuthStore((s) => s.changePassword);
  const { values, fieldErrors, formError, submitting, handleChange, handleSubmit } = useApiForm(
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    async ({ currentPassword, newPassword, confirmPassword }) => {
      if (newPassword !== confirmPassword) {
        throw Object.assign(new Error("Passwords don't match"), {
          details: { confirmPassword: ["Passwords don't match"] },
        });
      }
      await changePassword({ currentPassword, newPassword });
      onChanged();
    },
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormError>{formError}</FormError>
      <FormField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={handleChange}
        error={fieldErrors.currentPassword}
      />
      <FormField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        value={values.newPassword}
        onChange={handleChange}
        error={fieldErrors.newPassword}
      />
      <FormField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={handleChange}
        error={fieldErrors.confirmPassword}
      />
      <Button type="submit" loading={submitting}>
        Change password
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const logoutEverywhere = useAuthStore((s) => s.logoutEverywhere);
  const [passwordFormKey, setPasswordFormKey] = useState(0);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  async function logoutAll() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutEverywhere(); // status → guest: the route guard sends us to /login
    } catch (err) {
      setLogoutError(err.message);
      setLoggingOut(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:py-12">
      <header className="space-y-1">
        <p className="eyebrow">Account</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
      </header>

      <Section
        title="Preferences"
        description="How the app behaves for your account, on every device."
      >
        <PreferencesForm />
      </Section>

      <Section
        title="Ghost replays"
        description="Ghost duels replay real players' past ranked runs. You decide whether yours can be used."
      >
        <GhostToggle />
      </Section>

      <Section
        title="Change password"
        description="You stay logged in here. Every other device is logged out."
      >
        <FormError tone="success">
          {passwordChanged && 'Password changed. Your other devices were logged out.'}
        </FormError>
        <div className={passwordChanged ? 'mt-4' : ''}>
          <PasswordForm
            key={passwordFormKey}
            onChanged={() => {
              setPasswordChanged(true);
              setPasswordFormKey((k) => k + 1); // clears the fields
            }}
          />
        </div>
      </Section>

      <Section
        title="Sessions"
        description="Lost a device or used a shared computer? End every session at once, including this one."
        danger
      >
        <FormError>{logoutError}</FormError>
        <Button
          variant="danger-outline"
          onClick={() => setConfirmLogoutAll(true)}
          className={logoutError ? 'mt-4' : ''}
        >
          Log out of all devices
        </Button>
      </Section>

      <Modal
        open={confirmLogoutAll}
        title="Log out of all devices?"
        onClose={() => setConfirmLogoutAll(false)}
        tone="danger"
      >
        <p className="text-sm text-zinc-300">
          Every session ends immediately, including this one. Live matches on other devices will
          count as disconnected.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmLogoutAll(false)} data-autofocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={logoutAll} loading={loggingOut}>
            Log out everywhere
          </Button>
        </div>
      </Modal>
    </main>
  );
}
