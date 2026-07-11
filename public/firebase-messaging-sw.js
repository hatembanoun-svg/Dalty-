// ⚠️ هذا الملف الخاص بالـ Service Worker لإشعارات الخلفية
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// 🔐 نفس إعدادات مشروع Dalty الحقيقية الخاصة بك تماماً ليتطابق النظام
firebase.initializeApp({
  apiKey: "AIzaSyDkONiPRp4JBnGcuX9IQc15lcFVWKF9Vn4",
  authDomain: "dalty-d46da.firebaseapp.com",
  projectId: "dalty-d46da",
  storageBucket: "dalty-d46da.firebasestorage.app",
  messagingSenderId: "804075325308",
  appId: "1:804075325308:web:c455d97653a63d8aaf46f9"
});

const messaging = firebase.messaging();

// يُستدعى فقط عندما تكون الصفحة مغلقة أو بالخلفية
messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "🔔 تنبيه من العيادة";
    const options = {
        body: payload.notification?.body || "",
        icon: "https://cdn-icons-png.flaticon.com/512/3774/3774299.png",
        badge: "https://cdn-icons-png.flaticon.com/512/3774/3774299.png",
        vibrate: [200, 100, 200]
    };
    self.registration.showNotification(title, options);
});
