self.addEventListener("push", function (event) {
  let data = { title: "Monitor Alert", body: "Status change detected" };

  try {
    data = event.data.json();
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/favicon.ico",
      badge: data.badge || "/favicon.ico",
      tag: "monitor-alert",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow("/dashboard"));
});
