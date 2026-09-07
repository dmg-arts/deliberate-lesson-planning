/*
 * pwa.js — service worker registration and update prompt.
 *
 * Registration is best-effort: the app is fully functional without it, just
 * not offline. A waiting worker means a new version is ready, so we tell the
 * user rather than swapping the app out from under them mid-sentence.
 */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');

      const announce = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdate(registration);
          }
        });
      };

      if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration);
      announce(registration.installing);
      registration.addEventListener('updatefound', () => announce(registration.installing));
    } catch {
      /* Offline support unavailable; everything else still works. */
    }
  });
}

let reloading = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloading) return;
  reloading = true;
  location.reload();
});

function showUpdate(registration) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = 'A new version is ready. ';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Reload';
  button.addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
  toast.appendChild(button);
  toast.hidden = false;
}
