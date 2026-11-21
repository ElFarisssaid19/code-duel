import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button.jsx';
import Modal from '@/components/ui/Modal.jsx';
import Spinner from '@/components/ui/Spinner.jsx';
import { buttonClasses } from '@/components/ui/styles.js';
import { api } from '@/lib/api.js';

const cardPath = (shareId, format) => `/api/share/${shareId}/card.png?format=${format}`;

/**
 * Share a finished match: creates (or reuses) the player's share link, shows the card, and offers
 * the Web Share API (the PNG + the link: works on iPhone Safari), copy link, downloads (link
 * preview 1200×630 and story 1080×1920) and WhatsApp. `onRevoke` adds a "Revoke link" button.
 * Mount it only while open (its state starts fresh each time).
 */
export default function ShareModal({ open, matchId, onClose, onRevoke }) {
  const [share, setShare] = useState(null);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .post(`/matches/${matchId}/share`)
      .then(async ({ share: created }) => {
        if (cancelled) return;
        setShare(created);
        // Prefetch the card so navigator.share() can run right in the click handler (Safari
        // only allows it during the user gesture).
        const blob = await fetch(cardPath(created.shareId, 'og')).then((r) => r.blob());
        if (!cancelled) setFile(new File([blob], 'code-duel-result.png', { type: 'image/png' }));
      })
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [open, matchId]);

  if (!open) return null;
  const text = 'My Code Duel result';
  const canShareFile = file && navigator.canShare?.({ files: [file] });
  const canShare = Boolean(navigator.share);

  function nativeShare() {
    const data = canShareFile
      ? { files: [file], title: 'Code Duel', text, url: share.url }
      : { title: 'Code Duel', text, url: share.url };
    navigator.share(data).catch(() => {}); // dismissed: nothing to do
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await api.delete(`/matches/${matchId}/share`);
      setShare(null);
      onRevoke?.();
    } catch (err) {
      setError(err);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Modal open title="Share your result" onClose={onClose} size="lg">
      <div className="space-y-5" data-testid="share-modal">
        {error && <p className="text-sm text-red-300">{error.message}</p>}
        {!share && !error && (
          <div className="flex items-center gap-3 text-sm text-ink-muted" role="status">
            <Spinner className="size-4 text-accent" /> Creating your card…
          </div>
        )}
        {share && (
          <>
            <img
              src={cardPath(share.shareId, 'og')}
              width="1200"
              height="630"
              alt="Your result card"
              className="block h-auto w-full rounded-xl ring-1 ring-line-strong"
              data-testid="share-card"
            />
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas/60 p-1.5 pl-3">
              <span
                className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted"
                data-testid="share-url"
              >
                {share.url}
              </span>
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <Button onClick={nativeShare} data-autofocus>
                  Share…
                </Button>
              )}
              <a
                className={buttonClasses({ variant: 'secondary' })}
                href={`https://wa.me/?text=${encodeURIComponent(`${text} ${share.url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a
                className={buttonClasses({ variant: 'secondary' })}
                href={cardPath(share.shareId, 'og')}
                download={`code-duel-${share.shareId}-link.png`}
              >
                Download 1200×630
              </a>
              <a
                className={buttonClasses({ variant: 'secondary' })}
                href={cardPath(share.shareId, 'story')}
                download={`code-duel-${share.shareId}-story.png`}
              >
                Download story 1080×1920
              </a>
            </div>
            <p className="text-xs text-ink-subtle">
              Anyone with the link sees this card (no code, no tests). You can revoke it from the
              match details page.
            </p>
          </>
        )}
        <div className="flex justify-end gap-2">
          {share && onRevoke && (
            <Button variant="danger-outline" onClick={revoke} loading={revoking}>
              Revoke link
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
