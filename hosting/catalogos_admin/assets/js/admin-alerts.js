(function () {
  "use strict";

  const script = document.currentScript;
  const latestUrl = script?.dataset.latestUrl || "api/orders_latest.php";
  const pushKeyUrl = script?.dataset.pushKeyUrl || "api/push_public_key.php";
  const pushSubscribeUrl = script?.dataset.pushSubscribeUrl || "api/push_subscribe.php";
  const ordersUrl = script?.dataset.ordersUrl || "pedidos.php";
  const swUrl = script?.dataset.swUrl || "service-worker.js";
  const swScope = script?.dataset.swScope || "./";
  const storageKey = "rodeo_admin_latest_order_seen";
  const pollMs = 15000;
  let installPrompt = null;
  let toastTimer = null;
  let serviceWorkerRegistration = null;

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(swUrl, { scope: swScope })
        .then((registration) => {
          serviceWorkerRegistration = registration;
        })
        .catch(() => undefined);
    });
  }

  function setupNotificationButton() {
    const button = document.querySelector("[data-admin-enable-notifications]");
    if (!button || !("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) return;

    const refresh = () => {
      button.hidden = Notification.permission === "denied";
      button.textContent = Notification.permission === "granted" ? "Actualizar alertas" : "Activar alertas";
    };

    button.addEventListener("click", async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          await subscribeForPush();
        }
        refresh();
      } catch (error) {
        button.hidden = true;
      }
    });

    refresh();
  }

  async function subscribeForPush() {
    const keyResponse = await fetch(pushKeyUrl, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    if (!keyResponse.ok) return;
    const keyPayload = await keyResponse.json().catch(() => ({}));
    const publicKey = keyPayload.public_key || "";
    if (!publicKey) return;

    const registration = serviceWorkerRegistration || await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe().catch(() => undefined);
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey)
    });

    await fetch(pushSubscribeUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(subscription)
    }).catch(() => undefined);
  }

  function base64UrlToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      output[i] = raw.charCodeAt(i);
    }
    return output;
  }

  function setupInstallButton() {
    const button = document.querySelector("[data-admin-install-app]");
    if (!button) return;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      button.hidden = false;
      button.classList.add("is-visible");
    });

    button.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice.catch(() => undefined);
      installPrompt = null;
      button.hidden = true;
      button.classList.remove("is-visible");
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      button.hidden = true;
      button.classList.remove("is-visible");
    });
  }

  async function fetchLatestOrder() {
    const response = await fetch(latestUrl, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !payload.success || !payload.latest_order_id) return null;
    return payload;
  }

  function rememberInitialOrder(order) {
    if (!order?.latest_order_id) return;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, String(order.latest_order_id));
    }
  }

  function playTone() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  }

  function orderLabel(order) {
    const number = order.latest_order_number || `Pedido #${order.latest_order_id}`;
    const customer = order.company_name || order.customer_name || "Cliente sin nombre";
    const seller = order.seller_name ? `Vendedor: ${order.seller_name}` : "Vendedor no asignado";
    return { number, customer, seller };
  }

  function showToast(order) {
    const existing = document.querySelector(".admin-order-toast");
    if (existing) existing.remove();

    const labels = orderLabel(order);
    const toast = document.createElement("aside");
    toast.className = "admin-order-toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <button class="admin-order-toast__close" type="button" aria-label="Cerrar alerta">x</button>
      <div class="admin-order-toast__eyebrow">Nuevo pedido recibido</div>
      <strong>${escapeHtml(labels.number)}</strong>
      <span>${escapeHtml(labels.customer)}</span>
      <small>${escapeHtml(labels.seller)}</small>
      <a class="button" href="${ordersUrl}?id=${encodeURIComponent(order.latest_order_id)}">Ver pedido</a>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    toast.querySelector(".admin-order-toast__close")?.addEventListener("click", () => toast.remove());
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 18000);
  }

  async function showBrowserNotification(order) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const labels = orderLabel(order);
    const notificationOptions = {
      body: `${labels.customer}\n${labels.seller}`,
      icon: "assets/logo-rodeo-azul.png",
      badge: "assets/logo-rodeo-azul.png",
      tag: `rodeo-order-${order.latest_order_id}`,
      renotify: true,
      data: {
        url: `${ordersUrl}?id=${encodeURIComponent(order.latest_order_id)}`
      }
    };

    try {
      const registration = serviceWorkerRegistration || await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(`Nuevo pedido ${labels.number}`, notificationOptions);
        return;
      }
    } catch (error) {
      // Si el service worker no esta listo, intenta una notificacion normal.
    }

    try {
      new Notification(`Nuevo pedido ${labels.number}`, notificationOptions);
    } catch (error) {
      // Silencioso para no afectar el panel.
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  async function checkOrders(isInitial = false) {
    try {
      const order = await fetchLatestOrder();
      if (!order) return;
      if (isInitial) {
        rememberInitialOrder(order);
        return;
      }
      const latestId = String(order.latest_order_id);
      const seenId = localStorage.getItem(storageKey);
      if (seenId && Number(latestId) > Number(seenId)) {
        localStorage.setItem(storageKey, latestId);
        showToast(order);
        showBrowserNotification(order);
        playTone();
        if (navigator.vibrate) navigator.vibrate([160, 80, 160]);
        return;
      }
      if (!seenId) {
        localStorage.setItem(storageKey, latestId);
      }
    } catch (error) {
      // Silencioso para no interrumpir el admin si la red esta lenta.
    }
  }

  registerServiceWorker();
  setupInstallButton();
  setupNotificationButton();
  checkOrders(true).then(() => {
    window.setInterval(() => checkOrders(false), pollMs);
  });
}());
