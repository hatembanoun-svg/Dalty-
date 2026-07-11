import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getMessaging, isSupported } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js";

// 🔐 إعدادات مشروع Dalty الحقيقية الخاصة بك
export const firebaseConfig = {
  apiKey: "AIzaSyDkONiPRp4JBnGcuX9IQc15lcFVWKF9Vn4",
  authDomain: "dalty-d46da.firebaseapp.com",
  projectId: "dalty-d46da",
  storageBucket: "dalty-d46da.firebasestorage.app",
  messagingSenderId: "804075325308",
  appId: "1:804075325308:web:c455d97653a63d8aaf46f9"
};

// 🔑 مفتاح الإشعارات اللاسلكية الخاص بعيادتك
export const VAPID_KEY = "BNYdzFXqhysFrmqmIL7qgqpQpZT7xYZ5TPhrLg0hXV_Z-3BfZtAE4rpwH8O1wEXDvbjRNNlJNMKPL4Qe3vQbCXQ";

export const CLINIC_ID = "default";

// تهيئة خدمات Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functionsInstance = getFunctions(app);

export async function getMessagingIfSupported() {
    try {
        const supported = await isSupported();
        if (!supported) return null;
        return getMessaging(app);
    } catch (e) {
        console.warn("FCM غير مدعوم في هذا المتصفح:", e);
        return null;
    }
}
